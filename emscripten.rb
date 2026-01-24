MRuby::Build.new('emscripten') do |conf|
  toolchain :clang

  # Output directory for mrbc.js and mrbc.wasm
  conf.build_dir = File.expand_path('../public_html/mrbc_build', __FILE__)

  # Compiler settings
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

  # Memory settings
  conf.linker.flags << '-s ALLOW_MEMORY_GROWTH=1'
  conf.linker.flags << '-s INITIAL_MEMORY=33554432'    # 32MB
  conf.linker.flags << '-s MAXIMUM_MEMORY=268435456'   # 256MB
  conf.linker.flags << '-s STACK_SIZE=5242880'         # 5MB
  conf.linker.flags << '-s MALLOC=emmalloc'

  # Filesystem settings
  conf.linker.flags << '-s FORCE_FILESYSTEM=1'
  conf.linker.flags << '-s INVOKE_RUN=0'

  # Performance settings
  conf.linker.flags << '-s ASSERTIONS=0'
  conf.linker.flags << '-s DISABLE_EXCEPTION_CATCHING=1'

  # Stability settings
  conf.linker.flags << '-s STACK_OVERFLOW_CHECK=1'

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
