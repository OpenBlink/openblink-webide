/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * Logger - Controlled logging utility for OpenBlink WebIDE.
 *
 * Log levels (ascending severity): debug < info < warn < error < fatal
 * Only messages at or above the current level are emitted.
 *
 * Usage:
 *   Logger.setLevel('debug');
 *   Logger.info('Hello', someValue);
 *   const log = Logger.scope('BLEProtocol');
 *   log.warn('something happened');
 */
const Logger = (function () {
  const LEVELS = Object.freeze({
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  });
  const CONSOLE_METHODS = Object.freeze({
    debug: "debug",
    info: "info",
    warn: "warn",
    error: "error",
    fatal: "error",
  });

  let currentLevel = 2;

  function _resolveLevel(level) {
    if (typeof level === "number") {
      return level;
    }
    const n = LEVELS[String(level).toLowerCase()];
    return n !== undefined ? n : 2;
  }

  function _readStoredLevel() {
    try {
      const stored = localStorage.getItem(Config.logging.storageKey);
      if (stored && LEVELS[stored] !== undefined) {
        return LEVELS[stored];
      }
    } catch (_storageErr) {
      return _resolveLevel(Config.logging.defaultLevel);
    }
    return _resolveLevel(Config.logging.defaultLevel);
  }

  function setLevel(level) {
    currentLevel = _resolveLevel(level);
    try {
      const name = Object.keys(LEVELS).find((k) => LEVELS[k] === currentLevel);
      if (name) {
        localStorage.setItem(Config.logging.storageKey, name);
      }
    } catch (_storageErr) {
      return;
    }
  }

  function getLevel() {
    return (
      Object.keys(LEVELS).find((k) => LEVELS[k] === currentLevel) || "warn"
    );
  }

  function _emit(levelName, prefix, args) {
    const levelNum = LEVELS[levelName];
    if (levelNum < currentLevel) return;
    const method = CONSOLE_METHODS[levelName];
    const tag = prefix ? `[${prefix}]` : "[OpenBlink]";
    console[method](tag, ...args);
  }

  function debug(...args) {
    _emit("debug", null, args);
  }
  function info(...args) {
    _emit("info", null, args);
  }
  function warn(...args) {
    _emit("warn", null, args);
  }
  function error(...args) {
    _emit("error", null, args);
  }
  function fatal(...args) {
    _emit("fatal", null, args);
  }

  /**
   * Create a scoped logger that prefixes all messages with the given name.
   * @param {string} name - Scope name (e.g. 'BLEProtocol')
   * @returns {{ debug, info, warn, error, fatal }}
   */
  function scope(name) {
    return Object.freeze({
      debug: (...args) => _emit("debug", name, args),
      info: (...args) => _emit("info", name, args),
      warn: (...args) => _emit("warn", name, args),
      error: (...args) => _emit("error", name, args),
      fatal: (...args) => _emit("fatal", name, args),
    });
  }

  currentLevel = _readStoredLevel();

  return Object.freeze({
    setLevel,
    getLevel,
    debug,
    info,
    warn,
    error,
    fatal,
    scope,
  });
})();
