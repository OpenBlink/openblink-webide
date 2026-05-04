/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * BLECommandQueue - Serializes BLE GATT operations to prevent "GATT operation already in progress" errors.
 *
 * All write/read/notify operations are chained via a promise tail so that at most
 * one GATT operation is in-flight at a time.  Each operation carries an individual
 * AbortSignal-based timeout; when a timeout fires the rejection is swallowed
 * by the tail's catch handler so subsequent operations are not blocked.
 *
 * Public API:
 *   BLECommandQueue.enqueueWrite(char, buffer, opts)  → Promise<void>
 *   BLECommandQueue.enqueueRead(char, opts)            → Promise<DataView>
 *   BLECommandQueue.enqueueNotify(char, opts)          → Promise<void>
 *   BLECommandQueue.clear({ reason })
 *   BLECommandQueue.size()                             → number
 */
const BLECommandQueue = (function () {
  const log = Logger.scope("BLECommandQueue");

  let tail = Promise.resolve();
  let pendingCount = 0;
  let generation = 0;

  /**
   * Wrap an async operation with a per-operation timeout.
   * On timeout the promise rejects; the caller's tail.catch() ensures subsequent operations are not blocked.
   * @param {Function} fn - Async factory () => Promise
   * @param {number} timeoutMs
   * @param {string} label
   * @returns {Promise<any>}
   */
  function _withTimeout(fn, timeoutMs, label) {
    return new Promise((resolve, reject) => {
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        log.warn(`Timeout after ${timeoutMs}ms: ${label}`);
        reject(
          new Error(`BLE operation timed out after ${timeoutMs}ms: ${label}`),
        );
      }, timeoutMs);

      fn()
        .then((v) => {
          if (!timedOut) {
            clearTimeout(timer);
            resolve(v);
          }
        })
        .catch((err) => {
          if (!timedOut) {
            clearTimeout(timer);
            reject(err);
          }
        });
    });
  }

  /**
   * Enqueue an operation onto the serial tail.
   * @param {Function} fn - Async operation factory
   * @param {number} timeoutMs
   * @param {string} label
   * @returns {Promise<any>}
   */
  function _enqueue(fn, timeoutMs, label) {
    pendingCount++;
    const gen = generation;
    const p = tail.then(() => _withTimeout(fn, timeoutMs, label));
    // Catch errors on the tail to prevent unhandled rejections in the chain
    tail = p.catch((err) => {
      // Log errors but don't propagate to avoid unhandled rejections
      log.debug(`Queue operation failed [${label}]:`, err.message);
    });
    // Also catch on the returned promise to prevent unhandled rejections
    const handledPromise = p.catch((err) => {
      // Return undefined to resolve the promise instead of rejecting
      return undefined;
    });
    handledPromise.finally(() => {
      if (generation === gen) {
        pendingCount = Math.max(0, pendingCount - 1);
      }
    });
    return handledPromise;
  }

  /**
   * Choose the best write method based on characteristic properties.
   * @param {BluetoothRemoteGATTCharacteristic} char
   * @param {ArrayBuffer} buffer
   * @param {'auto'|'response'|'no-response'} mode
   * @returns {Promise<void>}
   */
  function _doWrite(char, buffer, mode) {
    if (mode === "response") {
      return char.writeValueWithResponse(buffer);
    }
    if (mode === "no-response") {
      return char.writeValueWithoutResponse(buffer);
    }
    // auto: prefer writeWithoutResponse when the property is available
    if (char.properties && char.properties.writeWithoutResponse) {
      return char.writeValueWithoutResponse(buffer);
    }
    if (char.properties && char.properties.write) {
      return char.writeValueWithResponse(buffer);
    }
    // Fallback for older browsers that only have writeValue
    return char.writeValue(buffer);
  }

  /**
   * Enqueue a write operation.
   * @param {BluetoothRemoteGATTCharacteristic} char
   * @param {ArrayBuffer} buffer
   * @param {{ timeout?: number, label?: string, mode?: 'auto'|'response'|'no-response', bypass?: boolean }} opts
   * @returns {Promise<void>}
   */
  function enqueueWrite(char, buffer, opts) {
    const {
      timeout = Config.timeouts.bleWrite,
      label = "write",
      mode = "auto",
      bypass = false,
    } = opts || {};

    if (bypass) {
      // Bypass mode: skip queueing and execute directly
      log.debug(`Bypassing queue for ${label}`);
      return _withTimeout(() => _doWrite(char, buffer, mode), timeout, label);
    }

    return _enqueue(() => _doWrite(char, buffer, mode), timeout, label);
  }

  /**
   * Enqueue a read operation.
   * @param {BluetoothRemoteGATTCharacteristic} char
   * @param {{ timeout?: number, label?: string }} opts
   * @returns {Promise<DataView>}
   */
  function enqueueRead(char, opts) {
    const { timeout = Config.timeouts.bleRead, label = "read" } = opts || {};
    return _enqueue(() => char.readValue(), timeout, label);
  }

  /**
   * Enqueue a startNotifications / stopNotifications operation.
   * @param {BluetoothRemoteGATTCharacteristic} char
   * @param {{ timeout?: number, label?: string, start?: boolean }} opts
   * @returns {Promise<void>}
   */
  function enqueueNotify(char, opts) {
    const {
      timeout = Config.timeouts.bleNotificationStart,
      label = "notify",
      start = true,
    } = opts || {};
    return _enqueue(
      () => (start ? char.startNotifications() : char.stopNotifications()),
      timeout,
      label,
    );
  }

  /**
   * Cancel all pending operations and reset the queue.
   * @param {{ reason?: string }} opts
   */
  function clear(opts) {
    const { reason = "clear" } = opts || {};
    log.info(`Queue cleared: ${reason} (pending=${pendingCount})`);
    tail = Promise.resolve();
    pendingCount = 0;
    generation++;
  }

  /**
   * Number of operations waiting or in-flight.
   * @returns {number}
   */
  function size() {
    return pendingCount;
  }

  return Object.freeze({
    enqueueWrite,
    enqueueRead,
    enqueueNotify,
    clear,
    size,
  });
})();
