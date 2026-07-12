// SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
// SPDX-License-Identifier: BSD-3-Clause
//
// esbuild configuration for the OpenBlink WebIDE browser bundles:
//   - CodeMirror 6 (node_modules -> public_html/codemirror/)
//   - Application core (src/app -> public_html/js/app.js)
// js/simulator.js, lib/board-loader.js and boards/* stay as classic scripts
// loaded on demand; the app bundle exposes the globals they rely on.

import * as esbuild from "esbuild";
import fs from "fs";
import path from "path";

const isWatch = process.argv.includes("--watch");
const outputDir = "public_html/codemirror";
const outputFile = `${outputDir}/codemirror.js`;
const appOutputFile = "public_html/js/app.js";
const bundledPackages = [
  "codemirror",
  "@codemirror/autocomplete",
  "@codemirror/commands",
  "@codemirror/language",
  "@codemirror/legacy-modes",
  "@codemirror/lint",
  "@codemirror/search",
  "@codemirror/state",
  "@codemirror/theme-one-dark",
  "@codemirror/view",
  "@lezer/common",
  "@lezer/highlight",
  "@lezer/lr",
  "@marijn/find-cluster-break",
  "crelt",
  "style-mod",
  "w3c-keyname",
];

function generateLicenseFile() {
  fs.copyFileSync(
    "node_modules/codemirror/LICENSE",
    "public_html/codemirror/LICENSE",
  );

  const bundledLicenseLines = bundledPackages.map((name) => {
    const packageJsonPath = path.join("node_modules", name, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const licensePath = path.join("node_modules", name, "LICENSE");
    const licenseText = fs.readFileSync(licensePath, "utf8").trimEnd();
    return [
      `Package: ${name}`,
      `License: ${packageJson.license || "UNKNOWN"}`,
      "",
      licenseText,
    ].join("\n");
  });

  fs.appendFileSync(
    "public_html/codemirror/LICENSE",
    `\n\nBundled third-party license notices:\n\n${bundledLicenseLines.join("\n\n---\n\n")}\n`,
  );
}

function finalizeBuild() {
  fs.writeFileSync(
    outputFile,
    fs.readFileSync(outputFile, "utf8").replace(/[ \t]+$/gm, ""),
  );
  generateLicenseFile();
  console.log("CodeMirror build complete: public_html/codemirror/");
}

const postBuildPlugin = {
  name: "openblink-codemirror-post-build",
  setup(buildContext) {
    buildContext.onEnd((result) => {
      if (result.errors.length > 0) {
        return;
      }
      finalizeBuild();
    });
  },
};

async function build() {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const commonOptions = {
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    legalComments: "none",
    logLevel: "info",
  };

  const codemirrorOptions = {
    ...commonOptions,
    entryPoints: ["src/codemirror/editor.mjs"],
    outfile: outputFile,
    plugins: [postBuildPlugin],
  };

  const appOptions = {
    ...commonOptions,
    entryPoints: ["src/app/main.js"],
    outfile: appOutputFile,
  };

  if (isWatch) {
    const codemirrorContext = await esbuild.context(codemirrorOptions);
    const appContext = await esbuild.context(appOptions);
    await Promise.all([codemirrorContext.watch(), appContext.watch()]);
    console.log("Watching CodeMirror and app bundles...");
    return;
  }

  await Promise.all([
    esbuild.build(codemirrorOptions),
    esbuild.build(appOptions),
  ]);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
