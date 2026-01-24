/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2025 OpenBlink.org
 */

const HistoryManager = (function() {
  const STORAGE_KEY = 'openblink_history';
  const MAX_CHECKPOINTS = 20;
  let history = [];

  function sanitizeContent(content) {
    if (typeof content !== 'string') {
      return '';
    }
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function unsanitizeContent(content) {
    if (typeof content !== 'string') {
      return '';
    }
    return content
      .replace(/&#039;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
  }

  function loadHistory() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        history = JSON.parse(stored);
        if (!Array.isArray(history)) {
          history = [];
        }
      }
    } catch (e) {
      console.error('Failed to load history:', e);
      history = [];
    }
  }

  function saveHistory() {
    try {
      const serialized = JSON.stringify(history);
      if (serialized.length > 5 * 1024 * 1024) {
        while (history.length > 1 && JSON.stringify(history).length > 4 * 1024 * 1024) {
          history.shift();
        }
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save history:', e);
      if (e.name === 'QuotaExceededError') {
        history.shift();
        saveHistory();
      }
    }
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function renderHistory() {
    const panel = document.getElementById('history-panel');
    if (!panel) return;

    if (history.length === 0) {
      panel.innerHTML = '<div class="history-empty">No build history yet</div>';
      return;
    }

    let html = '<div class="history-title">Build History</div><div class="history-list">';
    
    for (let i = history.length - 1; i >= 0; i--) {
      const checkpoint = history[i];
      html += `
        <div class="history-item" data-id="${checkpoint.id}">
          <div class="history-item-header">
            <span class="history-time">${formatTimestamp(checkpoint.timestamp)}</span>
            <span class="history-slot">Slot ${checkpoint.metadata.slot}</span>
          </div>
          <div class="history-metrics">
            <span class="metric">Compile: ${checkpoint.metadata.compileTime.toFixed(1)}ms</span>
            <span class="metric">Transfer: ${checkpoint.metadata.transferTime.toFixed(1)}ms</span>
            <span class="metric">Size: ${checkpoint.metadata.size}B</span>
          </div>
          <button class="history-restore-btn" onclick="HistoryManager.restoreCheckpoint('${checkpoint.id}')">Restore</button>
        </div>
      `;
    }
    
    html += '</div>';
    panel.innerHTML = html;
  }

  return {
    initialize: function() {
      loadHistory();
      renderHistory();
    },

    createCheckpoint: function(code, metadata) {
      const checkpoint = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        timestamp: Date.now(),
        code: sanitizeContent(code),
        metadata: {
          compileTime: metadata.compileTime || 0,
          transferTime: metadata.transferTime || 0,
          size: metadata.size || 0,
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
      const checkpoint = history.find(c => c.id === checkpointId);
      if (!checkpoint) {
        UIManager.appendToConsole('Error: Checkpoint not found');
        return null;
      }

      const code = unsanitizeContent(checkpoint.code);
      
      if (window.editor) {
        if (!FileManager.checkUnsavedChanges()) {
          return null;
        }
        window.editor.setValue(code);
        UIManager.appendToConsole(`Restored checkpoint from ${formatTimestamp(checkpoint.timestamp)}`);
      }

      return code;
    },

    getHistory: function() {
      return history.map(c => ({
        id: c.id,
        timestamp: c.timestamp,
        metadata: c.metadata
      }));
    },

    clearHistory: function() {
      history = [];
      saveHistory();
      renderHistory();
      UIManager.appendToConsole('Build history cleared');
    }
  };
})();
