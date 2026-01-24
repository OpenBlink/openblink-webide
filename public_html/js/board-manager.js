/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink.org
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
          if (typeof FileManager !== 'undefined' && typeof FileManager.markClean === 'function') {
            FileManager.markClean();
          }
        }

        // Update reference panel for initial board load
        if (typeof this.updateReferencePanel === 'function') {
          this.updateReferencePanel(currentBoard);
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
      // Simple line-oriented markdown parser for headings, lists, paragraphs and inline code
      const lines = markdown.split('\n');
      let html = '';
      let inParagraph = false;
      let inList = false;

      function escapeHtml(text) {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }

      function applyInlineFormatting(text) {
        // Escape HTML first, then apply inline code formatting
        const escaped = escapeHtml(text);
        return escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
      }

      function closeParagraph() {
        if (inParagraph) {
          html += '</p>';
          inParagraph = false;
        }
      }

      function closeList() {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Blank line: close paragraphs and lists
        if (trimmed === '') {
          closeParagraph();
          closeList();
          continue;
        }

        // Headings (###, ##, #)
        let headingMatch;
        if ((headingMatch = /^###\s+(.*)$/.exec(line)) !== null) {
          closeParagraph();
          closeList();
          html += '<h4>' + applyInlineFormatting(headingMatch[1]) + '</h4>';
          continue;
        }
        if ((headingMatch = /^##\s+(.*)$/.exec(line)) !== null) {
          closeParagraph();
          closeList();
          html += '<h3>' + applyInlineFormatting(headingMatch[1]) + '</h3>';
          continue;
        }
        if ((headingMatch = /^#\s+(.*)$/.exec(line)) !== null) {
          closeParagraph();
          closeList();
          html += '<h2>' + applyInlineFormatting(headingMatch[1]) + '</h2>';
          continue;
        }

        // List items starting with "* " or "- "
        let listMatch;
        if ((listMatch = /^\s*[\*\-]\s+(.*)$/.exec(line)) !== null) {
          // Start a new list if not currently in one
          if (!inList) {
            closeParagraph();
            html += '<ul>';
            inList = true;
          }
          const itemText = applyInlineFormatting(listMatch[1]);
          html += '<li>' + itemText + '</li>';
          continue;
        }

        // Regular paragraph text
        if (!inParagraph) {
          closeList();
          html += '<p>';
          inParagraph = true;
          html += applyInlineFormatting(line);
        } else {
          // New line within the same paragraph
          html += '<br>' + applyInlineFormatting(line);
        }
      }

      // Close any open blocks at the end
      closeParagraph();
      closeList();

      return html;
    }
  };
})();
