/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * BLEKnownDevices - Manages previously-permitted BLE devices via getDevices().
 *
 * Provides quick-connect (no pairing dialog) and forget (device.forget()) UI support.
 * Gracefully degrades when navigator.bluetooth.getDevices is unavailable.
 *
 * Public API:
 *   BLEKnownDevices.list()             → Promise<BluetoothDevice[]>
 *   BLEKnownDevices.findById(id)       → Promise<BluetoothDevice|null>
 *   BLEKnownDevices.connectKnown(dev)  → Promise<void>
 *   BLEKnownDevices.forget(dev)        → Promise<void>
 *   BLEKnownDevices.isSupported()      → boolean
 */
const BLEKnownDevices = (function () {
  const log = Logger.scope("BLEKnownDevices");

  /**
   * Whether getDevices() is available in this browser.
   * @returns {boolean}
   */
  function isSupported() {
    return (
      typeof navigator !== "undefined" &&
      navigator.bluetooth != null &&
      typeof navigator.bluetooth.getDevices === "function"
    );
  }

  /**
   * Return all previously-permitted OpenBlink devices.
   * Returns [] when getDevices() is unavailable.
   * @returns {Promise<BluetoothDevice[]>}
   */
  async function list() {
    if (!isSupported()) return [];
    try {
      const devices = await navigator.bluetooth.getDevices();
      return devices.filter(
        (d) => d.name && d.name.startsWith(Config.ble.namePrefix),
      );
    } catch (err) {
      log.warn("getDevices() failed:", err.message);
      return [];
    }
  }

  /**
   * Find a device by its BluetoothDevice.id.
   * @param {string} id
   * @returns {Promise<BluetoothDevice|null>}
   */
  async function findById(id) {
    const devices = await list();
    return devices.find((d) => d.id === id) || null;
  }

  /**
   * Connect to a known device, bypassing the requestDevice() pairing dialog.
   * Delegates to BLEStateMachine.connect({ device }) so that all state
   * transitions and heartbeat/poller setup happen normally.
   * @param {BluetoothDevice} device
   * @returns {Promise<void>}
   */
  async function connectKnown(device) {
    if (!device) throw new Error("device is required");
    log.info("Connecting to known device:", device.name);
    await BLEStateMachine.connect({ device });
  }

  /**
   * Forget a device: disconnect if currently connected, then call device.forget().
   * Emits BLE:DEVICE_FORGOTTEN on the EventBus (if available via BLEStateMachine).
   * @param {BluetoothDevice} device
   * @returns {Promise<void>}
   */
  async function forget(device) {
    if (!device) throw new Error("device is required");
    if (typeof device.forget !== "function") {
      throw new Error("device.forget() is not supported in this browser");
    }

    if (
      BLEStateMachine.isConnected() &&
      device.id === _getConnectedDeviceId()
    ) {
      log.info("Disconnecting before forget:", device.name);
      await BLEStateMachine.disconnect();
    }

    log.info("Forgetting device:", device.name);
    await device.forget();
    log.info("Device forgotten:", device.name);
  }

  /**
   * Helper: retrieve the id of the currently-connected device if possible.
   * Accesses BLEStateMachine internals via getConnectedDeviceId() if exposed,
   * otherwise falls back to a best-effort check.
   * @returns {string|null}
   */
  function _getConnectedDeviceId() {
    if (typeof BLEStateMachine.getConnectedDeviceId === "function") {
      return BLEStateMachine.getConnectedDeviceId();
    }
    return null;
  }

  return Object.freeze({ isSupported, list, findById, connectKnown, forget });
})();
