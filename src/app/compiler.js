/*
 * SPDX-FileCopyrightText: Copyright (c) 2025 ViXion Inc. All Rights Reserved.
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { I18n, t } from "./i18n.js";
import { EventBus } from "./state/event-bus.js";
import {
  isRuntimeReady,
  loadMrbcFactory,
  compileSource,
} from "./mrbc-runtime.js";

// Main-thread facade for the mrbc compiler. Prefers running the compiler in a
// module worker (js/compiler-worker.js) so compilation never blocks the UI;
// falls back to an in-page runtime when workers are unavailable.
export const Compiler = (function () {
  const WORKER_SRC = "js/compiler-worker.js";
  const MRBC_MODULE_SRC = "mrbc/mrbc.js";

  let worker = null;
  let workerReady = false;
  let nextRequestId = 1;
  const pendingRequests = new Map();

  let mrbcModule = null;
  let initializationPromise = null;

  function appendCompilerOutput(text) {
    if (text && text.trim() !== "") {
      EventBus.emit("COMPILER:OUTPUT", { message: text });
    }
  }

  function appendCompilerError(text) {
    if (!text || text.trim() === "") return;
    const prefix =
      typeof I18n !== "undefined"
        ? I18n.t("compiler.errorPrefix") || "Compiler Error: "
        : "Compiler Error: ";
    let errorText = prefix + text;
    if (typeof I18n !== "undefined" && I18n.isEasyJapanese()) {
      errorText = I18n.wrapCompilerError(text);
    }
    EventBus.emit("COMPILER:OUTPUT", { message: errorText });
  }

  function notReadyResult() {
    return {
      success: false,
      error:
        "mrbc runtime is not ready. Please reload the page and try again.",
      compileTime: 0,
    };
  }

  // Converts the transport-level result from mrbc-runtime / the worker into
  // the localized result shape callers expect.
  function finalizeResult(result) {
    if (result.success) {
      return result;
    }

    if (typeof result.exitCode === "number") {
      const errorMsg =
        (typeof t === "function" &&
          t("compiler.failed", { code: result.exitCode })) ||
        "mrbc failed with exit code: " + result.exitCode;
      return {
        success: false,
        error: errorMsg,
        compileTime: result.compileTime,
      };
    }

    return {
      success: false,
      error: result.errorMessage || result.error || "Compilation failed.",
      compileTime: result.compileTime || 0,
    };
  }

  function failPendingRequests(message) {
    for (const [, pending] of pendingRequests) {
      pending.resolve({ success: false, error: message, compileTime: 0 });
    }
    pendingRequests.clear();
  }

  function handleWorkerMessage(event) {
    const data = event.data || {};

    switch (data.type) {
      case "output":
        appendCompilerOutput(data.text);
        break;
      case "error":
        appendCompilerError(data.text);
        break;
      case "result": {
        const pending = pendingRequests.get(data.id);
        if (pending) {
          pendingRequests.delete(data.id);
          pending.resolve(finalizeResult(data.result));
        }
        break;
      }
    }
  }

  function initializeWorker() {
    return new Promise((resolve, reject) => {
      let candidate;
      try {
        candidate = new Worker(WORKER_SRC, { type: "module" });
      } catch (error) {
        reject(error);
        return;
      }

      const handleInitMessage = (event) => {
        const data = event.data || {};
        if (data.type === "ready") {
          candidate.removeEventListener("message", handleInitMessage);
          candidate.addEventListener("message", handleWorkerMessage);
          candidate.addEventListener("error", (errorEvent) => {
            failPendingRequests(
              "Compiler worker failed: " +
                (errorEvent.message || "unknown error"),
            );
            workerReady = false;
            worker = null;
            initializationPromise = null;
            candidate.terminate();
          });
          worker = candidate;
          workerReady = true;
          resolve(candidate);
        } else if (data.type === "init-error") {
          candidate.terminate();
          reject(new Error(data.message));
        } else {
          handleWorkerMessage(event);
        }
      };

      candidate.addEventListener("message", handleInitMessage);
      candidate.addEventListener("error", (errorEvent) => {
        if (!workerReady) {
          candidate.terminate();
          reject(
            new Error(errorEvent.message || "Compiler worker failed to load."),
          );
        }
      });
      candidate.postMessage({ type: "init" });
    });
  }

  async function initializeInPageRuntime() {
    if (isRuntimeReady(mrbcModule)) {
      return mrbcModule;
    }

    const moduleUrl = new URL(MRBC_MODULE_SRC, window.location.href).href;
    const moduleFactory = await loadMrbcFactory(moduleUrl);
    const moduleInstance = await moduleFactory({
      locateFile: (path) => "mrbc/" + path,
      print: appendCompilerOutput,
      printErr: appendCompilerError,
    });

    if (!isRuntimeReady(moduleInstance)) {
      throw new Error("mrbc runtime did not expose the required API.");
    }

    mrbcModule = moduleInstance;
    return mrbcModule;
  }

  async function initializeRuntime() {
    if (workerReady || isRuntimeReady(mrbcModule)) {
      return;
    }

    if (initializationPromise) {
      return initializationPromise;
    }

    initializationPromise = (async () => {
      if (typeof Worker === "function") {
        try {
          await initializeWorker();
          return;
        } catch (error) {
          appendCompilerOutput(
            "Compiler worker unavailable (" +
              error.message +
              "); compiling on the main thread.",
          );
        }
      }
      await initializeInPageRuntime();
    })();

    try {
      return await initializationPromise;
    } catch (error) {
      initializationPromise = null;
      throw error;
    }
  }

  function compileInWorker(rubyCode) {
    return new Promise((resolve) => {
      const id = nextRequestId++;
      pendingRequests.set(id, { resolve: resolve });
      worker.postMessage({ type: "compile", id: id, source: rubyCode });
    });
  }

  return {
    initialize: initializeRuntime,

    compile: async function (rubyCode) {
      if (workerReady) {
        return compileInWorker(rubyCode);
      }

      if (!isRuntimeReady(mrbcModule)) {
        try {
          await initializeRuntime();
        } catch (_error) {
          return notReadyResult();
        }
      }

      if (workerReady) {
        return compileInWorker(rubyCode);
      }

      if (!isRuntimeReady(mrbcModule)) {
        return notReadyResult();
      }

      return finalizeResult(compileSource(mrbcModule, rubyCode));
    },
  };
})();
