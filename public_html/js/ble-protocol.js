/*
 * SPDX-FileCopyrightText: Copyright (c) 2025 ViXion Inc. All Rights Reserved.
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * BLEProtocol - Stateless BLE protocol operations
 * This module provides pure protocol functions with no internal state.
 * All state management is handled by BLEStateMachine.
 */

const BLEProtocol = (function () {
  const log = Logger.scope("BLEProtocol");

  /** WeakMap to store console notification handlers without polluting characteristic objects. */
  const consoleHandlers = new WeakMap();

  /** Cached Bluetooth availability (updated by subscribeAvailability). */
  let _bluetoothAvailable = null;

  /**
   * Check Bluetooth adapter availability.
   * Result is cached; use subscribeAvailability() to keep it up to date.
   * @returns {Promise<boolean>}
   */
  async function checkAvailability() {
    if (!navigator.bluetooth) {
      _bluetoothAvailable = false;
      return false;
    }
    try {
      _bluetoothAvailable = await navigator.bluetooth.getAvailability();
    } catch (_e) {
      _bluetoothAvailable = false;
    }
    log.debug("Bluetooth available:", _bluetoothAvailable);
    return _bluetoothAvailable;
  }

  /**
   * Return the last cached Bluetooth availability value.
   * Returns null if checkAvailability() has never been called.
   * @returns {boolean|null}
   */
  function isAvailable() {
    return _bluetoothAvailable;
  }

  /**
   * Subscribe to Bluetooth adapter availability changes.
   * Updates the internal cache and calls handler(available: boolean) on each change.
   * @param {Function} handler
   */
  function subscribeAvailability(handler) {
    if (!navigator.bluetooth) return;
    navigator.bluetooth.addEventListener("availabilitychanged", (event) => {
      _bluetoothAvailable = event.value;
      log.info("Bluetooth availability changed:", _bluetoothAvailable);
      if (handler) handler(_bluetoothAvailable);
    });
  }

  /**
   * Request a BLE device with OpenBlink service filter
   * @returns {Promise<BluetoothDevice>} Selected device
   */
  async function requestDevice() {
    return navigator.bluetooth.requestDevice({
      filters: [
        { namePrefix: Config.ble.namePrefix },
        { services: [Config.ble.serviceUUID] },
      ],
    });
  }

  /**
   * Connect to a BLE device and get all characteristics
   * @param {BluetoothDevice} device - BLE device to connect
   * @returns {Promise<Object>} Object containing device, server, service, and characteristics
   */
  async function connectToDevice(device) {
    const server = await device.gatt.connect();

    const service = await server.getPrimaryService(Config.ble.serviceUUID);

    const [consoleCharacteristic, programCharacteristic, mtuCharacteristic] =
      await Promise.all([
        service.getCharacteristic(Config.ble.consoleCharUUID),
        service.getCharacteristic(Config.ble.programCharUUID),
        service.getCharacteristic(Config.ble.mtuCharUUID),
      ]);

    return {
      device: device,
      server: server,
      service: service,
      consoleCharacteristic: consoleCharacteristic,
      programCharacteristic: programCharacteristic,
      negotiatedMtuCharacteristic: mtuCharacteristic,
    };
  }

  /**
   * Negotiate MTU with the device.
   * Reads the MTU characteristic to obtain the device-reported ATT MTU.
   * gattServer.requestMTU() is not part of the Web Bluetooth standard and has been removed.
   * @param {BluetoothRemoteGATTCharacteristic} _programChar - Unused; kept for API compatibility
   * @param {BluetoothRemoteGATTCharacteristic} mtuChar - MTU characteristic
   * @returns {Promise<number>} Negotiated MTU value
   */
  async function negotiateMTU(_programChar, mtuChar) {
    try {
      const valueDataView = await mtuChar.readValue();
      const deviceMTU = valueDataView.getUint16(0, true);
      const effective = deviceMTU - 3;
      log.info(`Negotiated MTU: ${effective} (raw=${deviceMTU})`);
      return effective;
    } catch (_error) {
      log.warn("MTU read failed, using default", Config.ble.defaultMTU);
      return Config.ble.defaultMTU;
    }
  }

  /**
   * Start console notifications.
   * Stores the event handler in a WeakMap to avoid polluting the characteristic object.
   * @param {BluetoothRemoteGATTCharacteristic} consoleChar
   * @param {Function} onConsoleMessage
   * @returns {Promise<void>}
   */
  async function startConsoleNotifications(consoleChar, onConsoleMessage) {
    if (!consoleChar) {
      throw new Error("Console characteristic not available");
    }

    const handler = (event) => {
      const value = new TextDecoder().decode(event.target.value);
      if (onConsoleMessage) onConsoleMessage(value);
    };

    consoleHandlers.set(consoleChar, handler);
    consoleChar.addEventListener("characteristicvaluechanged", handler);
    await consoleChar.startNotifications();
  }

  /**
   * Stop console notifications.
   * Removes the stored handler from the WeakMap.
   * @param {BluetoothRemoteGATTCharacteristic} consoleChar
   */
  function stopConsoleNotifications(consoleChar) {
    if (!consoleChar) return;
    const handler = consoleHandlers.get(consoleChar);
    if (handler) {
      consoleChar.removeEventListener("characteristicvaluechanged", handler);
      consoleHandlers.delete(consoleChar);
    }
  }

  /**
   * Write to a characteristic with timeout.
   * Low-level wrapper retained for backward compatibility.
   * New code should prefer BLECommandQueue.enqueueWrite() for serialization.
   * @param {BluetoothRemoteGATTCharacteristic} characteristic
   * @param {ArrayBuffer} buffer
   * @param {number} [timeout]
   * @returns {Promise<void>}
   */
  async function writeWithTimeout(characteristic, buffer, timeout) {
    if (!characteristic) {
      throw new Error("Characteristic not available");
    }
    const ms = timeout !== undefined ? timeout : Config.timeouts.bleWrite;
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`BLE write timeout after ${ms}ms`));
      }, ms);

      let writePromise;
      if (
        characteristic.properties &&
        characteristic.properties.writeWithoutResponse
      ) {
        writePromise = characteristic.writeValueWithoutResponse(buffer);
      } else if (characteristic.properties && characteristic.properties.write) {
        writePromise = characteristic.writeValueWithResponse(buffer);
      } else {
        writePromise = characteristic.writeValue(buffer);
      }

      writePromise
        .then(() => {
          clearTimeout(timeoutId);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Read heartbeat (MTU characteristic)
   * @param {BluetoothRemoteGATTCharacteristic} mtuChar - MTU characteristic
   * @returns {Promise<DataView>} Read value
   */
  async function readHeartbeat(mtuChar) {
    if (!mtuChar) {
      throw new Error("MTU characteristic not available");
    }
    return mtuChar.readValue();
  }

  /**
   * Build a data chunk buffer
   * @param {number} offset - Byte offset in the firmware
   * @param {number} chunkSize - Size of this chunk
   * @param {Uint8Array} mrbContent - Full firmware content
   * @returns {ArrayBuffer} Buffer ready to send
   */
  function buildDataChunk(offset, chunkSize, mrbContent) {
    const actualChunkSize = Math.min(chunkSize, mrbContent.length - offset);

    const buffer = new ArrayBuffer(Config.ble.dataHeaderSize + actualChunkSize);
    const view = new DataView(buffer);

    view.setUint8(0, 0x01);
    view.setUint8(1, "D".charCodeAt(0));
    view.setUint16(2, offset, true);
    view.setUint16(4, actualChunkSize, true);

    const payload = new Uint8Array(
      buffer,
      Config.ble.dataHeaderSize,
      actualChunkSize,
    );
    payload.set(mrbContent.subarray(offset, offset + actualChunkSize));

    return buffer;
  }

  /**
   * Build a program command buffer
   * @param {number} contentLength - Total firmware size
   * @param {number} crc16 - CRC16 value
   * @param {number} slot - Target slot (1 or 2)
   * @returns {ArrayBuffer} Buffer ready to send
   */
  function buildProgramCommand(contentLength, crc16, slot) {
    const buffer = new ArrayBuffer(Config.ble.programHeaderSize);
    const view = new DataView(buffer);

    view.setUint8(0, 0x01);
    view.setUint8(1, "P".charCodeAt(0));
    view.setUint16(2, contentLength, true);
    view.setUint16(4, crc16, true);
    view.setUint8(6, slot);
    view.setUint8(7, 0);

    return buffer;
  }

  /**
   * Build a reset command buffer
   * @returns {ArrayBuffer} Buffer ready to send
   */
  function buildResetCommand() {
    const buffer = new ArrayBuffer(2);
    const view = new DataView(buffer);
    view.setUint8(0, 0x01);
    view.setUint8(1, "R".charCodeAt(0));
    return buffer;
  }

  /**
   * Build a reload command buffer
   * @returns {ArrayBuffer} Buffer ready to send
   */
  function buildReloadCommand() {
    const buffer = new ArrayBuffer(2);
    const view = new DataView(buffer);
    view.setUint8(0, 0x01);
    view.setUint8(1, "L".charCodeAt(0));
    return buffer;
  }

  /**
   * Check if device is connected
   * @param {BluetoothDevice} device - BLE device
   * @returns {boolean}
   */
  function isConnected(device) {
    return device?.gatt?.connected === true;
  }

  /**
   * Disconnect from device
   * @param {BluetoothDevice} device - BLE device to disconnect
   */
  function disconnect(device) {
    if (device && device.gatt && device.gatt.connected) {
      device.gatt.disconnect();
    }
  }

  return {
    // Constants (delegate to Config for single source of truth)
    getServiceUUID: function () {
      return Config.ble.serviceUUID;
    },
    getDefaultMTU: function () {
      return Config.ble.defaultMTU;
    },
    getDataHeaderSize: function () {
      return Config.ble.dataHeaderSize;
    },
    getProgramHeaderSize: function () {
      return Config.ble.programHeaderSize;
    },

    // Availability API
    checkAvailability: checkAvailability,
    isAvailable: isAvailable,
    subscribeAvailability: subscribeAvailability,

    // Protocol operations
    requestDevice: requestDevice,
    connectToDevice: connectToDevice,
    negotiateMTU: negotiateMTU,
    startConsoleNotifications: startConsoleNotifications,
    stopConsoleNotifications: stopConsoleNotifications,
    writeWithTimeout: writeWithTimeout,
    readHeartbeat: readHeartbeat,

    // Buffer builders
    buildDataChunk: buildDataChunk,
    buildProgramCommand: buildProgramCommand,
    buildResetCommand: buildResetCommand,
    buildReloadCommand: buildReloadCommand,

    // Connection helpers
    isConnected: isConnected,
    disconnect: disconnect,
  };
})();
