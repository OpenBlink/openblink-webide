/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink.org
 */

const OPENBLINK_WEBIDE_VERSION = "0.3.4";

function checkBrowserCompatibility() {
  const features = {
    webBluetooth: 'bluetooth' in navigator,
    webAssembly: typeof WebAssembly !== 'undefined',
    localStorage: typeof localStorage !== 'undefined',
    sessionStorage: typeof sessionStorage !== 'undefined'
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
  const warningDiv = document.getElementById('compatibility-warning');
  if (!warningDiv) return;

  const featureNames = {
    webBluetooth: 'Web Bluetooth API',
    webAssembly: 'WebAssembly',
    localStorage: 'Local Storage',
    sessionStorage: 'Session Storage'
  };

  const missingNames = missingFeatures.map(f => featureNames[f] || f);
  
  warningDiv.innerHTML = `
    <div class="warning-content">
      <strong>Browser Compatibility Warning</strong>
      <p>Your browser does not support the following required features:</p>
      <ul>
        ${missingNames.map(name => `<li>${name}</li>`).join('')}
      </ul>
      <p>Please use a compatible browser such as Chrome or Edge.</p>
    </div>
  `;
  warningDiv.style.display = 'block';
}

async function initializeApp() {
  if (!checkBrowserCompatibility()) {
    return;
  }

  UIManager.appendToConsole(`OpenBlink WebIDE v${OPENBLINK_WEBIDE_VERSION} started.`);
  UIManager.initialize();
  
  // Wait for boards to load before initializing FileManager to avoid race conditions
  await BoardManager.loadBoards();
  const defaultBoard = BoardManager.getCurrentBoard();
  if (defaultBoard) {
    UIManager.appendToConsole(`Loaded board: ${defaultBoard.displayName}`);
  }

  FileManager.initialize(window.editor);
  HistoryManager.initialize();
}

window.addEventListener('DOMContentLoaded', () => {
  window.onerror = function(message, source, lineno, colno, error) {
    UIManager.appendToConsole('Error: ' + message + ' (at line ' + lineno + ')');
    return false;
  };

  window.addEventListener('unhandledrejection', function(event) {
    const reason = event.reason;
    const message = reason?.message ?? String(reason);
    UIManager.appendToConsole('Promise Error: ' + message);
  });
});

Module.onRuntimeInitialized = () => {
  console.log("Emscripten runtime initialized.");
  initializeApp();
};
