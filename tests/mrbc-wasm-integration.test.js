/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

// Integration test: compiles Ruby source through the real public_html
// mrbc.wasm via compileSource and runs the resulting bytecode on the real
// mrubyc.wasm VM. Catches mismatches between the LVAR-stripping code and the
// actual RITE output of the vendored toolchain (e.g. a future mruby bump
// changing the section layout).
//
// The Emscripten modules are built with ENVIRONMENT=web/worker and only
// accept locateFile/print/printErr, so the wasm binaries are served over a
// local HTTP server during the test.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { compileSource } from "../src/app/mrbc-runtime.js";

const PUBLIC_HTML = path.resolve(__dirname, "../public_html");
const MRBC_JS = path.join(PUBLIC_HTML, "mrbc/mrbc.js");
const MRUBYC_JS = path.join(PUBLIC_HTML, "mrubyc/mrubyc.js");

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".wasm": "application/wasm",
};

let server;
let baseUrl;

beforeAll(async () => {
  globalThis.self = globalThis;
  server = http.createServer((req, res) => {
    const file = path.join(PUBLIC_HTML, decodeURIComponent(req.url));
    if (!file.startsWith(PUBLIC_HTML) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    readFile(file)
      .then((data) => {
        res.writeHead(200, {
          "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
        });
        res.end(data);
      })
      .catch(() => res.writeHead(500).end());
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => {
  server.close();
});

function riteSections(bytecode) {
  const names = [];
  const view = new DataView(bytecode.buffer, bytecode.byteOffset);
  let pos = 20; // rite_binary_header
  while (pos + 8 <= bytecode.length) {
    const size = view.getUint32(pos + 4);
    names.push(String.fromCharCode(...bytecode.slice(pos, pos + 4)));
    if (size < 8) break;
    pos += size;
  }
  return names;
}

describe("mrbc.wasm / mrubyc.wasm integration", () => {
  it(
    "compiles locals without an LVAR section and runs on the mrubyc VM",
    async () => {
      const mrbcModule = await (
        await import(MRBC_JS)
      ).default({ locateFile: (p) => `${baseUrl}/mrbc/${p}` });

      const source = "def foo\n  x = 1\n  y = 2\n  x + y\nend\nputs foo\n";
      const result = compileSource(mrbcModule, source);

      expect(result.success).toBe(true);
      expect(String.fromCharCode(...result.bytecode.slice(0, 4))).toBe("RITE");
      const sections = riteSections(result.bytecode);
      expect(sections).toContain("IREP");
      expect(sections).not.toContain("LVAR");
      expect(new DataView(result.bytecode.buffer).getUint32(8)).toBe(
        result.bytecode.length,
      );

      const printed = [];
      const mrubycModule = await (
        await import(MRUBYC_JS)
      ).default({
        locateFile: (p) => `${baseUrl}/mrubyc/${p}`,
        print: (text) => printed.push(text),
      });
      mrubycModule._mrbc_wasm_init();
      const ptr = mrubycModule._malloc(result.bytecode.length);
      mrubycModule.HEAPU8.set(result.bytecode, ptr);
      const ret = await mrubycModule.ccall(
        "mrbc_wasm_run",
        "number",
        ["number", "number"],
        [ptr, result.bytecode.length],
        { async: true },
      );
      mrubycModule._free(ptr);
      expect(ret).toBe(0);
      expect(printed.join("")).toContain("3");
    },
    30000,
  );
});
