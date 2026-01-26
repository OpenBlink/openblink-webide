/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink.org
 */

const BoardManager = (function () {
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

  async function fetchLocalizedReference(boardName, language) {
    // Derive the localized file suffix from I18n when available,
    // falling back to the English `.md` default otherwise.
    let suffix = '.md';

    if (typeof I18n !== 'undefined' && typeof I18n.getLocalizedFileSuffix === 'function') {
      try {
        const localizedSuffix = I18n.getLocalizedFileSuffix();
        if (typeof localizedSuffix === 'string' && localizedSuffix.trim() !== '') {
          suffix = localizedSuffix;
        }
      } catch (error) {
        console.error('Failed to get localized file suffix from I18n:', error);
      }
    }

    const localizedPath = `boards/${boardName}/reference${suffix}`;

    let content = await fetchText(localizedPath);
    if (!content && suffix !== '.md') {
      content = await fetchText(`boards/${boardName}/reference.md`);
    }

    return content;
  }

  return {
    loadBoards: async function () {
      const boardList = ["m5stamps3", "xiao-nrf54l15"]; // Add new board names here

      for (const boardName of boardList) {
        const config = await fetchJSON(`boards/${boardName}/config.json`);
        if (config) {
          const sampleCode = await fetchText(`boards/${boardName}/sample.rb`);
          const language = (typeof I18n !== 'undefined') ? I18n.getLanguage() : 'en';
          const reference = await fetchLocalizedReference(boardName, language);

          boards.push({
            name: boardName,
            displayName: config.displayName || config.name,
            manufacturer: config.manufacturer,
            description: config.description,
            sampleCode: sampleCode || "",
            reference: reference || "",
            simulator: config.simulator || null,
          });
        }
      }

      if (boards.length > 0) {
        currentBoard = boards[0];
        UIManager.populateBoardSelector(boards);

        if (currentBoard.sampleCode && window.editor) {
          window.editor.setValue(currentBoard.sampleCode);
          if (
            typeof FileManager !== "undefined" &&
            typeof FileManager.markClean === "function"
          ) {
            FileManager.markClean();
          }
        }

        // Update reference panel for initial board load
        this.updateReferencePanel(currentBoard);

        // Update simulator button state for initial board
        UIManager.updateSimulatorButton(currentBoard);
      }

      return boards;
    },

    getCurrentBoard: function () {
      return currentBoard;
    },

    getBoards: function () {
      return boards;
    },

    switchBoard: function (boardName) {
      const board = boards.find((b) => b.name === boardName);
      if (!board) {
        const errorMsg = (typeof I18n !== 'undefined')
          ? I18n.t('error.boardNotFound', { boardName: boardName })
          : `Error: Board "${boardName}" not found`;
        UIManager.appendToConsole(errorMsg);
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
      UIManager.updateSimulatorButton(board);
      const switchMsg = (typeof I18n !== 'undefined')
        ? I18n.t('message.boardSwitched', { boardName: board.displayName })
        : `Switched to board: ${board.displayName}`;
      UIManager.appendToConsole(switchMsg);

      return true;
    },

    hasSimulatorSupport: function (board) {
      return board && board.simulator && board.simulator.enabled === true;
    },

    updateReferencePanel: async function (board) {
      const referenceContent = document.getElementById("reference-content");
      if (!referenceContent || !board) return;

      const language = (typeof I18n !== 'undefined') ? I18n.getLanguage() : 'en';
      const localizedReference = await fetchLocalizedReference(board.name, language);

      if (localizedReference) {
        referenceContent.innerHTML = this.parseMarkdown(localizedReference);
      } else if (board.reference) {
        referenceContent.innerHTML = this.parseMarkdown(board.reference);
      } else {
        const noDocMsg = (typeof I18n !== 'undefined')
          ? I18n.t('reference.noDoc')
          : 'No reference documentation available for this board.';
        referenceContent.innerHTML = '<p>' + Utils.escapeHtml(noDocMsg) + '</p>';
      }
    },

    reloadReferenceForLanguage: async function () {
      if (currentBoard) {
        await this.updateReferencePanel(currentBoard);
      }
    },

    parseMarkdown: function (markdown) {
      // Simple line-oriented markdown parser for headings, lists, paragraphs and inline code
      const lines = markdown.split("\n");
      let html = "";
      let inParagraph = false;
      let inList = false;

      function applyInlineFormatting(text) {
        // Escape HTML first, then apply inline code formatting
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

        // Blank line: close paragraphs and lists
        if (trimmed === "") {
          closeParagraph();
          closeList();
          continue;
        }

        // Headings (###, ##, #)
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

        // List items starting with "* " or "- "
        let listMatch;
        if ((listMatch = /^\s*[\*\-]\s+(.*)$/.exec(line)) !== null) {
          // Start a new list if not currently in one
          if (!inList) {
            closeParagraph();
            html += "<ul>";
            inList = true;
          }
          const itemText = applyInlineFormatting(listMatch[1]);
          html += "<li>" + itemText + "</li>";
          continue;
        }

        // Regular paragraph text
        if (!inParagraph) {
          closeList();
          html += "<p>";
          inParagraph = true;
          html += applyInlineFormatting(line);
        } else {
          // New line within the same paragraph
          html += "<br>" + applyInlineFormatting(line);
        }
      }

      // Close any open blocks at the end
      closeParagraph();
      closeList();

      return html;
    },
  };
})();
