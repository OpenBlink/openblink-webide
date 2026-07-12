/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Config } from "../config.js";
import { Logger } from "../logger.js";

/**
 * BLECommandQueue - Serializes BLE GATT operations to prevent "GATT operation already in progress" errors.
 *
 * All write/read/notify operations are chained via a promise tail so that at most
 * one GATT operation is in-flight at a time.  Each operation carries an individual
 * timeout.  Errors (including timeouts) are propagated to the caller's promise;
 * the internal tail always settles so subsequent operations are not blocked.
 * After a timeout the tail keeps waiting for the underlying GATT operation to
 * settle before starting the next one, so operations never overlap.
 *
 * Public API:
 *   BLECommandQueue.enqueueWrite(char, buffer, opts)  → Promise<void>
 *   BLECommandQueue.enqueueRead(char, opts)            → Promise<DataView>
 *   BLECommandQueue.enqueueNotify(char, opts)          → Promise<void>
 *   BLECommandQueue.clear({ reason })
 *   BLECommandQueue.size()                             → number
 */
export const BLECommandQueue = (function () {
  const log = Logger.scope("BLECommandQueue");

  let tail = Promise.resolve();
  let pendingCount = 0;
  let generation = 0;

  /**
   * Race a promise against a per-operation timeout.
   * @param {Promise<any>} promise
   * @param {number} timeoutMs
   * @param {string} label
   * @returns {Promise<any>}
   */
  function _withTimeout(promise, timeoutMs, label) {
    return new Promise((resolve, reject) => {
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        log.warn(`Timeout after ${timeoutMs}ms: ${label}`);
        reject(
          new Error(`BLE operation timed out after ${timeoutMs}ms: ${label}`),
        );
      }, timeoutMs);

      promise
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
   * The returned promise rejects on failure or timeout; the internal tail
   * always settles (and, on timeout, waits for the underlying operation to
   * finish) so the queue never deadlocks and operations never overlap.
   * @param {Function} fn - Async operation factory
   * @param {number} timeoutMs
   * @param {string} label
   * @returns {Promise<any>}
   */
  function _enqueue(fn, timeoutMs, label) {
    pendingCount++;
    const gen = generation;
    let opPromise = null;
    const p = tail.then(() => {
      opPromise = Promise.resolve().then(fn);
      return _withTimeout(opPromise, timeoutMs, label);
    });
    tail = p.catch((err) => {
      log.debug(`Queue operation failed [${label}]:`, err.message);
      // On timeout the GATT operation may still be in flight; wait for it to
      // settle before releasing the queue so the next operation cannot collide.
      return opPromise ? opPromise.catch(() => undefined) : undefined;
    });
    tail.finally(() => {
      if (generation === gen) {
        pendingCount = Math.max(0, pendingCount - 1);
      }
    });
    return p;
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
      return _withTimeout(_doWrite(char, buffer, mode), timeout, label);
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
