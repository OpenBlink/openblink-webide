/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink.org
 */

const ErrorHandler = (function() {
  const errorKeyMap = {
    'NotFoundError': 'error.deviceNotFound',
    'SecurityError': 'error.securityError',
    'NetworkError': 'error.networkError',
    'InvalidStateError': 'error.invalidStateError',
    'NotSupportedError': 'error.notSupportedError',
    'AbortError': 'error.abortError',
    'TimeoutError': 'error.timeoutError',
    'NotAllowedError': 'error.notAllowedError'
  };

  const fallbackMessages = {
    'NotFoundError': 'Device not found. Please make sure your OpenBlink device is turned on and nearby.',
    'SecurityError': 'Bluetooth access denied. Please grant permission in browser settings.',
    'NetworkError': 'Connection lost. Please check if the device is still connected.',
    'InvalidStateError': 'Device not connected. Please connect to a device first.',
    'NotSupportedError': 'This feature is not supported by your browser. Please use Chrome or Edge.',
    'AbortError': 'The operation was cancelled.',
    'TimeoutError': 'The operation timed out. Please try again.',
    'NotAllowedError': 'Permission denied. Please allow Bluetooth access when prompted.'
  };

  function t(key, params) {
    if (typeof I18n !== 'undefined') {
      return I18n.t(key, params);
    }
    return null;
  }

  return {
    getErrorMessage: function(error) {
      if (!error) {
        return t('error.unknown') || 'An unknown error occurred.';
      }

      if (errorKeyMap[error.name]) {
        const translated = t(errorKeyMap[error.name]);
        if (translated && translated !== errorKeyMap[error.name]) {
          return translated;
        }
        return fallbackMessages[error.name];
      }

      if (error.message) {
        if (error.message.includes('User cancelled')) {
          return t('error.userCancelled') || 'Connection cancelled by user.';
        }
        if (error.message.includes('GATT')) {
          return t('error.gattError') || 'Bluetooth communication error. Please try reconnecting.';
        }
        if (error.message.includes('adapter')) {
          return t('error.adapterError') || 'Bluetooth adapter not available. Please check if Bluetooth is enabled.';
        }
      }

      const genericMsg = t('error.generic', { message: error.message || error.name || 'Unknown error' });
      if (genericMsg && genericMsg !== 'error.generic') {
        return genericMsg;
      }
      return `An error occurred: ${error.message || error.name || 'Unknown error'}`;
    },

    displayError: function(error, context) {
      const friendlyMessage = this.getErrorMessage(error);
      
      const errorPrefix = (typeof I18n !== 'undefined') ? 'Error: ' : 'Error: ';
      UIManager.appendToConsole(errorPrefix + friendlyMessage);
      
      if (error && error.message && error.message !== friendlyMessage) {
        console.error(`[${context || 'Error'}] Technical details:`, error);
      }
    },

    wrapAsync: function(fn, context) {
      return async function(...args) {
        try {
          return await fn.apply(this, args);
        } catch (error) {
          ErrorHandler.displayError(error, context);
          throw error;
        }
      };
    }
  };
})();
