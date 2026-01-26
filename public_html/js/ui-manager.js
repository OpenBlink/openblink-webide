/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2025 ViXion Inc. All Rights Reserved.
 */

const UIManager = (function() {
  let connectButton = null;
  let disconnectButton = null;
  let runMainButton = null;
  let runSimulatorButton = null;
  let softResetButton = null;
  let loadFileButton = null;
  let saveFileButton = null;
  let slotSelector = null;
  let boardSelector = null;
  let simulatorLoaded = false;

  const MAX_METRICS_HISTORY = 100;

  let metricsHistory = {
    compile: [],
    transfer: [],
    size: []
  };

  function t(key, params) {
    if (typeof I18n !== 'undefined') {
      return I18n.t(key, params);
    }
    return null;
  }

  function addToHistory(arr, value) {
    arr.push(value);
    while (arr.length > MAX_METRICS_HISTORY) {
      arr.shift();
    }
  }

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
          statusElement.textContent = t('status.connected') || "Connected";
          statusElement.classList.add("connected");
          if (connectButton) connectButton.disabled = true;
          if (disconnectButton) disconnectButton.disabled = false;
          if (runMainButton) runMainButton.disabled = false;
          if (softResetButton) softResetButton.disabled = false;
          break;
        case "disconnected":
          statusElement.textContent = t('status.disconnected') || "Disconnected";
          statusElement.classList.add("disconnected");
          if (connectButton) connectButton.disabled = false;
          if (disconnectButton) disconnectButton.disabled = true;
          if (runMainButton) runMainButton.disabled = true;
          if (softResetButton) softResetButton.disabled = true;
          break;
        case "connecting":
          statusElement.textContent = t('status.connecting') || "Connecting...";
          statusElement.classList.add("connecting");
          if (connectButton) connectButton.disabled = true;
          if (disconnectButton) disconnectButton.disabled = true;
          if (runMainButton) runMainButton.disabled = true;
          if (softResetButton) softResetButton.disabled = true;
          break;
        case "reconnecting":
          statusElement.textContent = t('status.reconnecting') || "Reconnecting...";
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
        addToHistory(metricsHistory.compile, metrics.compileTime);
      }
      if (metrics.transferTime !== undefined) {
        addToHistory(metricsHistory.transfer, metrics.transferTime);
      }
      if (metrics.programSize !== undefined) {
        addToHistory(metricsHistory.size, metrics.programSize);
      }

      const compileStats = calculateStats(metricsHistory.compile);
      const transferStats = calculateStats(metricsHistory.transfer);
      const sizeStats = calculateStats(metricsHistory.size);

      const updateCurrent = (id, value, unit, decimals) => {
        const el = document.getElementById(id);
        if (el && value !== undefined) {
          el.textContent = (decimals !== undefined ? value.toFixed(decimals) : value) + unit;
        }
      };

      updateCurrent("compile-current", metrics.compileTime, " ms", 1);
      updateCurrent("transfer-current", metrics.transferTime, " ms", 1);
      updateCurrent("size-current", metrics.programSize, " B", undefined);

      const renderChart = (chartId, stats, unit, decimals) => {
        const chart = document.getElementById(chartId);
        if (!chart || stats.min === null) return;

        const range = stats.max - stats.min;
        const padding = range > 0 ? range * 0.1 : stats.max * 0.1;
        const displayMin = Math.max(0, stats.min - padding);
        const displayMax = stats.max + padding;
        const displayRange = displayMax - displayMin;

        // Calculate percentages and validate to ensure finite numbers between 0-100
        const clampPercent = (val) => {
          if (!Number.isFinite(val)) return 0;
          return Math.max(0, Math.min(100, val));
        };

        const minPercent = clampPercent(displayRange > 0 ? ((stats.min - displayMin) / displayRange) * 100 : 0);
        const maxPercent = clampPercent(displayRange > 0 ? ((stats.max - displayMin) / displayRange) * 100 : 100);
        const avgPercent = clampPercent(displayRange > 0 ? ((stats.avg - displayMin) / displayRange) * 100 : 50);

        const formatValue = (val) => {
          if (!Number.isFinite(val)) return '--';
          return decimals !== undefined ? val.toFixed(decimals) : Math.round(val);
        };

        chart.innerHTML = `
          <div class="metrics-bar metrics-bar-range" style="left: ${minPercent}%; width: ${maxPercent - minPercent}%;"></div>
          <div class="metrics-bar metrics-bar-avg" style="left: ${avgPercent}%;"></div>
          <div class="metrics-chart-labels">
            <span class="metrics-chart-min">${formatValue(stats.min)}${unit}</span>
            <span class="metrics-chart-max">${formatValue(stats.max)}${unit}</span>
          </div>
          <span class="metrics-chart-avg" style="left: ${avgPercent}%;">avg: ${formatValue(stats.avg)}${unit}</span>
        `;
      };

      renderChart("compile-chart", compileStats, "ms", 1);
      renderChart("transfer-chart", transferStats, "ms", 1);
      renderChart("size-chart", sizeStats, "B", undefined);

      metricsPanel.style.display = "block";
    },

    getSelectedSlot: getSelectedSlot,

    initialize: function() {
      connectButton = document.getElementById("ble-connect");
      disconnectButton = document.getElementById("ble-disconnect");
      runMainButton = document.getElementById("run-main");
      runSimulatorButton = document.getElementById("run-simulator");
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
            const msg = t('error.notConnected') || "Not connected to device";
            this.appendToConsole("Error: " + msg);
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

      if (runSimulatorButton) {
        runSimulatorButton.addEventListener("click", async () => {
          const currentBoard = BoardManager.getCurrentBoard();
          if (!currentBoard || !BoardManager.hasSimulatorSupport(currentBoard)) {
            const msg = t('error.simulatorNotAvailable') || "Simulator not available for this board";
            this.appendToConsole("Error: " + msg);
            return;
          }

          runSimulatorButton.disabled = true;
          const loadingMsg = t('message.loadingSimulator') || "Loading simulator...";
          this.appendToConsole(loadingMsg);

          try {
            await this.loadSimulatorResources();
            const success = await Simulator.show(currentBoard.name);
            if (success) {
              await Simulator.runFromEditor();
            }
          } catch (error) {
            const errorMsg = t('error.loadingSimulatorFailed', { message: error.message }) || ("Error loading simulator: " + error.message);
            this.appendToConsole(errorMsg);
          } finally {
            this.updateSimulatorButton(BoardManager.getCurrentBoard());
          }
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
    },

    updateSimulatorButton: function(board) {
      if (!runSimulatorButton) return;
      
      const hasSimulator = BoardManager.hasSimulatorSupport(board);
      runSimulatorButton.disabled = !hasSimulator;
      const availableTitle = t('simulator.available') || "Run code in browser simulator";
      const unavailableTitle = t('simulator.unavailable') || "Simulator not available for this board";
      runSimulatorButton.title = hasSimulator ? availableTitle : unavailableTitle;
    },

    loadSimulatorResources: async function() {
      if (simulatorLoaded) return;

      const loadScript = (src) => {
        return new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = src;
          script.onload = resolve;
          script.onerror = () => reject(new Error("Failed to load " + src));
          document.body.appendChild(script);
        });
      };

      await loadScript("mrubyc/mrubyc.js");
      await loadScript("lib/board-loader.js");
      await loadScript("js/simulator.js");

      simulatorLoaded = true;
    }
  };
})();
