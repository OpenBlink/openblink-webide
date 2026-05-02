/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * BLEStateMachine - Facade managing BLE connection state and lifecycle.
 *
 * Delegates connection logic to BLEConnection, write serialization to
 * BLECommandQueue, and transfer loops to BLETransfer.
 * Retains: state + transitions, heartbeat, GATT-poll, reconnect scheduling.
 *
 * Public API (signatures unchanged):
 *   init(bus) / getState() / isConnected() / canTransfer() / getNegotiatedMTU()
 *   connect() / disconnect() / sendReset() / sendReload() / startTransfer() / cleanup()
 */
const BLEStateMachine = (function () {
  const log = Logger.scope("BLEStateMachine");

  // ── State ───────────────────────────────────────────────────────────────
  let state = BLEState.DISCONNECTED;
  let previousState = null;
  let eventBus = null;

  // ── BLE resources ───────────────────────────────────────────────────────
  let connectedDevice = null;
  let programCharacteristic = null;
  let negotiatedMtuCharacteristic = null;
  let consoleCharacteristic = null;
  let negotiatedMTU = Config.ble.defaultMTU;

  // ── Reconnect ───────────────────────────────────────────────────────────
  let reconnectAttempts = 0;
  let reconnectHandle = null;
  let userInitiatedDisconnect = false;
  let connectAbortController = null;

  // ── Heartbeat ───────────────────────────────────────────────────────────
  let heartbeatTimer = null;

  // ── GATT poller ─────────────────────────────────────────────────────────
  let pollTimer = null;

  // ── Cleanup guard ───────────────────────────────────────────────────────
  let cleanedUp = false;

  // ── Helpers ─────────────────────────────────────────────────────────────

  function _emit(event, payload) {
    if (eventBus) eventBus.emit(event, payload);
  }

  function transition(newState, payload) {
    if (state === newState) return;
    if (!isBLETransitionValid(state, newState)) {
      log.error(`Invalid transition: ${state} -> ${newState}`);
      return;
    }
    previousState = state;
    state = newState;
    log.info(`State: ${previousState} -> ${newState}`);
    _emit("BLE:STATE_CHANGED", { from: previousState, to: newState, payload });
  }

  // ── Heartbeat ────────────────────────────────────────────────────────────

  async function sendHeartbeat() {
    if (!negotiatedMtuCharacteristic || state !== BLEState.CONNECTED) return;
    try {
      await BLECommandQueue.enqueueRead(negotiatedMtuCharacteristic, {
        label: "heartbeat",
        timeout: Config.timeouts.bleRead,
      });
    } catch (err) {
      log.warn("Heartbeat failed:", err.message);
    }
  }

  function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(
      sendHeartbeat,
      Config.timeouts.bleHeartbeatInterval,
    );
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  // ── GATT state poller ────────────────────────────────────────────────────

  function startPoller() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (
        (state === BLEState.CONNECTED || state === BLEState.TRANSFERRING) &&
        connectedDevice &&
        connectedDevice.gatt &&
        !connectedDevice.gatt.connected
      ) {
        log.warn(
          "Poller detected GATT disconnected; triggering handleDisconnect",
        );
        handleDisconnect({ target: connectedDevice });
      }
    }, Config.timeouts.bleStatePollInterval);
  }

  function stopPoller() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // ── Resource cleanup ─────────────────────────────────────────────────────

  function cleanupResources() {
    if (cleanedUp) return;
    cleanedUp = true;

    stopHeartbeat();
    stopPoller();
    BLECommandQueue.clear({ reason: "cleanup" });

    if (reconnectHandle) {
      reconnectHandle.cancel();
      reconnectHandle = null;
    }

    if (connectedDevice) {
      connectedDevice.removeEventListener(
        "gattserverdisconnected",
        handleDisconnect,
      );
    }

    if (connectAbortController) {
      connectAbortController.abort();
      connectAbortController = null;
    }

    userInitiatedDisconnect = false;
    reconnectAttempts = 0;
    connectedDevice = null;
    programCharacteristic = null;
    negotiatedMtuCharacteristic = null;
    consoleCharacteristic = null;
    negotiatedMTU = Config.ble.defaultMTU;
  }

  function _resetCleanupGuard() {
    cleanedUp = false;
  }

  // ── Disconnect handler ───────────────────────────────────────────────────

  function handleDisconnect(event) {
    const device = event.target;

    if (userInitiatedDisconnect) {
      cleanupResources();
      transition(BLEState.DISCONNECTED, { reason: "user" });
      _emit("BLE:DISCONNECTED", { reason: "user" });
      return;
    }

    // Count reconnect attempts regardless of current state (fixes TRANSFERRING bug)
    if (reconnectAttempts < Config.retries.bleReconnectMaxAttempts) {
      reconnectAttempts++;
      transition(BLEState.RECONNECTING, {
        attempt: reconnectAttempts,
        maxAttempts: Config.retries.bleReconnectMaxAttempts,
      });
      _emit("BLE:RECONNECTING", {
        attempt: reconnectAttempts,
        maxAttempts: Config.retries.bleReconnectMaxAttempts,
      });
      _scheduleReconnect(device, reconnectAttempts);
    } else {
      cleanupResources();
      transition(BLEState.DISCONNECTED, { reason: "max_reconnects" });
      _emit("BLE:DISCONNECTED", { reason: "max_reconnects" });
      _emit("BLE:RECONNECT_FAILED", {
        attempts: Config.retries.bleReconnectMaxAttempts,
      });
    }
  }

  function _onConsoleMessage(message) {
    _emit("BLE:CONSOLE_MESSAGE", { message });
  }

  function _applyConnectionResult(result) {
    connectedDevice = result.device;
    programCharacteristic = result.programChar;
    negotiatedMtuCharacteristic = result.mtuChar;
    consoleCharacteristic = result.consoleChar;
    negotiatedMTU = result.mtu;
  }

  function _afterConnected(deviceName) {
    connectedDevice.addEventListener(
      "gattserverdisconnected",
      handleDisconnect,
    );
    startHeartbeat();
    startPoller();
    reconnectAttempts = 0;
    _resetCleanupGuard();
    transition(BLEState.CONNECTED, { deviceName });
    _emit("BLE:CONNECTED", { deviceName });
  }

  function _scheduleReconnect(device, attempt) {
    if (reconnectHandle) {
      reconnectHandle.cancel();
      reconnectHandle = null;
    }
    const signal = connectAbortController
      ? connectAbortController.signal
      : undefined;
    reconnectHandle = BLEConnection.scheduleReconnect(
      device,
      attempt,
      signal,
      _onConsoleMessage,
      (result) => {
        reconnectHandle = null;
        _applyConnectionResult(result);
        _afterConnected(device.name);
      },
      (_err) => {
        reconnectHandle = null;
        cleanupResources();
        transition(BLEState.DISCONNECTED, { reason: "reconnect_failed" });
        _emit("BLE:DISCONNECTED", { reason: "reconnect_failed" });
        _emit("BLE:RECONNECT_FAILED", {
          attempts: Config.retries.bleReconnectMaxAttempts,
        });
      },
    );
  }

  // ── Public API ───────────────────────────────────────────────────────────

  return {
    /**
     * Initialize with an EventBus instance.
     * @param {Object} bus
     */
    init(bus) {
      eventBus = bus;
    },

    /** @returns {string} */
    getState() {
      return state;
    },

    /** @returns {boolean} */
    isConnected() {
      return state === BLEState.CONNECTED;
    },

    /** @returns {boolean} */
    isTransferring() {
      return state === BLEState.TRANSFERRING;
    },

    /** @returns {boolean} */
    canTransfer() {
      return state === BLEState.CONNECTED;
    },

    /** @returns {number} */
    getNegotiatedMTU() {
      return negotiatedMTU;
    },

    /**
     * Return the id of the currently-connected BluetoothDevice, or null.
     * Used by BLEKnownDevices.forget() to detect if the device to forget is active.
     * @returns {string|null}
     */
    getConnectedDeviceId() {
      return connectedDevice ? connectedDevice.id : null;
    },

    /**
     * Connect to a BLE device.
     * @param {{ device?: BluetoothDevice }} [opts]
     *   opts.device - If provided, skip requestDevice() and connect directly
     *                 (used by BLEKnownDevices.connectKnown()).
     */
    async connect(opts) {
      if (state !== BLEState.DISCONNECTED) return;

      transition(BLEState.CONNECTING);
      userInitiatedDisconnect = false;
      reconnectAttempts = 0;
      _resetCleanupGuard();

      connectAbortController = new AbortController();
      const signal = connectAbortController.signal;

      try {
        const device =
          opts && opts.device ? opts.device : await BLEProtocol.requestDevice();
        const result = await BLEConnection.establish(
          device,
          signal,
          _onConsoleMessage,
        );
        connectAbortController = null;
        _applyConnectionResult(result);
        _afterConnected(device.name);
      } catch (error) {
        connectAbortController = null;
        cleanupResources();
        transition(BLEState.DISCONNECTED, { error });
        _emit("BLE:CONNECT_FAILED", { error });
      }
    },

    /**
     * Disconnect from the device.
     * Waits for gattserverdisconnected event (max bleDisconnect ms).
     */
    async disconnect() {
      if (state === BLEState.DISCONNECTED || state === BLEState.DISCONNECTING)
        return;

      userInitiatedDisconnect = true;
      reconnectAttempts = Config.retries.bleReconnectMaxAttempts;

      if (connectAbortController) {
        connectAbortController.abort();
        connectAbortController = null;
      }

      if (
        connectedDevice &&
        connectedDevice.gatt &&
        connectedDevice.gatt.connected
      ) {
        transition(BLEState.DISCONNECTING);
        await BLEConnection.tearDown(connectedDevice, consoleCharacteristic);
        const outcome = await BLEConnection.awaitDisconnect(
          connectedDevice,
          Config.timeouts.bleDisconnect,
        );
        if (outcome === "timeout") {
          log.warn(
            "disconnect: event not received within timeout, forcing cleanup",
          );
        }
      }

      cleanupResources();
      transition(BLEState.DISCONNECTED, { reason: "user" });
      _emit("BLE:DISCONNECTED", { reason: "user" });
    },

    /**
     * Send R (reset) command.
     */
    async sendReset() {
      if (state !== BLEState.CONNECTED || !programCharacteristic) {
        throw new Error("Not connected");
      }
      const buffer = BLEProtocol.buildResetCommand();
      try {
        await BLECommandQueue.enqueueWrite(programCharacteristic, buffer, {
          label: "resetCmd",
          mode: "response",
        });
        _emit("BLE:RESET_SENT", {});
      } catch (error) {
        _emit("BLE:RESET_FAILED", { error });
        throw error;
      }
    },

    /**
     * Send L (reload) command.
     */
    async sendReload() {
      if (state !== BLEState.CONNECTED || !programCharacteristic) {
        throw new Error("Not connected");
      }
      const buffer = BLEProtocol.buildReloadCommand();
      try {
        await BLECommandQueue.enqueueWrite(programCharacteristic, buffer, {
          label: "reloadCmd",
          mode: "response",
        });
        _emit("BLE:RELOAD_SENT", {});
      } catch (error) {
        _emit("BLE:RELOAD_FAILED", { error });
        throw error;
      }
    },

    /**
     * Transfer firmware bytecode to the device.
     * @param {Uint8Array} bytecode
     * @param {number} slot - 1 or 2
     * @param {Function} [onProgress] - (sent, total) => void
     */
    async startTransfer(bytecode, slot, onProgress) {
      if (state !== BLEState.CONNECTED || !programCharacteristic) {
        throw new Error("Not connected");
      }

      transition(BLEState.TRANSFERRING);
      stopHeartbeat();
      _emit("BLE:TRANSFER_STARTED", {});

      const signal = connectAbortController
        ? connectAbortController.signal
        : undefined;

      const progressProxy = onProgress
        ? (sent, total) => {
            onProgress(sent, total);
            _emit("BLE:TRANSFER_PROGRESS", { sent, total });
          }
        : (sent, total) => {
            _emit("BLE:TRANSFER_PROGRESS", { sent, total });
          };

      try {
        await BLETransfer.run(
          programCharacteristic,
          bytecode,
          slot,
          negotiatedMTU,
          signal,
          progressProxy,
        );

        transition(BLEState.CONNECTED);
        _emit("BLE:TRANSFER_COMPLETE", {});
      } catch (error) {
        if (
          !connectedDevice ||
          !connectedDevice.gatt ||
          !connectedDevice.gatt.connected
        ) {
          transition(BLEState.DISCONNECTED, { reason: "transfer_error" });
          _emit("BLE:DISCONNECTED", { reason: "transfer_error" });
        } else {
          transition(BLEState.CONNECTED);
        }
        _emit("BLE:TRANSFER_FAILED", { error });
        throw error;
      } finally {
        if (state === BLEState.CONNECTED) startHeartbeat();
      }
    },

    /**
     * Phase 3F: Pause heartbeat and poller when page goes to background.
     * Called on visibilitychange (hidden) to reduce background GATT activity.
     */
    pauseBackgroundTimers() {
      stopHeartbeat();
      stopPoller();
      log.info("Background timers paused");
    },

    /**
     * Phase 3F: Resume heartbeat and poller when page returns to foreground.
     * Only resumes if the state machine is currently CONNECTED.
     */
    resumeBackgroundTimers() {
      if (state === BLEState.CONNECTED) {
        startHeartbeat();
        startPoller();
        log.info("Background timers resumed");
      }
    },

    /**
     * Full cleanup for page unload.
     */
    cleanup() {
      cleanupResources();
      if (state !== BLEState.DISCONNECTED) {
        transition(BLEState.DISCONNECTED, { reason: "cleanup" });
      }
    },
  };
})();
