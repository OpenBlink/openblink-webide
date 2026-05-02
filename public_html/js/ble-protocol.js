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
  // Protocol constants (not state)
  const OPENBLINK_SERVICE_UUID = "227da52c-e13a-412b-befb-ba2256bb7fbe";
  const OPENBLINK_PROGRAM_CHARACTERISTIC_UUID =
    "ad9fdd56-1135-4a84-923c-ce5a244385e7";
  const OPENBLINK_CONSOLE_CHARACTERISTIC_UUID =
    "a015b3de-185a-4252-aa04-7a87d38ce148";
  const OPENBLINK_NEGOTIATED_MTU_CHARACTERISTIC_UUID =
    "ca141151-3113-448b-b21a-6a6203d253ff";

  const DATA_HEADER_SIZE = 6;
  const PROGRAM_HEADER_SIZE = 8;
  const DEFAULT_MTU = 20;
  const REQUESTED_MTU = 512;

  /**
   * Request a BLE device with OpenBlink service filter
   * @returns {Promise<BluetoothDevice>} Selected device
   */
  async function requestDevice() {
    return navigator.bluetooth.requestDevice({
      filters: [
        { namePrefix: "OpenBlink" },
        { services: [OPENBLINK_SERVICE_UUID] },
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

    const service = await server.getPrimaryService(OPENBLINK_SERVICE_UUID);

    const [consoleCharacteristic, programCharacteristic, mtuCharacteristic] =
      await Promise.all([
        service.getCharacteristic(OPENBLINK_CONSOLE_CHARACTERISTIC_UUID),
        service.getCharacteristic(OPENBLINK_PROGRAM_CHARACTERISTIC_UUID),
        service.getCharacteristic(OPENBLINK_NEGOTIATED_MTU_CHARACTERISTIC_UUID),
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
   * Negotiate MTU with the device
   * @param {BluetoothRemoteGATTCharacteristic} programChar - Program characteristic (for device reference)
   * @param {BluetoothRemoteGATTCharacteristic} mtuChar - MTU characteristic
   * @returns {Promise<number>} Negotiated MTU value
   */
  async function negotiateMTU(programChar, mtuChar) {
    if (!programChar || !programChar.service || !programChar.service.device) {
      return DEFAULT_MTU;
    }

    const gattServer = programChar.service.device.gatt;
    if (gattServer.requestMTU) {
      try {
        const mtu = await gattServer.requestMTU(REQUESTED_MTU);
        return mtu;
      } catch (_error) {
        return DEFAULT_MTU;
      }
    } else {
      try {
        const valueDataView = await mtuChar.readValue();
        const deviceMTU = valueDataView.getUint16(0, true);
        return deviceMTU - 3;
      } catch (_error) {
        return DEFAULT_MTU;
      }
    }
  }

  /**
   * Start console notifications
   * @param {BluetoothRemoteGATTCharacteristic} consoleChar - Console characteristic
   * @param {Function} onConsoleMessage - Callback for console messages
   * @returns {Promise<void>}
   */
  async function startConsoleNotifications(consoleChar, onConsoleMessage) {
    if (!consoleChar) {
      throw new Error("Console characteristic not available");
    }

    const handler = function (event) {
      const value = new TextDecoder().decode(event.target.value);
      if (onConsoleMessage) {
        onConsoleMessage(value);
      }
    };

    // Store handler reference for cleanup
    consoleChar._consoleHandler = handler;
    consoleChar.addEventListener("characteristicvaluechanged", handler);
    await consoleChar.startNotifications();
  }

  /**
   * Stop console notifications
   * @param {BluetoothRemoteGATTCharacteristic} consoleChar - Console characteristic
   */
  function stopConsoleNotifications(consoleChar) {
    if (!consoleChar) {
      return;
    }

    if (consoleChar._consoleHandler) {
      consoleChar.removeEventListener(
        "characteristicvaluechanged",
        consoleChar._consoleHandler,
      );
      delete consoleChar._consoleHandler;
    }
  }

  /**
   * Write to a characteristic with timeout
   * @param {BluetoothRemoteGATTCharacteristic} characteristic - Target characteristic
   * @param {ArrayBuffer} buffer - Data to write
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<void>}
   */
  async function writeWithTimeout(characteristic, buffer, timeout) {
    if (!characteristic) {
      throw new Error("Characteristic not available");
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`BLE write timeout after ${timeout}ms`));
      }, timeout);

      const writePromise = characteristic.properties.writeWithoutResponse
        ? characteristic.writeValueWithoutResponse(buffer)
        : characteristic.writeValue(buffer);

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

    const buffer = new ArrayBuffer(DATA_HEADER_SIZE + actualChunkSize);
    const view = new DataView(buffer);

    view.setUint8(0, 0x01);
    view.setUint8(1, "D".charCodeAt(0));
    view.setUint16(2, offset, true);
    view.setUint16(4, actualChunkSize, true);

    const payload = new Uint8Array(buffer, DATA_HEADER_SIZE, actualChunkSize);
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
    const buffer = new ArrayBuffer(PROGRAM_HEADER_SIZE);
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
    // Constants
    getServiceUUID: function () {
      return OPENBLINK_SERVICE_UUID;
    },
    getDefaultMTU: function () {
      return DEFAULT_MTU;
    },
    getDataHeaderSize: function () {
      return DATA_HEADER_SIZE;
    },
    getProgramHeaderSize: function () {
      return PROGRAM_HEADER_SIZE;
    },

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
