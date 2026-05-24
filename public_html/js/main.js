/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

const OPENBLINK_WEBIDE_VERSION = "0.3.6";

// Track if initializeApp has been called to prevent duplicate initialization
let isInitialized = false;

// Note: Global t() helper is defined in i18n.js

function checkBrowserCompatibility() {
  const features = {
    webBluetooth: "bluetooth" in navigator,
    webAssembly: typeof WebAssembly !== "undefined",
    localStorage: typeof localStorage !== "undefined",
    sessionStorage: typeof sessionStorage !== "undefined",
  };

  const missingFeatures = Object.entries(features)
    .filter(([_, supported]) => !supported)
    .map(([name, _]) => name);

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
    sessionStorage: "compatibility.feature.sessionStorage",
  };

  const fallbackNames = {
    webBluetooth: "Web Bluetooth API",
    webAssembly: "WebAssembly",
    localStorage: "Local Storage",
    sessionStorage: "Session Storage",
  };

  const missingNames = missingFeatures.map((f) => {
    const translated = t(featureKeyMap[f]);
    return translated && translated !== featureKeyMap[f]
      ? translated
      : fallbackNames[f] || f;
  });

  const warningTitle =
    t("compatibility.warning.title") || "Browser Compatibility Warning";
  const warningMessage =
    t("compatibility.warning.message") ||
    "Your browser does not support the following required features:";
  const warningSuggestion =
    t("compatibility.warning.suggestion") ||
    "Please use a compatible browser such as Chrome or Edge.";

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
  // Prevent duplicate initialization
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

    // Phase 3G: enable debug logging when ?debug=ble is present
    if (new URLSearchParams(window.location.search).get("debug") === "ble") {
      Logger.setLevel("debug");
      Logger.scope("main").info("BLE debug mode enabled");
    }

    // Initialize EventBus and BLE State Machine
    BLEStateMachine.init(EventBus);

    // Initialize UI Manager with EventBus
    UIManager.initialize(EventBus);

    // Phase 4.4: flush any errors that occurred before UIManager was ready
    ErrorHandler.flush();

    // Setup event wiring
    setupEventWiring();
    setupPageLifecycle();

    // Phase 3A: check Bluetooth availability and subscribe to changes
    const available = await BLEProtocol.checkAvailability();
    BLEProtocol.subscribeAvailability((isNowAvailable) => {
      EventBus.emit("BLE:AVAILABILITY_CHANGED", { available: isNowAvailable });
      if (
        !isNowAvailable &&
        BLEStateMachine.getState() !== BLEState.DISCONNECTED
      ) {
        BLEStateMachine.cleanup();
      }
    });
    if (!available) {
      UIManager.updateConnectionStatus("unavailable");
    }

    // Phase 3C: populate Known Devices list on startup
    UIManager.refreshKnownDevices().catch((err) => {
      Logger.scope("main").warn(
        "refreshKnownDevices failed on startup:",
        err.message,
      );
    });

    const startedMsg =
      t("message.started", { version: OPENBLINK_WEBIDE_VERSION }) ||
      `OpenBlink WebIDE v${OPENBLINK_WEBIDE_VERSION} started.`;
    UIManager.appendToConsole(startedMsg);

    updateLoadingMessage(t("loading.boards") || "Loading boards...");
    await BoardManager.loadBoards();
    const defaultBoard = BoardManager.getCurrentBoard();
    if (defaultBoard) {
      const loadedMsg =
        t("message.boardLoaded", { boardName: defaultBoard.displayName }) ||
        `Loaded board: ${defaultBoard.displayName}`;
      UIManager.appendToConsole(loadedMsg);
    }

    FileManager.initialize(window.editor);
    HistoryManager.initialize();
  } finally {
    hideLoadingOverlay();
  }
}

/**
 * Phase 3F: Page Lifecycle integration.
 * Stops heartbeat/poller when the page is hidden or frozen;
 * resumes them when the page becomes visible again.
 */
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

/**
 * Setup event wiring between modules via EventBus
 */
function setupEventWiring() {
  // UI events → BLE State Machine actions
  EventBus.on("UI:CONNECT_CLICKED", () => {
    BLEStateMachine.connect();
  });

  EventBus.on("UI:DISCONNECT_CLICKED", () => {
    BLEStateMachine.disconnect();
  });

  // UI:BUILD_CLICKED → Compile → Transfer
  EventBus.on("UI:BUILD_CLICKED", async () => {
    if (!BLEStateMachine.isConnected()) {
      const msg = t("error.notConnected") || "Not connected to device";
      UIManager.appendToConsole("Error: " + msg);
      return;
    }

    UIManager.setRunButtonEnabled(false);

    try {
      const rubyCode = window.editor.getValue();
      const slot = UIManager.getSelectedSlot();

      const compileResult = Compiler.compile(rubyCode);

      if (!compileResult.success) {
        UIManager.appendToConsole(compileResult.error);
        return;
      }

      const successMsg =
        t("compiler.success", {
          time: compileResult.compileTime.toFixed(2),
        }) || "mrbc success!: (" + compileResult.compileTime.toFixed(2) + "ms)";
      UIManager.appendToConsole(successMsg);

      const startSend = performance.now();

      await BLEStateMachine.startTransfer(compileResult.bytecode, slot);

      const endSend = performance.now();
      const transferTime = endSend - startSend;

      const completeMsg =
        t("compiler.sendComplete", { time: transferTime.toFixed(2) }) ||
        "Sending bytecode: Complete! (" + transferTime.toFixed(2) + "ms)";
      UIManager.appendToConsole(completeMsg);

      UIManager.updateMetrics({
        compileTime: compileResult.compileTime,
        transferTime: transferTime,
        programSize: compileResult.size,
      });

      HistoryManager.createCheckpoint(rubyCode, {
        compileTime: compileResult.compileTime,
        transferTime: transferTime,
        size: compileResult.size,
        slot: slot,
      });
    } catch (error) {
      const errorMsg =
        t("compiler.error", { message: error.message }) ||
        "Error: " + error.message;
      UIManager.appendToConsole(errorMsg);
    } finally {
      if (BLEStateMachine.isConnected()) {
        UIManager.setRunButtonEnabled(true);
      }
    }
  });

  // BLE events → UI updates
  EventBus.on("BLE:STATE_CHANGED", ({ to }) => {
    UIManager.updateConnectionStatus(to.toLowerCase());
  });

  EventBus.on("BLE:CONNECTED", ({ deviceName }) => {
    UIManager.appendToConsole("Connected to device: " + deviceName);
    // Refresh known devices asynchronously to avoid blocking connect flow
    UIManager.refreshKnownDevices().catch((err) => {
      Logger.scope("main").warn(
        "refreshKnownDevices failed on connect:",
        err.message,
      );
    });
  });

  EventBus.on("BLE:DISCONNECTED", () => {
    UIManager.appendToConsole("Disconnected from device.");
    // Refresh known devices asynchronously to avoid blocking disconnect flow
    UIManager.refreshKnownDevices().catch((err) => {
      Logger.scope("main").warn(
        "refreshKnownDevices failed on disconnect:",
        err.message,
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
      available ? "disconnected" : "unavailable",
    );
  });

  EventBus.on("BLE:DEVICE_FORGOTTEN", () => {
    UIManager.refreshKnownDevices().catch((err) => {
      Logger.scope("main").warn(
        "refreshKnownDevices failed on device forgotten:",
        err.message,
      );
    });
  });

  EventBus.on("BLE:RECONNECTING", ({ attempt, maxAttempts, delay }) => {
    UIManager.appendToConsole(
      "Attempting to reconnect (" +
        attempt +
        "/" +
        maxAttempts +
        ") in " +
        delay +
        "ms...",
    );
  });

  EventBus.on("BLE:RECONNECT_FAILED", () => {
    UIManager.appendToConsole(
      "Max reconnection attempts reached. Please reconnect manually.",
    );
  });

  EventBus.on("BLE:CONSOLE_MESSAGE", ({ message }) => {
    UIManager.appendToConsole(message);
  });

  EventBus.on("BLE:TRANSFER_STARTED", () => {
    UIManager.appendToConsole("Starting firmware transfer...");
  });

  EventBus.on("BLE:TRANSFER_PROGRESS", ({ sent, total }) => {
    const progress = Math.round((sent / total) * 100);
    if (progress % 10 === 0 || progress === 100) {
      UIManager.appendToConsole(
        "Transfer progress: " + progress + "% (" + sent + "/" + total + ")",
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

  selector.addEventListener("change", function (e) {
    I18n.setLanguage(e.target.value);
  });

  let isReloadingReference = false;
  document.addEventListener("languageChanged", async function () {
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
  window.onerror = function (message, source, lineno, _colno, error) {
    const syntheticErr = error || new Error(message + " (line " + lineno + ")");
    ErrorHandler.report(syntheticErr, "Global");
    return false;
  };

  window.addEventListener("unhandledrejection", function (event) {
    const reason = event.reason;
    const err =
      reason instanceof Error
        ? reason
        : new Error(String(reason?.message ?? reason));
    ErrorHandler.report(err, "Promise");
  });

  // Cleanup Bluetooth connections on page unload/reload/navigation
  // Use both pagehide and beforeunload for better browser compatibility
  const cleanupBluetooth = function () {
    if (typeof BLEStateMachine !== "undefined" && BLEStateMachine.cleanup) {
      BLEStateMachine.cleanup();
    }
  };
  window.addEventListener("pagehide", cleanupBluetooth);
  window.addEventListener("beforeunload", cleanupBluetooth);
});

Module.onRuntimeInitialized = () => {
  Logger.scope("main").info("Emscripten runtime initialized.");
  initializeApp();
};

// Fallback: if Module.onRuntimeInitialized is not called within 3 seconds, initialize anyway
setTimeout(() => {
  if (typeof Module !== "undefined" && Module.calledRun !== true) {
    Logger.scope("main").error(
      "Emscripten runtime initialization timeout, forcing initialization",
    );
    initializeApp();
  } else if (typeof Module !== "undefined" && Module.calledRun === true) {
    Logger.scope("main").info(
      "Emscripten runtime already initialized, calling initializeApp",
    );
    initializeApp();
  }
}, 3000);
