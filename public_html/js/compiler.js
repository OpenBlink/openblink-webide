/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2025 ViXion Inc. All Rights Reserved.
 */

const Compiler = (function() {
  return {
    compile: function(rubyCode) {
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
          return {
            success: false,
            error: "mrbc failed with exit code: " + result,
            compileTime: compileTime
          };
        }

        const mrbContent = Module.FS.readFile(outputFileName);

        return {
          success: true,
          bytecode: mrbContent,
          compileTime: compileTime,
          size: mrbContent.length
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

    buildAndBlink: async function() {
      if (!BLEProtocol.isConnected()) {
        UIManager.appendToConsole("Error: Not connected to device");
        return;
      }

      if (!BLEProtocol.isProgramCharacteristicAvailable()) {
        UIManager.appendToConsole("Error: Program characteristic not available. Please reconnect.");
        return;
      }

      UIManager.setRunButtonEnabled(false);

      try {
        const rubyCode = window.editor.getValue();
        const slot = UIManager.getSelectedSlot();

        const compileResult = this.compile(rubyCode);

        if (!compileResult.success) {
          UIManager.appendToConsole(compileResult.error);
          return;
        }

        UIManager.appendToConsole(
          "mrbc success!: (" + compileResult.compileTime.toFixed(2) + "ms)"
        );

        const startSend = performance.now();
        
        await BLEProtocol.sendFirmware(compileResult.bytecode, slot);
        
        const endSend = performance.now();
        const transferTime = endSend - startSend;

        UIManager.appendToConsole(
          "Sending bytecode: Complete! (" + transferTime.toFixed(2) + "ms)"
        );

        UIManager.updateMetrics({
          compileTime: compileResult.compileTime,
          transferTime: transferTime,
          programSize: compileResult.size
        });

        HistoryManager.createCheckpoint(rubyCode, {
          compileTime: compileResult.compileTime,
          transferTime: transferTime,
          size: compileResult.size,
          slot: slot
        });

      } catch (error) {
        UIManager.appendToConsole("Error: " + error.message);
      } finally {
        if (BLEProtocol.isConnected()) {
          UIManager.setRunButtonEnabled(true);
        }
      }
    }
  };
})();
