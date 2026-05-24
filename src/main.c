// SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
// SPDX-License-Identifier: BSD-3-Clause

/*! @file
  @brief
  Main entry point for mruby/c WebAssembly module.
*/

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <emscripten.h>
#include "mrubyc.h"
#include "hal.h"

EM_JS(void, js_on_task_created, (), {
  const moduleCallback =
    typeof Module !== 'undefined' && Module.mrubycOnTaskCreated;
  if (typeof moduleCallback === 'function') {
    moduleCallback();
  }
});

#if !defined(MRBC_MEMORY_SIZE)
#define MRBC_MEMORY_SIZE 131072
#endif

#define MIN_BYTECODE_SIZE 8
#define MAX_BYTECODE_SIZE (1024 * 1024)

static uint8_t memory_pool[MRBC_MEMORY_SIZE];
static int initialized = 0;
static mrbc_tcb *active_tcb = NULL;

EMSCRIPTEN_KEEPALIVE
void mrbc_wasm_init(void);

static void write_text(int fd, const char *message)
{
  hal_write(fd, message, (int)strlen(message));
  hal_flush(fd);
}

static void reset_vm(void)
{
  if (initialized) {
    mrbc_cleanup();
    initialized = 0;
  }
  mrbc_wasm_init();
}

static void terminate_active_task(void)
{
  mrbc_tcb *tcb = active_tcb;

  if (tcb == NULL) {
    return;
  }

  active_tcb = NULL;
  mrbc_terminate_task(tcb);
  mrbc_delete_task(tcb);
}

EMSCRIPTEN_KEEPALIVE
void mrbc_wasm_init(void)
{
  if (!initialized) {
    mrbc_init(memory_pool, MRBC_MEMORY_SIZE);
    initialized = 1;
  }
}

EMSCRIPTEN_KEEPALIVE
void mrbc_wasm_stop(void)
{
  terminate_active_task();
}

EMSCRIPTEN_KEEPALIVE
int mrbc_wasm_run(const uint8_t *bytecode, int size)
{
  char buffer[256];

  if (bytecode == NULL) {
    write_text(2, "[ERROR] Bytecode pointer is NULL.\n");
    return -1;
  }

  if (size < MIN_BYTECODE_SIZE) {
    snprintf(buffer, sizeof(buffer),
      "[ERROR] Bytecode size too small: %d bytes (minimum: %d bytes).\n",
      size, MIN_BYTECODE_SIZE);
    write_text(2, buffer);
    return -2;
  }

  if (size > MAX_BYTECODE_SIZE) {
    snprintf(buffer, sizeof(buffer),
      "[ERROR] Bytecode size too large: %d bytes (maximum: %d bytes).\n",
      size, MAX_BYTECODE_SIZE);
    write_text(2, buffer);
    return -3;
  }

  if (bytecode[0] != 'R' || bytecode[1] != 'I' ||
      bytecode[2] != 'T' || bytecode[3] != 'E') {
    write_text(2, "[ERROR] Invalid bytecode format: missing RITE header.\n");
    return -4;
  }

  if (!initialized) {
    mrbc_wasm_init();
  }

  mrbc_tcb *tcb = mrbc_create_task(bytecode, NULL);
  
  if (tcb == NULL) {
    write_text(2, "[ERROR] Failed to create task.\n");
    write_text(2, "  Possible causes:\n");
    write_text(2, "  - Insufficient memory in VM pool\n");
    write_text(2, "  - Invalid or corrupted bytecode\n");
    write_text(2, "  - VM state is abnormal\n");
    snprintf(buffer, sizeof(buffer),
      "  Memory pool size: %d bytes\n", MRBC_MEMORY_SIZE);
    write_text(2, buffer);
    reset_vm();
    return -5;
  }

  js_on_task_created();

  active_tcb = tcb;
  int ret = mrbc_run();
  hal_flush(1);
  hal_flush(2);
  active_tcb = NULL;
  reset_vm();

  return ret == 1 ? 0 : ret;
}

EMSCRIPTEN_KEEPALIVE
void mrbc_wasm_print_statistics(void)
{
  mrbc_alloc_print_statistics();
}

/*
 * WASM API wrapper functions for JavaScript integration
 * These functions expose mruby/c internal APIs to JavaScript,
 * allowing dynamic class and method definition from the browser.
 */

/**
 * @brief Get pointer to mrbc_class_object (Object class)
 * @return Pointer to the Object class
 */
EMSCRIPTEN_KEEPALIVE
void* mrbc_wasm_get_class_object(void)
{
  return (void*)mrbc_class_object;
}

/**
 * @brief Define a new class in mruby/c
 * @param name Class name
 * @param super Pointer to super class (use mrbc_wasm_get_class_object for Object)
 * @return Pointer to the newly created class
 */
EMSCRIPTEN_KEEPALIVE
void* mrbc_wasm_define_class(const char* name, void* super)
{
  if (!initialized) {
    mrbc_wasm_init();
  }
  return (void*)mrbc_define_class(0, name, (mrbc_class*)super);
}

/**
 * @brief Define a method for a class
 * @param cls Pointer to the class
 * @param name Method name
 * @param func Pointer to the C function (mrbc_func_t signature)
 */
EMSCRIPTEN_KEEPALIVE
void mrbc_wasm_define_method(void* cls, const char* name, void* func)
{
  mrbc_define_method(0, (mrbc_class*)cls, name, (mrbc_func_t)func);
}

/**
 * @brief Get an integer argument from mruby/c method call
 * Wrapper for GET_INT_ARG macro to ensure compatibility with future mruby/c versions
 * @param v Pointer to the value array (mrbc_value*)
 * @param index Argument index (1-based)
 * @return Integer value of the argument
 */
EMSCRIPTEN_KEEPALIVE
int mrbc_wasm_get_int_arg(void* v, int index)
{
  mrbc_value* values = (mrbc_value*)v;
  if (values[index].tt == MRBC_TT_INTEGER) {
    return (int)values[index].i;
  } else if (values[index].tt == MRBC_TT_FLOAT) {
    return (int)values[index].d;
  }
  return 0;
}

/**
 * @brief Get a float argument from mruby/c method call
 * @param v Pointer to the value array (mrbc_value*)
 * @param index Argument index (1-based)
 * @return Float value of the argument
 */
EMSCRIPTEN_KEEPALIVE
double mrbc_wasm_get_float_arg(void* v, int index)
{
  mrbc_value* values = (mrbc_value*)v;
  if (values[index].tt == MRBC_TT_FLOAT) {
    return values[index].d;
  } else if (values[index].tt == MRBC_TT_INTEGER) {
    return (double)values[index].i;
  }
  return 0.0;
}

/**
 * @brief Check if an argument is numeric (integer or float)
 * @param v Pointer to the value array (mrbc_value*)
 * @param index Argument index (1-based)
 * @return 1 if numeric, 0 otherwise
 */
EMSCRIPTEN_KEEPALIVE
int mrbc_wasm_is_numeric_arg(void* v, int index)
{
  mrbc_value* values = (mrbc_value*)v;
  return (values[index].tt == MRBC_TT_INTEGER || values[index].tt == MRBC_TT_FLOAT) ? 1 : 0;
}

/**
 * @brief Set return value to boolean (true/false)
 * Wrapper for SET_BOOL_RETURN macro to ensure compatibility with future mruby/c versions
 * @param v Pointer to the value array (mrbc_value*)
 * @param val Boolean value (0 = false, non-zero = true)
 */
EMSCRIPTEN_KEEPALIVE
void mrbc_wasm_set_return_bool(void* v, int val)
{
  mrbc_value* values = (mrbc_value*)v;
  mrbc_decref(values);
  values[0].tt = val ? MRBC_TT_TRUE : MRBC_TT_FALSE;
}

/**
 * @brief Set return value to nil
 * @param v Pointer to the value array (mrbc_value*)
 */
EMSCRIPTEN_KEEPALIVE
void mrbc_wasm_set_return_nil(void* v)
{
  mrbc_value* values = (mrbc_value*)v;
  mrbc_decref(values);
  values[0].tt = MRBC_TT_NIL;
}

/**
 * @brief Set return value to integer
 * @param v Pointer to the value array (mrbc_value*)
 * @param val Integer value
 */
EMSCRIPTEN_KEEPALIVE
void mrbc_wasm_set_return_int(void* v, int val)
{
  mrbc_value* values = (mrbc_value*)v;
  mrbc_decref(values);
  values[0].tt = MRBC_TT_INTEGER;
  values[0].i = val;
}

/**
 * @brief Set return value to float
 * @param v Pointer to the value array (mrbc_value*)
 * @param val Float value
 */
EMSCRIPTEN_KEEPALIVE
void mrbc_wasm_set_return_float(void* v, double val)
{
  mrbc_value* values = (mrbc_value*)v;
  mrbc_decref(values);
  values[0].tt = MRBC_TT_FLOAT;
  values[0].d = val;
}

/**
 * @brief Create a new instance of a class
 * @param cls Pointer to the class
 * @return Pointer to the newly created instance (mrbc_value*)
 */
EMSCRIPTEN_KEEPALIVE
void* mrbc_wasm_instance_new(void* cls)
{
  if (!initialized) {
    mrbc_wasm_init();
  }
  
  mrbc_value* instance = (mrbc_value*)malloc(sizeof(mrbc_value));
  if (!instance) {
    return NULL;
  }
  
  *instance = mrbc_instance_new(0, (mrbc_class*)cls, 0);
  
  if (instance->instance == NULL) {
    free(instance);
    return NULL;
  }
  
  return (void*)instance;
}

/**
 * @brief Set a global constant
 * @param name Constant name
 * @param value Pointer to the value (mrbc_value*)
 */
EMSCRIPTEN_KEEPALIVE
void mrbc_wasm_set_global_const(const char* name, void* value)
{
  if (!initialized) {
    mrbc_wasm_init();
  }
  
  mrbc_value* val = (mrbc_value*)value;
  mrbc_sym sym_id = mrbc_str_to_symid(name);
  
  mrbc_set_const(sym_id, val);
}

/**
 * @brief Free an instance created by mrbc_wasm_instance_new
 * @param instance Pointer to the instance (mrbc_value*)
 */
EMSCRIPTEN_KEEPALIVE
void mrbc_wasm_free_instance(void* instance)
{
  if (instance) {
    free(instance);
  }
}
