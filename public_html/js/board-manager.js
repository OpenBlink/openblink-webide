/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2025 OpenBlink.org
 */

const BoardManager = (function() {
  let boards = [];
  let currentBoard = null;

  async function fetchJSON(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
      return null;
    }
  }

  async function fetchText(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
      return null;
    }
  }

  return {
    loadBoards: async function() {
      const boardList = ['m5stamps3'];
      
      for (const boardName of boardList) {
        const config = await fetchJSON(`boards/${boardName}/config.json`);
        if (config) {
          const sampleCode = await fetchText(`boards/${boardName}/sample.rb`);
          const reference = await fetchText(`boards/${boardName}/reference.md`);
          
          boards.push({
            name: boardName,
            displayName: config.displayName || config.name,
            manufacturer: config.manufacturer,
            description: config.description,
            sampleCode: sampleCode || '',
            reference: reference || ''
          });
        }
      }

      if (boards.length > 0) {
        currentBoard = boards[0];
        UIManager.populateBoardSelector(boards);
        
        if (currentBoard.sampleCode && window.editor) {
          window.editor.setValue(currentBoard.sampleCode);
        }
      }

      return boards;
    },

    getCurrentBoard: function() {
      return currentBoard;
    },

    getBoards: function() {
      return boards;
    },

    switchBoard: function(boardName) {
      const board = boards.find(b => b.name === boardName);
      if (!board) {
        UIManager.appendToConsole(`Error: Board "${boardName}" not found`);
        return false;
      }

      if (!FileManager.checkUnsavedChanges()) {
        return false;
      }

      currentBoard = board;

      if (board.sampleCode && window.editor) {
        window.editor.setValue(board.sampleCode);
        FileManager.markClean();
      }

      this.updateReferencePanel(board);
      UIManager.appendToConsole(`Switched to board: ${board.displayName}`);
      
      return true;
    },

    updateReferencePanel: function(board) {
      const referenceContent = document.getElementById('reference-content');
      if (!referenceContent || !board) return;

      if (board.reference) {
        referenceContent.innerHTML = this.parseMarkdown(board.reference);
      } else {
        referenceContent.innerHTML = '<p>No reference documentation available for this board.</p>';
      }
    },

    parseMarkdown: function(markdown) {
      let html = markdown
        .replace(/^### (.*$)/gim, '<h4>$1</h4>')
        .replace(/^## (.*$)/gim, '<h3>$1</h3>')
        .replace(/^# (.*$)/gim, '<h2>$1</h2>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/^\- (.*$)/gim, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

      html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
      
      return '<p>' + html + '</p>';
    }
  };
})();
