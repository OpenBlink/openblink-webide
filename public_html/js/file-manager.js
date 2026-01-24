/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink.org
 */

const FileManager = (function() {
  let editor = null;
  let currentFile = null;
  let isDirty = false;

  function setupChangeTracking() {
    if (editor) {
      editor.on('change', () => {
        isDirty = true;
      });
    }
  }

  function setupBeforeUnload() {
    window.addEventListener('beforeunload', (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Do you want to leave?';
        return e.returnValue;
      }
    });
  }

  return {
    initialize: function(editorInstance) {
      editor = editorInstance;
      setupChangeTracking();
      setupBeforeUnload();
    },

    loadFile: function() {
      if (!this.checkUnsavedChanges()) {
        return;
      }

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.rb';
      
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.rb')) {
          UIManager.appendToConsole("Error: Please select a .rb file");
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target.result;
          if (editor) {
            editor.setValue(content);
            currentFile = file.name;
            isDirty = false;
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
      if (!editor) return;

      const content = editor.getValue();
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = currentFile || 'program.rb';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      isDirty = false;
      UIManager.appendToConsole(`Saved file: ${a.download}`);
    },

    checkUnsavedChanges: function() {
      if (isDirty) {
        return confirm('You have unsaved changes. Do you want to continue?');
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
    }
  };
})();
