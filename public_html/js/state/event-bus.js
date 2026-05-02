/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * EventBus - Simple Pub/Sub event system for decoupled module communication
 * Enables loose coupling between BLE State Machine, UI Manager, and other modules.
 */

const EventBus = (function () {
  const log = Logger.scope("EventBus");
  const listeners = new Map();

  /**
   * Enable or disable debug logging.
   * Deprecated: use Logger.setLevel('debug') instead.
   * Kept for backward compatibility.
   */
  function setDebugMode(enabled) {
    if (enabled) Logger.setLevel("debug");
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name (e.g., 'BLE:CONNECTED')
   * @param {Function} handler - Event handler function
   * @returns {Function} Unsubscribe function
   */
  function on(event, handler) {
    if (typeof event !== "string" || event.length === 0) {
      log.error("EventBus.on: event name must be a non-empty string");
      return () => {};
    }
    if (typeof handler !== "function") {
      log.error("EventBus.on: handler must be a function");
      return () => {};
    }

    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event).add(handler);

    // Return unsubscribe function
    return function unsubscribe() {
      off(event, handler);
    };
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} handler - Handler to remove
   */
  function off(event, handler) {
    if (typeof event !== "string" || !listeners.has(event)) {
      return;
    }

    const eventListeners = listeners.get(event);
    eventListeners.delete(handler);

    if (eventListeners.size === 0) {
      listeners.delete(event);
    }
  }

  /**
   * Emit an event to all subscribers (synchronous)
   * @param {string} event - Event name
   * @param {*} data - Event data/payload
   */
  function emit(event, data) {
    if (typeof event !== "string" || event.length === 0) {
      log.error("EventBus.emit: event name must be a non-empty string");
      return;
    }

    log.debug(`emit ${event}`, data);

    if (!listeners.has(event)) {
      return;
    }

    const eventListeners = listeners.get(event);
    // Create array copy to allow modification during iteration
    const handlers = Array.from(eventListeners);

    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        log.error(`Error in handler for ${event}:`, error);
      }
    }
  }

  /**
   * Subscribe to an event once (auto-unsubscribes after first call)
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   * @returns {Function} Unsubscribe function
   */
  function once(event, handler) {
    let called = false;
    const wrappedHandler = function (data) {
      if (called) return;
      called = true;
      off(event, wrappedHandler);
      handler(data);
    };
    return on(event, wrappedHandler);
  }

  /**
   * Remove all listeners for a specific event
   * @param {string} event - Event name
   */
  function removeAllListeners(event) {
    if (typeof event !== "string") {
      return;
    }
    listeners.delete(event);
  }

  /**
   * Remove all listeners for all events
   */
  function clear() {
    listeners.clear();
  }

  /**
   * Get the number of listeners for a specific event
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  function listenerCount(event) {
    if (typeof event !== "string" || !listeners.has(event)) {
      return 0;
    }
    return listeners.get(event).size;
  }

  return {
    on: on,
    off: off,
    emit: emit,
    once: once,
    removeAllListeners: removeAllListeners,
    clear: clear,
    listenerCount: listenerCount,
    setDebugMode: setDebugMode,
  };
})();
