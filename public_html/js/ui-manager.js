/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2025 ViXion Inc. All Rights Reserved.
 */

const UIManager = (function() {
  let connectButton = null;
  let disconnectButton = null;
  let runMainButton = null;
  let softResetButton = null;
  let loadFileButton = null;
  let saveFileButton = null;
  let slotSelector = null;
  let boardSelector = null;

  let metricsHistory = {
    compile: [],
    transfer: [],
    size: []
  };

  function calculateStats(arr) {
    if (arr.length === 0) return { min: null, avg: null, max: null };
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    return { min, avg, max };
  }

  function getSelectedSlot() {
    if (slotSelector) {
      const value = parseInt(slotSelector.value, 10);
      if (value === 1 || value === 2) {
        return value;
      }
    }
    return 2;
  }

  return {
    appendToConsole: function(message) {
      if (message === undefined || message === null) {
        return;
      }
      const msgStr = String(message).trim();
      if (msgStr === "") {
        return;
      }
      const consoleOutput = document.getElementById("consoleOutput");
      if (!consoleOutput) return;
      
      const line = document.createElement("div");
      line.textContent = msgStr;
      consoleOutput.appendChild(line);
      consoleOutput.scrollTop = consoleOutput.scrollHeight;
    },

    updateConnectionStatus: function(status) {
      const statusElement = document.getElementById("connectionStatus");
      if (!statusElement) return;

      statusElement.className = "connection-status";

      switch (status) {
        case "connected":
          statusElement.textContent = "Connected";
          statusElement.classList.add("connected");
          if (connectButton) connectButton.disabled = true;
          if (disconnectButton) disconnectButton.disabled = false;
          if (runMainButton) runMainButton.disabled = false;
          if (softResetButton) softResetButton.disabled = false;
          break;
        case "disconnected":
          statusElement.textContent = "Disconnected";
          statusElement.classList.add("disconnected");
          if (connectButton) connectButton.disabled = false;
          if (disconnectButton) disconnectButton.disabled = true;
          if (runMainButton) runMainButton.disabled = true;
          if (softResetButton) softResetButton.disabled = true;
          break;
        case "connecting":
          statusElement.textContent = "Connecting...";
          statusElement.classList.add("connecting");
          if (connectButton) connectButton.disabled = true;
          if (disconnectButton) disconnectButton.disabled = true;
          if (runMainButton) runMainButton.disabled = true;
          if (softResetButton) softResetButton.disabled = true;
          break;
        case "reconnecting":
          statusElement.textContent = "Reconnecting...";
          statusElement.classList.add("connecting");
          if (connectButton) connectButton.disabled = true;
          if (disconnectButton) disconnectButton.disabled = false;
          if (runMainButton) runMainButton.disabled = true;
          if (softResetButton) softResetButton.disabled = true;
          break;
      }
    },

    updateMetrics: function(metrics) {
      const metricsPanel = document.getElementById("metrics-panel");
      if (!metricsPanel) return;

      if (metrics.compileTime !== undefined) {
        metricsHistory.compile.push(metrics.compileTime);
      }
      if (metrics.transferTime !== undefined) {
        metricsHistory.transfer.push(metrics.transferTime);
      }
      if (metrics.programSize !== undefined) {
        metricsHistory.size.push(metrics.programSize);
      }

      const compileStats = calculateStats(metricsHistory.compile);
      const transferStats = calculateStats(metricsHistory.transfer);
      const sizeStats = calculateStats(metricsHistory.size);

      const updateElement = (id, value, unit, decimals) => {
        const el = document.getElementById(id);
        if (el && value !== null) {
          el.textContent = (decimals !== undefined ? value.toFixed(decimals) : value) + unit;
        }
      };

      updateElement("compile-min", compileStats.min, " ms", 1);
      updateElement("compile-avg", compileStats.avg, " ms", 1);
      updateElement("compile-max", compileStats.max, " ms", 1);

      updateElement("transfer-min", transferStats.min, " ms", 1);
      updateElement("transfer-avg", transferStats.avg, " ms", 1);
      updateElement("transfer-max", transferStats.max, " ms", 1);

      updateElement("size-min", sizeStats.min, " B", undefined);
      updateElement("size-avg", Math.round(sizeStats.avg), " B", undefined);
      updateElement("size-max", sizeStats.max, " B", undefined);

      metricsPanel.style.display = "block";
    },

    getSelectedSlot: getSelectedSlot,

    initialize: function() {
      connectButton = document.getElementById("ble-connect");
      disconnectButton = document.getElementById("ble-disconnect");
      runMainButton = document.getElementById("run-main");
      softResetButton = document.getElementById("soft-reset");
      loadFileButton = document.getElementById("load-file");
      saveFileButton = document.getElementById("save-file");
      slotSelector = document.getElementById("slot-selector");
      boardSelector = document.getElementById("board-selector");

      this.updateConnectionStatus("disconnected");

      if (connectButton) {
        connectButton.addEventListener("click", () => {
          BLEProtocol.connect();
        });
      }

      if (disconnectButton) {
        disconnectButton.addEventListener("click", () => {
          BLEProtocol.disconnect();
        });
      }

      if (softResetButton) {
        softResetButton.addEventListener("click", () => {
          if (!BLEProtocol.isConnected()) {
            this.appendToConsole("Error: Not connected to device");
            return;
          }
          softResetButton.disabled = true;
          BLEProtocol.sendReset().finally(() => {
            if (BLEProtocol.isConnected()) {
              softResetButton.disabled = false;
            }
          });
        });
      }

      if (runMainButton) {
        runMainButton.addEventListener("click", () => {
          Compiler.buildAndBlink();
        });
      }

      if (loadFileButton) {
        loadFileButton.addEventListener("click", () => {
          FileManager.loadFile();
        });
      }

      if (saveFileButton) {
        saveFileButton.addEventListener("click", () => {
          FileManager.saveFile();
        });
      }

      if (boardSelector) {
        boardSelector.addEventListener("change", (e) => {
          BoardManager.switchBoard(e.target.value);
        });
      }
    },

    populateBoardSelector: function(boards) {
      if (!boardSelector) return;
      
      boardSelector.innerHTML = "";
      boards.forEach(board => {
        const option = document.createElement("option");
        option.value = board.name;
        option.textContent = board.displayName;
        boardSelector.appendChild(option);
      });
    },

    setRunButtonEnabled: function(enabled) {
      if (runMainButton) {
        runMainButton.disabled = !enabled || !BLEProtocol.isConnected();
      }
    }
  };
})();
