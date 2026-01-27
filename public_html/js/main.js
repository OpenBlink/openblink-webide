/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink.org
 */

const OPENBLINK_WEBIDE_VERSION = "0.3.4";

// Note: Global t() helper is defined in i18n.js

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

  const featureKeyMap = {
    webBluetooth: 'compatibility.feature.webBluetooth',
    webAssembly: 'compatibility.feature.webAssembly',
    localStorage: 'compatibility.feature.localStorage',
    sessionStorage: 'compatibility.feature.sessionStorage'
  };

  const fallbackNames = {
    webBluetooth: 'Web Bluetooth API',
    webAssembly: 'WebAssembly',
    localStorage: 'Local Storage',
    sessionStorage: 'Session Storage'
  };

  const missingNames = missingFeatures.map(f => {
    const translated = t(featureKeyMap[f]);
    return (translated && translated !== featureKeyMap[f]) ? translated : (fallbackNames[f] || f);
  });

  const warningTitle = t('compatibility.warning.title') || 'Browser Compatibility Warning';
  const warningMessage = t('compatibility.warning.message') || 'Your browser does not support the following required features:';
  const warningSuggestion = t('compatibility.warning.suggestion') || 'Please use a compatible browser such as Chrome or Edge.';
  
  warningDiv.innerHTML = `
    <div class="warning-content">
      <strong>${Utils.escapeHtml(warningTitle)}</strong>
      <p>${Utils.escapeHtml(warningMessage)}</p>
      <ul>
        ${missingNames.map(name => `<li>${Utils.escapeHtml(name)}</li>`).join('')}
      </ul>
      <p>${Utils.escapeHtml(warningSuggestion)}</p>
    </div>
  `;
  warningDiv.style.display = 'block';
}

function showLoadingOverlay(message) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    const loadingText = overlay.querySelector('.loading-text');
    if (loadingText && message) {
      loadingText.textContent = message;
    }
  }
}

function updateLoadingMessage(message) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    const loadingText = overlay.querySelector('.loading-text');
    if (loadingText) {
      loadingText.textContent = message;
    }
  }
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

async function initializeApp() {
  showLoadingOverlay('Loading translations...');
  
  try {
    await I18n.init();
    
    updateLoadingMessage(t('loading.setup') || 'Setting up...');
    setupLanguageSelector();

    if (!checkBrowserCompatibility()) {
      hideLoadingOverlay();
      return;
    }

    const startedMsg = t('message.started', { version: OPENBLINK_WEBIDE_VERSION }) 
      || `OpenBlink WebIDE v${OPENBLINK_WEBIDE_VERSION} started.`;
    UIManager.appendToConsole(startedMsg);
    UIManager.initialize();
    
    updateLoadingMessage(t('loading.boards') || 'Loading boards...');
    await BoardManager.loadBoards();
    const defaultBoard = BoardManager.getCurrentBoard();
    if (defaultBoard) {
      const loadedMsg = t('message.boardLoaded', { boardName: defaultBoard.displayName })
        || `Loaded board: ${defaultBoard.displayName}`;
      UIManager.appendToConsole(loadedMsg);
    }

    FileManager.initialize(window.editor);
    HistoryManager.initialize();
  } finally {
    hideLoadingOverlay();
  }
}

function setupLanguageSelector() {
  const selector = document.getElementById('language-selector');
  if (!selector) return;

  selector.value = I18n.getLanguage();

  selector.addEventListener('change', function(e) {
    I18n.setLanguage(e.target.value);
  });

    let isReloadingReference = false;
    document.addEventListener('languageChanged', async function() {
      if (isReloadingReference) return;
      isReloadingReference = true;
      try {
        await BoardManager.reloadReferenceForLanguage();
      } finally {
        isReloadingReference = false;
      }
    });
}

window.addEventListener('DOMContentLoaded', () => {
  window.onerror = function(message, source, lineno, colno, error) {
    const errorMsg = t('message.lineError', { message: message, line: lineno })
      || ('Error: ' + message + ' (at line ' + lineno + ')');
    UIManager.appendToConsole(errorMsg);
    return false;
  };

  window.addEventListener('unhandledrejection', function(event) {
    const reason = event.reason;
    const message = reason?.message ?? String(reason);
    const errorMsg = t('message.promiseError', { message: message })
      || ('Promise Error: ' + message);
    UIManager.appendToConsole(errorMsg);
  });
});

Module.onRuntimeInitialized = () => {
  console.log("Emscripten runtime initialized.");
  initializeApp();
};
