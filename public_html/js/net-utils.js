/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * NetUtils - Shared fetch utility with AbortController timeout and exponential-backoff retry.
 *
 * Consolidates the duplicated fetchWithTimeout + fetchWithRetry patterns previously
 * found in board-manager.js and i18n.js.
 *
 * Public API:
 *   NetUtils.fetchWithRetry(url, opts) → Promise<Response|string|object|ArrayBuffer|null>
 *
 * Options:
 *   timeout    {number}  ms before the request is aborted (default: Config.timeouts.fetchRequest)
 *   maxAttempts{number}  total attempts including first (default: Config.retries.fetchMaxAttempts)
 *   parseAs    {string}  'response'|'json'|'text'|'arrayBuffer' (default: 'response')
 *   useCache   {boolean} cache successful results by url+parseAs key (default: false)
 */
const NetUtils = (function () {
  const log = Logger.scope("NetUtils");

  const _cache = new Map();

  /**
   * Fetch a URL with AbortController timeout and exponential-backoff retry.
   *
   * @param {string} url
   * @param {{ timeout?: number, maxAttempts?: number, parseAs?: string, useCache?: boolean }} [opts]
   * @returns {Promise<Response|string|object|ArrayBuffer|null>}
   *   Returns null if all attempts fail (avoids throwing for non-critical fetches).
   */
  async function fetchWithRetry(url, opts) {
    const {
      timeout = Config.timeouts.fetchRequest,
      maxAttempts = Config.retries.fetchMaxAttempts,
      parseAs = "response",
      useCache = false,
    } = opts || {};

    // Response objects are single-use (body is a ReadableStream), so caching
    // them would hand a consumed object to the second caller.
    const cacheable = useCache && parseAs !== "response";
    const cacheKey = `${url}:${parseAs}`;
    if (cacheable && _cache.has(cacheKey)) {
      return _cache.get(cacheKey);
    }

    let lastError = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${url}`);
        }

        let result;
        switch (parseAs) {
          case "json":
            result = await response.json();
            break;
          case "text":
            result = await response.text();
            break;
          case "arrayBuffer":
            result = await response.arrayBuffer();
            break;
          default:
            result = response;
        }

        if (cacheable) _cache.set(cacheKey, result);
        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        lastError =
          error.name === "AbortError"
            ? new Error(`Request timeout after ${timeout}ms: ${url}`)
            : error;

        log.warn(
          `Fetch attempt ${attempt + 1}/${maxAttempts} failed for ${url}:`,
          lastError.message,
        );

        if (attempt < maxAttempts - 1) {
          const delay =
            Config.timeouts.bleReconnectInitialDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    log.error(
      `Failed to fetch ${url} after ${maxAttempts} attempts:`,
      lastError,
    );
    return null;
  }

  return Object.freeze({ fetchWithRetry });
})();
