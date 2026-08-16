// src/app/mrbc-runtime.js
function isRuntimeReady(moduleInstance) {
  return moduleInstance && moduleInstance.FS && typeof moduleInstance.FS.writeFile === "function" && typeof moduleInstance.FS.readFile === "function" && typeof moduleInstance._malloc === "function" && typeof moduleInstance._free === "function" && typeof moduleInstance.stringToUTF8 === "function" && typeof moduleInstance.setValue === "function" && typeof moduleInstance._main === "function";
}
async function loadMrbcFactory(moduleUrl) {
  const moduleNamespace = await import(
    /* @vite-ignore */
    moduleUrl
  );
  const moduleFactory = moduleNamespace.default || moduleNamespace.createMrbcModule;
  if (typeof moduleFactory !== "function") {
    throw new Error("mrbc module factory was not found: " + moduleUrl);
  }
  return moduleFactory;
}
function tryUnlink(fs, path) {
  try {
    fs.unlink(path);
  } catch (_error) {
    return;
  }
}
function compileSource(mrbcModule2, rubyCode) {
  const sourceFileName = "temp.rb";
  const outputFileName = "temp.mrb";
  tryUnlink(mrbcModule2.FS, outputFileName);
  mrbcModule2.FS.writeFile(sourceFileName, rubyCode);
  const args = ["mrbc", "-o", outputFileName, sourceFileName];
  const argc = args.length;
  let argv = null;
  let argPointers = [];
  try {
    argv = mrbcModule2._malloc(args.length * 4);
    if (!argv) {
      throw new Error("Failed to allocate compiler argv.");
    }
    for (const arg of args) {
      const ptr = mrbcModule2._malloc(arg.length + 1);
      if (!ptr) {
        throw new Error("Failed to allocate compiler argument.");
      }
      mrbcModule2.stringToUTF8(arg, ptr, arg.length + 1);
      argPointers.push(ptr);
    }
    for (let i = 0; i < argPointers.length; i++) {
      mrbcModule2.setValue(argv + i * 4, argPointers[i], "i32");
    }
    const startTime = performance.now();
    const result = mrbcModule2._main(argc, argv);
    const endTime = performance.now();
    const compileTime = endTime - startTime;
    if (result !== 0) {
      return {
        success: false,
        exitCode: result,
        compileTime
      };
    }
    const mrbContent = mrbcModule2.FS.readFile(outputFileName);
    return {
      success: true,
      bytecode: mrbContent,
      compileTime,
      size: mrbContent.length
    };
  } finally {
    if (argPointers.length > 0) {
      argPointers.forEach((ptr) => mrbcModule2._free(ptr));
    }
    if (argv !== null) {
      mrbcModule2._free(argv);
    }
  }
}

// src/app/compiler-worker.js
var mrbcModule = null;
var initializationPromise = null;
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
          post({ type: "output", text });
        }
      },
      printErr: (text) => {
        if (text && text.trim() !== "") {
          post({ type: "error", text });
        }
      }
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
        result: { success: false, errorMessage: error.message, compileTime: 0 }
      });
      return;
    }
    const transfer = result.success && result.bytecode ? [result.bytecode.buffer] : [];
    post({ type: "result", id: data.id, result }, transfer);
  }
};
