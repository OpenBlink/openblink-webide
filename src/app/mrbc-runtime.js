/*
 * SPDX-FileCopyrightText: Copyright (c) 2025 ViXion Inc. All Rights Reserved.
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

// Shared mrbc (mruby bytecode compiler) runtime helpers, usable from both the
// main thread and the compiler worker. Contains no DOM or i18n dependencies;
// callers are responsible for localizing error messages.

export function isRuntimeReady(moduleInstance) {
  return (
    moduleInstance &&
    moduleInstance.FS &&
    typeof moduleInstance.FS.writeFile === "function" &&
    typeof moduleInstance.FS.readFile === "function" &&
    typeof moduleInstance._malloc === "function" &&
    typeof moduleInstance._free === "function" &&
    typeof moduleInstance.stringToUTF8 === "function" &&
    typeof moduleInstance.setValue === "function" &&
    typeof moduleInstance._main === "function"
  );
}

export async function loadMrbcFactory(moduleUrl) {
  const moduleNamespace = await import(/* @vite-ignore */ moduleUrl);
  const moduleFactory =
    moduleNamespace.default || moduleNamespace.createMrbcModule;

  if (typeof moduleFactory !== "function") {
    throw new Error("mrbc module factory was not found: " + moduleUrl);
  }

  return moduleFactory;
}

function tryUnlink(fs, path) {
  try {
    fs.unlink(path);
  } catch (_error) {
    return;
  }
}

// Runs mrbc on the given Ruby source. Returns either
// { success: true, bytecode, compileTime, size } or
// { success: false, exitCode, compileTime }.
export function compileSource(mrbcModule, rubyCode) {
  const sourceFileName = "temp.rb";
  const outputFileName = "temp.mrb";

  tryUnlink(mrbcModule.FS, outputFileName);
  mrbcModule.FS.writeFile(sourceFileName, rubyCode);

  const args = ["mrbc", "-o", outputFileName, sourceFileName];
  const argc = args.length;

  let argv = null;
  let argPointers = [];

  try {
    argv = mrbcModule._malloc(args.length * 4);
    if (!argv) {
      throw new Error("Failed to allocate compiler argv.");
    }

    for (const arg of args) {
      const ptr = mrbcModule._malloc(arg.length + 1);
      if (!ptr) {
        throw new Error("Failed to allocate compiler argument.");
      }
      mrbcModule.stringToUTF8(arg, ptr, arg.length + 1);
      argPointers.push(ptr);
    }

    for (let i = 0; i < argPointers.length; i++) {
      mrbcModule.setValue(argv + i * 4, argPointers[i], "i32");
    }

    const startTime = performance.now();
    const result = mrbcModule._main(argc, argv);
    const endTime = performance.now();
    const compileTime = endTime - startTime;

    if (result !== 0) {
      return {
        success: false,
        exitCode: result,
        compileTime: compileTime,
      };
    }

    const mrbContent = mrbcModule.FS.readFile(outputFileName);

    return {
      success: true,
      bytecode: mrbContent,
      compileTime: compileTime,
      size: mrbContent.length,
    };
  } finally {
    if (argPointers.length > 0) {
      argPointers.forEach((ptr) => mrbcModule._free(ptr));
    }
    if (argv !== null) {
      mrbcModule._free(argv);
    }
  }
}
