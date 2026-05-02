/*
 * SPDX-FileCopyrightText: Copyright (c) 2025 ViXion Inc. All Rights Reserved.
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

const Compiler = (function () {
  // Note: Global t() helper is defined in i18n.js

  return {
    compile: function (rubyCode) {
      const sourceFileName = "temp.rb";
      const outputFileName = "temp.mrb";

      Module.FS.writeFile(sourceFileName, rubyCode);

      const args = ["mrbc", "-o", outputFileName, sourceFileName];
      const argc = args.length;

      let argv = null;
      let argPointers = [];

      try {
        argv = Module._malloc(args.length * 4);
        argPointers = args.map((arg) => {
          const ptr = Module._malloc(arg.length + 1);
          Module.stringToUTF8(arg, ptr, arg.length + 1);
          return ptr;
        });

        for (let i = 0; i < argPointers.length; i++) {
          Module.setValue(argv + i * 4, argPointers[i], "i32");
        }

        const startTime = performance.now();
        const result = Module._main(argc, argv);
        const endTime = performance.now();
        const compileTime = endTime - startTime;

        if (result !== 0) {
          const errorMsg =
            t("compiler.failed", { code: result }) ||
            "mrbc failed with exit code: " + result;
          return {
            success: false,
            error: errorMsg,
            compileTime: compileTime,
          };
        }

        const mrbContent = Module.FS.readFile(outputFileName);

        return {
          success: true,
          bytecode: mrbContent,
          compileTime: compileTime,
          size: mrbContent.length,
        };
      } finally {
        if (argPointers.length > 0) {
          argPointers.forEach((ptr) => Module._free(ptr));
        }
        if (argv !== null) {
          Module._free(argv);
        }
      }
    },
  };
})();
