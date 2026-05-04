// SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
// SPDX-License-Identifier: BSD-3-Clause
//
// esbuild configuration for CodeMirror 5
// Copies CodeMirror files from node_modules to public_html/codemirror/

import fs from "fs";
import path from "path";

const isWatch = process.argv.includes("--watch");

async function build() {
  // Ensure output directories exist
  const dirs = [
    "public_html/codemirror",
    "public_html/codemirror/mode/ruby",
    "public_html/codemirror/addon/edit",
    "public_html/codemirror/theme",
  ];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Copy CodeMirror core JS
  fs.copyFileSync(
    "node_modules/codemirror/lib/codemirror.js",
    "public_html/codemirror/codemirror.js",
  );

  // Copy Ruby mode JS
  fs.copyFileSync(
    "node_modules/codemirror/mode/ruby/ruby.js",
    "public_html/codemirror/mode/ruby/ruby.js",
  );

  // Copy MatchBrackets addon JS
  fs.copyFileSync(
    "node_modules/codemirror/addon/edit/matchbrackets.js",
    "public_html/codemirror/addon/edit/matchbrackets.js",
  );

  // Copy CodeMirror core CSS
  fs.copyFileSync(
    "node_modules/codemirror/lib/codemirror.css",
    "public_html/codemirror/codemirror.css",
  );

  // Copy Dracula theme CSS
  fs.copyFileSync(
    "node_modules/codemirror/theme/dracula.css",
    "public_html/codemirror/theme/dracula.css",
  );

  if (!isWatch) {
    console.log("CodeMirror build complete: public_html/codemirror/");
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
