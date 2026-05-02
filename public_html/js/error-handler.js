/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

const ErrorHandler = (function () {
  const log = Logger.scope("ErrorHandler");

  /** Buffer for errors that arrive before UIManager is initialized. */
  const _earlyBuffer = [];
  let _uiReady = false;

  const errorKeyMap = {
    NotFoundError: "error.deviceNotFound",
    SecurityError: "error.securityError",
    NetworkError: "error.networkError",
    InvalidStateError: "error.invalidStateError",
    NotSupportedError: "error.notSupportedError",
    AbortError: "error.abortError",
    TimeoutError: "error.timeoutError",
    NotAllowedError: "error.notAllowedError",
  };

  const fallbackMessages = {
    NotFoundError:
      "Device not found. Please make sure your OpenBlink device is turned on and nearby.",
    SecurityError:
      "Bluetooth access denied. Please grant permission in browser settings.",
    NetworkError:
      "Connection lost. Please check if the device is still connected.",
    InvalidStateError:
      "Device not connected. Please connect to a device first.",
    NotSupportedError:
      "This feature is not supported by your browser. Please use Chrome or Edge.",
    AbortError: "The operation was cancelled.",
    TimeoutError: "The operation timed out. Please try again.",
    NotAllowedError:
      "Permission denied. Please allow Bluetooth access when prompted.",
  };

  // Note: Global t() helper is defined in i18n.js

  function _showInUI(message) {
    if (
      _uiReady &&
      typeof UIManager !== "undefined" &&
      UIManager.appendToConsole
    ) {
      UIManager.appendToConsole(message);
    } else {
      _earlyBuffer.push(message);
    }
  }

  return {
    getErrorMessage: function (error) {
      if (!error) {
        return t("error.unknown") || "An unknown error occurred.";
      }

      if (errorKeyMap[error.name]) {
        const translated = t(errorKeyMap[error.name]);
        if (translated && translated !== errorKeyMap[error.name]) {
          return translated;
        }
        return fallbackMessages[error.name];
      }

      if (error.message) {
        if (error.message.includes("User cancelled")) {
          return t("error.userCancelled") || "Connection cancelled by user.";
        }
        if (error.message.includes("GATT")) {
          return (
            t("error.gattError") ||
            "Bluetooth communication error. Please try reconnecting."
          );
        }
        if (error.message.includes("adapter")) {
          return (
            t("error.adapterError") ||
            "Bluetooth adapter not available. Please check if Bluetooth is enabled."
          );
        }
      }

      const genericMsg = t("error.generic", {
        message: error.message || error.name || "Unknown error",
      });
      if (genericMsg && genericMsg !== "error.generic") {
        return genericMsg;
      }
      return `An error occurred: ${error.message || error.name || "Unknown error"}`;
    },

    /**
     * Report an error: log it and display a user-facing message.
     * @param {Error|*} error
     * @param {string} [context]
     */
    report: function (error, context) {
      const friendlyMessage = this.getErrorMessage(error);
      _showInUI("Error: " + friendlyMessage);
      if (error && error.message && error.message !== friendlyMessage) {
        log.error(`[${context || "Error"}] Technical details:`, error);
      }
    },

    /**
     * Show a purely informational notification (no Error object).
     * @param {string} messageKey  i18n key
     * @param {Object} [params]    interpolation params
     */
    notify: function (messageKey, params) {
      const msg = t(messageKey, params) || messageKey;
      _showInUI(msg);
    },

    /**
     * Log an error silently (no UI display).
     * @param {Error|*} error
     * @param {string} [context]
     */
    silent: function (error, context) {
      log.error(`[${context || "Error"}]`, error);
    },

    /**
     * Flush the early-error buffer to UIManager once it is ready.
     * Call this after UIManager.initialize().
     */
    flush: function () {
      _uiReady = true;
      while (_earlyBuffer.length > 0) {
        const msg = _earlyBuffer.shift();
        if (typeof UIManager !== "undefined" && UIManager.appendToConsole) {
          UIManager.appendToConsole(msg);
        }
      }
    },

    /**
     * Backward-compatible alias for report().
     * @param {Error|*} error
     * @param {string} [context]
     */
    displayError: function (error, context) {
      this.report(error, context);
    },

    wrapAsync: function (fn, context) {
      return async function (...args) {
        try {
          return await fn.apply(this, args);
        } catch (error) {
          ErrorHandler.displayError(error, context);
          throw error;
        }
      };
    },
  };
})();
