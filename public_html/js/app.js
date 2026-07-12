(() => {
  // src/app/config.js
  var Config = Object.freeze({
    timeouts: Object.freeze({
      bleWrite: 1e4,
      bleRead: 8e3,
      bleNotificationStart: 8e3,
      bleConnectGatt: 15e3,
      bleConnectOverall: 3e4,
      bleDisconnect: 2500,
      bleHeartbeatInterval: 3e3,
      bleStatePollInterval: 2e3,
      bleReconnectInitialDelay: 1e3,
      fetchRequest: 15e3,
      fetchRetryInitialDelay: 1e3,
      scriptLoad: 3e4
    }),
    retries: Object.freeze({
      bleReconnectMaxAttempts: 5,
      fetchMaxAttempts: 3,
      scriptLoadMaxAttempts: 3
    }),
    logging: Object.freeze({
      defaultLevel: "warn",
      devLevel: "debug",
      storageKey: "openblink_log_level"
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
      crcPoly: 53621,
      crcInit: 65535
    })
  });

  // src/app/logger.js
  var Logger = (function() {
    const LEVELS = Object.freeze({
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4
    });
    const CONSOLE_METHODS = Object.freeze({
      debug: "debug",
      info: "info",
      warn: "warn",
      error: "error",
      fatal: "error"
    });
    let currentLevel = 2;
    function _resolveLevel(level) {
      if (typeof level === "number") {
        return level;
      }
      const n = LEVELS[String(level).toLowerCase()];
      return n !== void 0 ? n : 2;
    }
    function _readStoredLevel() {
      const defaultLevel = typeof Config !== "undefined" && Config.logging?.defaultLevel ? Config.logging.defaultLevel : "warn";
      const storageKey = typeof Config !== "undefined" && Config.logging?.storageKey ? Config.logging.storageKey : "openblink_log_level";
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored && LEVELS[stored] !== void 0) {
          return LEVELS[stored];
        }
      } catch (_storageErr) {
        return _resolveLevel(defaultLevel);
      }
      return _resolveLevel(defaultLevel);
    }
    function setLevel(level) {
      currentLevel = _resolveLevel(level);
      const storageKey = typeof Config !== "undefined" && Config.logging?.storageKey ? Config.logging.storageKey : "openblink_log_level";
      try {
        const name = Object.keys(LEVELS).find((k) => LEVELS[k] === currentLevel);
        if (name) {
          localStorage.setItem(storageKey, name);
        }
      } catch (_storageErr) {
        return;
      }
    }
    function getLevel() {
      return Object.keys(LEVELS).find((k) => LEVELS[k] === currentLevel) || "warn";
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
    function scope(name) {
      return Object.freeze({
        debug: (...args) => _emit("debug", name, args),
        info: (...args) => _emit("info", name, args),
        warn: (...args) => _emit("warn", name, args),
        error: (...args) => _emit("error", name, args),
        fatal: (...args) => _emit("fatal", name, args)
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
      scope
    });
  })();

  // src/app/utils.js
  var Utils = /* @__PURE__ */ (function() {
    return {
      escapeHtml: function(text) {
        if (typeof text !== "string") {
          return "";
        }
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      },
      unescapeHtml: function(text) {
        if (typeof text !== "string") {
          return "";
        }
        return text.replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
      }
    };
  })();

  // src/app/net-utils.js
  var NetUtils = (function() {
    const log = Logger.scope("NetUtils");
    const _cache = /* @__PURE__ */ new Map();
    const _inflight = /* @__PURE__ */ new Map();
    async function fetchWithRetry(url, opts) {
      const {
        timeout = Config.timeouts.fetchRequest,
        maxAttempts = Config.retries.fetchMaxAttempts,
        parseAs = "response",
        useCache = false
      } = opts || {};
      const cacheable = useCache && parseAs !== "response";
      const cacheKey = `${url}:${parseAs}`;
      if (cacheable) {
        if (_cache.has(cacheKey)) {
          return _cache.get(cacheKey);
        }
        if (_inflight.has(cacheKey)) {
          return _inflight.get(cacheKey);
        }
        const promise = _doFetchWithRetry(url, timeout, maxAttempts, parseAs).then((result) => {
          if (result !== null) _cache.set(cacheKey, result);
          return result;
        }).finally(() => {
          _inflight.delete(cacheKey);
        });
        _inflight.set(cacheKey, promise);
        return promise;
      }
      return _doFetchWithRetry(url, timeout, maxAttempts, parseAs);
    }
    async function _doFetchWithRetry(url, timeout, maxAttempts, parseAs) {
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
          return result;
        } catch (error) {
          clearTimeout(timeoutId);
          lastError = error.name === "AbortError" ? new Error(`Request timeout after ${timeout}ms: ${url}`) : error;
          log.warn(
            `Fetch attempt ${attempt + 1}/${maxAttempts} failed for ${url}:`,
            lastError.message
          );
          if (attempt < maxAttempts - 1) {
            const delay = Config.timeouts.fetchRetryInitialDelay * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
      log.error(
        `Failed to fetch ${url} after ${maxAttempts} attempts:`,
        lastError
      );
      return null;
    }
    return Object.freeze({ fetchWithRetry });
  })();

  // src/app/i18n.js
  function t(key, params) {
    if (typeof I18n !== "undefined" && typeof I18n.t === "function") {
      return I18n.t(key, params);
    }
    return null;
  }
  var I18n = (function() {
    const log = Logger.scope("I18n");
    const STORAGE_KEY = "openblink_language";
    const SUPPORTED_LANGUAGES = ["en", "zh-CN", "zh-TW", "ja", "ja-easy"];
    const DEFAULT_LANGUAGE = "en";
    let translations = {};
    let translationsCache = null;
    let currentLanguage = DEFAULT_LANGUAGE;
    let initialized = false;
    async function fetchTranslationsWithRetry() {
      if (translationsCache) {
        return translationsCache;
      }
      const result = await NetUtils.fetchWithRetry("i18n/translations.json", {
        parseAs: "json"
      });
      if (!result) {
        log.error("Failed to load translations after all retries.");
        return {};
      }
      translationsCache = result;
      return result;
    }
    function detectBrowserLanguage() {
      const browserLang = navigator.language || navigator.userLanguage || "";
      if (browserLang.startsWith("ja")) {
        return "ja";
      }
      if (browserLang === "zh-TW" || browserLang === "zh-Hant") {
        return "zh-TW";
      }
      if (browserLang.startsWith("zh")) {
        return "zh-CN";
      }
      return DEFAULT_LANGUAGE;
    }
    function loadSavedLanguage() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
          return saved;
        }
      } catch (e) {
        log.warn("Failed to load saved language:", e);
      }
      return null;
    }
    function saveLanguage(lang) {
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch (e) {
        log.warn("Failed to save language:", e);
      }
    }
    function applyTranslations() {
      const elements = document.querySelectorAll("[data-i18n]");
      elements.forEach(function(element) {
        const key = element.getAttribute("data-i18n");
        const translation = getTranslation(key);
        if (translation) {
          element.textContent = translation;
        }
      });
      const placeholderElements = document.querySelectorAll(
        "[data-i18n-placeholder]"
      );
      placeholderElements.forEach(function(element) {
        const key = element.getAttribute("data-i18n-placeholder");
        const translation = getTranslation(key);
        if (translation) {
          element.placeholder = translation;
        }
      });
      const titleElements = document.querySelectorAll("[data-i18n-title]");
      titleElements.forEach(function(element) {
        const key = element.getAttribute("data-i18n-title");
        const translation = getTranslation(key);
        if (translation) {
          element.title = translation;
        }
      });
      document.documentElement.lang = currentLanguage.split("-")[0];
    }
    function getTranslation(key) {
      const langData = translations[currentLanguage];
      if (langData && langData[key]) {
        return langData[key];
      }
      const fallbackData = translations[DEFAULT_LANGUAGE];
      if (fallbackData && fallbackData[key]) {
        return fallbackData[key];
      }
      return null;
    }
    function updateLanguageSelector() {
      const selector = document.getElementById("language-selector");
      if (selector) {
        selector.value = currentLanguage;
      }
    }
    return {
      init: async function() {
        if (initialized) return;
        translations = await fetchTranslationsWithRetry();
        const savedLang = loadSavedLanguage();
        if (savedLang) {
          currentLanguage = savedLang;
        } else {
          currentLanguage = detectBrowserLanguage();
        }
        applyTranslations();
        updateLanguageSelector();
        initialized = true;
      },
      setLanguage: function(lang) {
        if (!SUPPORTED_LANGUAGES.includes(lang)) {
          log.warn("Unsupported language:", lang);
          return false;
        }
        currentLanguage = lang;
        saveLanguage(lang);
        applyTranslations();
        updateLanguageSelector();
        const event = new CustomEvent("languageChanged", {
          detail: { language: lang }
        });
        document.dispatchEvent(event);
        return true;
      },
      getLanguage: function() {
        return currentLanguage;
      },
      getSupportedLanguages: function() {
        return SUPPORTED_LANGUAGES.slice();
      },
      t: function(key, params) {
        let translation = getTranslation(key);
        if (!translation) {
          return null;
        }
        if (params) {
          Object.keys(params).forEach(function(paramKey) {
            translation = translation.replace(
              new RegExp("\\{" + paramKey + "\\}", "g"),
              function() {
                return String(params[paramKey]);
              }
            );
          });
        }
        return translation;
      },
      isEasyJapanese: function() {
        return currentLanguage === "ja-easy";
      },
      getLocalizedFileSuffix: function() {
        const suffixes = {
          en: ".md",
          "zh-CN": ".zh-CN.md",
          "zh-TW": ".zh-TW.md",
          ja: ".ja.md",
          "ja-easy": ".ja-easy.md"
        };
        return suffixes[currentLanguage] || ".md";
      },
      wrapCompilerError: function(errorMessage) {
        if (this.isEasyJapanese()) {
          const prefix = this.t("compiler.error.prefix") || "";
          const suffix = this.t("compiler.error.suffix") || "";
          return prefix + "\n" + errorMessage + "\n" + suffix;
        }
        return errorMessage;
      },
      getLanguageDisplayName: function(langCode) {
        const names = {
          en: "English",
          "zh-CN": "\u7B80\u4F53\u4E2D\u6587",
          "zh-TW": "\u7E41\u9AD4\u4E2D\u6587",
          ja: "\u65E5\u672C\u8A9E",
          "ja-easy": "\u3084\u3055\u3057\u3044\u65E5\u672C\u8A9E"
        };
        return names[langCode] || langCode;
      }
    };
  })();

  // src/app/state/ble-states.js
  var BLEState = Object.freeze({
    DISCONNECTED: "DISCONNECTED",
    CONNECTING: "CONNECTING",
    CONNECTED: "CONNECTED",
    TRANSFERRING: "TRANSFERRING",
    RECONNECTING: "RECONNECTING",
    DISCONNECTING: "DISCONNECTING"
  });
  var BLE_VALID_TRANSITIONS = Object.freeze({
    [BLEState.DISCONNECTED]: Object.freeze([BLEState.CONNECTING]),
    [BLEState.CONNECTING]: Object.freeze([BLEState.CONNECTED, BLEState.DISCONNECTED]),
    [BLEState.CONNECTED]: Object.freeze([
      BLEState.TRANSFERRING,
      BLEState.DISCONNECTING,
      BLEState.RECONNECTING,
      BLEState.DISCONNECTED
    ]),
    [BLEState.TRANSFERRING]: Object.freeze([
      BLEState.CONNECTED,
      BLEState.DISCONNECTED,
      BLEState.RECONNECTING
    ]),
    [BLEState.RECONNECTING]: Object.freeze([BLEState.CONNECTED, BLEState.DISCONNECTED]),
    [BLEState.DISCONNECTING]: Object.freeze([BLEState.DISCONNECTED])
  });
  function isBLETransitionValid(from, to) {
    const allowed = BLE_VALID_TRANSITIONS[from];
    return Array.isArray(allowed) && allowed.includes(to);
  }

  // src/app/ble-protocol.js
  var BLEProtocol = (function() {
    const log = Logger.scope("BLEProtocol");
    let _bluetoothAvailable = null;
    async function checkAvailability() {
      if (!navigator.bluetooth) {
        _bluetoothAvailable = false;
        return false;
      }
      try {
        _bluetoothAvailable = await navigator.bluetooth.getAvailability();
      } catch (_e) {
        _bluetoothAvailable = false;
      }
      log.debug("Bluetooth available:", _bluetoothAvailable);
      return _bluetoothAvailable;
    }
    function isAvailable() {
      return _bluetoothAvailable;
    }
    function subscribeAvailability(handler) {
      if (!navigator.bluetooth) return;
      navigator.bluetooth.addEventListener("availabilitychanged", (event) => {
        _bluetoothAvailable = event.value;
        log.info("Bluetooth availability changed:", _bluetoothAvailable);
        if (handler) handler(_bluetoothAvailable);
      });
    }
    async function requestDevice() {
      return navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: Config.ble.namePrefix },
          { services: [Config.ble.serviceUUID] }
        ]
      });
    }
    function buildDataChunk(offset, chunkSize, mrbContent) {
      const actualChunkSize = Math.min(chunkSize, mrbContent.length - offset);
      const buffer = new ArrayBuffer(Config.ble.dataHeaderSize + actualChunkSize);
      const view = new DataView(buffer);
      view.setUint8(0, 1);
      view.setUint8(1, "D".charCodeAt(0));
      view.setUint16(2, offset, true);
      view.setUint16(4, actualChunkSize, true);
      const payload = new Uint8Array(
        buffer,
        Config.ble.dataHeaderSize,
        actualChunkSize
      );
      payload.set(mrbContent.subarray(offset, offset + actualChunkSize));
      return buffer;
    }
    function buildProgramCommand(contentLength, crc16, slot) {
      const buffer = new ArrayBuffer(Config.ble.programHeaderSize);
      const view = new DataView(buffer);
      view.setUint8(0, 1);
      view.setUint8(1, "P".charCodeAt(0));
      view.setUint16(2, contentLength, true);
      view.setUint16(4, crc16, true);
      view.setUint8(6, slot);
      view.setUint8(7, 0);
      return buffer;
    }
    function buildResetCommand() {
      const buffer = new ArrayBuffer(2);
      const view = new DataView(buffer);
      view.setUint8(0, 1);
      view.setUint8(1, "R".charCodeAt(0));
      return buffer;
    }
    function buildReloadCommand() {
      const buffer = new ArrayBuffer(2);
      const view = new DataView(buffer);
      view.setUint8(0, 1);
      view.setUint8(1, "L".charCodeAt(0));
      return buffer;
    }
    return {
      // Availability API
      checkAvailability,
      isAvailable,
      subscribeAvailability,
      // Device selection
      requestDevice,
      // Buffer builders
      buildDataChunk,
      buildProgramCommand,
      buildResetCommand,
      buildReloadCommand
    };
  })();

  // src/app/state/ble-command-queue.js
  var BLECommandQueue = (function() {
    const log = Logger.scope("BLECommandQueue");
    let tail = Promise.resolve();
    let pendingCount = 0;
    let generation = 0;
    function _withTimeout(promise, timeoutMs, label) {
      return new Promise((resolve, reject) => {
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          log.warn(`Timeout after ${timeoutMs}ms: ${label}`);
          reject(
            new Error(`BLE operation timed out after ${timeoutMs}ms: ${label}`)
          );
        }, timeoutMs);
        promise.then((v) => {
          if (!timedOut) {
            clearTimeout(timer);
            resolve(v);
          }
        }).catch((err) => {
          if (!timedOut) {
            clearTimeout(timer);
            reject(err);
          }
        });
      });
    }
    function _enqueue(fn, timeoutMs, label) {
      pendingCount++;
      const gen = generation;
      let opPromise = null;
      const p = tail.then(() => {
        opPromise = Promise.resolve().then(fn);
        return _withTimeout(opPromise, timeoutMs, label);
      });
      tail = p.catch((err) => {
        log.debug(`Queue operation failed [${label}]:`, err.message);
        return opPromise ? opPromise.catch(() => void 0) : void 0;
      });
      tail.finally(() => {
        if (generation === gen) {
          pendingCount = Math.max(0, pendingCount - 1);
        }
      });
      return p;
    }
    function _doWrite(char, buffer, mode) {
      if (mode === "response") {
        return char.writeValueWithResponse(buffer);
      }
      if (mode === "no-response") {
        return char.writeValueWithoutResponse(buffer);
      }
      if (char.properties && char.properties.writeWithoutResponse) {
        return char.writeValueWithoutResponse(buffer);
      }
      if (char.properties && char.properties.write) {
        return char.writeValueWithResponse(buffer);
      }
      return char.writeValue(buffer);
    }
    function enqueueWrite(char, buffer, opts) {
      const {
        timeout = Config.timeouts.bleWrite,
        label = "write",
        mode = "auto",
        bypass = false
      } = opts || {};
      if (bypass) {
        log.debug(`Bypassing queue for ${label}`);
        return _withTimeout(_doWrite(char, buffer, mode), timeout, label);
      }
      return _enqueue(() => _doWrite(char, buffer, mode), timeout, label);
    }
    function enqueueRead(char, opts) {
      const { timeout = Config.timeouts.bleRead, label = "read" } = opts || {};
      return _enqueue(() => char.readValue(), timeout, label);
    }
    function enqueueNotify(char, opts) {
      const {
        timeout = Config.timeouts.bleNotificationStart,
        label = "notify",
        start = true
      } = opts || {};
      return _enqueue(
        () => start ? char.startNotifications() : char.stopNotifications(),
        timeout,
        label
      );
    }
    function clear(opts) {
      const { reason = "clear" } = opts || {};
      log.info(`Queue cleared: ${reason} (pending=${pendingCount})`);
      tail = Promise.resolve();
      pendingCount = 0;
      generation++;
    }
    function size() {
      return pendingCount;
    }
    return Object.freeze({
      enqueueWrite,
      enqueueRead,
      enqueueNotify,
      clear,
      size
    });
  })();

  // src/app/state/ble-connection.js
  var BLEConnection = (function() {
    const log = Logger.scope("BLEConnection");
    const textDecoder = new TextDecoder();
    const consoleHandlers = /* @__PURE__ */ new WeakMap();
    function _validateProperties(char, name, expected) {
      for (const prop of expected) {
        if (!char.properties[prop]) {
          log.warn(`${name} is missing property: ${prop}`);
        }
      }
    }
    async function _negotiateMTU(mtuChar) {
      try {
        const dataView = await BLECommandQueue.enqueueRead(mtuChar, {
          label: "negotiateMTU",
          timeout: Config.timeouts.bleRead
        });
        const deviceMTU = dataView.getUint16(0, true);
        const effective = deviceMTU - 3;
        log.info(`Negotiated MTU: ${effective} (raw=${deviceMTU})`);
        return effective;
      } catch (err) {
        log.warn("MTU negotiation failed, using default:", err.message);
        return Config.ble.defaultMTU;
      }
    }
    async function _startNotifications(consoleChar, onMessage) {
      const handler = (event) => {
        const value = textDecoder.decode(event.target.value);
        if (onMessage) onMessage(value);
      };
      consoleHandlers.set(consoleChar, handler);
      consoleChar.addEventListener("characteristicvaluechanged", handler);
      await BLECommandQueue.enqueueNotify(consoleChar, {
        start: true,
        label: "startNotifications",
        timeout: Config.timeouts.bleNotificationStart
      });
    }
    async function _stopNotifications(consoleChar) {
      if (!consoleChar) return;
      const handler = consoleHandlers.get(consoleChar);
      if (handler) {
        consoleChar.removeEventListener("characteristicvaluechanged", handler);
        consoleHandlers.delete(consoleChar);
      }
      try {
        await BLECommandQueue.enqueueNotify(consoleChar, {
          start: false,
          label: "stopNotifications",
          timeout: Config.timeouts.bleNotificationStart
        });
      } catch (err) {
        log.warn("stopNotifications failed (ignored):", err.message);
      }
    }
    async function _dumpGATTStructure(server, signal) {
      const diagLog = Logger.scope("Diagnostic");
      if (Logger.getLevel() !== "debug") return;
      try {
        diagLog.debug("=== GATT structure dump ===");
        const services = await server.getPrimaryServices();
        _checkSignalAborted(signal);
        for (const svc of services) {
          diagLog.debug(`Service: ${svc.uuid} (primary=${svc.isPrimary})`);
          try {
            const chars = await svc.getCharacteristics();
            for (const c of chars) {
              const props = Object.keys(c.properties).filter((k) => c.properties[k] === true).join(", ");
              diagLog.debug(`  Char: ${c.uuid} [${props}]`);
            }
          } catch (err) {
            diagLog.debug(
              `  (could not enumerate characteristics: ${err.message})`
            );
          }
          _checkSignalAborted(signal);
        }
        diagLog.debug("=== end GATT dump ===");
      } catch (err) {
        if (err.name === "AbortError") throw err;
        diagLog.debug("GATT dump failed:", err.message);
      }
    }
    function _checkSignalAborted(signal) {
      if (signal?.aborted) {
        const err = new Error("Operation aborted");
        err.name = "AbortError";
        throw err;
      }
    }
    async function establish(device, signal, onConsoleMessage) {
      _checkSignalAborted(signal);
      log.info("Connecting to", device.name);
      const server = await device.gatt.connect();
      _checkSignalAborted(signal);
      if (!server || !server.connected) {
        throw new Error(
          "GATT connection failed: server not connected after connect()"
        );
      }
      const service = await server.getPrimaryService(Config.ble.serviceUUID);
      _checkSignalAborted(signal);
      const [consoleChar, programChar, mtuChar] = await Promise.all([
        service.getCharacteristic(Config.ble.consoleCharUUID),
        service.getCharacteristic(Config.ble.programCharUUID),
        service.getCharacteristic(Config.ble.mtuCharUUID)
      ]);
      _checkSignalAborted(signal);
      _validateProperties(programChar, "programChar", [
        "write",
        "writeWithoutResponse"
      ]);
      _validateProperties(consoleChar, "consoleChar", ["notify"]);
      _validateProperties(mtuChar, "mtuChar", ["read"]);
      await _dumpGATTStructure(server, signal);
      const mtu = await _negotiateMTU(mtuChar);
      _checkSignalAborted(signal);
      await _startNotifications(consoleChar, onConsoleMessage);
      _checkSignalAborted(signal);
      log.info(`Connected: ${device.name}, MTU=${mtu}`);
      return { device, programChar, mtuChar, consoleChar, mtu };
    }
    async function tearDown(device, consoleChar) {
      if (consoleChar) {
        await _stopNotifications(consoleChar);
      }
      BLECommandQueue.clear({ reason: "tearDown" });
      if (device && device.gatt && device.gatt.connected) {
        device.gatt.disconnect();
      }
    }
    function awaitDisconnect(device, timeoutMs) {
      return new Promise((resolve) => {
        if (!device) {
          log.warn("awaitDisconnect: device is null, resolving as timeout");
          resolve("timeout");
          return;
        }
        const timer = setTimeout(() => {
          log.warn(`awaitDisconnect: timeout after ${timeoutMs}ms`);
          resolve("timeout");
        }, timeoutMs);
        const handler = () => {
          clearTimeout(timer);
          resolve("event");
        };
        device.addEventListener("gattserverdisconnected", handler, {
          once: true
        });
      });
    }
    function scheduleReconnect(device, attempt, signal, onConsoleMessage, onConnected, onFailed) {
      const delay = Config.timeouts.bleReconnectInitialDelay * Math.pow(2, attempt - 1);
      log.info(`Reconnect scheduled: attempt=${attempt}, delay=${delay}ms`);
      let timerId = null;
      timerId = setTimeout(async () => {
        if (signal && signal.aborted) {
          log.info("Reconnect cancelled (aborted)");
          return;
        }
        try {
          const result = await establish(device, signal, onConsoleMessage);
          onConnected(result);
        } catch (err) {
          log.warn(`Reconnect attempt ${attempt} failed:`, err.message);
          onFailed(err);
        }
      }, delay);
      return {
        cancel() {
          clearTimeout(timerId);
          timerId = null;
        }
      };
    }
    return Object.freeze({
      establish,
      tearDown,
      awaitDisconnect,
      scheduleReconnect
    });
  })();

  // src/app/lib/crc.js
  function crc16_reflect(poly, seed, src) {
    let crc = seed;
    for (let i = 0; i < src.length; i++) {
      crc ^= src[i];
      for (let j = 0; j < 8; j++) {
        if (crc & 1) {
          crc = crc >>> 1 ^ poly;
        } else {
          crc = crc >>> 1;
        }
      }
    }
    return crc & 65535;
  }

  // src/app/state/ble-transfer.js
  var BLETransfer = (function() {
    const log = Logger.scope("BLETransfer");
    function _checkSignalAborted(signal) {
      if (signal?.aborted) {
        const err = new Error("Transfer aborted");
        err.name = "AbortError";
        throw err;
      }
    }
    async function run(programChar, bytecode, slot, mtu, signal, onProgress) {
      const total = bytecode.length;
      const payloadSize = mtu - Config.ble.dataHeaderSize;
      const crc16 = crc16_reflect(
        Config.ble.crcPoly,
        Config.ble.crcInit,
        bytecode
      );
      log.info(
        `Transfer start: ${total} bytes, slot=${slot}, MTU=${mtu}, CRC=0x${crc16.toString(16)}`
      );
      for (let offset = 0; offset < total; offset += payloadSize) {
        _checkSignalAborted(signal);
        const chunkSize = Math.min(payloadSize, total - offset);
        const buf = BLEProtocol.buildDataChunk(offset, chunkSize, bytecode);
        await BLECommandQueue.enqueueWrite(programChar, buf, {
          label: `data@${offset}`,
          mode: "no-response",
          timeout: Config.timeouts.bleWrite,
          bypass: true
        });
        const sent = offset + chunkSize;
        if (onProgress) onProgress(sent, total);
      }
      _checkSignalAborted(signal);
      const programBuf = BLEProtocol.buildProgramCommand(total, crc16, slot);
      await BLECommandQueue.enqueueWrite(programChar, programBuf, {
        label: "programCmd",
        mode: "no-response",
        timeout: Config.timeouts.bleWrite,
        bypass: true
      });
      _checkSignalAborted(signal);
      const reloadBuf = BLEProtocol.buildReloadCommand();
      await BLECommandQueue.enqueueWrite(programChar, reloadBuf, {
        label: "reloadCmd",
        mode: "no-response",
        timeout: Config.timeouts.bleWrite,
        bypass: true
      });
      log.info("Transfer complete");
    }
    return Object.freeze({ run });
  })();

  // src/app/state/ble-state-machine.js
  var BLEStateMachine = (function() {
    const log = Logger.scope("BLEStateMachine");
    let state = BLEState.DISCONNECTED;
    let previousState = null;
    let eventBus = null;
    let connectedDevice = null;
    let programCharacteristic = null;
    let negotiatedMtuCharacteristic = null;
    let consoleCharacteristic = null;
    let negotiatedMTU = Config.ble.defaultMTU;
    let reconnectAttempts = 0;
    let reconnectHandle = null;
    let userInitiatedDisconnect = false;
    let connectAbortController = null;
    let transferAbortController = null;
    let heartbeatTimer = null;
    let pollTimer = null;
    let cleanedUp = false;
    function _emit(event, payload) {
      if (eventBus) eventBus.emit(event, payload);
    }
    function transition(newState, payload) {
      if (state === newState) return;
      if (!isBLETransitionValid(state, newState)) {
        log.error(`Invalid transition: ${state} -> ${newState}`);
        return;
      }
      previousState = state;
      state = newState;
      log.info(`State: ${previousState} -> ${newState}`);
      _emit("BLE:STATE_CHANGED", { from: previousState, to: newState, payload });
    }
    async function sendHeartbeat() {
      if (!negotiatedMtuCharacteristic || state !== BLEState.CONNECTED) return;
      try {
        await BLECommandQueue.enqueueRead(negotiatedMtuCharacteristic, {
          label: "heartbeat",
          timeout: Config.timeouts.bleRead
        });
      } catch (err) {
        if (err.message.includes("disconnected") || err.message.includes("GATT Server is disconnected") || err.name === "NotSupportedError" || err.name === "NetworkError") {
          log.warn(
            "Heartbeat detected GATT error, triggering disconnect handler:",
            err.message
          );
          if (connectedDevice && connectedDevice.gatt) {
            handleDisconnect({ target: connectedDevice });
          }
        } else {
          log.warn("Heartbeat failed:", err.message);
        }
      }
    }
    function startHeartbeat() {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(
        sendHeartbeat,
        Config.timeouts.bleHeartbeatInterval
      );
    }
    function stopHeartbeat() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    }
    function startPoller() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(() => {
        if ((state === BLEState.CONNECTED || state === BLEState.TRANSFERRING) && connectedDevice && connectedDevice.gatt && !connectedDevice.gatt.connected) {
          log.warn(
            "Poller detected GATT disconnected; triggering handleDisconnect"
          );
          handleDisconnect({ target: connectedDevice });
        }
      }, Config.timeouts.bleStatePollInterval);
    }
    function stopPoller() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }
    function cleanupResources() {
      if (cleanedUp) return;
      cleanedUp = true;
      stopHeartbeat();
      stopPoller();
      BLECommandQueue.clear({ reason: "cleanup" });
      if (reconnectHandle) {
        reconnectHandle.cancel();
        reconnectHandle = null;
      }
      if (connectedDevice) {
        connectedDevice.removeEventListener(
          "gattserverdisconnected",
          handleDisconnect
        );
      }
      if (connectAbortController) {
        connectAbortController.abort();
        connectAbortController = null;
      }
      if (transferAbortController) {
        transferAbortController.abort();
        transferAbortController = null;
      }
      userInitiatedDisconnect = false;
      reconnectAttempts = 0;
      connectedDevice = null;
      programCharacteristic = null;
      negotiatedMtuCharacteristic = null;
      consoleCharacteristic = null;
      negotiatedMTU = Config.ble.defaultMTU;
    }
    function _resetCleanupGuard() {
      cleanedUp = false;
    }
    function handleDisconnect(event) {
      const device = event.target;
      if (userInitiatedDisconnect) {
        cleanupResources();
        transition(BLEState.DISCONNECTED, { reason: "user" });
        _emit("BLE:DISCONNECTED", { reason: "user" });
        return;
      }
      _tryReconnect(device, "max_reconnects");
    }
    function _tryReconnect(device, failReason) {
      if (reconnectAttempts < Config.retries.bleReconnectMaxAttempts) {
        reconnectAttempts++;
        transition(BLEState.RECONNECTING, {
          attempt: reconnectAttempts,
          maxAttempts: Config.retries.bleReconnectMaxAttempts
        });
        _emit("BLE:RECONNECTING", {
          attempt: reconnectAttempts,
          maxAttempts: Config.retries.bleReconnectMaxAttempts,
          delay: Config.timeouts.bleReconnectInitialDelay * Math.pow(2, reconnectAttempts - 1)
        });
        _scheduleReconnect(device, reconnectAttempts);
      } else {
        cleanupResources();
        transition(BLEState.DISCONNECTED, { reason: failReason });
        _emit("BLE:DISCONNECTED", { reason: failReason });
        _emit("BLE:RECONNECT_FAILED", {
          attempts: Config.retries.bleReconnectMaxAttempts
        });
      }
    }
    function _onConsoleMessage(message) {
      _emit("BLE:CONSOLE_MESSAGE", { message });
    }
    function _applyConnectionResult(result) {
      connectedDevice = result.device;
      programCharacteristic = result.programChar;
      negotiatedMtuCharacteristic = result.mtuChar;
      consoleCharacteristic = result.consoleChar;
      negotiatedMTU = result.mtu;
    }
    function _afterConnected(deviceName) {
      connectedDevice.addEventListener(
        "gattserverdisconnected",
        handleDisconnect
      );
      startHeartbeat();
      startPoller();
      reconnectAttempts = 0;
      _resetCleanupGuard();
      transition(BLEState.CONNECTED, { deviceName });
      _emit("BLE:CONNECTED", { deviceName });
    }
    function _scheduleReconnect(device, attempt) {
      if (reconnectHandle) {
        reconnectHandle.cancel();
        reconnectHandle = null;
      }
      const signal = connectAbortController ? connectAbortController.signal : void 0;
      reconnectHandle = BLEConnection.scheduleReconnect(
        device,
        attempt,
        signal,
        _onConsoleMessage,
        (result) => {
          reconnectHandle = null;
          _applyConnectionResult(result);
          _afterConnected(device.name);
        },
        (_err) => {
          reconnectHandle = null;
          _tryReconnect(device, "reconnect_failed");
        }
      );
    }
    return {
      /**
       * Initialize with an EventBus instance.
       * @param {Object} bus
       */
      init(bus) {
        eventBus = bus;
      },
      /** @returns {string} */
      getState() {
        return state;
      },
      /** @returns {boolean} */
      isConnected() {
        return state === BLEState.CONNECTED;
      },
      /** @returns {boolean} */
      isTransferring() {
        return state === BLEState.TRANSFERRING;
      },
      /** @returns {boolean} */
      canTransfer() {
        return state === BLEState.CONNECTED;
      },
      /** @returns {number} */
      getNegotiatedMTU() {
        return negotiatedMTU;
      },
      /**
       * Return the id of the currently-connected BluetoothDevice, or null.
       * Used by BLEKnownDevices.forget() to detect if the device to forget is active.
       * @returns {string|null}
       */
      getConnectedDeviceId() {
        return connectedDevice ? connectedDevice.id : null;
      },
      /**
       * Connect to a BLE device.
       * @param {{ device?: BluetoothDevice }} [opts]
       *   opts.device - If provided, skip requestDevice() and connect directly
       *                 (used by BLEKnownDevices.connectKnown()).
       */
      async connect(opts) {
        if (state !== BLEState.DISCONNECTED) return;
        transition(BLEState.CONNECTING);
        userInitiatedDisconnect = false;
        reconnectAttempts = 0;
        _resetCleanupGuard();
        connectAbortController = new AbortController();
        const signal = connectAbortController.signal;
        let device = null;
        try {
          device = opts && opts.device ? opts.device : await BLEProtocol.requestDevice();
          const result = await BLEConnection.establish(
            device,
            signal,
            _onConsoleMessage
          );
          connectAbortController = null;
          _applyConnectionResult(result);
          _afterConnected(device.name);
        } catch (error) {
          connectAbortController = null;
          if (device?.gatt?.connected) {
            await BLEConnection.tearDown(device).catch(() => {
            });
          }
          cleanupResources();
          transition(BLEState.DISCONNECTED, { error });
          _emit("BLE:CONNECT_FAILED", { error });
        }
      },
      /**
       * Disconnect from the device.
       * Waits for gattserverdisconnected event (max bleDisconnect ms).
       */
      async disconnect() {
        if (state === BLEState.DISCONNECTED || state === BLEState.DISCONNECTING)
          return;
        userInitiatedDisconnect = true;
        reconnectAttempts = Config.retries.bleReconnectMaxAttempts;
        if (connectAbortController) {
          connectAbortController.abort();
          connectAbortController = null;
        }
        if (transferAbortController) {
          transferAbortController.abort();
          transferAbortController = null;
        }
        if (connectedDevice && connectedDevice.gatt && connectedDevice.gatt.connected) {
          transition(BLEState.DISCONNECTING);
          await BLEConnection.tearDown(connectedDevice, consoleCharacteristic);
          const outcome = await BLEConnection.awaitDisconnect(
            connectedDevice,
            Config.timeouts.bleDisconnect
          );
          if (outcome === "timeout") {
            log.warn(
              "disconnect: event not received within timeout, forcing cleanup"
            );
          }
        }
        if (state !== BLEState.DISCONNECTED) {
          cleanupResources();
          transition(BLEState.DISCONNECTED, { reason: "user" });
          _emit("BLE:DISCONNECTED", { reason: "user" });
        }
      },
      /**
       * Send R (reset) command.
       */
      async sendReset() {
        if (state !== BLEState.CONNECTED || !programCharacteristic) {
          throw new Error("Not connected");
        }
        const buffer = BLEProtocol.buildResetCommand();
        try {
          await BLECommandQueue.enqueueWrite(programCharacteristic, buffer, {
            label: "resetCmd",
            mode: "response"
          });
          _emit("BLE:RESET_SENT", {});
        } catch (error) {
          _emit("BLE:RESET_FAILED", { error });
          log.warn("Reset command failed:", error.message);
        }
      },
      /**
       * Send L (reload) command.
       */
      async sendReload() {
        if (state !== BLEState.CONNECTED || !programCharacteristic) {
          throw new Error("Not connected");
        }
        const buffer = BLEProtocol.buildReloadCommand();
        try {
          await BLECommandQueue.enqueueWrite(programCharacteristic, buffer, {
            label: "reloadCmd",
            mode: "response"
          });
          _emit("BLE:RELOAD_SENT", {});
        } catch (error) {
          _emit("BLE:RELOAD_FAILED", { error });
          log.warn("Reload command failed:", error.message);
        }
      },
      /**
       * Transfer firmware bytecode to the device.
       * @param {Uint8Array} bytecode
       * @param {number} slot - 1 or 2
       * @param {Function} [onProgress] - (sent, total) => void
       */
      async startTransfer(bytecode, slot, onProgress) {
        if (state !== BLEState.CONNECTED || !programCharacteristic) {
          throw new Error("Not connected");
        }
        transition(BLEState.TRANSFERRING);
        stopHeartbeat();
        _emit("BLE:TRANSFER_STARTED", {});
        transferAbortController = new AbortController();
        const signal = transferAbortController.signal;
        const progressProxy = onProgress ? (sent, total) => {
          onProgress(sent, total);
          _emit("BLE:TRANSFER_PROGRESS", { sent, total });
        } : (sent, total) => {
          _emit("BLE:TRANSFER_PROGRESS", { sent, total });
        };
        try {
          await BLETransfer.run(
            programCharacteristic,
            bytecode,
            slot,
            negotiatedMTU,
            signal,
            progressProxy
          );
          transition(BLEState.CONNECTED);
          _emit("BLE:TRANSFER_COMPLETE", {});
        } catch (error) {
          if (!connectedDevice || !connectedDevice.gatt || !connectedDevice.gatt.connected) {
            transition(BLEState.DISCONNECTED, { reason: "transfer_error" });
            _emit("BLE:DISCONNECTED", { reason: "transfer_error" });
          } else {
            transition(BLEState.CONNECTED);
          }
          _emit("BLE:TRANSFER_FAILED", { error });
          throw error;
        } finally {
          transferAbortController = null;
          if (state === BLEState.CONNECTED) startHeartbeat();
        }
      },
      /**
       * Phase 3F: Pause heartbeat and poller when page goes to background.
       * Called on visibilitychange (hidden) to reduce background GATT activity.
       */
      pauseBackgroundTimers() {
        stopHeartbeat();
        stopPoller();
        log.info("Background timers paused");
      },
      /**
       * Phase 3F: Resume heartbeat and poller when page returns to foreground.
       * Only resumes if the state machine is currently CONNECTED.
       */
      resumeBackgroundTimers() {
        if (state === BLEState.CONNECTED) {
          startHeartbeat();
          startPoller();
          log.info("Background timers resumed");
        }
      },
      /**
       * Full cleanup for page unload.
       */
      cleanup() {
        cleanupResources();
        if (state !== BLEState.DISCONNECTED) {
          transition(BLEState.DISCONNECTED, { reason: "cleanup" });
        }
      }
    };
  })();

  // src/app/state/ble-known-devices.js
  var BLEKnownDevices = (function() {
    const log = Logger.scope("BLEKnownDevices");
    function isSupported() {
      try {
        return typeof navigator !== "undefined" && navigator.bluetooth != null && typeof navigator.bluetooth.getDevices === "function";
      } catch (err) {
        log.debug("isSupported() check failed:", err.message);
        return false;
      }
    }
    async function list() {
      if (!isSupported()) return [];
      try {
        const devices = await navigator.bluetooth.getDevices();
        return devices.filter(
          (d) => d.name && d.name.startsWith(Config.ble.namePrefix)
        );
      } catch (err) {
        if (err.name === "NotSupportedError") {
          log.debug("getDevices() not supported in this browser");
        } else {
          log.warn("getDevices() failed:", err.message);
        }
        return [];
      }
    }
    async function findById(id) {
      const devices = await list();
      return devices.find((d) => d.id === id) || null;
    }
    async function connectKnown(device) {
      if (!device) throw new Error("device is required");
      log.info("Connecting to known device:", device.name);
      await BLEStateMachine.connect({ device });
    }
    async function forget(device) {
      if (!device) throw new Error("device is required");
      if (typeof device.forget !== "function") {
        throw new Error("device.forget() is not supported in this browser");
      }
      const currentState = BLEStateMachine.getState();
      const isActive = currentState !== BLEState.DISCONNECTED && currentState !== BLEState.DISCONNECTING;
      if (isActive && device.id === _getConnectedDeviceId()) {
        log.info("Disconnecting before forget:", device.name);
        await BLEStateMachine.disconnect();
      }
      log.info("Forgetting device:", device.name);
      await device.forget();
      log.info("Device forgotten:", device.name);
    }
    function _getConnectedDeviceId() {
      if (typeof BLEStateMachine.getConnectedDeviceId === "function") {
        return BLEStateMachine.getConnectedDeviceId();
      }
      return null;
    }
    return Object.freeze({ isSupported, list, findById, connectKnown, forget });
  })();

  // src/app/file-manager.js
  var FileManager = /* @__PURE__ */ (function() {
    let editorView = null;
    let currentFile = null;
    let isDirty = false;
    function setupChangeTracking() {
      if (editorView) {
        window.addEventListener("openblink:editor-doc-changed", () => {
          isDirty = true;
        });
      }
    }
    function setupBeforeUnload() {
      window.addEventListener("beforeunload", (e) => {
        if (isDirty) {
          e.preventDefault();
          e.returnValue = "";
        }
      });
    }
    return {
      initialize: function(editorInstance) {
        editorView = editorInstance;
        setupChangeTracking();
        setupBeforeUnload();
      },
      loadFile: function() {
        if (!this.checkUnsavedChanges()) {
          return;
        }
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".rb";
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          if (!file.name.endsWith(".rb")) {
            UIManager.appendToConsole("Error: Please select a .rb file");
            return;
          }
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target.result;
            if (editorView) {
              editorView.dispatch({
                changes: {
                  from: 0,
                  to: editorView.state.doc.length,
                  insert: content
                }
              });
              currentFile = file.name;
              isDirty = false;
              this.updateFilenameInput();
              UIManager.appendToConsole(`Loaded file: ${file.name}`);
            }
          };
          reader.onerror = () => {
            UIManager.appendToConsole("Error: Failed to read file");
          };
          reader.readAsText(file);
        };
        input.click();
      },
      saveFile: function() {
        if (!editorView) return;
        const filenameInput = document.getElementById("filename-input");
        let filename = filenameInput ? filenameInput.value.trim() : "";
        if (!filename) {
          filename = "program.rb";
        }
        if (!filename.endsWith(".rb")) {
          filename += ".rb";
        }
        const content = editorView.state.doc.toString();
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        currentFile = filename;
        isDirty = false;
        UIManager.appendToConsole(`Downloaded file: ${filename}`);
      },
      checkUnsavedChanges: function() {
        if (isDirty) {
          return confirm("You have unsaved changes. Do you want to continue?");
        }
        return true;
      },
      markClean: function() {
        isDirty = false;
      },
      isDirty: function() {
        return isDirty;
      },
      getCurrentFileName: function() {
        return currentFile;
      },
      updateFilenameInput: function() {
        const filenameInput = document.getElementById("filename-input");
        if (filenameInput) {
          filenameInput.value = currentFile || "program.rb";
        }
      },
      setCurrentFileName: function(name) {
        currentFile = name;
        this.updateFilenameInput();
      }
    };
  })();

  // src/app/board-manager.js
  var BoardManager = (function() {
    const log = Logger.scope("BoardManager");
    let boards = [];
    let currentBoard = null;
    async function fetchJSON(url) {
      return NetUtils.fetchWithRetry(url, { parseAs: "json", useCache: true });
    }
    async function fetchText(url) {
      return NetUtils.fetchWithRetry(url, { parseAs: "text", useCache: true });
    }
    async function fetchLocalizedReference(boardName) {
      let suffix = ".md";
      if (typeof I18n !== "undefined" && typeof I18n.getLocalizedFileSuffix === "function") {
        try {
          const localizedSuffix = I18n.getLocalizedFileSuffix();
          if (typeof localizedSuffix === "string" && localizedSuffix.trim() !== "") {
            suffix = localizedSuffix;
          }
        } catch (error) {
          log.error("Failed to get localized file suffix from I18n:", error);
        }
      }
      const localizedPath = `boards/${boardName}/reference${suffix}`;
      let content = await fetchText(localizedPath);
      if (!content && suffix !== ".md") {
        content = await fetchText(`boards/${boardName}/reference.md`);
      }
      return content;
    }
    return {
      loadBoards: async function() {
        const boardList = ["xiao-nrf54l15", "m5stamps3"];
        const loaded = await Promise.all(
          boardList.map(async (boardName) => {
            const [config, sampleCode, reference] = await Promise.all([
              fetchJSON(`boards/${boardName}/config.json`),
              fetchText(`boards/${boardName}/sample.rb`),
              fetchLocalizedReference(boardName)
            ]);
            if (!config) return null;
            return {
              name: boardName,
              displayName: config.displayName || config.name,
              manufacturer: config.manufacturer,
              description: config.description,
              sampleCode: sampleCode || "",
              reference: reference || "",
              simulator: config.simulator || null
            };
          })
        );
        boards.push(...loaded.filter((b) => b !== null));
        if (boards.length > 0) {
          currentBoard = boards[0];
          UIManager.populateBoardSelector(boards);
          if (currentBoard.sampleCode && window.editorView) {
            window.editorView.dispatch({
              changes: {
                from: 0,
                to: window.editorView.state.doc.length,
                insert: currentBoard.sampleCode
              }
            });
            if (typeof FileManager !== "undefined" && typeof FileManager.markClean === "function") {
              FileManager.markClean();
            }
          }
          this.updateReferencePanel(currentBoard);
          UIManager.updateSimulatorButton(currentBoard);
        }
        return boards;
      },
      getCurrentBoard: function() {
        return currentBoard;
      },
      getBoards: function() {
        return boards;
      },
      switchBoard: async function(boardName) {
        const board = boards.find((b) => b.name === boardName);
        if (!board) {
          const errorMsg = typeof I18n !== "undefined" ? I18n.t("error.boardNotFound", { boardName }) : `Error: Board "${boardName}" not found`;
          UIManager.appendToConsole(errorMsg);
          return false;
        }
        if (!FileManager.checkUnsavedChanges()) {
          return false;
        }
        currentBoard = board;
        if (board.sampleCode && window.editorView) {
          window.editorView.dispatch({
            changes: {
              from: 0,
              to: window.editorView.state.doc.length,
              insert: board.sampleCode
            }
          });
          FileManager.markClean();
        }
        await this.updateReferencePanel(board);
        UIManager.updateSimulatorButton(board);
        const switchMsg = typeof I18n !== "undefined" ? I18n.t("message.boardSwitched", { boardName: board.displayName }) : `Switched to board: ${board.displayName}`;
        UIManager.appendToConsole(switchMsg);
        return true;
      },
      hasSimulatorSupport: function(board) {
        return board && board.simulator && board.simulator.enabled === true;
      },
      updateReferencePanel: async function(board) {
        const referenceContent = document.getElementById("reference-content");
        if (!referenceContent || !board) return;
        const localizedReference = await fetchLocalizedReference(board.name);
        if (localizedReference) {
          referenceContent.innerHTML = this.parseMarkdown(localizedReference);
        } else if (board.reference) {
          referenceContent.innerHTML = this.parseMarkdown(board.reference);
        } else {
          const noDocMsg = typeof I18n !== "undefined" ? I18n.t("reference.noDoc") : "No reference documentation available for this board.";
          referenceContent.innerHTML = "<p>" + Utils.escapeHtml(noDocMsg) + "</p>";
        }
      },
      reloadReferenceForLanguage: async function() {
        if (currentBoard) {
          await this.updateReferencePanel(currentBoard);
        }
      },
      parseMarkdown: function(markdown) {
        const lines = markdown.split("\n");
        let html = "";
        let inParagraph = false;
        let inList = false;
        function applyInlineFormatting(text) {
          const escaped = Utils.escapeHtml(text);
          return escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
        }
        function closeParagraph() {
          if (inParagraph) {
            html += "</p>";
            inParagraph = false;
          }
        }
        function closeList() {
          if (inList) {
            html += "</ul>";
            inList = false;
          }
        }
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmed = line.trim();
          if (trimmed === "") {
            closeParagraph();
            closeList();
            continue;
          }
          let headingMatch;
          if ((headingMatch = /^###\s+(.*)$/.exec(line)) !== null) {
            closeParagraph();
            closeList();
            html += "<h4>" + applyInlineFormatting(headingMatch[1]) + "</h4>";
            continue;
          }
          if ((headingMatch = /^##\s+(.*)$/.exec(line)) !== null) {
            closeParagraph();
            closeList();
            html += "<h3>" + applyInlineFormatting(headingMatch[1]) + "</h3>";
            continue;
          }
          if ((headingMatch = /^#\s+(.*)$/.exec(line)) !== null) {
            closeParagraph();
            closeList();
            html += "<h2>" + applyInlineFormatting(headingMatch[1]) + "</h2>";
            continue;
          }
          let listMatch;
          if ((listMatch = /^\s*[\*\-]\s+(.*)$/.exec(line)) !== null) {
            if (!inList) {
              closeParagraph();
              html += "<ul>";
              inList = true;
            }
            const itemText = applyInlineFormatting(listMatch[1]);
            html += "<li>" + itemText + "</li>";
            continue;
          }
          if (!inParagraph) {
            closeList();
            html += "<p>";
            inParagraph = true;
            html += applyInlineFormatting(line);
          } else {
            html += "<br>" + applyInlineFormatting(line);
          }
        }
        closeParagraph();
        closeList();
        return html;
      }
    };
  })();

  // src/app/ui-manager.js
  var UIManager = (function() {
    const log = Logger.scope("UIManager");
    const MAX_CONSOLE_LINES = 500;
    let connectButton = null;
    let disconnectButton = null;
    let runMainButton = null;
    let runSimulatorButton = null;
    let softResetButton = null;
    let loadFileButton = null;
    let saveFileButton = null;
    let slotSelector = null;
    let boardSelector = null;
    let simulatorLoaded = false;
    let simulatorLoading = false;
    let simulatorLoadPromise = null;
    let eventBus = null;
    const MAX_METRICS_HISTORY = 100;
    let metricsHistory = {
      compile: [],
      transfer: [],
      size: []
    };
    function addToHistory(arr, value) {
      arr.push(value);
      while (arr.length > MAX_METRICS_HISTORY) {
        arr.shift();
      }
    }
    function calculateStats(arr) {
      if (arr.length === 0) return { min: null, avg: null, max: null };
      const min = Math.min(...arr);
      const max = Math.max(...arr);
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      return { min, avg, max };
    }
    function getSelectedSlot() {
      if (slotSelector) {
        const value = parseInt(slotSelector.value, 10);
        if (value === 1 || value === 2) {
          return value;
        }
      }
      return 2;
    }
    return {
      appendToConsole: function(message) {
        if (message === void 0 || message === null) {
          return;
        }
        const msgStr = String(message).trim();
        if (msgStr === "") {
          return;
        }
        const consoleOutput = document.getElementById("consoleOutput");
        if (!consoleOutput) return;
        const line = document.createElement("div");
        line.textContent = msgStr;
        consoleOutput.appendChild(line);
        while (consoleOutput.childElementCount > MAX_CONSOLE_LINES) {
          consoleOutput.removeChild(consoleOutput.firstElementChild);
        }
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
      },
      updateConnectionStatus: function(status) {
        const statusElement = document.getElementById("connectionStatus");
        if (!statusElement) return;
        statusElement.className = "connection-status";
        switch (status) {
          case "connected":
            statusElement.textContent = t("status.connected") || "Connected";
            statusElement.classList.add("connected");
            if (connectButton) connectButton.disabled = true;
            if (disconnectButton) disconnectButton.disabled = false;
            if (runMainButton) runMainButton.disabled = false;
            if (softResetButton) softResetButton.disabled = false;
            break;
          case "disconnected":
            statusElement.textContent = t("status.disconnected") || "Disconnected";
            statusElement.classList.add("disconnected");
            if (connectButton) connectButton.disabled = false;
            if (disconnectButton) disconnectButton.disabled = true;
            if (runMainButton) runMainButton.disabled = true;
            if (softResetButton) softResetButton.disabled = true;
            break;
          case "connecting":
            statusElement.textContent = t("status.connecting") || "Connecting...";
            statusElement.classList.add("connecting");
            if (connectButton) connectButton.disabled = true;
            if (disconnectButton) disconnectButton.disabled = true;
            if (runMainButton) runMainButton.disabled = true;
            if (softResetButton) softResetButton.disabled = true;
            break;
          case "reconnecting":
            statusElement.textContent = t("status.reconnecting") || "Reconnecting...";
            statusElement.classList.add("connecting");
            if (connectButton) connectButton.disabled = true;
            if (disconnectButton) disconnectButton.disabled = false;
            if (runMainButton) runMainButton.disabled = true;
            if (softResetButton) softResetButton.disabled = true;
            break;
          case "unavailable":
            statusElement.textContent = t("status.unavailable") || "Bluetooth unavailable";
            statusElement.classList.add("disconnected");
            if (connectButton) connectButton.disabled = true;
            if (disconnectButton) disconnectButton.disabled = true;
            if (runMainButton) runMainButton.disabled = true;
            if (softResetButton) softResetButton.disabled = true;
            break;
        }
      },
      /**
       * Phase 3C/3D: Refresh the Known Devices list panel.
       * Calls BLEKnownDevices.list() and renders connect/forget buttons.
       * No-ops silently if the panel element is absent or getDevices() is unsupported.
       */
      refreshKnownDevices: async function() {
        const panel = document.getElementById("known-devices-list");
        if (!panel) return;
        if (!BLEKnownDevices.isSupported()) {
          panel.style.display = "none";
          return;
        }
        try {
          panel.style.display = "";
          const devices = await BLEKnownDevices.list();
          if (devices.length === 0) {
            panel.innerHTML = "<span class='known-devices-empty'>" + (t("device.noKnownDevices") || "No known devices") + "</span>";
            return;
          }
          const isConnected = BLEStateMachine.getState() !== "DISCONNECTED";
          panel.innerHTML = "";
          devices.forEach((device) => {
            const row = document.createElement("div");
            row.className = "known-device-row";
            const nameSpan = document.createElement("span");
            nameSpan.className = "known-device-name";
            nameSpan.textContent = device.name || device.id;
            row.appendChild(nameSpan);
            const connectBtn = document.createElement("button");
            connectBtn.className = "secondary known-device-connect";
            connectBtn.textContent = t("device.connectKnown") || "Connect";
            connectBtn.disabled = isConnected;
            connectBtn.addEventListener("click", () => {
              connectBtn.disabled = true;
              BLEKnownDevices.connectKnown(device).catch((err) => {
                UIManager.appendToConsole("Error: " + err.message);
                connectBtn.disabled = false;
              });
            });
            row.appendChild(connectBtn);
            if (typeof device.forget === "function") {
              const forgetBtn = document.createElement("button");
              forgetBtn.className = "danger known-device-forget";
              forgetBtn.textContent = "\xD7";
              forgetBtn.title = t("device.forget") || "Forget device";
              forgetBtn.addEventListener("click", async () => {
                const confirmMsg = t("device.forgetConfirm") || "Forget this device? You'll need to re-pair.";
                if (!window.confirm(confirmMsg)) return;
                forgetBtn.disabled = true;
                try {
                  await BLEKnownDevices.forget(device);
                  if (eventBus) eventBus.emit("BLE:DEVICE_FORGOTTEN", { device });
                  UIManager.appendToConsole(
                    t("device.forgetSuccess", {
                      deviceName: device.name || device.id
                    }) || "Device forgotten: " + (device.name || device.id)
                  );
                } catch (err) {
                  UIManager.appendToConsole("Error: " + err.message);
                  forgetBtn.disabled = false;
                }
              });
              row.appendChild(forgetBtn);
            }
            panel.appendChild(row);
          });
        } catch (error) {
          Logger.scope("UIManager").warn(
            "refreshKnownDevices failed:",
            error.message
          );
          panel.style.display = "none";
        }
      },
      updateMetrics: function(metrics) {
        const metricsPanel = document.getElementById("metrics-panel");
        if (!metricsPanel) return;
        if (metrics.compileTime !== void 0) {
          addToHistory(metricsHistory.compile, metrics.compileTime);
        }
        if (metrics.transferTime !== void 0) {
          addToHistory(metricsHistory.transfer, metrics.transferTime);
        }
        if (metrics.programSize !== void 0) {
          addToHistory(metricsHistory.size, metrics.programSize);
        }
        const compileStats = calculateStats(metricsHistory.compile);
        const transferStats = calculateStats(metricsHistory.transfer);
        const sizeStats = calculateStats(metricsHistory.size);
        const updateCurrent = (id, value, unit, decimals) => {
          const el = document.getElementById(id);
          if (el && value !== void 0) {
            el.textContent = (decimals !== void 0 ? value.toFixed(decimals) : value) + unit;
          }
        };
        updateCurrent("compile-current", metrics.compileTime, " ms", 1);
        updateCurrent("transfer-current", metrics.transferTime, " ms", 1);
        updateCurrent("size-current", metrics.programSize, " B", void 0);
        const renderChart = (chartId, stats, unit, decimals) => {
          const chart = document.getElementById(chartId);
          if (!chart || stats.min === null) return;
          const range = stats.max - stats.min;
          const padding = range > 0 ? range * 0.1 : stats.max * 0.1;
          const displayMin = Math.max(0, stats.min - padding);
          const displayMax = stats.max + padding;
          const displayRange = displayMax - displayMin;
          const clampPercent = (val) => {
            if (!Number.isFinite(val)) return 0;
            return Math.max(0, Math.min(100, val));
          };
          const minPercent = clampPercent(
            displayRange > 0 ? (stats.min - displayMin) / displayRange * 100 : 0
          );
          const maxPercent = clampPercent(
            displayRange > 0 ? (stats.max - displayMin) / displayRange * 100 : 100
          );
          const avgPercent = clampPercent(
            displayRange > 0 ? (stats.avg - displayMin) / displayRange * 100 : 50
          );
          const formatValue = (val) => {
            if (!Number.isFinite(val)) return "--";
            return decimals !== void 0 ? val.toFixed(decimals) : Math.round(val);
          };
          chart.innerHTML = `
          <div class="metrics-bar metrics-bar-range" style="left: ${minPercent}%; width: ${maxPercent - minPercent}%;"></div>
          <div class="metrics-bar metrics-bar-avg" style="left: ${avgPercent}%;"></div>
          <div class="metrics-chart-labels">
            <span class="metrics-chart-min">${formatValue(stats.min)}${unit}</span>
            <span class="metrics-chart-max">${formatValue(stats.max)}${unit}</span>
          </div>
          <span class="metrics-chart-avg" style="left: ${avgPercent}%;">avg: ${formatValue(stats.avg)}${unit}</span>
        `;
        };
        renderChart("compile-chart", compileStats, "ms", 1);
        renderChart("transfer-chart", transferStats, "ms", 1);
        renderChart("size-chart", sizeStats, "B", void 0);
        metricsPanel.style.display = "block";
      },
      getSelectedSlot,
      /**
       * Initialize UIManager with EventBus
       * @param {Object} bus - EventBus instance for decoupled communication
       */
      initialize: function(bus) {
        eventBus = bus;
        connectButton = document.getElementById("ble-connect");
        disconnectButton = document.getElementById("ble-disconnect");
        runMainButton = document.getElementById("run-main");
        runSimulatorButton = document.getElementById("run-simulator");
        softResetButton = document.getElementById("soft-reset");
        loadFileButton = document.getElementById("load-file");
        saveFileButton = document.getElementById("save-file");
        slotSelector = document.getElementById("slot-selector");
        boardSelector = document.getElementById("board-selector");
        this.updateConnectionStatus("disconnected");
        if (connectButton) {
          connectButton.addEventListener("click", () => {
            if (eventBus) {
              eventBus.emit("UI:CONNECT_CLICKED", {});
            }
          });
        }
        if (disconnectButton) {
          disconnectButton.addEventListener("click", () => {
            if (eventBus) {
              eventBus.emit("UI:DISCONNECT_CLICKED", {});
            }
          });
        }
        if (softResetButton) {
          softResetButton.addEventListener("click", () => {
            if (!BLEStateMachine.isConnected()) {
              const msg = t("error.notConnected") || "Not connected to device";
              this.appendToConsole("Error: " + msg);
              return;
            }
            softResetButton.disabled = true;
            BLEStateMachine.sendReset().catch((err) => {
              Logger.scope("UIManager").warn(
                "Reset command failed:",
                err.message
              );
            }).finally(() => {
              if (BLEStateMachine.isConnected()) {
                softResetButton.disabled = false;
              }
            });
          });
        }
        if (runMainButton) {
          runMainButton.addEventListener("click", () => {
            if (eventBus) {
              eventBus.emit("UI:BUILD_CLICKED", {});
            }
          });
        }
        if (loadFileButton) {
          loadFileButton.addEventListener("click", () => {
            FileManager.loadFile();
          });
        }
        if (saveFileButton) {
          saveFileButton.addEventListener("click", () => {
            FileManager.saveFile();
          });
        }
        if (boardSelector) {
          boardSelector.addEventListener("change", (e) => {
            BoardManager.switchBoard(e.target.value);
          });
        }
        if (runSimulatorButton) {
          runSimulatorButton.addEventListener("click", async () => {
            const currentBoard = BoardManager.getCurrentBoard();
            if (!currentBoard || !BoardManager.hasSimulatorSupport(currentBoard)) {
              const msg = t("error.simulatorNotAvailable") || "Simulator not available for this board";
              this.appendToConsole("Error: " + msg);
              return;
            }
            runSimulatorButton.disabled = true;
            const loadingMsg = t("message.loadingSimulator") || "Loading simulator...";
            this.appendToConsole(loadingMsg);
            try {
              await this.loadSimulatorResources();
              const success = await Simulator.show(currentBoard.name);
              if (success) {
                await Simulator.runFromEditor();
              }
            } catch (error) {
              const errorMsg = t("error.loadingSimulatorFailed", { message: error.message }) || "Error loading simulator: " + error.message;
              this.appendToConsole(errorMsg);
            } finally {
              this.updateSimulatorButton(BoardManager.getCurrentBoard());
            }
          });
        }
      },
      populateBoardSelector: function(boards) {
        if (!boardSelector) return;
        boardSelector.innerHTML = "";
        boards.forEach((board) => {
          const option = document.createElement("option");
          option.value = board.name;
          option.textContent = board.displayName;
          boardSelector.appendChild(option);
        });
      },
      setRunButtonEnabled: function(enabled) {
        if (runMainButton) {
          runMainButton.disabled = !enabled || !BLEStateMachine.isConnected();
        }
      },
      updateSimulatorButton: function(board) {
        if (!runSimulatorButton) return;
        const hasSimulator = BoardManager.hasSimulatorSupport(board);
        const simulatorRunning = typeof Simulator !== "undefined" && typeof Simulator.isRunning === "function" && Simulator.isRunning();
        runSimulatorButton.disabled = !hasSimulator || simulatorRunning;
        const availableTitle = t("simulator.available") || "Run code in browser simulator";
        const unavailableTitle = t("simulator.unavailable") || "Simulator not available for this board";
        runSimulatorButton.title = hasSimulator ? availableTitle : unavailableTitle;
      },
      loadSimulatorResources: async function() {
        if (simulatorLoaded) return Promise.resolve();
        if (simulatorLoading && simulatorLoadPromise) {
          return simulatorLoadPromise;
        }
        simulatorLoading = true;
        const loadScriptWithRetry = async (src) => {
          let lastError = null;
          for (let attempt = 0; attempt < Config.retries.scriptLoadMaxAttempts; attempt++) {
            try {
              await new Promise((resolve, reject) => {
                const script = document.createElement("script");
                script.src = src;
                const timeoutId = setTimeout(() => {
                  if (script.parentNode) script.parentNode.removeChild(script);
                  reject(
                    new Error(
                      `Script load timeout after ${Config.timeouts.scriptLoad}ms: ${src}`
                    )
                  );
                }, Config.timeouts.scriptLoad);
                script.onload = () => {
                  clearTimeout(timeoutId);
                  resolve();
                };
                script.onerror = () => {
                  clearTimeout(timeoutId);
                  if (script.parentNode) script.parentNode.removeChild(script);
                  reject(new Error("Failed to load " + src));
                };
                document.body.appendChild(script);
              });
              return;
            } catch (error) {
              lastError = error;
              log.warn(
                `Script load attempt ${attempt + 1}/${Config.retries.scriptLoadMaxAttempts} failed for ${src}:`,
                error.message
              );
              if (attempt < Config.retries.scriptLoadMaxAttempts - 1) {
                const delay = Config.timeouts.fetchRetryInitialDelay * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, delay));
              }
            }
          }
          throw lastError;
        };
        const loadMrubycModuleFactoryWithRetry = async () => {
          const src = "mrubyc/mrubyc.js";
          let lastError = null;
          for (let attempt = 0; attempt < Config.retries.scriptLoadMaxAttempts; attempt++) {
            try {
              const moduleNamespace = await import(new URL(src, window.location.href).href);
              const moduleFactory = moduleNamespace.default || moduleNamespace.createMrubycModule;
              if (typeof moduleFactory !== "function") {
                throw new Error("module factory was not found: " + src);
              }
              window.createMrubycModule = moduleFactory;
              return;
            } catch (error) {
              lastError = error;
              log.warn(
                `Script load attempt ${attempt + 1}/${Config.retries.scriptLoadMaxAttempts} failed for ${src}:`,
                error.message
              );
              if (attempt < Config.retries.scriptLoadMaxAttempts - 1) {
                const delay = Config.timeouts.fetchRetryInitialDelay * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, delay));
              }
            }
          }
          throw lastError;
        };
        simulatorLoadPromise = (async () => {
          try {
            await loadMrubycModuleFactoryWithRetry();
            await loadScriptWithRetry("lib/board-loader.js");
            await loadScriptWithRetry("js/simulator.js");
            simulatorLoaded = true;
          } catch (error) {
            simulatorLoading = false;
            simulatorLoadPromise = null;
            throw error;
          } finally {
            simulatorLoading = false;
          }
        })();
        return simulatorLoadPromise;
      }
    };
  })();

  // src/app/error-handler.js
  var ErrorHandler = (function() {
    const log = Logger.scope("ErrorHandler");
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
      NotAllowedError: "error.notAllowedError"
    };
    const fallbackMessages = {
      NotFoundError: "Device not found. Please make sure your OpenBlink device is turned on and nearby.",
      SecurityError: "Bluetooth access denied. Please grant permission in browser settings.",
      NetworkError: "Connection lost. Please check if the device is still connected.",
      InvalidStateError: "Device not connected. Please connect to a device first.",
      NotSupportedError: "This feature is not supported by your browser. Please use Chrome or Edge.",
      AbortError: "The operation was cancelled.",
      TimeoutError: "The operation timed out. Please try again.",
      NotAllowedError: "Permission denied. Please allow Bluetooth access when prompted."
    };
    function _showInUI(message) {
      if (_uiReady && typeof UIManager !== "undefined" && UIManager.appendToConsole) {
        UIManager.appendToConsole(message);
      } else {
        _earlyBuffer.push(message);
      }
    }
    return {
      getErrorMessage: function(error) {
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
            return t("error.gattError") || "Bluetooth communication error. Please try reconnecting.";
          }
          if (error.message.includes("adapter")) {
            return t("error.adapterError") || "Bluetooth adapter not available. Please check if Bluetooth is enabled.";
          }
        }
        const genericMsg = t("error.generic", {
          message: error.message || error.name || "Unknown error"
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
      report: function(error, context) {
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
      notify: function(messageKey, params) {
        const msg = t(messageKey, params) || messageKey;
        _showInUI(msg);
      },
      /**
       * Log an error silently (no UI display).
       * @param {Error|*} error
       * @param {string} [context]
       */
      silent: function(error, context) {
        log.error(`[${context || "Error"}]`, error);
      },
      /**
       * Flush the early-error buffer to UIManager once it is ready.
       * Call this after UIManager.initialize().
       */
      flush: function() {
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
      displayError: function(error, context) {
        this.report(error, context);
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

  // src/app/state/event-bus.js
  var EventBus = (function() {
    const log = Logger.scope("EventBus");
    const listeners = /* @__PURE__ */ new Map();
    function setDebugMode(enabled) {
      if (enabled) Logger.setLevel("debug");
    }
    function on(event, handler) {
      if (typeof event !== "string" || event.length === 0) {
        log.error("EventBus.on: event name must be a non-empty string");
        return () => {
        };
      }
      if (typeof handler !== "function") {
        log.error("EventBus.on: handler must be a function");
        return () => {
        };
      }
      if (!listeners.has(event)) {
        listeners.set(event, /* @__PURE__ */ new Set());
      }
      listeners.get(event).add(handler);
      return function unsubscribe() {
        off(event, handler);
      };
    }
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
      const handlers = Array.from(eventListeners);
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          log.error(`Error in handler for ${event}:`, error);
        }
      }
    }
    function once(event, handler) {
      let called = false;
      const wrappedHandler = function(data) {
        if (called) return;
        called = true;
        off(event, wrappedHandler);
        handler(data);
      };
      return on(event, wrappedHandler);
    }
    function removeAllListeners(event) {
      if (typeof event !== "string") {
        return;
      }
      listeners.delete(event);
    }
    function clear() {
      listeners.clear();
    }
    function listenerCount(event) {
      if (typeof event !== "string" || !listeners.has(event)) {
        return 0;
      }
      return listeners.get(event).size;
    }
    return {
      on,
      off,
      emit,
      once,
      removeAllListeners,
      clear,
      listenerCount,
      setDebugMode
    };
  })();

  // src/app/history-manager.js
  var HistoryManager = (function() {
    const log = Logger.scope("HistoryManager");
    const STORAGE_KEY = "openblink_history";
    const STORAGE_VERSION = 2;
    const MAX_CHECKPOINTS = 20;
    let history = [];
    function computeDiff(oldCode, newCode) {
      const oldLines = oldCode.split("\n");
      const newLines = newCode.split("\n");
      const diff = [];
      const maxLines = Math.max(oldLines.length, newLines.length);
      for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i];
        const newLine = newLines[i];
        if (oldLine === void 0) {
          diff.push({ type: "add", line: i + 1, content: newLine });
        } else if (newLine === void 0) {
          diff.push({ type: "remove", line: i + 1, content: oldLine });
        } else if (oldLine !== newLine) {
          diff.push({ type: "remove", line: i + 1, content: oldLine });
          diff.push({ type: "add", line: i + 1, content: newLine });
        }
      }
      return diff;
    }
    function loadHistory() {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          history = parsed.map((c) => ({
            ...c,
            code: Utils.unescapeHtml(c.code)
          }));
        } else if (parsed && parsed.version === STORAGE_VERSION && Array.isArray(parsed.items)) {
          history = parsed.items;
        } else {
          history = [];
        }
      } catch (e) {
        log.error("Failed to load history:", e);
        history = [];
      }
    }
    function serializeHistory() {
      return JSON.stringify({ version: STORAGE_VERSION, items: history });
    }
    function saveHistory() {
      try {
        let serialized = serializeHistory();
        while (history.length > 1 && serialized.length > 4 * 1024 * 1024) {
          history.shift();
          serialized = serializeHistory();
        }
        sessionStorage.setItem(STORAGE_KEY, serialized);
      } catch (e) {
        log.error("Failed to save history:", e);
        if (e.name === "QuotaExceededError") {
          for (let trim = 0; trim < MAX_CHECKPOINTS && history.length > 0; trim++) {
            history.shift();
            try {
              sessionStorage.setItem(STORAGE_KEY, serializeHistory());
              break;
            } catch (retryError) {
              if (retryError.name !== "QuotaExceededError") {
                log.error("Failed to save history after trimming:", retryError);
                break;
              }
            }
          }
        }
      }
    }
    function formatTimestamp(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    }
    function renderDiff(diff) {
      if (diff.length === 0) {
        return '<div class="diff-empty">No changes</div>';
      }
      let html = '<div class="diff-view">';
      const maxDiffLines = 6;
      const displayDiff = diff.slice(0, maxDiffLines);
      for (const item of displayDiff) {
        const escapedContent = Utils.escapeHtml(item.content);
        const truncatedContent = escapedContent.length > 40 ? escapedContent.substring(0, 40) + "..." : escapedContent;
        if (item.type === "add") {
          html += `<div class="diff-line diff-add">+ ${truncatedContent}</div>`;
        } else {
          html += `<div class="diff-line diff-remove">- ${truncatedContent}</div>`;
        }
      }
      if (diff.length > maxDiffLines) {
        html += `<div class="diff-more">... and ${diff.length - maxDiffLines} more changes</div>`;
      }
      html += "</div>";
      return html;
    }
    function getStorageUsage() {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        const usedBytes = stored ? new Blob([stored]).size : 0;
        const totalBytes = 5 * 1024 * 1024;
        return {
          used: usedBytes,
          total: totalBytes,
          percentage: Math.min(100, usedBytes / totalBytes * 100)
        };
      } catch (e) {
        return { used: 0, total: 5 * 1024 * 1024, percentage: 0 };
      }
    }
    function formatBytes(bytes) {
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
      return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    }
    function renderStorageBar() {
      const storage = getStorageUsage();
      const barColor = storage.percentage > 80 ? "#e74c3c" : storage.percentage > 60 ? "#f39c12" : "#3498db";
      return `
      <div class="storage-bar-container">
        <div class="storage-bar-label">Storage: ${formatBytes(storage.used)} / ${formatBytes(storage.total)}</div>
        <div class="storage-bar-track">
          <div class="storage-bar-fill" style="width: ${storage.percentage}%; background-color: ${barColor};"></div>
        </div>
      </div>
    `;
    }
    function renderHistory() {
      const panel = document.getElementById("history-panel");
      if (!panel) return;
      if (history.length === 0) {
        panel.innerHTML = '<div class="history-header"><div class="history-title">Build History</div>' + renderStorageBar() + '</div><div class="history-empty">No build history yet</div>';
        return;
      }
      let html = '<div class="history-header"><div class="history-title">Build History</div>' + renderStorageBar() + '</div><div class="history-list">';
      for (let i = history.length - 1; i >= 0; i--) {
        const checkpoint = history[i];
        const escapedId = checkpoint.id.replace(/[&<>"']/g, "");
        const diff = checkpoint.diff || [];
        html += `
        <div class="history-item" data-id="${escapedId}">
          <div class="history-item-header">
            <span class="history-time">${formatTimestamp(checkpoint.timestamp)}</span>
            <span class="history-slot">Slot ${checkpoint.metadata.slot}</span>
          </div>
          ${renderDiff(diff)}
          <button class="history-restore-btn" data-checkpoint-id="${escapedId}">Restore</button>
        </div>
      `;
      }
      html += "</div>";
      panel.innerHTML = html;
      if (!panel.dataset.restoreDelegationBound) {
        panel.addEventListener("click", function(event) {
          const btn = event.target.closest(".history-restore-btn");
          if (!btn || !panel.contains(btn)) {
            return;
          }
          const checkpointId = btn.getAttribute("data-checkpoint-id");
          HistoryManager.restoreCheckpoint(checkpointId);
        });
        panel.dataset.restoreDelegationBound = "true";
      }
    }
    return {
      initialize: function() {
        loadHistory();
        renderHistory();
      },
      createCheckpoint: function(code, metadata) {
        const lastCheckpoint = history.length > 0 ? history[history.length - 1] : null;
        const lastCode = lastCheckpoint ? lastCheckpoint.code : "";
        if (lastCode === code) {
          return null;
        }
        const diff = computeDiff(lastCode, code);
        const checkpoint = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          timestamp: Date.now(),
          code,
          diff,
          metadata: {
            slot: metadata.slot || 2
          }
        };
        history.push(checkpoint);
        while (history.length > MAX_CHECKPOINTS) {
          history.shift();
        }
        saveHistory();
        renderHistory();
        return checkpoint.id;
      },
      restoreCheckpoint: function(checkpointId) {
        const checkpointIndex = history.findIndex((c) => c.id === checkpointId);
        if (checkpointIndex === -1) {
          UIManager.appendToConsole("Error: Checkpoint not found");
          return null;
        }
        let code;
        if (checkpointIndex === 0) {
          code = "";
          UIManager.appendToConsole("Restored to initial empty state");
        } else {
          const previousCheckpoint = history[checkpointIndex - 1];
          code = previousCheckpoint.code;
          UIManager.appendToConsole(
            `Restored to state before ${formatTimestamp(history[checkpointIndex].timestamp)}`
          );
        }
        if (window.editorView) {
          if (!FileManager.checkUnsavedChanges()) {
            return null;
          }
          window.editorView.dispatch({
            changes: {
              from: 0,
              to: window.editorView.state.doc.length,
              insert: code
            }
          });
        }
        return code;
      },
      getHistory: function() {
        return history.map((c) => ({
          id: c.id,
          timestamp: c.timestamp,
          metadata: c.metadata
        }));
      },
      clearHistory: function() {
        history = [];
        saveHistory();
        renderHistory();
        UIManager.appendToConsole("Build history cleared");
      }
    };
  })();

  // src/app/compiler.js
  var Compiler = /* @__PURE__ */ (function() {
    const MRBC_MODULE_SRC = "mrbc/mrbc.js";
    let mrbcModule = null;
    let initializationPromise = null;
    function isRuntimeReady(moduleInstance) {
      return moduleInstance && moduleInstance.FS && typeof moduleInstance.FS.writeFile === "function" && typeof moduleInstance.FS.readFile === "function" && typeof moduleInstance._malloc === "function" && typeof moduleInstance._free === "function" && typeof moduleInstance.stringToUTF8 === "function" && typeof moduleInstance.setValue === "function" && typeof moduleInstance._main === "function";
    }
    function appendCompilerOutput(text) {
      if (text && text.trim() !== "") {
        EventBus.emit("COMPILER:OUTPUT", { message: text });
      }
    }
    function appendCompilerError(text) {
      if (!text || text.trim() === "") return;
      const prefix = typeof I18n !== "undefined" ? I18n.t("compiler.errorPrefix") || "Compiler Error: " : "Compiler Error: ";
      let errorText = prefix + text;
      if (typeof I18n !== "undefined" && I18n.isEasyJapanese()) {
        errorText = I18n.wrapCompilerError(text);
      }
      EventBus.emit("COMPILER:OUTPUT", { message: errorText });
    }
    function getModuleOptions() {
      return {
        locateFile: (path) => "mrbc/" + path,
        print: appendCompilerOutput,
        printErr: appendCompilerError
      };
    }
    async function loadEsModuleFactory(src) {
      const moduleUrl = new URL(src, window.location.href).href;
      const moduleNamespace = await import(moduleUrl);
      const moduleFactory = moduleNamespace.default || moduleNamespace.createMrbcModule;
      if (typeof moduleFactory !== "function") {
        throw new Error("mrbc module factory was not found: " + src);
      }
      return moduleFactory;
    }
    async function initializeRuntime() {
      if (isRuntimeReady(mrbcModule)) {
        return mrbcModule;
      }
      if (initializationPromise) {
        return initializationPromise;
      }
      initializationPromise = (async () => {
        const moduleOptions = getModuleOptions();
        const moduleFactory = await loadEsModuleFactory(MRBC_MODULE_SRC);
        const moduleInstance = await moduleFactory(moduleOptions);
        if (!isRuntimeReady(moduleInstance)) {
          throw new Error("mrbc runtime did not expose the required API.");
        }
        mrbcModule = moduleInstance;
        return mrbcModule;
      })();
      try {
        return await initializationPromise;
      } catch (error) {
        initializationPromise = null;
        throw error;
      }
    }
    function tryUnlink(fs, path) {
      try {
        fs.unlink(path);
      } catch (_error) {
        return;
      }
    }
    return {
      initialize: initializeRuntime,
      compile: function(rubyCode) {
        if (!isRuntimeReady(mrbcModule)) {
          const errorMsg = "mrbc runtime is not ready. Please reload the page and try again.";
          return {
            success: false,
            error: errorMsg,
            compileTime: 0
          };
        }
        const sourceFileName = "temp.rb";
        const outputFileName = "temp.mrb";
        tryUnlink(mrbcModule.FS, outputFileName);
        mrbcModule.FS.writeFile(sourceFileName, rubyCode);
        const args = ["mrbc", "-o", outputFileName, sourceFileName];
        const argc = args.length;
        let argv = null;
        let argPointers = [];
        try {
          argv = mrbcModule._malloc(args.length * 4);
          if (!argv) {
            throw new Error("Failed to allocate compiler argv.");
          }
          for (const arg of args) {
            const ptr = mrbcModule._malloc(arg.length + 1);
            if (!ptr) {
              throw new Error("Failed to allocate compiler argument.");
            }
            mrbcModule.stringToUTF8(arg, ptr, arg.length + 1);
            argPointers.push(ptr);
          }
          for (let i = 0; i < argPointers.length; i++) {
            mrbcModule.setValue(argv + i * 4, argPointers[i], "i32");
          }
          const startTime = performance.now();
          const result = mrbcModule._main(argc, argv);
          const endTime = performance.now();
          const compileTime = endTime - startTime;
          if (result !== 0) {
            const errorMsg = typeof t === "function" && t("compiler.failed", { code: result }) || "mrbc failed with exit code: " + result;
            return {
              success: false,
              error: errorMsg,
              compileTime
            };
          }
          const mrbContent = mrbcModule.FS.readFile(outputFileName);
          return {
            success: true,
            bytecode: mrbContent,
            compileTime,
            size: mrbContent.length
          };
        } finally {
          if (argPointers.length > 0) {
            argPointers.forEach((ptr) => mrbcModule._free(ptr));
          }
          if (argv !== null) {
            mrbcModule._free(argv);
          }
        }
      }
    };
  })();

  // src/app/main.js
  var OPENBLINK_WEBIDE_VERSION = "0.3.6";
  window.UIManager = UIManager;
  window.BoardManager = BoardManager;
  window.Compiler = Compiler;
  window.t = t;
  var isInitialized = false;
  function checkBrowserCompatibility() {
    const features = {
      webBluetooth: "bluetooth" in navigator,
      webAssembly: typeof WebAssembly !== "undefined",
      localStorage: typeof localStorage !== "undefined",
      sessionStorage: typeof sessionStorage !== "undefined"
    };
    const missingFeatures = Object.entries(features).filter(([_, supported]) => !supported).map(([name, _]) => name);
    if (missingFeatures.length > 0) {
      showCompatibilityWarning(missingFeatures);
      return false;
    }
    return true;
  }
  function showCompatibilityWarning(missingFeatures) {
    const warningDiv = document.getElementById("compatibility-warning");
    if (!warningDiv) return;
    const featureKeyMap = {
      webBluetooth: "compatibility.feature.webBluetooth",
      webAssembly: "compatibility.feature.webAssembly",
      localStorage: "compatibility.feature.localStorage",
      sessionStorage: "compatibility.feature.sessionStorage"
    };
    const fallbackNames = {
      webBluetooth: "Web Bluetooth API",
      webAssembly: "WebAssembly",
      localStorage: "Local Storage",
      sessionStorage: "Session Storage"
    };
    const missingNames = missingFeatures.map((f) => {
      const translated = t(featureKeyMap[f]);
      return translated && translated !== featureKeyMap[f] ? translated : fallbackNames[f] || f;
    });
    const warningTitle = t("compatibility.warning.title") || "Browser Compatibility Warning";
    const warningMessage = t("compatibility.warning.message") || "Your browser does not support the following required features:";
    const warningSuggestion = t("compatibility.warning.suggestion") || "Please use a compatible browser such as Chrome or Edge.";
    warningDiv.innerHTML = `
    <div class="warning-content">
      <strong>${Utils.escapeHtml(warningTitle)}</strong>
      <p>${Utils.escapeHtml(warningMessage)}</p>
      <ul>
        ${missingNames.map((name) => `<li>${Utils.escapeHtml(name)}</li>`).join("")}
      </ul>
      <p>${Utils.escapeHtml(warningSuggestion)}</p>
    </div>
  `;
    warningDiv.style.display = "block";
  }
  function showLoadingOverlay(message) {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
      overlay.classList.remove("hidden");
      const loadingText = overlay.querySelector(".loading-text");
      if (loadingText && message) {
        loadingText.textContent = message;
      }
    }
  }
  function updateLoadingMessage(message) {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
      const loadingText = overlay.querySelector(".loading-text");
      if (loadingText) {
        loadingText.textContent = message;
      }
    }
  }
  function hideLoadingOverlay() {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
      overlay.classList.add("hidden");
    }
  }
  async function initializeApp() {
    if (isInitialized) {
      Logger.scope("main").warn("initializeApp called multiple times, skipping");
      return;
    }
    isInitialized = true;
    showLoadingOverlay("Loading translations...");
    try {
      await I18n.init();
      updateLoadingMessage(t("loading.setup") || "Setting up...");
      setupLanguageSelector();
      if (!checkBrowserCompatibility()) {
        hideLoadingOverlay();
        return;
      }
      EventBus.on("COMPILER:OUTPUT", ({ message }) => {
        UIManager.appendToConsole(message);
      });
      updateLoadingMessage(t("loading.compiler") || "Loading compiler...");
      const compilerInit = Compiler.initialize();
      compilerInit.catch(() => {
      });
      if (new URLSearchParams(window.location.search).get("debug") === "ble") {
        Logger.setLevel("debug");
        Logger.scope("main").info("BLE debug mode enabled");
      }
      BLEStateMachine.init(EventBus);
      UIManager.initialize(EventBus);
      ErrorHandler.flush();
      setupEventWiring();
      setupPageLifecycle();
      const available = await BLEProtocol.checkAvailability();
      BLEProtocol.subscribeAvailability((isNowAvailable) => {
        EventBus.emit("BLE:AVAILABILITY_CHANGED", { available: isNowAvailable });
        if (!isNowAvailable && BLEStateMachine.getState() !== BLEState.DISCONNECTED) {
          BLEStateMachine.cleanup();
        }
      });
      if (!available) {
        UIManager.updateConnectionStatus("unavailable");
      }
      UIManager.refreshKnownDevices().catch((err) => {
        Logger.scope("main").warn(
          "refreshKnownDevices failed on startup:",
          err.message
        );
      });
      const startedMsg = t("message.started", { version: OPENBLINK_WEBIDE_VERSION }) || `OpenBlink WebIDE v${OPENBLINK_WEBIDE_VERSION} started.`;
      UIManager.appendToConsole(startedMsg);
      updateLoadingMessage(t("loading.boards") || "Loading boards...");
      await Promise.all([compilerInit, BoardManager.loadBoards()]);
      const defaultBoard = BoardManager.getCurrentBoard();
      if (defaultBoard) {
        const loadedMsg = t("message.boardLoaded", { boardName: defaultBoard.displayName }) || `Loaded board: ${defaultBoard.displayName}`;
        UIManager.appendToConsole(loadedMsg);
      }
      FileManager.initialize(window.editorView);
      HistoryManager.initialize();
    } finally {
      hideLoadingOverlay();
    }
  }
  function setupPageLifecycle() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        BLEStateMachine.pauseBackgroundTimers();
      } else {
        BLEStateMachine.resumeBackgroundTimers();
      }
    });
    document.addEventListener("freeze", () => {
      BLEStateMachine.cleanup();
    });
  }
  function setupEventWiring() {
    EventBus.on("UI:CONNECT_CLICKED", () => {
      BLEStateMachine.connect();
    });
    EventBus.on("UI:DISCONNECT_CLICKED", () => {
      BLEStateMachine.disconnect();
    });
    EventBus.on("UI:BUILD_CLICKED", async () => {
      if (!BLEStateMachine.isConnected()) {
        const msg = t("error.notConnected") || "Not connected to device";
        UIManager.appendToConsole("Error: " + msg);
        return;
      }
      UIManager.setRunButtonEnabled(false);
      try {
        const rubyCode = window.editorView.state.doc.toString();
        const slot = UIManager.getSelectedSlot();
        const compileResult = Compiler.compile(rubyCode);
        if (!compileResult.success) {
          UIManager.appendToConsole(compileResult.error);
          return;
        }
        const successMsg = t("compiler.success", {
          time: compileResult.compileTime.toFixed(2)
        }) || "mrbc success!: (" + compileResult.compileTime.toFixed(2) + "ms)";
        UIManager.appendToConsole(successMsg);
        const startSend = performance.now();
        await BLEStateMachine.startTransfer(compileResult.bytecode, slot);
        const endSend = performance.now();
        const transferTime = endSend - startSend;
        const completeMsg = t("compiler.sendComplete", { time: transferTime.toFixed(2) }) || "Sending bytecode: Complete! (" + transferTime.toFixed(2) + "ms)";
        UIManager.appendToConsole(completeMsg);
        UIManager.updateMetrics({
          compileTime: compileResult.compileTime,
          transferTime,
          programSize: compileResult.size
        });
        HistoryManager.createCheckpoint(rubyCode, {
          compileTime: compileResult.compileTime,
          transferTime,
          size: compileResult.size,
          slot
        });
      } catch (error) {
        const errorMsg = t("compiler.error", { message: error.message }) || "Error: " + error.message;
        UIManager.appendToConsole(errorMsg);
      } finally {
        if (BLEStateMachine.isConnected()) {
          UIManager.setRunButtonEnabled(true);
        }
      }
    });
    EventBus.on("BLE:STATE_CHANGED", ({ to }) => {
      UIManager.updateConnectionStatus(to.toLowerCase());
    });
    EventBus.on("BLE:CONNECTED", ({ deviceName }) => {
      UIManager.appendToConsole("Connected to device: " + deviceName);
      UIManager.refreshKnownDevices().catch((err) => {
        Logger.scope("main").warn(
          "refreshKnownDevices failed on connect:",
          err.message
        );
      });
    });
    EventBus.on("BLE:DISCONNECTED", () => {
      UIManager.appendToConsole("Disconnected from device.");
      UIManager.refreshKnownDevices().catch((err) => {
        Logger.scope("main").warn(
          "refreshKnownDevices failed on disconnect:",
          err.message
        );
      });
    });
    EventBus.on("BLE:CONNECT_FAILED", ({ error }) => {
      if (error.name === "NotFoundError") {
        UIManager.appendToConsole("Connection cancelled: No device selected");
      } else {
        UIManager.appendToConsole(ErrorHandler.getErrorMessage(error));
      }
    });
    EventBus.on("BLE:AVAILABILITY_CHANGED", ({ available }) => {
      UIManager.updateConnectionStatus(
        available ? "disconnected" : "unavailable"
      );
    });
    EventBus.on("BLE:DEVICE_FORGOTTEN", () => {
      UIManager.refreshKnownDevices().catch((err) => {
        Logger.scope("main").warn(
          "refreshKnownDevices failed on device forgotten:",
          err.message
        );
      });
    });
    EventBus.on("BLE:RECONNECTING", ({ attempt, maxAttempts, delay }) => {
      UIManager.appendToConsole(
        "Attempting to reconnect (" + attempt + "/" + maxAttempts + ") in " + delay + "ms..."
      );
    });
    EventBus.on("BLE:RECONNECT_FAILED", () => {
      UIManager.appendToConsole(
        "Max reconnection attempts reached. Please reconnect manually."
      );
    });
    EventBus.on("BLE:CONSOLE_MESSAGE", ({ message }) => {
      UIManager.appendToConsole(message);
    });
    let lastLoggedProgress = -1;
    EventBus.on("BLE:TRANSFER_STARTED", () => {
      lastLoggedProgress = -1;
      UIManager.appendToConsole("Starting firmware transfer...");
    });
    EventBus.on("BLE:TRANSFER_PROGRESS", ({ sent, total }) => {
      const progress = Math.round(sent / total * 100);
      if ((progress % 10 === 0 || progress === 100) && progress !== lastLoggedProgress) {
        lastLoggedProgress = progress;
        UIManager.appendToConsole(
          "Transfer progress: " + progress + "% (" + sent + "/" + total + ")"
        );
      }
    });
    EventBus.on("BLE:TRANSFER_COMPLETE", () => {
      UIManager.appendToConsole("Firmware transfer complete!");
    });
    EventBus.on("BLE:TRANSFER_FAILED", ({ error }) => {
      UIManager.appendToConsole("Transfer error: " + error.message);
    });
    EventBus.on("BLE:RESET_SENT", () => {
      UIManager.appendToConsole("Send [R]eset Complete");
    });
    EventBus.on("BLE:RELOAD_SENT", () => {
      UIManager.appendToConsole("Send re[L]oad Complete");
    });
  }
  function setupLanguageSelector() {
    const selector = document.getElementById("language-selector");
    if (!selector) return;
    selector.value = I18n.getLanguage();
    selector.addEventListener("change", function(e) {
      I18n.setLanguage(e.target.value);
    });
    let isReloadingReference = false;
    document.addEventListener("languageChanged", async function() {
      if (isReloadingReference) return;
      isReloadingReference = true;
      try {
        await BoardManager.reloadReferenceForLanguage();
      } finally {
        isReloadingReference = false;
      }
    });
  }
  window.addEventListener("DOMContentLoaded", () => {
    window.onerror = function(message, source, lineno, _colno, error) {
      const syntheticErr = error || new Error(message + " (line " + lineno + ")");
      ErrorHandler.report(syntheticErr, "Global");
      return false;
    };
    window.addEventListener("unhandledrejection", function(event) {
      const reason = event.reason;
      const err = reason instanceof Error ? reason : new Error(String(reason?.message ?? reason));
      ErrorHandler.report(err, "Promise");
    });
    const cleanupBluetooth = function() {
      if (typeof BLEStateMachine !== "undefined" && BLEStateMachine.cleanup) {
        BLEStateMachine.cleanup();
      }
    };
    window.addEventListener("pagehide", cleanupBluetooth);
    window.addEventListener("beforeunload", cleanupBluetooth);
    initializeApp().catch((error) => {
      ErrorHandler.report(error, "Startup");
    });
  });
})();
