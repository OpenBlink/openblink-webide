// SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
// SPDX-License-Identifier: BSD-3-Clause

import js from "@eslint/js";
import globals from "globals";

// Globals shared between the app bundle and the dynamically loaded classic
// scripts (js/simulator.js, lib/board-loader.js, boards/*).
const legacyScriptGlobals = {
  ...globals.browser,
  Module: "readonly",
  createMrubycModule: "readonly",
  t: "readonly",
  UIManager: "readonly",
  BoardManager: "readonly",
  Compiler: "readonly",
  Simulator: "readonly",
  BoardLoader: "readonly",
  BOARD_CONFIG: "readonly",
  MrubycWasmAPI: "readonly",
  CRC16: "readonly",
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
      "public_html/js/app.js",
      "public_html/js/compiler-worker.js",
      "public_html/mrbc/**",
      "public_html/mrubyc/**",
    ],
  },
  {
    files: ["public_html/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: legacyScriptGlobals,
    },
    rules: {
      "no-redeclare": "off",
      "no-useless-escape": "off",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_|^(argc|colno|error)$",
          varsIgnorePattern: "^_|^Simulator$",
          caughtErrorsIgnorePattern: "^_|^e$",
        },
      ],
    },
  },
  {
    files: ["src/app/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        // Provided by the dynamically loaded classic scripts.
        Simulator: "readonly",
        createMrubycModule: "readonly",
      },
    },
    rules: {
      "no-useless-escape": "off",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_|^(argc|colno|error)$",
          varsIgnorePattern: "^_",
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
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
  },
  {
    files: ["src/codemirror/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
    },
  },
];
