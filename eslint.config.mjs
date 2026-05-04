// SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
// SPDX-License-Identifier: BSD-3-Clause

import js from "@eslint/js";
import globals from "globals";

const browserGlobals = {
  ...globals.browser,
  Module: "readonly",
  createMrubycModule: "readonly",
  CodeMirror: "readonly",
  I18n: "readonly",
  t: "readonly",
  Utils: "readonly",
  UIManager: "readonly",
  BLEProtocol: "readonly",
  FileManager: "readonly",
  HistoryManager: "readonly",
  BoardManager: "readonly",
  Compiler: "readonly",
  Simulator: "readonly",
  BoardLoader: "readonly",
  BOARD_CONFIG: "readonly",
  MrubycWasmAPI: "readonly",
  CRC16: "readonly",
  ErrorHandler: "readonly",
  crc16_reflect: "readonly",
  EventBus: "readonly",
  BLEStateMachine: "readonly",
  Config: "readonly",
  Logger: "readonly",
  BLEState: "readonly",
  BLE_VALID_TRANSITIONS: "readonly",
  isBLETransitionValid: "readonly",
  BLECommandQueue: "readonly",
  BLEConnection: "readonly",
  BLETransfer: "readonly",
  BLEKnownDevices: "readonly",
  NetUtils: "readonly",
};

export default [
  js.configs.recommended,
  {
    ignores: [
      "node_modules/**",
      "vendor/emsdk/**",
      "vendor/mruby/**",
      "vendor/mrubyc/**",
      "public_html/codemirror/**",
      "public_html/mrbc/**",
      "public_html/mrubyc/**",
    ],
  },
  {
    files: ["public_html/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: browserGlobals,
    },
    rules: {
      "no-redeclare": "off",
      "no-useless-escape": "off",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_|^(argc|colno|error)$",
          varsIgnorePattern:
            "^_|^(BLECommandQueue|BLEConnection|BLEKnownDevices|BLEProtocol|BLEState|BLEStateMachine|BLETransfer|BoardManager|Compiler|Config|EventBus|FileManager|HistoryManager|I18n|Logger|NetUtils|Simulator|UIManager|Utils|crc16_reflect|isBLETransitionValid|t)$",
          caughtErrorsIgnorePattern: "^_|^e$",
        },
      ],
    },
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: globals.node,
    },
  },
];
