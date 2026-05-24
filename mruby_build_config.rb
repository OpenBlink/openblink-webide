# SPDX-FileCopyrightText: Copyright (c) 2025-2026 OpenBlink All Rights Reserved.
# SPDX-License-Identifier: BSD-3-Clause

MRuby::Build.new('emscripten') do |conf|
  toolchain :emscripten

  conf.build_dir = File.expand_path('build/mrbc', __dir__)

  compile_flags = %w[
    -O3
    -flto
    -sSTRICT=1
  ]

  link_flags = [
    '-O3',
    '-flto',
    '-sWASM=1',
    '-sENVIRONMENT=web',
    '-sSTRICT=1',
    '-sMODULARIZE=1',
    '-sEXPORT_ES6=1',
    '-sEXPORT_NAME=createMrbcModule',
    '-sINITIAL_HEAP=67108864',
    '-sSTACK_SIZE=5242880',
    '-sMALLOC=dlmalloc',
    '-sABORTING_MALLOC=1',
    '-sFORCE_FILESYSTEM=1',
    '-sINVOKE_RUN=0',
    '-sASSERTIONS=1',
    '-sDYNAMIC_EXECUTION=0',
    '-sEVAL_CTORS=1',
    '-sTEXTDECODER=2',
    '-sSTACK_OVERFLOW_CHECK=1',
    '-sCHECK_NULL_WRITES=1',
    '-sEXPORTED_FUNCTIONS=["_main","_malloc","_free"]',
    '-sEXPORTED_RUNTIME_METHODS=["stringToUTF8","setValue","FS"]',
    '-sINCOMING_MODULE_JS_API=["locateFile","print","printErr"]'
  ]

  conf.cc.flags.concat(compile_flags)
  conf.cxx.flags.concat(compile_flags)
  conf.linker.flags.concat(link_flags)

  exts.executable = '.js'

  conf.gem core: 'mruby-bin-mrbc'
  conf.build_mrbc_exec
  conf.disable_libmruby
  conf.disable_presym
end

MRuby.each_target do |target|
  next unless target.name == 'emscripten'

  public_html_mrbc = File.expand_path('public_html/mrbc', __dir__)
  task all: "#{public_html_mrbc}/mrbc.js"

  file "#{public_html_mrbc}/mrbc.js" => "#{target.build_dir}/bin/mrbc.js" do |t|
    FileUtils.mkdir_p(File.dirname(t.name))
    FileUtils.cp("#{target.build_dir}/bin/mrbc.js", t.name)
    FileUtils.cp("#{target.build_dir}/bin/mrbc.wasm", "#{public_html_mrbc}/mrbc.wasm")
  end
end
