/*
 * SPDX-FileCopyrightText: Copyright (c) 2025 ViXion Inc. All Rights Reserved.
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

const Compiler = (function () {
  // Note: Global t() helper is defined in i18n.js
  const MRBC_MODULE_SRC = "mrbc/mrbc.js";
  let mrbcModule = null;
  let initializationPromise = null;

  function isRuntimeReady(moduleInstance) {
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

  function appendCompilerOutput(text) {
    const consoleOutput = document.getElementById("consoleOutput");
    if (consoleOutput && text && text.trim() !== "") {
      const line = document.createElement("div");
      line.textContent = text;
      consoleOutput.appendChild(line);
      consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
  }

  function appendCompilerError(text) {
    const consoleOutput = document.getElementById("consoleOutput");
    if (consoleOutput && text && text.trim() !== "") {
      const line = document.createElement("div");
      const prefix =
        typeof I18n !== "undefined"
          ? I18n.t("compiler.errorPrefix") || "Compiler Error: "
          : "Compiler Error: ";
      let errorText = prefix + text;
      if (typeof I18n !== "undefined" && I18n.isEasyJapanese()) {
        errorText = I18n.wrapCompilerError(text);
      }
      line.textContent = errorText;
      consoleOutput.appendChild(line);
      consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
  }

  function getModuleOptions() {
    return {
      locateFile: (path) => "mrbc/" + path,
      print: appendCompilerOutput,
      printErr: appendCompilerError,
    };
  }

  async function loadEsModuleFactory(src) {
    const moduleUrl = new URL(src, window.location.href).href;
    const moduleNamespace = await import(moduleUrl);
    const moduleFactory =
      moduleNamespace.default || moduleNamespace.createMrbcModule;

    if (typeof moduleFactory !== "function") {
      throw new Error("mrbc module factory was not found: " + src);
    }

    return moduleFactory;
  }

  async function initializeRuntime() {
    if (isRuntimeReady(mrbcModule)) {
      return mrbcModule;
    }

    if (initializationPromise) {
      return initializationPromise;
    }

    initializationPromise = (async () => {
      const moduleOptions = getModuleOptions();
      const moduleFactory = await loadEsModuleFactory(MRBC_MODULE_SRC);
      const moduleInstance = await moduleFactory(moduleOptions);

      if (!isRuntimeReady(moduleInstance)) {
        throw new Error("mrbc runtime did not expose the required API.");
      }

      mrbcModule = moduleInstance;
      return mrbcModule;
    })();

    try {
      return await initializationPromise;
    } catch (error) {
      initializationPromise = null;
      throw error;
    }
  }

  function tryUnlink(fs, path) {
    try {
      fs.unlink(path);
    } catch (_error) {
      return;
    }
  }

  return {
    initialize: initializeRuntime,

    compile: function (rubyCode) {
      if (!isRuntimeReady(mrbcModule)) {
        const errorMsg =
          "mrbc runtime is not ready. Please reload the page and try again.";
        return {
          success: false,
          error: errorMsg,
          compileTime: 0,
        };
      }

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
          const errorMsg =
            (typeof t === "function" &&
              t("compiler.failed", { code: result })) ||
            "mrbc failed with exit code: " + result;
          return {
            success: false,
            error: errorMsg,
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
    },
  };
})();
