# SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
# SPDX-License-Identifier: BSD-3-Clause
#
# Makefile for OpenBlink WebIDE
# Builds both mrbc (mruby bytecode compiler) and mrubyc (mruby/c VM) for WebAssembly

# ============================================================================
# mruby/c WebAssembly Module Build Configuration
# ============================================================================

# Directories
MRUBYC_DIR = vendor/mrubyc
MRUBYC_SRC_DIR = $(MRUBYC_DIR)/src
SRC_DIR = src
HAL_DIR = $(SRC_DIR)/lib/mrubyc
BUILD_DIR = public_html

# Emscripten compiler
CC = emcc
RUBY ?= ruby
RUBY_BINDIR ?= $(dir $(shell command -v $(RUBY) 2>/dev/null))

# Compiler flags
MRUBYC_CFLAGS = -O3 \
                -flto \
                -Wall \
                -I$(MRUBYC_SRC_DIR) \
                -I$(HAL_DIR) \
                -DMRBC_SCHEDULER_EXIT=1 \
                -DMRBC_USE_FLOAT=2 \
                -DMRBC_USE_MATH=1 \
                -DMAX_VM_COUNT=5 \
                -DMRBC_MEMORY_SIZE=131072

# Emscripten specific flags
MRUBYC_EMFLAGS = -s WASM=1 \
                 -s STRICT=1 \
                 -s EXPORTED_RUNTIME_METHODS='["ccall","HEAPU8","addFunction","removeFunction"]' \
                 -s EXPORTED_FUNCTIONS='["_mrbc_wasm_init","_mrbc_wasm_stop","_mrbc_wasm_run","_mrbc_wasm_print_statistics","_malloc","_free","_mrbc_wasm_get_class_object","_mrbc_wasm_define_class","_mrbc_wasm_define_method","_mrbc_wasm_get_int_arg","_mrbc_wasm_get_float_arg","_mrbc_wasm_is_numeric_arg","_mrbc_wasm_set_return_bool","_mrbc_wasm_set_return_nil","_mrbc_wasm_set_return_int","_mrbc_wasm_set_return_float","_mrbc_wasm_instance_new","_mrbc_wasm_set_global_const","_mrbc_wasm_free_instance"]' \
                 -s ALLOW_TABLE_GROWTH=1 \
                 -s ALLOW_MEMORY_GROWTH=1 \
                 -s INITIAL_HEAP=16777216 \
                 -s MAXIMUM_MEMORY=33554432 \
                 -s STACK_SIZE=1048576 \
                 -s MALLOC=dlmalloc \
                 -s ABORTING_MALLOC=1 \
                 -s ASYNCIFY=1 \
                 -s ASYNCIFY_STACK_SIZE=65536 \
                 -s MODULARIZE=1 \
                 -s EXPORT_ES6=1 \
                 -s EXPORT_NAME='createMrubycModule' \
                 -s ASSERTIONS=1 \
                 -s STACK_OVERFLOW_CHECK=1 \
                 -s CHECK_NULL_WRITES=1 \
                 -s FILESYSTEM=0 \
                 -s ENVIRONMENT='web' \
                 -s EXIT_RUNTIME=0 \
                 -s DYNAMIC_EXECUTION=0 \
                 -s TEXTDECODER=2 \
                 -s INCOMING_MODULE_JS_API='["locateFile","print","printErr"]' \
                 --no-entry

# mruby/c source files
MRUBYC_SRCS = $(MRUBYC_SRC_DIR)/alloc.c \
              $(MRUBYC_SRC_DIR)/c_array.c \
              $(MRUBYC_SRC_DIR)/c_hash.c \
              $(MRUBYC_SRC_DIR)/c_math.c \
              $(MRUBYC_SRC_DIR)/c_numeric.c \
              $(MRUBYC_SRC_DIR)/c_object.c \
              $(MRUBYC_SRC_DIR)/c_proc.c \
              $(MRUBYC_SRC_DIR)/c_range.c \
              $(MRUBYC_SRC_DIR)/c_string.c \
              $(MRUBYC_SRC_DIR)/class.c \
              $(MRUBYC_SRC_DIR)/console.c \
              $(MRUBYC_SRC_DIR)/error.c \
              $(MRUBYC_SRC_DIR)/global.c \
              $(MRUBYC_SRC_DIR)/keyvalue.c \
              $(MRUBYC_SRC_DIR)/load.c \
              $(MRUBYC_SRC_DIR)/mrblib.c \
              $(MRUBYC_SRC_DIR)/rrt0.c \
              $(MRUBYC_SRC_DIR)/symbol.c \
              $(MRUBYC_SRC_DIR)/value.c \
              $(MRUBYC_SRC_DIR)/vm.c

# HAL source files
HAL_SRCS = $(HAL_DIR)/hal.c

# Main source files
MAIN_SRCS = $(SRC_DIR)/main.c

# All source files for mruby/c
SRCS = $(MRUBYC_SRCS) $(HAL_SRCS) $(MAIN_SRCS)

# Output files for mruby/c
MRUBYC_OUTPUT_DIR = $(BUILD_DIR)/mrubyc
MRUBYC_OUTPUT_JS = $(MRUBYC_OUTPUT_DIR)/mrubyc.js
MRUBYC_OUTPUT_WASM = $(MRUBYC_OUTPUT_DIR)/mrubyc.wasm

# ============================================================================
# Build Targets
# ============================================================================

# Default target: build both mrbc and mrubyc
all: mrbc mrubyc codemirror

check-emcc:
	@command -v $(CC) >/dev/null 2>&1 || { echo "emcc was not found. Run: source vendor/emsdk/emsdk_env.sh" >&2; exit 1; }

check-ruby-autogen:
	@PATH="$(RUBY_BINDIR):$(PATH)" ruby -rripper -e 'exit RUBY_VERSION.split(".").first.to_i >= 3 ? 0 : 1' || { echo "Ruby 3.x or newer with Ripper is required for mruby/c autogen. Set RUBY=/path/to/ruby." >&2; exit 1; }

# Build mrbc (mruby bytecode compiler)
mrbc: check-emcc
	@echo "Building mrbc (mruby bytecode compiler)..."
	cd vendor/mruby && PATH="$(RUBY_BINDIR):$(PATH)" rake MRUBY_CONFIG=../../mruby_build_config.rb
	@echo "mrbc build complete. Output: public_html/mrbc/"

# Build mrubyc (mruby/c VM)
mrubyc: check-emcc mrubyc-autogen $(MRUBYC_OUTPUT_DIR) $(MRUBYC_OUTPUT_JS)
	@echo "mrubyc build complete. Output: public_html/mrubyc/"

# Build CodeMirror
codemirror:
	@echo "Building CodeMirror..."
	npm run build:codemirror
	@echo "CodeMirror build complete. Output: public_html/codemirror/"

# Generate mrubyc auto-generated files
mrubyc-autogen: check-ruby-autogen
	@echo "Generating mrubyc auto-generated files..."
	PATH="$(RUBY_BINDIR):$(PATH)" $(MAKE) -C vendor/mrubyc autogen
	@echo "mrubyc auto-generated files complete."

# Create build directory
$(MRUBYC_OUTPUT_DIR):
	mkdir -p $(MRUBYC_OUTPUT_DIR)

# Build WebAssembly module
$(MRUBYC_OUTPUT_JS): $(SRCS) Makefile | $(MRUBYC_OUTPUT_DIR)
	$(CC) $(MRUBYC_CFLAGS) $(MRUBYC_EMFLAGS) $(SRCS) -o $(MRUBYC_OUTPUT_JS)

# Clean build artifacts
clean: clean-mrbc clean-mrubyc clean-codemirror

clean-all: clean
	@echo "Cleaning all mrubyc artifacts including auto-generated files..."
	cd vendor/mrubyc && make clean

clean-mrbc:
	@echo "Cleaning mrbc build artifacts..."
	cd vendor/mruby && make clean || true
	rm -rf build/mrbc

clean-mrubyc:
	@echo "Cleaning mrubyc build artifacts..."
	rm -f $(MRUBYC_OUTPUT_JS) $(MRUBYC_OUTPUT_WASM)
	cd vendor/mrubyc/src && rm -f _autogen_*.h

clean-codemirror:
	@echo "Cleaning CodeMirror build artifacts..."
	rm -rf public_html/codemirror

# Rebuild
rebuild: clean-all all

# Help
help:
	@echo "OpenBlink WebIDE Build System"
	@echo ""
	@echo "Targets:"
	@echo "  all         - Build both mrbc and mrubyc (default)"
	@echo "  check-emcc  - Verify emcc is available"
	@echo "  check-ruby-autogen - Verify Ruby can run mruby/c generators"
	@echo "  mrbc        - Build mrbc (mruby bytecode compiler)"
	@echo "  mrubyc      - Build mrubyc (mruby/c VM for simulator)"
	@echo "  codemirror  - Build CodeMirror from npm"
	@echo "  mrubyc-autogen - Generate mrubyc auto-generated files"
	@echo "  clean       - Remove all build artifacts"
	@echo "  clean-mrbc  - Remove mrbc build artifacts"
	@echo "  clean-mrubyc - Remove mrubyc build artifacts"
	@echo "  clean-codemirror - Remove CodeMirror build artifacts"
	@echo "  clean-all   - Remove all build artifacts including auto-generated files"
	@echo "  rebuild     - Clean and rebuild all"
	@echo "  help        - Show this help message"
	@echo ""
	@echo "Before building, make sure to activate Emscripten:"
	@echo "  source vendor/emsdk/emsdk_env.sh"

.PHONY: all check-emcc check-ruby-autogen mrbc mrubyc codemirror mrubyc-autogen clean clean-mrbc clean-mrubyc clean-codemirror clean-all rebuild help
