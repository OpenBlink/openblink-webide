# SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
# SPDX-License-Identifier: BSD-3-Clause

MRuby::Build.new('emscripten') do |conf|
  toolchain :clang

  # Output directory for mrbc.js and mrbc.wasm
  conf.build_dir = File.expand_path('../build/mrbc', __FILE__)

  # Compiler settings (Emscripten 5.0.7)
  conf.cc.command = 'emcc'
  conf.cxx.command = 'em++'
  conf.linker.command = 'emcc'
  conf.archiver.command = 'emar'

  # Optimization settings
  conf.cc.flags << '-O3'
  conf.cc.flags << '-flto'
  conf.cc.flags << '-fno-exceptions'

  # WebAssembly settings
  conf.linker.flags << '-s WASM=1'
  conf.linker.flags << '-s ENVIRONMENT=web'
  conf.linker.flags << '-s WASM_BIGINT=1'              # Use BigInt for i64 (Emscripten 5.0.7)
  conf.linker.flags << '-s WASM_ASYNC_COMPILATION=1'  # Async compilation (Emscripten 5.0.7)

  # Memory settings
  conf.linker.flags << '-s ALLOW_MEMORY_GROWTH=1'
  conf.linker.flags << '-s INITIAL_HEAP=33554432'      # 32MB (INITIAL_HEAP is recommended over INITIAL_MEMORY)
  conf.linker.flags << '-s MAXIMUM_MEMORY=268435456'   # 256MB (default is 2GB)
  conf.linker.flags << '-s STACK_SIZE=5242880'         # 5MB (default is 64KB)
  conf.linker.flags << '-s MALLOC=emmalloc'            # Small and compact allocator suitable for emscripten
  conf.linker.flags << '-s MEMORY_GROWTH_GEOMETRIC_STEP=0.20'  # 20% overgrowth (default is 0.20)
  conf.linker.flags << '-s MEMORY_GROWTH_GEOMETRIC_CAP=100663296'  # 96MB cap (default is 96MB)

  # Filesystem settings
  conf.linker.flags << '-s FORCE_FILESYSTEM=1'
  conf.linker.flags << '-s INVOKE_RUN=0'

  # Performance settings
  conf.linker.flags << '-s ASSERTIONS=0'              # Disabled for performance (default is 0 at -O1+)
  conf.linker.flags << '-s DISABLE_EXCEPTION_CATCHING=1'
  conf.linker.flags << '-s EVAL_CTORS=1'               # Evaluate constructors at compile time (default is 0)
  conf.linker.flags << '-s TEXTDECODER=2'              # Assume TextDecoder is available, no fallback (default is 1, 2 in -Oz)

  # Stability settings
  conf.linker.flags << '-s STACK_OVERFLOW_CHECK=1'     # Security cookie with zero performance overhead (default is 0)

  # Export settings
  conf.linker.flags << '-s EXPORTED_FUNCTIONS=["_main","_malloc","_free"]'
  conf.linker.flags << '-s EXPORTED_RUNTIME_METHODS=["stringToUTF8","setValue","FS"]'

  exts.executable = '.js'

  # mrbc
  conf.gem core: 'mruby-bin-mrbc'

  conf.build_mrbc_exec
  conf.disable_libmruby
  conf.disable_presym
end

# Post-build: Copy mrbc.js and mrbc.wasm to public_html/mrbc
MRuby.each_target do |target|
  next unless target.name == 'emscripten'

  file "#{target.build_dir}/bin/mrbc.js" do
    # This dependency is handled by mruby build system
  end

  task :all => "#{MRUBY_ROOT}/../public_html/mrbc/mrbc.js"

  file "#{MRUBY_ROOT}/../public_html/mrbc/mrbc.js" => "#{target.build_dir}/bin/mrbc.js" do |t|
    FileUtils.mkdir_p(File.dirname(t.name))
    FileUtils.cp("#{target.build_dir}/bin/mrbc.js", t.name)
    FileUtils.cp("#{target.build_dir}/bin/mrbc.wasm", "#{MRUBY_ROOT}/../public_html/mrbc/mrbc.wasm")
    puts "Copied mrbc.js and mrbc.wasm to public_html/mrbc/"
  end
end
