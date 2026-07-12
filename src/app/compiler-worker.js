/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

// Module worker that hosts the mrbc WASM compiler off the main thread.
// Protocol (worker -> main): "ready" | "init-error" | "output" | "error" |
// "result". Protocol (main -> worker): "init" | "compile".

import {
  isRuntimeReady,
  loadMrbcFactory,
  compileSource,
} from "./mrbc-runtime.js";

let mrbcModule = null;
let initializationPromise = null;

function post(message, transfer) {
  self.postMessage(message, transfer || []);
}

async function initializeRuntime() {
  if (isRuntimeReady(mrbcModule)) {
    return mrbcModule;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    const mrbcBase = new URL("../mrbc/", self.location.href).href;
    const moduleFactory = await loadMrbcFactory(mrbcBase + "mrbc.js");
    const moduleInstance = await moduleFactory({
      locateFile: (path) => mrbcBase + path,
      print: (text) => {
        if (text && text.trim() !== "") {
          post({ type: "output", text: text });
        }
      },
      printErr: (text) => {
        if (text && text.trim() !== "") {
          post({ type: "error", text: text });
        }
      },
    });

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

self.onmessage = async (event) => {
  const data = event.data || {};

  if (data.type === "init") {
    try {
      await initializeRuntime();
      post({ type: "ready" });
    } catch (error) {
      post({ type: "init-error", message: error.message });
    }
    return;
  }

  if (data.type === "compile") {
    let result;
    try {
      await initializeRuntime();
      result = compileSource(mrbcModule, data.source);
    } catch (error) {
      post({
        type: "result",
        id: data.id,
        result: { success: false, errorMessage: error.message, compileTime: 0 },
      });
      return;
    }

    const transfer =
      result.success && result.bytecode ? [result.bytecode.buffer] : [];
    post({ type: "result", id: data.id, result: result }, transfer);
  }
};
