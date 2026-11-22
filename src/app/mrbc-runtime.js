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

// RITE binary layout (see mruby/include/mruby/dump.h):
//   header (20 bytes): "RITE" + format version(4) + binary size(4, BE) +
//                      compiler name(4) + compiler version(4)
//   section records:   ident(4) + section size(4, BE, whole record) + payload
const RITE_BINARY_HEADER_SIZE = 20;
const RITE_LVAR_IDENT = "LVAR";

// Removes the LVAR (local variable names) section from a compiled .mrb,
// matching what `mrbc --remove-lv` produces. mruby 3.4.0's mrbc silently
// ignores the flag because mrbc_args.flags is a 2-bit field that cannot
// hold MRB_DUMP_NO_LVAR (=4); upstream fixed the field width in 4.0.0
// (mruby/mruby commit 586ff7a). Stripping here gives the flag its intended
// effect on the pinned mruby while remaining a no-op once mrbc honors it.
// mruby/c loaders ignore non-IREP sections, so the output stays loadable.
export function removeLvarSection(bytecode) {
  if (
    !bytecode ||
    bytecode.length < RITE_BINARY_HEADER_SIZE ||
    String.fromCharCode(...bytecode.slice(0, 4)) !== "RITE"
  ) {
    return bytecode;
  }

  const view = new DataView(bytecode.buffer, bytecode.byteOffset);
  const kept = [bytecode.slice(0, RITE_BINARY_HEADER_SIZE)];
  let stripped = 0;
  let pos = RITE_BINARY_HEADER_SIZE;

  while (pos + 8 <= bytecode.length) {
    const size = view.getUint32(pos + 4);
    if (size < 8 || pos + size > bytecode.length) {
      return bytecode;
    }
    const ident = String.fromCharCode(...bytecode.slice(pos, pos + 4));
    if (ident === RITE_LVAR_IDENT) {
      stripped += size;
    } else {
      kept.push(bytecode.slice(pos, pos + size));
    }
    pos += size;
  }
  if (pos !== bytecode.length) {
    return bytecode;
  }
  if (stripped === 0) {
    return bytecode;
  }

  const result = new Uint8Array(bytecode.length - stripped);
  let offset = 0;
  for (const chunk of kept) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  const resultView = new DataView(result.buffer);
  resultView.setUint32(8, result.length);
  return result;
}

// Runs mrbc on the given Ruby source. Returns either
// { success: true, bytecode, compileTime, size } or
// { success: false, exitCode, compileTime }.
export function compileSource(mrbcModule, rubyCode) {
  const sourceFileName = "temp.rb";
  const outputFileName = "temp.mrb";

  tryUnlink(mrbcModule.FS, outputFileName);
  mrbcModule.FS.writeFile(sourceFileName, rubyCode);

  const args = [
    "mrbc",
    "-o",
    outputFileName,
    "--remove-lv",
    sourceFileName,
  ];
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

    const mrbContent = removeLvarSection(
      mrbcModule.FS.readFile(outputFileName),
    );

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
