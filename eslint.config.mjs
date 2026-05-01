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
};

export default [
  js.configs.recommended,
  {
    ignores: [
      "node_modules/**",
      "emsdk/**",
      "mruby/**",
      "mrubyc/**",
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
            "^_|^(BLEProtocol|BoardManager|Compiler|FileManager|HistoryManager|I18n|Simulator|UIManager|Utils|crc16_reflect|t)$",
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
