/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * BLEConnection - Handles GATT connection, negotiation, and reconnection.
 *
 * Responsibilities:
 *   - Connect to a BluetoothDevice, obtain service + characteristics, negotiate MTU
 *   - Start/stop console notifications via BLECommandQueue
 *   - Provide AbortSignal-aware helpers so callers can cancel mid-flight
 *   - Schedule exponential-backoff reconnects (clearing any previous timer first)
 *
 * Public API:
 *   BLEConnection.establish(device, signal)          → Promise<ConnectionResult>
 *   BLEConnection.tearDown(device)                   → Promise<void>
 *   BLEConnection.scheduleReconnect(device, attempt, signal, onConnected, onFailed)
 */
const BLEConnection = (function () {
  const log = Logger.scope("BLEConnection");

  /** @type {WeakMap<BluetoothRemoteGATTCharacteristic, Function>} */
  const consoleHandlers = new WeakMap();

  /**
   * Validate that a characteristic has the expected properties.
   * Logs a warning for each missing property rather than throwing, so
   * firmware with partial support still works.
   * @param {BluetoothRemoteGATTCharacteristic} char
   * @param {string} name
   * @param {string[]} expected - e.g. ['write', 'writeWithoutResponse']
   */
  function _validateProperties(char, name, expected) {
    for (const prop of expected) {
      if (!char.properties[prop]) {
        log.warn(`${name} is missing property: ${prop}`);
      }
    }
  }

  /**
   * Negotiate the effective MTU with the device.
   * Reads the MTU characteristic; falls back to DEFAULT_MTU on error.
   * @param {BluetoothRemoteGATTCharacteristic} mtuChar
   * @returns {Promise<number>}
   */
  async function _negotiateMTU(mtuChar) {
    try {
      const dataView = await BLECommandQueue.enqueueRead(mtuChar, {
        label: "negotiateMTU",
        timeout: Config.timeouts.bleRead,
      });
      const deviceMTU = dataView.getUint16(0, true);
      const effective = deviceMTU - 3;
      log.info(`Negotiated MTU: ${effective} (raw=${deviceMTU})`);
      return effective;
    } catch (err) {
      log.warn("MTU negotiation failed, using default:", err.message);
      return Config.ble.defaultMTU;
    }
  }

  /**
   * Attach a console notification handler to the characteristic.
   * Stores the handler in a WeakMap so the characteristic object is not polluted.
   * @param {BluetoothRemoteGATTCharacteristic} consoleChar
   * @param {Function} onMessage - Called with decoded string on each notification
   */
  async function _startNotifications(consoleChar, onMessage) {
    const handler = (event) => {
      const value = new TextDecoder().decode(event.target.value);
      if (onMessage) onMessage(value);
    };
    consoleHandlers.set(consoleChar, handler);
    consoleChar.addEventListener("characteristicvaluechanged", handler);
    await BLECommandQueue.enqueueNotify(consoleChar, {
      start: true,
      label: "startNotifications",
      timeout: Config.timeouts.bleNotificationStart,
    });
  }

  /**
   * Remove the console notification handler and stop notifications.
   * Safe to call multiple times (idempotent).
   * @param {BluetoothRemoteGATTCharacteristic} consoleChar
   */
  async function _stopNotifications(consoleChar) {
    if (!consoleChar) return;
    const handler = consoleHandlers.get(consoleChar);
    if (handler) {
      consoleChar.removeEventListener("characteristicvaluechanged", handler);
      consoleHandlers.delete(consoleChar);
    }
    try {
      await BLECommandQueue.enqueueNotify(consoleChar, {
        start: false,
        label: "stopNotifications",
        timeout: Config.timeouts.bleNotificationStart,
      });
    } catch (err) {
      log.warn("stopNotifications failed (ignored):", err.message);
    }
  }

  /**
   * Connect to a BluetoothDevice and set up all characteristics.
   *
   * Throws if the AbortSignal fires before completion.
   *
   * @param {BluetoothDevice} device
   * @param {AbortSignal} [signal]
   * @param {Function} onConsoleMessage - Called for each console notification
   * @returns {Promise<{device, programChar, mtuChar, consoleChar, mtu}>}
   */
  async function establish(device, signal, onConsoleMessage) {
    if (signal) signal.throwIfAborted();

    log.info("Connecting to", device.name);
    const server = await device.gatt.connect();
    if (signal) signal.throwIfAborted();

    const service = await server.getPrimaryService(Config.ble.serviceUUID);
    if (signal) signal.throwIfAborted();

    const [consoleChar, programChar, mtuChar] = await Promise.all([
      service.getCharacteristic(Config.ble.consoleCharUUID),
      service.getCharacteristic(Config.ble.programCharUUID),
      service.getCharacteristic(Config.ble.mtuCharUUID),
    ]);
    if (signal) signal.throwIfAborted();

    _validateProperties(programChar, "programChar", ["write", "writeWithoutResponse"]);
    _validateProperties(consoleChar, "consoleChar", ["notify"]);
    _validateProperties(mtuChar, "mtuChar", ["read"]);

    const mtu = await _negotiateMTU(mtuChar);
    if (signal) signal.throwIfAborted();

    await _startNotifications(consoleChar, onConsoleMessage);
    if (signal) signal.throwIfAborted();

    log.info(`Connected: ${device.name}, MTU=${mtu}`);
    return { device, programChar, mtuChar, consoleChar, mtu };
  }

  /**
   * Tear down a GATT connection cleanly.
   * Stops notifications and disconnects.
   * @param {BluetoothDevice} device
   * @param {BluetoothRemoteGATTCharacteristic} [consoleChar]
   * @returns {Promise<void>}
   */
  async function tearDown(device, consoleChar) {
    if (consoleChar) {
      await _stopNotifications(consoleChar);
    }
    BLECommandQueue.clear({ reason: "tearDown" });
    if (device && device.gatt && device.gatt.connected) {
      device.gatt.disconnect();
    }
  }

  /**
   * Wait for the gattserverdisconnected event with a timeout.
   * @param {BluetoothDevice} device
   * @param {number} timeoutMs
   * @returns {Promise<'event'|'timeout'>}
   */
  function awaitDisconnect(device, timeoutMs) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        log.warn(`awaitDisconnect: timeout after ${timeoutMs}ms`);
        resolve("timeout");
      }, timeoutMs);

      device.addEventListener(
        "gattserverdisconnected",
        () => {
          clearTimeout(timer);
          resolve("event");
        },
        { once: true },
      );
    });
  }

  /**
   * Schedule an exponential-backoff reconnect attempt.
   * Always clears any previously scheduled timer before setting a new one.
   *
   * @param {BluetoothDevice} device
   * @param {number} attempt - 1-based attempt number
   * @param {AbortSignal} [signal]
   * @param {Function} onConsoleMessage
   * @param {Function} onConnected  - Called with ConnectionResult on success
   * @param {Function} onFailed     - Called with Error when max attempts exceeded
   * @returns {{ cancel: Function }} Object with cancel helper
   */
  function scheduleReconnect(device, attempt, signal, onConsoleMessage, onConnected, onFailed) {
    const delay = Config.timeouts.bleReconnectInitialDelay * Math.pow(2, attempt - 1);
    log.info(`Reconnect scheduled: attempt=${attempt}, delay=${delay}ms`);

    let timerId = null;

    timerId = setTimeout(async () => {
      if (signal && signal.aborted) {
        log.info("Reconnect cancelled (aborted)");
        return;
      }
      try {
        const result = await establish(device, signal, onConsoleMessage);
        onConnected(result);
      } catch (err) {
        log.warn(`Reconnect attempt ${attempt} failed:`, err.message);
        if (attempt < Config.retries.bleReconnectMaxAttempts) {
          scheduleReconnect(device, attempt + 1, signal, onConsoleMessage, onConnected, onFailed);
        } else {
          onFailed(err);
        }
      }
    }, delay);

    return {
      cancel() {
        clearTimeout(timerId);
        timerId = null;
      },
    };
  }

  return Object.freeze({ establish, tearDown, awaitDisconnect, scheduleReconnect });
})();
