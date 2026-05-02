/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * BLEState - Frozen BLE state constants and transition validation.
 * Single source of truth for all state names used by BLEStateMachine.
 */
const BLEState = Object.freeze({
  DISCONNECTED: "DISCONNECTED",
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
  TRANSFERRING: "TRANSFERRING",
  RECONNECTING: "RECONNECTING",
  DISCONNECTING: "DISCONNECTING",
});

/**
 * Valid state transition map.
 * Key: current state, Value: array of allowed next states.
 */
const BLE_VALID_TRANSITIONS = Object.freeze({
  [BLEState.DISCONNECTED]: Object.freeze([BLEState.CONNECTING]),
  [BLEState.CONNECTING]: Object.freeze([BLEState.CONNECTED, BLEState.DISCONNECTED]),
  [BLEState.CONNECTED]: Object.freeze([
    BLEState.TRANSFERRING,
    BLEState.DISCONNECTING,
    BLEState.RECONNECTING,
    BLEState.DISCONNECTED,
  ]),
  [BLEState.TRANSFERRING]: Object.freeze([
    BLEState.CONNECTED,
    BLEState.DISCONNECTED,
    BLEState.RECONNECTING,
  ]),
  [BLEState.RECONNECTING]: Object.freeze([BLEState.CONNECTED, BLEState.DISCONNECTED]),
  [BLEState.DISCONNECTING]: Object.freeze([BLEState.DISCONNECTED]),
});

/**
 * Check whether a state transition is valid.
 * @param {string} from - Current state
 * @param {string} to - Target state
 * @returns {boolean}
 */
function isBLETransitionValid(from, to) {
  const allowed = BLE_VALID_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}
