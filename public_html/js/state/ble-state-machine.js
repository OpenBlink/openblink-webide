/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * BLEStateMachine - Manages BLE connection state and lifecycle
 * All BLE state management is centralized here. BLEProtocol provides stateless protocol functions.
 */

const BLEStateMachine = (function () {
  // State machine implementation constants
  const MAX_RECONNECT_ATTEMPTS = 5;
  const INITIAL_RECONNECT_DELAY = 1000;
  const WRITE_TIMEOUT = 10000;
  const HEARTBEAT_INTERVAL = 3000;

  // Valid state transitions
  const VALID_TRANSITIONS = {
    DISCONNECTED: ["CONNECTING"],
    CONNECTING: ["CONNECTED", "DISCONNECTED"],
    CONNECTED: [
      "TRANSFERRING",
      "DISCONNECTING",
      "RECONNECTING",
      "DISCONNECTED",
    ],
    TRANSFERRING: ["CONNECTED", "DISCONNECTED", "RECONNECTING"],
    RECONNECTING: ["CONNECTED", "DISCONNECTED"],
    DISCONNECTING: ["DISCONNECTED"],
  };

  // Current state
  let state = "DISCONNECTED";
  let previousState = null;

  // Event bus reference
  let eventBus = null;

  // BLE resources (managed by state transitions)
  let connectedDevice = null;
  let programCharacteristic = null;
  let negotiatedMtuCharacteristic = null;
  let consoleCharacteristic = null;
  let negotiatedMTU = BLEProtocol.getDefaultMTU();

  // Reconnection state
  let reconnectAttempts = 0;
  let reconnectTimeoutId = null;
  let userInitiatedDisconnect = false;

  // Heartbeat
  let heartbeatTimer = null;

  // Transfer state
  let isTransferring = false;

  /**
   * Transition to a new state
   * @param {string} newState - Target state
   * @param {Object} payload - Optional payload for event
   */
  function transition(newState, payload) {
    if (state === newState) {
      return; // No-op transition
    }

    // Validate transition
    const allowedTransitions = VALID_TRANSITIONS[state] || [];
    if (!allowedTransitions.includes(newState)) {
      console.error(`Invalid state transition: ${state} -> ${newState}`);
      return;
    }

    previousState = state;
    state = newState;

    if (eventBus) {
      eventBus.emit("BLE:STATE_CHANGED", {
        from: previousState,
        to: newState,
        payload: payload,
      });
    }

    console.log(`BLE State: ${previousState} -> ${newState}`);
  }

  /**
   * Send heartbeat to keep connection alive
   */
  async function sendHeartbeat() {
    if (
      !negotiatedMtuCharacteristic ||
      isTransferring ||
      state !== "CONNECTED"
    ) {
      return;
    }

    try {
      await BLEProtocol.readHeartbeat(negotiatedMtuCharacteristic);
    } catch (error) {
      console.warn("Heartbeat failed:", error.message);
      // Don't disconnect on heartbeat failure
    }
  }

  /**
   * Start keep-alive heartbeat
   */
  function startHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
  }

  /**
   * Stop keep-alive heartbeat
   */
  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  /**
   * Cleanup all BLE resources and event listeners
   */
  function cleanupResources() {
    // Stop heartbeat
    stopHeartbeat();

    // Stop console notifications
    if (consoleCharacteristic) {
      BLEProtocol.stopConsoleNotifications(consoleCharacteristic);
      try {
        consoleCharacteristic.stopNotifications();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }

    // Remove disconnect listener
    if (connectedDevice) {
      connectedDevice.removeEventListener(
        "gattserverdisconnected",
        handleDisconnect,
      );
    }

    // Clear reconnect timeout
    if (reconnectTimeoutId) {
      clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = null;
    }

    // Reset state
    isTransferring = false;
    userInitiatedDisconnect = false;
    reconnectAttempts = 0;

    // Clear references
    connectedDevice = null;
    programCharacteristic = null;
    negotiatedMtuCharacteristic = null;
    consoleCharacteristic = null;
    negotiatedMTU = BLEProtocol.getDefaultMTU();
  }

  /**
   * Handle unexpected disconnect (not user-initiated)
   * @param {Event} event - gattserverdisconnected event
   */
  function handleDisconnect(event) {
    const device = event.target;

    if (userInitiatedDisconnect) {
      cleanupResources();
      transition("DISCONNECTED", { reason: "user" });
      if (eventBus) {
        eventBus.emit("BLE:DISCONNECTED", { reason: "user" });
      }
      return;
    }

    if (state === "TRANSFERRING") {
      // During transfer, try immediate reconnect
      transition("RECONNECTING", { attempt: 1 });
      attemptReconnect(device);
    } else if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      transition("RECONNECTING", { attempt: reconnectAttempts + 1 });
      attemptReconnect(device);
    } else {
      cleanupResources();
      transition("DISCONNECTED", { reason: "max_reconnects" });
      if (eventBus) {
        eventBus.emit("BLE:DISCONNECTED", { reason: "max_reconnects" });
        eventBus.emit("BLE:RECONNECT_FAILED", {
          attempts: MAX_RECONNECT_ATTEMPTS,
        });
      }
    }
  }

  /**
   * Attempt to reconnect to device
   * @param {BluetoothDevice} device - Device to reconnect to
   */
  async function attemptReconnect(device) {
    reconnectAttempts++;
    const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);

    if (eventBus) {
      eventBus.emit("BLE:RECONNECTING", {
        attempt: reconnectAttempts,
        maxAttempts: MAX_RECONNECT_ATTEMPTS,
        delay: delay,
      });
    }

    reconnectTimeoutId = setTimeout(async () => {
      if (userInitiatedDisconnect) {
        cleanupResources();
        transition("DISCONNECTED", { reason: "user_cancelled" });
        if (eventBus) {
          eventBus.emit("BLE:DISCONNECTED", { reason: "user_cancelled" });
        }
        return;
      }

      try {
        const result = await BLEProtocol.connectToDevice(device);

        // Store resources (only those we need for operations)
        connectedDevice = result.device;
        programCharacteristic = result.programCharacteristic;
        negotiatedMtuCharacteristic = result.negotiatedMtuCharacteristic;
        consoleCharacteristic = result.consoleCharacteristic;

        // Negotiate MTU
        negotiatedMTU = await BLEProtocol.negotiateMTU(
          programCharacteristic,
          negotiatedMtuCharacteristic,
        );

        // Setup console notifications
        await BLEProtocol.startConsoleNotifications(
          consoleCharacteristic,
          (message) => {
            if (eventBus) {
              eventBus.emit("BLE:CONSOLE_MESSAGE", { message: message });
            }
          },
        );

        // Add disconnect listener
        connectedDevice.addEventListener(
          "gattserverdisconnected",
          handleDisconnect,
        );

        // Start heartbeat
        startHeartbeat();

        reconnectAttempts = 0;
        reconnectTimeoutId = null;

        transition("CONNECTED", { deviceName: device.name });
        if (eventBus) {
          eventBus.emit("BLE:CONNECTED", { deviceName: device.name });
        }
      } catch (_error) {
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          attemptReconnect(device);
        } else {
          cleanupResources();
          transition("DISCONNECTED", { reason: "reconnect_failed" });
          if (eventBus) {
            eventBus.emit("BLE:DISCONNECTED", { reason: "reconnect_failed" });
            eventBus.emit("BLE:RECONNECT_FAILED", {
              attempts: MAX_RECONNECT_ATTEMPTS,
            });
          }
        }
      }
    }, delay);
  }

  return {
    /**
     * Initialize the state machine with EventBus
     * @param {Object} bus - EventBus instance
     */
    init: function (bus) {
      eventBus = bus;
    },

    /**
     * Get current state
     * @returns {string} Current state
     */
    getState: function () {
      return state;
    },

    /**
     * Check if connected
     * @returns {boolean}
     */
    isConnected: function () {
      return state === "CONNECTED";
    },

    /**
     * Check if transferring
     * @returns {boolean}
     */
    isTransferring: function () {
      return state === "TRANSFERRING";
    },

    /**
     * Check if transfer is possible
     * @returns {boolean}
     */
    canTransfer: function () {
      return state === "CONNECTED";
    },

    /**
     * Get negotiated MTU
     * @returns {number}
     */
    getNegotiatedMTU: function () {
      return negotiatedMTU;
    },

    /**
     * Connect to a BLE device
     */
    connect: async function () {
      if (state !== "DISCONNECTED") {
        return;
      }

      transition("CONNECTING");
      userInitiatedDisconnect = false;
      reconnectAttempts = 0;

      try {
        const device = await BLEProtocol.requestDevice();

        const result = await BLEProtocol.connectToDevice(device);

        // Store resources (only those we need for operations)
        connectedDevice = result.device;
        programCharacteristic = result.programCharacteristic;
        negotiatedMtuCharacteristic = result.negotiatedMtuCharacteristic;
        consoleCharacteristic = result.consoleCharacteristic;

        // Negotiate MTU
        negotiatedMTU = await BLEProtocol.negotiateMTU(
          programCharacteristic,
          negotiatedMtuCharacteristic,
        );

        // Setup console notifications
        await BLEProtocol.startConsoleNotifications(
          consoleCharacteristic,
          (message) => {
            if (eventBus) {
              eventBus.emit("BLE:CONSOLE_MESSAGE", { message: message });
            }
          },
        );

        // Add disconnect listener
        connectedDevice.addEventListener(
          "gattserverdisconnected",
          handleDisconnect,
        );

        // Start heartbeat
        startHeartbeat();

        transition("CONNECTED", { deviceName: device.name });
        if (eventBus) {
          eventBus.emit("BLE:CONNECTED", { deviceName: device.name });
        }
      } catch (error) {
        cleanupResources();
        transition("DISCONNECTED", { error: error });
        if (eventBus) {
          eventBus.emit("BLE:CONNECT_FAILED", { error: error });
        }
      }
    },

    /**
     * Disconnect from device
     */
    disconnect: function () {
      if (state === "DISCONNECTED" || state === "DISCONNECTING") {
        return;
      }

      userInitiatedDisconnect = true;
      reconnectAttempts = MAX_RECONNECT_ATTEMPTS;

      if (connectedDevice && BLEProtocol.isConnected(connectedDevice)) {
        transition("DISCONNECTING");
        BLEProtocol.disconnect(connectedDevice);
        // Note: actual cleanup happens in handleDisconnect or we do it here if already disconnected
        setTimeout(() => {
          if (state === "DISCONNECTING") {
            cleanupResources();
            transition("DISCONNECTED", { reason: "user" });
            if (eventBus) {
              eventBus.emit("BLE:DISCONNECTED", { reason: "user" });
            }
          }
        }, 100);
      } else {
        cleanupResources();
        transition("DISCONNECTED", { reason: "user" });
        if (eventBus) {
          eventBus.emit("BLE:DISCONNECTED", { reason: "user" });
        }
      }
    },

    /**
     * Send reset command
     */
    sendReset: async function () {
      if (state !== "CONNECTED" || !programCharacteristic) {
        throw new Error("Not connected");
      }

      const buffer = BLEProtocol.buildResetCommand();

      try {
        await BLEProtocol.writeWithTimeout(
          programCharacteristic,
          buffer,
          WRITE_TIMEOUT,
        );
        if (eventBus) {
          eventBus.emit("BLE:RESET_SENT", {});
        }
      } catch (error) {
        if (eventBus) {
          eventBus.emit("BLE:RESET_FAILED", { error: error });
        }
        throw error;
      }
    },

    /**
     * Send reload command
     */
    sendReload: async function () {
      if (state !== "CONNECTED" || !programCharacteristic) {
        throw new Error("Not connected");
      }

      const buffer = BLEProtocol.buildReloadCommand();

      try {
        await BLEProtocol.writeWithTimeout(
          programCharacteristic,
          buffer,
          WRITE_TIMEOUT,
        );
        if (eventBus) {
          eventBus.emit("BLE:RELOAD_SENT", {});
        }
      } catch (error) {
        if (eventBus) {
          eventBus.emit("BLE:RELOAD_FAILED", { error: error });
        }
        throw error;
      }
    },

    /**
     * Start firmware transfer
     * @param {Uint8Array} bytecode - Firmware bytecode
     * @param {number} slot - Target slot (1 or 2)
     * @param {Function} onProgress - Optional progress callback
     */
    startTransfer: async function (bytecode, slot, onProgress) {
      if (state !== "CONNECTED") {
        throw new Error("Not connected");
      }

      if (!programCharacteristic) {
        throw new Error("Program characteristic not available");
      }

      transition("TRANSFERRING");
      isTransferring = true;
      stopHeartbeat();

      if (eventBus) {
        eventBus.emit("BLE:TRANSFER_STARTED", {});
      }

      try {
        const contentLength = bytecode.length;
        const crc16 = crc16_reflect(0xd175, 0xffff, bytecode);
        const dataPayloadSize = negotiatedMTU - BLEProtocol.getDataHeaderSize();

        // Send data chunks
        for (
          let offset = 0;
          offset < contentLength;
          offset += dataPayloadSize
        ) {
          const chunkSize = Math.min(dataPayloadSize, contentLength - offset);
          const buffer = BLEProtocol.buildDataChunk(
            offset,
            chunkSize,
            bytecode,
          );

          await BLEProtocol.writeWithTimeout(
            programCharacteristic,
            buffer,
            WRITE_TIMEOUT,
          );

          if (onProgress) {
            onProgress(offset + chunkSize, contentLength);
          }

          if (eventBus) {
            eventBus.emit("BLE:TRANSFER_PROGRESS", {
              sent: offset + chunkSize,
              total: contentLength,
            });
          }
        }

        // Send program command
        const programBuffer = BLEProtocol.buildProgramCommand(
          contentLength,
          crc16,
          slot,
        );

        await BLEProtocol.writeWithTimeout(
          programCharacteristic,
          programBuffer,
          WRITE_TIMEOUT,
        );

        // Send reload
        await this.sendReload();

        isTransferring = false;
        transition("CONNECTED");

        if (eventBus) {
          eventBus.emit("BLE:TRANSFER_COMPLETE", {});
        }
      } catch (error) {
        isTransferring = false;

        // Check if we got disconnected during transfer
        if (!connectedDevice || !BLEProtocol.isConnected(connectedDevice)) {
          transition("DISCONNECTED", { reason: "transfer_error" });
          if (eventBus) {
            eventBus.emit("BLE:DISCONNECTED", { reason: "transfer_error" });
          }
        } else {
          transition("CONNECTED");
        }

        if (eventBus) {
          eventBus.emit("BLE:TRANSFER_FAILED", { error: error });
        }
        throw error;
      } finally {
        if (state === "CONNECTED") {
          startHeartbeat();
        }
      }
    },

    /**
     * Cleanup all resources (for page unload)
     */
    cleanup: function () {
      cleanupResources();
      if (state !== "DISCONNECTED") {
        transition("DISCONNECTED", { reason: "cleanup" });
      }
    },
  };
})();
