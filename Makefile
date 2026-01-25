# Makefile for OpenBlink WebIDE
# Builds both mrbc (mruby bytecode compiler) and mrubyc (mruby/c VM) for WebAssembly

# ============================================================================
# mruby/c WebAssembly Module Build Configuration
# ============================================================================

# Directories
MRUBYC_DIR = mrubyc
MRUBYC_SRC_DIR = $(MRUBYC_DIR)/src
SRC_DIR = src
HAL_DIR = $(SRC_DIR)/lib/mrubyc
BUILD_DIR = public_html

# Emscripten compiler
CC = emcc

# Compiler flags
CFLAGS = -O3 \
         -flto \
         -I$(MRUBYC_SRC_DIR) \
         -I$(HAL_DIR) \
         -DMRBC_SCHEDULER_EXIT=1 -DMRBC_USE_FLOAT=1 -DMRBC_USE_MATH=1 -DMAX_VM_COUNT=5 \
         -DMRBC_DEBUG \
         -DNDEBUG

# Emscripten specific flags
EMFLAGS = -s WASM=1 \
          -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","wasmMemory","addFunction","removeFunction"]' \
          -s EXPORTED_FUNCTIONS='["_main","_mrbc_wasm_init","_mrbc_wasm_run","_mrbc_wasm_print_statistics","_malloc","_free","_mrbc_wasm_get_class_object","_mrbc_wasm_define_class","_mrbc_wasm_define_method","_mrbc_wasm_get_int_arg","_mrbc_wasm_get_float_arg","_mrbc_wasm_is_numeric_arg","_mrbc_wasm_set_return_bool","_mrbc_wasm_set_return_nil","_mrbc_wasm_set_return_int","_mrbc_wasm_set_return_float","_mrbc_wasm_instance_new","_mrbc_wasm_set_global_const","_mrbc_wasm_free_instance"]' \
          -s ALLOW_TABLE_GROWTH=1 \
          -s ALLOW_MEMORY_GROWTH=1 \
          -s INITIAL_MEMORY=16777216 \
          -s MAXIMUM_MEMORY=33554432 \
          -s ASYNCIFY \
          -s ASYNCIFY_STACK_SIZE=16384 \
          -s 'ASYNCIFY_ADD=["mrbc_*","hal_*","main"]' \
          -s ASYNCIFY_IMPORTS='["emscripten_sleep"]' \
          -s MODULARIZE=1 \
          -s EXPORT_NAME='createMrubycModule' \
          -s ASSERTIONS=0 \
          -s DISABLE_EXCEPTION_CATCHING=1 \
          -s STACK_OVERFLOW_CHECK=0 \
          -s FILESYSTEM=0 \
          -s ENVIRONMENT='web' \
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
MRUBYC_BUILD_DIR = $(BUILD_DIR)/mrubyc
OUTPUT_JS = $(MRUBYC_BUILD_DIR)/mrubyc.js
OUTPUT_WASM = $(MRUBYC_BUILD_DIR)/mrubyc.wasm

# ============================================================================
# Build Targets
# ============================================================================

# Default target: build both mrbc and mrubyc
all: mrbc mrubyc

# Build mrbc (mruby bytecode compiler)
mrbc:
	@echo "Building mrbc (mruby bytecode compiler)..."
	cd mruby && make
	cd mruby && rake MRUBY_CONFIG=../emscripten.rb
	@echo "mrbc build complete. Output: public_html/mrbc/"

# Build mrubyc (mruby/c VM)
mrubyc: $(MRUBYC_BUILD_DIR) $(OUTPUT_JS)
	@echo "mrubyc build complete. Output: public_html/mrubyc/"

# Create build directory
$(MRUBYC_BUILD_DIR):
	mkdir -p $(MRUBYC_BUILD_DIR)

# Build WebAssembly module
$(OUTPUT_JS): $(SRCS)
	$(CC) $(CFLAGS) $(EMFLAGS) $(SRCS) -o $(OUTPUT_JS)

# Clean build artifacts
clean: clean-mrbc clean-mrubyc

clean-mrbc:
	@echo "Cleaning mrbc build artifacts..."
	cd mruby && make clean || true
	rm -rf public_html/mrbc_build
	rm -f public_html/mrbc/mrbc.js public_html/mrbc/mrbc.wasm

clean-mrubyc:
	@echo "Cleaning mrubyc build artifacts..."
	rm -f $(OUTPUT_JS) $(OUTPUT_WASM)

# Rebuild
rebuild: clean all

# Help
help:
	@echo "OpenBlink WebIDE Build System"
	@echo ""
	@echo "Targets:"
	@echo "  all         - Build both mrbc and mrubyc (default)"
	@echo "  mrbc        - Build mrbc (mruby bytecode compiler)"
	@echo "  mrubyc      - Build mrubyc (mruby/c VM for simulator)"
	@echo "  clean       - Remove all build artifacts"
	@echo "  clean-mrbc  - Remove mrbc build artifacts"
	@echo "  clean-mrubyc - Remove mrubyc build artifacts"
	@echo "  rebuild     - Clean and rebuild all"
	@echo "  help        - Show this help message"
	@echo ""
	@echo "Before building, make sure to activate Emscripten:"
	@echo "  source emsdk/emsdk_env.sh"

.PHONY: all mrbc mrubyc clean clean-mrbc clean-mrubyc rebuild help
