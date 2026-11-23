// SPDX-License-Identifier: BSD-3-Clause

const assert = require("node:assert/strict");
const { once } = require("node:events");
const { readFile } = require("node:fs/promises");
const { createServer } = require("node:http");
const { resolve } = require("node:path");

async function main() {
  const { compileSource } = await import("../src/app/mrbc-runtime.js");
  const { default: createMrbc } = await import("../public_html/mrbc/mrbc.js");
  const { default: createMrubyc } = await import("../public_html/mrubyc/mrubyc.js");
  const assets = new Map();
  for (const name of ["mrbc", "mrubyc"]) {
    const wasmFile = `${name}.wasm`;
    assets.set(
      `/${wasmFile}`,
      await readFile(resolve(__dirname, "..", "public_html", name, wasmFile)),
    );
  }

  const server = createServer((request, response) => {
    const asset = assets.get(request.url);
    if (!asset) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "Content-Type": "application/wasm" }).end(asset);
  });
  const listening = once(server, "listening");
  server.listen(0, "127.0.0.1");
  try {
    await listening;
    const locateFile = (file) => `http://127.0.0.1:${server.address().port}/${file}`;
    const compiler = await createMrbc({ locateFile });
    const { success, bytecode } = compileSource(compiler, "puts 6 * 7\n");
    assert.equal(success, true, "mrbc failed to compile the smoke program");
    assert.equal(Buffer.from(bytecode.subarray(0, 4)).toString(), "RITE");

    let output = "";
    const vm = await createMrubyc({
      locateFile,
      mrubycOutput: (text) => {
        output += text;
      },
    });
    vm._mrbc_wasm_init();
    const pointer = vm._malloc(bytecode.length);
    assert.ok(pointer, "mruby/c failed to allocate bytecode memory");
    try {
      vm.HEAPU8.set(bytecode, pointer);
      const result = await vm.ccall(
        "mrbc_wasm_run",
        "number",
        ["number", "number"],
        [pointer, bytecode.length],
        { async: true },
      );
      assert.equal(result, 0, "mruby/c failed to run the smoke program");
      assert.equal(output, "42\n");
    } finally {
      vm._free(pointer);
    }
  } finally {
    server.close();
  }
  console.log("WASM smoke passed: mrbc compiled Ruby and mruby/c printed 42.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
