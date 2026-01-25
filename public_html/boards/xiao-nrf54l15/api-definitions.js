/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink.org
 */

/**
 * API definitions for XIAO nRF54L15 board simulator
 * Defines the PIXELS class and methods for mruby/c scripts to control LED strip
 */

/**
 * Registered callback function pointers for cleanup
 * @type {number[]}
 */
let registeredCallbacks = [];

/**
 * Pointer to the current PIXELS instance for memory management
 * @type {number|null}
 */
let currentPixelsInstance = null;

/**
 * Reference to the current API wrapper for cleanup
 * @type {MrubycWasmAPI|null}
 */
let currentApi = null;

/**
 * mruby/c WASM API wrapper class
 * Provides a clean JavaScript interface to the mruby/c WASM functions.
 * This abstraction layer ensures compatibility with future mruby/c versions
 * by isolating the direct WASM calls.
 */
class MrubycWasmAPI {
  /**
   * @param {Object} module - The mruby/c WASM module instance
   */
  constructor(module) {
    this.module = module;
  }

  /**
   * Get the Object class pointer
   * @returns {number} Pointer to the Object class
   */
  getClassObject() {
    return this.module._mrbc_wasm_get_class_object();
  }

  /**
   * Define a new class
   * @param {string} name - Class name
   * @param {number} superClass - Pointer to super class
   * @returns {number} Pointer to the newly created class
   */
  defineClass(name, superClass) {
    return this.module.ccall(
      "mrbc_wasm_define_class",
      "number",
      ["string", "number"],
      [name, superClass],
    );
  }

  /**
   * Define a method for a class
   * @param {number} cls - Pointer to the class
   * @param {string} name - Method name
   * @param {number} func - Pointer to the callback function
   */
  defineMethod(cls, name, func) {
    this.module.ccall(
      "mrbc_wasm_define_method",
      null,
      ["number", "string", "number"],
      [cls, name, func],
    );
  }

  /**
   * Get an integer argument from method call
   * @param {number} vPtr - Pointer to the value array
   * @param {number} index - Argument index (1-based)
   * @returns {number} Integer value
   */
  getIntArg(vPtr, index) {
    return this.module._mrbc_wasm_get_int_arg(vPtr, index);
  }

  /**
   * Get a float argument from method call
   * @param {number} vPtr - Pointer to the value array
   * @param {number} index - Argument index (1-based)
   * @returns {number} Float value
   */
  getFloatArg(vPtr, index) {
    return this.module._mrbc_wasm_get_float_arg(vPtr, index);
  }

  /**
   * Check if an argument is numeric
   * @param {number} vPtr - Pointer to the value array
   * @param {number} index - Argument index (1-based)
   * @returns {boolean} True if numeric
   */
  isNumericArg(vPtr, index) {
    return this.module._mrbc_wasm_is_numeric_arg(vPtr, index) !== 0;
  }

  /**
   * Set return value to boolean
   * @param {number} vPtr - Pointer to the value array
   * @param {boolean} val - Boolean value
   */
  setReturnBool(vPtr, val) {
    this.module._mrbc_wasm_set_return_bool(vPtr, val ? 1 : 0);
  }

  /**
   * Set return value to nil
   * @param {number} vPtr - Pointer to the value array
   */
  setReturnNil(vPtr) {
    this.module._mrbc_wasm_set_return_nil(vPtr);
  }

  /**
   * Set return value to integer
   * @param {number} vPtr - Pointer to the value array
   * @param {number} val - Integer value
   */
  setReturnInt(vPtr, val) {
    this.module._mrbc_wasm_set_return_int(vPtr, val);
  }

  /**
   * Set return value to float
   * @param {number} vPtr - Pointer to the value array
   * @param {number} val - Float value
   */
  setReturnFloat(vPtr, val) {
    this.module._mrbc_wasm_set_return_float(vPtr, val);
  }

  /**
   * Add a callback function to the WASM function table
   * @param {Function} func - The callback function
   * @param {string} signature - Function signature (e.g., 'viii')
   * @returns {number} Function pointer
   */
  addFunction(func, signature) {
    return this.module.addFunction(func, signature);
  }

  /**
   * Remove a callback function from the WASM function table
   * @param {number} funcPtr - Function pointer to remove
   */
  removeFunction(funcPtr) {
    this.module.removeFunction(funcPtr);
  }

  /**
   * Create a new instance of a class
   * @param {number} cls - Pointer to the class
   * @returns {number} Pointer to the instance
   */
  instanceNew(cls) {
    return this.module._mrbc_wasm_instance_new(cls);
  }

  /**
   * Set a global constant
   * @param {string} name - Constant name
   * @param {number} value - Pointer to the value
   */
  setGlobalConst(name, value) {
    this.module.ccall(
      "mrbc_wasm_set_global_const",
      null,
      ["string", "number"],
      [name, value],
    );
  }

  /**
   * Free an instance
   * @param {number} instance - Pointer to the instance
   */
  freeInstance(instance) {
    this.module._mrbc_wasm_free_instance(instance);
  }
}

/**
 * Define the PIXELS API for mruby/c
 * This function handles the atomic swap of callbacks to prevent race conditions
 * during board switching. New callbacks are registered and methods are updated
 * BEFORE old callbacks are removed.
 * @param {Object} mrubycModule - The mruby/c WASM module instance
 */
function definePixelsAPI(mrubycModule) {
  const api = new MrubycWasmAPI(mrubycModule);

  if (currentPixelsInstance && currentApi) {
    currentApi.freeInstance(currentPixelsInstance);
    currentPixelsInstance = null;
  }
  currentApi = api;

  const oldCallbacks = [...registeredCallbacks];
  registeredCallbacks = [];

  const classObject = api.getClassObject();

  const pixelsClass = api.defineClass("Pixels", classObject);

  const setPixelCallback = api.addFunction((vmPtr, vPtr, argc) => {
    if (
      api.isNumericArg(vPtr, 1) &&
      api.isNumericArg(vPtr, 2) &&
      api.isNumericArg(vPtr, 3) &&
      api.isNumericArg(vPtr, 4)
    ) {
      const index = api.getIntArg(vPtr, 1);
      const red = Math.max(0, Math.min(255, api.getIntArg(vPtr, 2))) * 10;
      const green = Math.max(0, Math.min(255, api.getIntArg(vPtr, 3))) * 10;
      const blue = Math.max(0, Math.min(255, api.getIntArg(vPtr, 4))) * 10;

      if (typeof window.setPixelColor === "function") {
        window.setPixelColor(index, red, green, blue);
      }
      api.setReturnBool(vPtr, true);
    } else {
      api.setReturnBool(vPtr, false);
    }
  }, "viii");

  registeredCallbacks.push(setPixelCallback);
  api.defineMethod(pixelsClass, "set", setPixelCallback);

  const updateCallback = api.addFunction((vmPtr, vPtr, argc) => {
    api.setReturnBool(vPtr, true);
  }, "viii");

  registeredCallbacks.push(updateCallback);
  api.defineMethod(pixelsClass, "update", updateCallback);

  const pixelsInstance = api.instanceNew(pixelsClass);

  if (pixelsInstance) {
    currentPixelsInstance = pixelsInstance;
    api.setGlobalConst("PIXELS", pixelsInstance);
  } else {
    console.error("definePixelsAPI: Failed to create Pixels instance");
  }

  for (const callback of oldCallbacks) {
    try {
      api.removeFunction(callback);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Cleanup registered callbacks and instance to prevent memory leaks
 * Should be called when switching boards
 * @param {Object} mrubycModule - The mruby/c WASM module instance
 */
function cleanupPixelsAPI(mrubycModule) {
  if (currentPixelsInstance && currentApi) {
    currentApi.freeInstance(currentPixelsInstance);
    currentPixelsInstance = null;
  }
  currentApi = null;

  for (const callback of registeredCallbacks) {
    try {
      mrubycModule.removeFunction(callback);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  registeredCallbacks = [];
}

if (typeof window !== "undefined") {
  window.definePixelsAPI = definePixelsAPI;
  window.cleanupPixelsAPI = cleanupPixelsAPI;
}
