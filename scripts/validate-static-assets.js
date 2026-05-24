#!/usr/bin/env node
// SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
// SPDX-License-Identifier: BSD-3-Clause

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");

const requiredFiles = [
  { path: "LICENSE", minBytes: 100 },
  { path: "public_html/index.html", minBytes: 1000 },
  { path: "public_html/codemirror/codemirror.js", minBytes: 1000 },
  { path: "public_html/codemirror/LICENSE", minBytes: 100 },
  { path: "public_html/mrbc/LICENSE.txt", minBytes: 100 },
  { path: "public_html/mrbc/mrbc.js", minBytes: 1000 },
  { path: "public_html/mrbc/mrbc.wasm", minBytes: 1000 },
  { path: "public_html/mrubyc/LICENSE", minBytes: 100 },
  { path: "public_html/mrubyc/mrubyc.js", minBytes: 1000 },
  { path: "public_html/mrubyc/mrubyc.wasm", minBytes: 1000 },
];

const requiredDirectories = [
  "public_html/boards",
  "public_html/css",
  "public_html/js",
  "public_html/lib",
];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

for (const dir of requiredDirectories) {
  const absolute = path.join(rootDir, dir);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
    fail(`${dir} is missing or is not a directory`);
  } else {
    console.log(`✓ ${dir}`);
  }
}

for (const file of requiredFiles) {
  const absolute = path.join(rootDir, file.path);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    fail(`${file.path} is missing or is not a file`);
    continue;
  }

  const size = fs.statSync(absolute).size;
  if (size < file.minBytes) {
    fail(`${file.path} is suspiciously small (${size} bytes)`);
    continue;
  }

  console.log(`✓ ${file.path} (${size} bytes)`);
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("\nStatic asset validation passed.");
