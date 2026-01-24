/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2025 OpenBlink.org
 */

const ErrorHandler = (function() {
  const errorMap = {
    'NotFoundError': 'Device not found. Please make sure your OpenBlink device is turned on and nearby.',
    'SecurityError': 'Bluetooth access denied. Please grant permission in browser settings.',
    'NetworkError': 'Connection lost. Please check if the device is still connected.',
    'InvalidStateError': 'Device not connected. Please connect to a device first.',
    'NotSupportedError': 'This feature is not supported by your browser. Please use Chrome or Edge.',
    'AbortError': 'The operation was cancelled.',
    'TimeoutError': 'The operation timed out. Please try again.',
    'NotAllowedError': 'Permission denied. Please allow Bluetooth access when prompted.'
  };

  return {
    getErrorMessage: function(error) {
      if (!error) {
        return 'An unknown error occurred.';
      }

      if (errorMap[error.name]) {
        return errorMap[error.name];
      }

      if (error.message) {
        if (error.message.includes('User cancelled')) {
          return 'Connection cancelled by user.';
        }
        if (error.message.includes('GATT')) {
          return 'Bluetooth communication error. Please try reconnecting.';
        }
        if (error.message.includes('adapter')) {
          return 'Bluetooth adapter not available. Please check if Bluetooth is enabled.';
        }
      }

      return `An error occurred: ${error.message || error.name || 'Unknown error'}`;
    },

    displayError: function(error, context) {
      const friendlyMessage = this.getErrorMessage(error);
      
      UIManager.appendToConsole(`Error: ${friendlyMessage}`);
      
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
