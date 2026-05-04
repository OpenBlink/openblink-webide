/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * BLETransfer - Encapsulates the firmware transfer loop.
 *
 * Sends bytecode to the device in chunks via BLECommandQueue, then issues
 * the program + reload commands.  Progress is reported via callbacks and
 * can be aborted at any chunk boundary via AbortSignal.
 *
 * Public API:
 *   BLETransfer.run(programChar, bytecode, slot, mtu, signal, onProgress) → Promise<void>
 */
const BLETransfer = (function () {
  const log = Logger.scope("BLETransfer");

  function _checkSignalAborted(signal) {
    if (signal?.aborted) {
      const err = new Error("Transfer aborted");
      err.name = "AbortError";
      throw err;
    }
  }

  /**
   * Build a D-command (data chunk) buffer.
   * @param {number} offset
   * @param {number} chunkSize
   * @param {Uint8Array} bytecode
   * @returns {ArrayBuffer}
   */
  function _buildDataChunk(offset, chunkSize, bytecode) {
    const actual = Math.min(chunkSize, bytecode.length - offset);
    const buf = new ArrayBuffer(Config.ble.dataHeaderSize + actual);
    const view = new DataView(buf);
    view.setUint8(0, 0x01);
    view.setUint8(1, "D".charCodeAt(0));
    view.setUint16(2, offset, true);
    view.setUint16(4, actual, true);
    new Uint8Array(buf, Config.ble.dataHeaderSize, actual).set(
      bytecode.subarray(offset, offset + actual),
    );
    return buf;
  }

  /**
   * Build a P-command (program) buffer.
   * @param {number} length - Total bytecode length
   * @param {number} crc16
   * @param {number} slot - 1 or 2
   * @returns {ArrayBuffer}
   */
  function _buildProgramCommand(length, crc16, slot) {
    const buf = new ArrayBuffer(Config.ble.programHeaderSize);
    const view = new DataView(buf);
    view.setUint8(0, 0x01);
    view.setUint8(1, "P".charCodeAt(0));
    view.setUint16(2, length, true);
    view.setUint16(4, crc16, true);
    view.setUint8(6, slot);
    view.setUint8(7, 0);
    return buf;
  }

  /**
   * Run the full firmware transfer sequence.
   *
   * @param {BluetoothRemoteGATTCharacteristic} programChar
   * @param {Uint8Array} bytecode
   * @param {number} slot - Target slot (1 or 2)
   * @param {number} mtu  - Negotiated MTU
   * @param {AbortSignal} [signal]
   * @param {Function} [onProgress] - (sent: number, total: number) => void
   * @returns {Promise<void>}
   */
  async function run(programChar, bytecode, slot, mtu, signal, onProgress) {
    const total = bytecode.length;
    const payloadSize = mtu - Config.ble.dataHeaderSize;
    const crc16 = crc16_reflect(
      Config.ble.crcPoly,
      Config.ble.crcInit,
      bytecode,
    );

    log.info(
      `Transfer start: ${total} bytes, slot=${slot}, MTU=${mtu}, CRC=0x${crc16.toString(16)}`,
    );

    for (let offset = 0; offset < total; offset += payloadSize) {
      _checkSignalAborted(signal);

      const chunkSize = Math.min(payloadSize, total - offset);
      const buf = _buildDataChunk(offset, chunkSize, bytecode);

      await BLECommandQueue.enqueueWrite(programChar, buf, {
        label: `data@${offset}`,
        mode: "no-response",
        timeout: Config.timeouts.bleWrite,
        bypass: true,
      });

      const sent = offset + chunkSize;
      if (onProgress) onProgress(sent, total);
    }

    _checkSignalAborted(signal);

    const programBuf = _buildProgramCommand(total, crc16, slot);
    await BLECommandQueue.enqueueWrite(programChar, programBuf, {
      label: "programCmd",
      mode: "no-response",
      timeout: Config.timeouts.bleWrite,
      bypass: true,
    });

    _checkSignalAborted(signal);

    const reloadBuf = BLEProtocol.buildReloadCommand();
    await BLECommandQueue.enqueueWrite(programChar, reloadBuf, {
      label: "reloadCmd",
      mode: "no-response",
      timeout: Config.timeouts.bleWrite,
      bypass: true,
    });

    log.info("Transfer complete");
  }

  return Object.freeze({ run });
})();
