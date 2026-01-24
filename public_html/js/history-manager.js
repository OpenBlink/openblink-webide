/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink.org
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

  function computeDiff(oldCode, newCode) {
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');
    const diff = [];
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];
      
      if (oldLine === undefined) {
        diff.push({ type: 'add', line: i + 1, content: newLine });
      } else if (newLine === undefined) {
        diff.push({ type: 'remove', line: i + 1, content: oldLine });
      } else if (oldLine !== newLine) {
        diff.push({ type: 'remove', line: i + 1, content: oldLine });
        diff.push({ type: 'add', line: i + 1, content: newLine });
      }
    }
    
    return diff;
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
        while (history.length > 0) {
          history.shift();
          try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history));
            break;
          } catch (retryError) {
            console.error('Failed to save history after trimming:', retryError);
            if (retryError.name !== 'QuotaExceededError') {
              break;
            }
          }
        }
      }
    }
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function renderDiff(diff) {
    if (diff.length === 0) {
      return '<div class="diff-empty">No changes</div>';
    }
    
    let html = '<div class="diff-view">';
    const maxDiffLines = 6;
    const displayDiff = diff.slice(0, maxDiffLines);
    
    for (const item of displayDiff) {
      const escapedContent = sanitizeContent(item.content);
      const truncatedContent = escapedContent.length > 40 
        ? escapedContent.substring(0, 40) + '...' 
        : escapedContent;
      
      if (item.type === 'add') {
        html += `<div class="diff-line diff-add">+ ${truncatedContent}</div>`;
      } else {
        html += `<div class="diff-line diff-remove">- ${truncatedContent}</div>`;
      }
    }
    
    if (diff.length > maxDiffLines) {
      html += `<div class="diff-more">... and ${diff.length - maxDiffLines} more changes</div>`;
    }
    
    html += '</div>';
    return html;
  }

  function getStorageUsage() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      const usedBytes = stored ? new Blob([stored]).size : 0;
      // SessionStorage typically has 5MB limit
      const totalBytes = 5 * 1024 * 1024;
      return {
        used: usedBytes,
        total: totalBytes,
        percentage: Math.min(100, (usedBytes / totalBytes) * 100)
      };
    } catch (e) {
      return { used: 0, total: 5 * 1024 * 1024, percentage: 0 };
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function renderStorageBar() {
    const storage = getStorageUsage();
    const barColor = storage.percentage > 80 ? '#e74c3c' : storage.percentage > 60 ? '#f39c12' : '#3498db';
    
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
    const panel = document.getElementById('history-panel');
    if (!panel) return;

    if (history.length === 0) {
      panel.innerHTML = '<div class="history-header"><div class="history-title">Build History</div>' + renderStorageBar() + '</div><div class="history-empty">No build history yet</div>';
      return;
    }

    let html = '<div class="history-header"><div class="history-title">Build History</div>' + renderStorageBar() + '</div><div class="history-list">';
    
    for (let i = history.length - 1; i >= 0; i--) {
      const checkpoint = history[i];
      const escapedId = checkpoint.id.replace(/[&<>"']/g, '');
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
    
    html += '</div>';
    panel.innerHTML = html;

    // Use true event delegation: attach a single click handler to the panel
    if (!panel.dataset.restoreDelegationBound) {
      panel.addEventListener('click', function(event) {
        const btn = event.target.closest('.history-restore-btn');
        if (!btn || !panel.contains(btn)) {
          return;
        }
        const checkpointId = btn.getAttribute('data-checkpoint-id');
        HistoryManager.restoreCheckpoint(checkpointId);
      });
      panel.dataset.restoreDelegationBound = 'true';
    }
  }

  return {
    initialize: function() {
      loadHistory();
      renderHistory();
    },

    createCheckpoint: function(code, metadata) {
      const lastCheckpoint = history.length > 0 ? history[history.length - 1] : null;
      const lastCode = lastCheckpoint ? unsanitizeContent(lastCheckpoint.code) : '';
      
      if (lastCode === code) {
        return null;
      }
      
      const diff = computeDiff(lastCode, code);

      const checkpoint = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        timestamp: Date.now(),
        code: sanitizeContent(code),
        diff: diff,
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
      const checkpointIndex = history.findIndex(c => c.id === checkpointId);
      if (checkpointIndex === -1) {
        UIManager.appendToConsole('Error: Checkpoint not found');
        return null;
      }

      // Restore the state BEFORE this checkpoint (the previous checkpoint's code)
      // This makes "Restore" act as "undo these changes shown in the diff"
      let code;
      if (checkpointIndex === 0) {
        // First checkpoint - no previous state, restore empty
        code = '';
        UIManager.appendToConsole('Restored to initial empty state');
      } else {
        const previousCheckpoint = history[checkpointIndex - 1];
        code = unsanitizeContent(previousCheckpoint.code);
        UIManager.appendToConsole(`Restored to state before ${formatTimestamp(history[checkpointIndex].timestamp)}`);
      }
      
      if (window.editor) {
        if (!FileManager.checkUnsavedChanges()) {
          return null;
        }
        window.editor.setValue(code);
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
