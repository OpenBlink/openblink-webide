/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * Test helper: load a classic (non-module) browser script from public_html/js
 * into an isolated sandbox and return its global exports.
 *
 * The application scripts define top-level `const` globals (e.g.
 * BLECommandQueue) and depend on globals such as Logger and Config, so they
 * are evaluated with `vm.runInNewContext` against a sandbox providing stubs.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const noop = () => {};

/** Minimal Logger stub matching public_html/js/logger.js's scoped API. */
export function createLoggerStub() {
  const scoped = {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
  };
  return { scope: () => scoped, ...scoped };
}

/** Config stub with the constants used by the BLE modules. */
export function createConfigStub() {
  return {
    ble: {
      namePrefix: "OpenBlink",
      serviceUUID: "service-uuid",
      consoleCharUUID: "console-uuid",
      programCharUUID: "program-uuid",
      mtuCharUUID: "mtu-uuid",
      defaultMTU: 20,
      dataHeaderSize: 6,
      programHeaderSize: 8,
      crcPolynomial: 0xd175,
      crcInitial: 0xffff,
    },
    timeouts: {
      bleWrite: 100,
      bleRead: 100,
      bleNotificationStart: 100,
      bleHeartbeatInterval: 3000,
      bleStatePollInterval: 2000,
      bleReconnectInitialDelay: 1000,
      bleDisconnect: 100,
    },
    retries: {
      bleReconnectMaxAttempts: 5,
    },
  };
}

/**
 * Evaluate a script from the repository inside a sandbox and return the
 * named top-level bindings it defines.
 * Top-level `const` declarations live in the context's lexical scope (not on
 * the sandbox object), so they are captured explicitly by name.
 * @param {string} relPath - Path relative to the repository root
 * @param {string[]} names - Top-level binding names to capture
 * @param {Object} [globals] - Extra globals to expose to the script
 * @returns {Object} Map of captured bindings
 */
export function loadScript(relPath, names, globals = {}) {
  const code = fs.readFileSync(path.join(repoRoot, relPath), "utf8");
  const sandbox = {
    Logger: createLoggerStub(),
    Config: createConfigStub(),
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    Error,
    Math,
    Object,
    ArrayBuffer,
    Uint8Array,
    DataView,
    TextDecoder,
    ...globals,
  };
  vm.createContext(sandbox);
  return vm.runInContext(
    `${code}\n;({ ${names.join(", ")} });`,
    sandbox,
    { filename: relPath },
  );
}
