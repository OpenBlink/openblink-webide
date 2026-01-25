/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink.org
 */

/**
 * UI components for XIAO nRF54L15 board simulator
 * Creates and manages the 6x10 RGB LED matrix display
 */

/**
 * Create the board-specific UI elements
 * @param {HTMLElement} container - The container element to add UI to
 * @param {Object} config - The board configuration object
 */
function createBoardUI(container, config) {
  container.innerHTML = '';
  
  const title = document.createElement('div');
  title.className = 'simulator-board-title';
  title.textContent = `${config.ui.matrixWidth}x${config.ui.matrixHeight} RGB MATRIX for ${config.name}`;
  container.appendChild(title);
  
  const dotContainer = document.createElement('div');
  dotContainer.id = 'simulator-dot-container';
  dotContainer.className = 'simulator-dot-container';
  container.appendChild(dotContainer);
  
  for (let i = 0; i < config.ui.totalPixels; i++) {
    const dot = document.createElement('div');
    dot.id = 'simulator-pixel-' + i;
    dot.className = 'simulator-dot';
    dot.textContent = i;
    dotContainer.appendChild(dot);
  }
}

/**
 * Set the color of a specific pixel/LED
 * @param {number} id - The pixel ID (0-based index)
 * @param {number} red - Red component (0-255)
 * @param {number} green - Green component (0-255)
 * @param {number} blue - Blue component (0-255)
 */
function setPixelColor(id, red, green, blue) {
  console.log('[setPixelColor] id:', id, 'rgb:', red, green, blue);
  const targetDot = document.getElementById('simulator-pixel-' + id);
  if (targetDot) {
    targetDot.style.backgroundColor = `rgb(${red}, ${green}, ${blue})`;
    const brightness = red + green + blue;
    const isLight = brightness > 128 * 3;
    targetDot.style.color = isLight ? '#666' : 'white';
  } else {
    console.warn('[setPixelColor] Element not found: simulator-pixel-' + id);
  }
}

/**
 * Reset all pixels to default state (gray)
 * @param {Object} config - The board configuration object
 */
function resetPixels(config) {
  for (let i = 0; i < config.ui.totalPixels; i++) {
    const dot = document.getElementById('simulator-pixel-' + i);
    if (dot) {
      dot.style.backgroundColor = '';
      dot.style.color = '';
    }
  }
}

/**
 * Cleanup the board UI
 * @param {HTMLElement} container - The container element
 */
function cleanupBoardUI(container) {
  container.innerHTML = '';
}

if (typeof window !== 'undefined') {
  window.createBoardUI = createBoardUI;
  window.setPixelColor = setPixelColor;
  window.resetPixels = resetPixels;
  window.cleanupBoardUI = cleanupBoardUI;
}
