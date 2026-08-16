/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * BLETransfer - Encapsulates the firmware transfer loop.
 *
 * Sends bytecode to the device in chunks via BLECommandQueue, then issues
 * the program + reload commands.  Packet buffers are built by BLEProtocol.
 * Progress is reported via callbacks and can be aborted at any chunk
 * boundary via AbortSignal.
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
      const buf = BLEProtocol.buildDataChunk(offset, chunkSize, bytecode);

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

    const programBuf = BLEProtocol.buildProgramCommand(total, crc16, slot);
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
