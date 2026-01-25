/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink.org
 */

/**
 * WebSimulator - mruby/c WebAssembly Simulator for OpenBlink WebIDE
 * This module provides browser-based simulation of mruby/c bytecode execution.
 * It is loaded lazily when the user clicks the "Run Simulator" button.
 */

const Simulator = (function() {
  let mrubycModule = null;
  let isRunning = false;
  let boardLoader = null;
  let initialized = false;
  let simulatorPanel = null;

  /**
   * Append output to the simulator console
   * @param {string} text - Text to append
   * @param {string} className - Optional CSS class for styling
   */
  function appendOutput(text, className) {
    const output = document.getElementById('simulator-output');
    if (!output) return;
    
    const span = document.createElement('span');
    if (className) span.className = className;
    span.textContent = text;
    output.appendChild(span);
    output.scrollTop = output.scrollHeight;
  }

  /**
   * Clear the simulator output console
   */
  function clearOutput() {
    const output = document.getElementById('simulator-output');
    if (output) {
      output.innerHTML = '';
    }
  }

  /**
   * Set the simulator status indicator
   * @param {string} status - Status class (loading, ready, running, error)
   * @param {string} text - Status text
   */
  function setStatus(status, text) {
    const indicator = document.getElementById('simulator-status-indicator');
    const statusText = document.getElementById('simulator-status-text');
    
    if (indicator) {
      indicator.className = 'simulator-status-indicator ' + status;
    }
    if (statusText) {
      statusText.textContent = text;
    }
  }

  /**
   * Create the simulator UI panel
   * @returns {HTMLElement} The simulator panel element
   */
  function createSimulatorPanel() {
    const panel = document.createElement('div');
    panel.id = 'simulator-panel';
    panel.className = 'simulator-panel';
    panel.innerHTML = `
      <div class="simulator-header">
        <span class="simulator-title">WebSimulator (Experimental)</span>
        <button id="simulator-close" class="simulator-close-btn">Close</button>
      </div>
      <div class="simulator-status">
        <div id="simulator-status-indicator" class="simulator-status-indicator loading"></div>
        <span id="simulator-status-text">Loading mruby/c module...</span>
      </div>
      <div id="simulator-board-ui" class="simulator-board-ui"></div>
      <div class="simulator-console">
        <div class="simulator-console-header">
          <span>Simulator Output</span>
          <button id="simulator-clear" class="simulator-clear-btn">Clear</button>
        </div>
        <div id="simulator-output" class="simulator-output"></div>
      </div>
    `;
    return panel;
  }

  /**
   * Initialize the mruby/c WASM module and board loader
   */
  async function initModule() {
    if (initialized && mrubycModule) {
      return true;
    }

    try {
      setStatus('loading', 'Loading mruby/c module...');
      
      mrubycModule = await createMrubycModule();
      mrubycModule._mrbc_wasm_init();
      
      boardLoader = new BoardLoader();
      
      initialized = true;
      setStatus('ready', 'Simulator ready');
      appendOutput('[INFO] mruby/c WebAssembly module loaded successfully.\n', 'info');
      
      return true;
    } catch (error) {
      setStatus('error', 'Failed to load module: ' + error.message);
      appendOutput('[ERROR] Failed to load mruby/c module: ' + error.message + '\n', 'error');
      return false;
    }
  }

  /**
   * Run bytecode in the simulator
   * @param {Uint8Array} bytecode - The bytecode to execute
   */
  async function runBytecode(bytecode) {
    if (!mrubycModule || isRunning) return;
    
    isRunning = true;
    setStatus('running', 'Running bytecode...');
    
    const runBtn = document.getElementById('run-simulator');
    if (runBtn) runBtn.disabled = true;
    
    appendOutput('\n--- Execution Start ---\n', 'info');
    
    let bytecodePtr = 0;
    try {
      bytecodePtr = mrubycModule._malloc(bytecode.length);
      if (!bytecodePtr) {
        throw new Error('Memory allocation failed in WebAssembly module.');
      }
      const heapU8 = new Uint8Array(mrubycModule.wasmMemory.buffer);
      heapU8.set(bytecode, bytecodePtr);
      
      const result = await mrubycModule.ccall(
        'mrbc_wasm_run',
        'number',
        ['number', 'number'],
        [bytecodePtr, bytecode.length],
        { async: true }
      );
      
      appendOutput('\n--- Execution End (return: ' + result + ') ---\n', 'info');
      
      if (result === 0) {
        appendOutput('[SUCCESS] Program completed successfully.\n', 'success');
      } else {
        appendOutput('[WARNING] Program returned non-zero: ' + result + '\n', 'error');
      }
    } catch (error) {
      appendOutput('\n[ERROR] Execution failed: ' + error.message + '\n', 'error');
    } finally {
      if (bytecodePtr) {
        mrubycModule._free(bytecodePtr);
      }
      isRunning = false;
      setStatus('ready', 'Simulator ready');
      
      // Recompute the Run Simulator button state based on the current board
      if (typeof UIManager !== 'undefined' && typeof BoardManager !== 'undefined') {
        UIManager.updateSimulatorButton(BoardManager.getCurrentBoard());
      } else {
        const runBtn = document.getElementById('run-simulator');
        if (runBtn) runBtn.disabled = false;
      }
    }
  }

  return {
    /**
     * Check if the simulator is initialized
     * @returns {boolean} True if initialized
     */
    isInitialized: function() {
      return initialized;
    },

    /**
     * Check if the simulator is currently running
     * @returns {boolean} True if running
     */
    isRunning: function() {
      return isRunning;
    },

    /**
     * Initialize and show the simulator panel
     * @param {string} boardName - The board name to load
     * @returns {Promise<boolean>} True if successful
     */
    show: async function(boardName) {
      // Create panel if it doesn't exist
      if (!simulatorPanel) {
        simulatorPanel = createSimulatorPanel();
        document.body.appendChild(simulatorPanel);
        
        // Set up event listeners
        document.getElementById('simulator-close').addEventListener('click', () => {
          this.hide();
        });
        
        document.getElementById('simulator-clear').addEventListener('click', () => {
          clearOutput();
        });
      }
      
      simulatorPanel.style.display = 'block';
      
      // Set up global callbacks for mruby/c output
      window.mrubycOutput = function(text) {
        appendOutput(text);
      };
      
      window.mrubycError = function(text) {
        appendOutput(text, 'error');
      };
      
      window.mrubycOnTaskCreated = function() {
        if (boardLoader && mrubycModule && typeof window.definePixelsAPI === 'function') {
          window.definePixelsAPI(mrubycModule);
        }
      };
      
      // Initialize module
      const success = await initModule();
      if (!success) {
        return false;
      }
      
      // Load board configuration
      const boardUIContainer = document.getElementById('simulator-board-ui');
      
      // Register the board if it has simulator support
      const boardConfig = BoardManager.getCurrentBoard();
      if (boardConfig && boardConfig.name === boardName) {
        boardLoader.registerBoard({
          id: boardName,
          name: boardConfig.displayName || boardName,
          path: `boards/${boardName}`
        });
        
        const boardSuccess = await boardLoader.switchBoard(boardName, boardUIContainer);
        if (boardSuccess) {
          appendOutput('[INFO] Board loaded: ' + boardName + '\n', 'info');
        } else {
          appendOutput('[WARNING] Failed to load board UI for: ' + boardName + '\n', 'error');
        }
      }
      
      return true;
    },

    /**
     * Hide the simulator panel
     */
    hide: function() {
      if (simulatorPanel) {
        simulatorPanel.style.display = 'none';
      }
    },

    /**
     * Run the current editor code in the simulator
     */
    runFromEditor: async function() {
      if (!initialized) {
        UIManager.appendToConsole('Error: Simulator not initialized');
        return;
      }
      
      if (isRunning) {
        UIManager.appendToConsole('Error: Simulator is already running');
        return;
      }
      
      // Compile the code using the existing compiler
      const rubyCode = window.editor.getValue();
      const compileResult = Compiler.compile(rubyCode);
      
      if (!compileResult.success) {
        UIManager.appendToConsole('Compile error: ' + compileResult.error);
        appendOutput('[ERROR] Compilation failed: ' + compileResult.error + '\n', 'error');
        return;
      }
      
      appendOutput('[INFO] Compiled successfully (' + compileResult.compileTime.toFixed(2) + 'ms, ' + compileResult.size + ' bytes)\n', 'info');
      
      // Run the bytecode
      await runBytecode(compileResult.bytecode);
    },

    /**
     * Get the mruby/c module instance
     * @returns {Object|null} The module instance
     */
    getModule: function() {
      return mrubycModule;
    }
  };
})();
