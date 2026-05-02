#!/usr/bin/env node
// SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
// SPDX-License-Identifier: BSD-3-Clause

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const packageJsonPath = path.join(rootDir, "package.json");
const mainJsPath = path.join(rootDir, "public_html", "js", "main.js");

function fail(message) {
  console.error(message);
  process.exit(1);
}

let packageJson;
try {
  packageJson = require(packageJsonPath);
} catch (error) {
  fail(`Unable to load package.json: ${error.message}`);
}

let mainJs;
try {
  mainJs = fs.readFileSync(mainJsPath, "utf8");
} catch (error) {
  fail(`Unable to read public_html/js/main.js: ${error.message}`);
}

const match =
  /const\s+OPENBLINK_WEBIDE_VERSION\s*=\s*["']([^"']+)["']\s*;/.exec(mainJs);
if (!match) {
  fail("OPENBLINK_WEBIDE_VERSION was not found in public_html/js/main.js");
}

const appVersion = match[1];
if (packageJson.version !== appVersion) {
  fail(
    `package.json version (${packageJson.version}) does not match OPENBLINK_WEBIDE_VERSION (${appVersion})`,
  );
}

const refType = process.env.GITHUB_REF_TYPE;
const tagName = process.env.GITHUB_REF_NAME;
if (refType === "tag" && tagName) {
  const tagVersion = tagName.replace(/^v/, "");
  if (tagVersion !== appVersion) {
    fail(
      `Git tag version (${tagVersion}) does not match OPENBLINK_WEBIDE_VERSION (${appVersion})`,
    );
  }
}

console.log(`Version check passed: ${appVersion}`);
