/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * Config - Centralized configuration constants for OpenBlink WebIDE.
 * All timeout, retry, logging, and BLE protocol constants are defined here.
 */
const Config = Object.freeze({
  timeouts: Object.freeze({
    bleWrite: 10000,
    bleRead: 8000,
    bleNotificationStart: 8000,
    bleConnectGatt: 15000,
    bleConnectOverall: 30000,
    bleDisconnect: 2500,
    bleHeartbeatInterval: 3000,
    bleStatePollInterval: 2000,
    bleReconnectInitialDelay: 1000,
    fetchRequest: 15000,
    fetchRetryInitialDelay: 1000,
    scriptLoad: 30000,
  }),
  retries: Object.freeze({
    bleReconnectMaxAttempts: 5,
    fetchMaxAttempts: 3,
    scriptLoadMaxAttempts: 3,
  }),
  logging: Object.freeze({
    defaultLevel: "warn",
    devLevel: "debug",
    storageKey: "openblink_log_level",
  }),
  ble: Object.freeze({
    serviceUUID: "227da52c-e13a-412b-befb-ba2256bb7fbe",
    programCharUUID: "ad9fdd56-1135-4a84-923c-ce5a244385e7",
    consoleCharUUID: "a015b3de-185a-4252-aa04-7a87d38ce148",
    mtuCharUUID: "ca141151-3113-448b-b21a-6a6203d253ff",
    namePrefix: "OpenBlink",
    defaultMTU: 20,
    dataHeaderSize: 6,
    programHeaderSize: 8,
    crcPoly: 0xd175,
    crcInit: 0xffff,
  }),
});
