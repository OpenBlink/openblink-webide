/*
 * SPDX-FileCopyrightText: Copyright (c) 2025 ViXion Inc. All Rights Reserved.
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * BLEProtocol - Stateless BLE protocol operations.
 * Provides adapter availability checks, device selection, and pure packet
 * builders.  Connection lifecycle is owned by BLEConnection; state management
 * by BLEStateMachine.
 */

const BLEProtocol = (function () {
  const log = Logger.scope("BLEProtocol");

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

  return {
    // Availability API
    checkAvailability: checkAvailability,
    isAvailable: isAvailable,
    subscribeAvailability: subscribeAvailability,

    // Device selection
    requestDevice: requestDevice,

    // Buffer builders
    buildDataChunk: buildDataChunk,
    buildProgramCommand: buildProgramCommand,
    buildResetCommand: buildResetCommand,
    buildReloadCommand: buildReloadCommand,
  };
})();
