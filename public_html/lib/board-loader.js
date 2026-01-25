/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink.org
 */

/**
 * Board Loader - Dynamically loads and manages board configurations for simulator
 * Enables switching between different microcontroller boards without
 * recompiling the C/WASM code.
 */

class BoardLoader {
  constructor() {
    this.currentBoard = null;
    this.currentBoardId = null;
    this.loadedScripts = [];
    
    // Available boards registry - populated from board configs
    this.availableBoards = [];
  }

  /**
   * Load a script dynamically
   * @param {string} path - Path to the script file
   * @returns {Promise} Resolves when script is loaded
   */
  loadScript(path) {
    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${path}"]`);
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = path;
      script.onload = () => {
        this.loadedScripts.push(script);
        resolve();
      };
      script.onerror = () => {
        reject(new Error(`Failed to load script: ${path}`));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Unload previously loaded board scripts
   */
  unloadScripts() {
    for (const script of this.loadedScripts) {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }
    this.loadedScripts = [];
  }

  /**
   * Load a board configuration
   * @param {string} boardPath - Path to the board directory
   * @returns {Promise} Resolves when all board files are loaded
   */
  async loadBoard(boardPath) {
    await this.loadScript(`${boardPath}/board-config.js`);
    await this.loadScript(`${boardPath}/ui-components.js`);
    await this.loadScript(`${boardPath}/api-definitions.js`);
  }

  /**
   * Switch to a different board
   * @param {string} boardId - The board ID to switch to
   * @param {HTMLElement} uiContainer - Container for board UI
   * @returns {Promise<boolean>} True if switch was successful
   */
  async switchBoard(boardId, uiContainer) {
    const boardInfo = this.availableBoards.find(b => b.id === boardId);
    if (!boardInfo) {
      console.error(`Board not found: ${boardId}`);
      return false;
    }

    if (this.currentBoard) {
      this.cleanupBoard(uiContainer);
    }

    try {
      await this.loadBoard(boardInfo.path);

      this.currentBoard = window.BOARD_CONFIG;
      this.currentBoardId = boardId;

      if (typeof window.createBoardUI === 'function' && uiContainer) {
        window.createBoardUI(uiContainer, this.currentBoard);
      }

      return true;
    } catch (error) {
      console.error(`Failed to load board ${boardId}:`, error);
      return false;
    }
  }

  /**
   * Cleanup the current board UI only
   * @param {HTMLElement} uiContainer - Container for board UI
   */
  cleanupBoard(uiContainer) {
    if (typeof window.cleanupBoardUI === 'function' && uiContainer) {
      window.cleanupBoardUI(uiContainer);
    }

    this.currentBoard = null;
    this.currentBoardId = null;
  }

  /**
   * Get list of available boards
   * @returns {Array} Array of board info objects
   */
  getAvailableBoards() {
    return this.availableBoards;
  }

  /**
   * Get current board configuration
   * @returns {Object|null} Current board config or null
   */
  getCurrentBoard() {
    return this.currentBoard;
  }

  /**
   * Check if a board is currently loaded
   * @returns {boolean} True if a board is loaded
   */
  isBoardLoaded() {
    return this.currentBoard !== null;
  }

  /**
   * Register a new board
   * @param {Object} boardInfo - Board information object
   * @param {string} boardInfo.id - Unique board ID
   * @param {string} boardInfo.name - Display name
   * @param {string} boardInfo.path - Path to board files
   */
  registerBoard(boardInfo) {
    const existing = this.availableBoards.find(b => b.id === boardInfo.id);
    if (existing) {
      Object.assign(existing, boardInfo);
    } else {
      this.availableBoards.push(boardInfo);
    }
  }
}

if (typeof window !== 'undefined') {
  window.BoardLoader = BoardLoader;
}
