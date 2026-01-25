/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink.org
 */

/**
 * Board configuration for XIAO nRF54L15 simulator
 * Defines board-specific settings including UI layout and hardware parameters
 */
const BOARD_CONFIG = {
  name: "XIAO nRF54L15",
  id: "xiao-nrf54l15",
  description: "6x10 RGB Matrix for XIAO nRF54L15",
  
  ui: {
    matrixWidth: 10,
    matrixHeight: 6,
    totalPixels: 60
  }
};

if (typeof window !== 'undefined') {
  window.BOARD_CONFIG = BOARD_CONFIG;
}
