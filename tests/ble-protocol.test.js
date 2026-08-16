/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, it, expect, beforeAll } from "vitest";
import { loadScript } from "./helpers/load-module.js";

describe("BLEProtocol packet builders", () => {
  let BLEProtocol;

  beforeAll(() => {
    BLEProtocol = loadScript("public_html/js/ble-protocol.js", ["BLEProtocol"], {
      navigator: {},
    }).BLEProtocol;
  });

  it("builds a data chunk with header and payload", () => {
    const content = new Uint8Array([0x10, 0x20, 0x30, 0x40, 0x50]);
    const buf = BLEProtocol.buildDataChunk(2, 10, content);
    const view = new DataView(buf);
    // Chunk is clamped to remaining bytes (3)
    expect(buf.byteLength).toBe(6 + 3);
    expect(view.getUint8(0)).toBe(0x01);
    expect(String.fromCharCode(view.getUint8(1))).toBe("D");
    expect(view.getUint16(2, true)).toBe(2); // offset
    expect(view.getUint16(4, true)).toBe(3); // size
    expect(Array.from(new Uint8Array(buf, 6))).toEqual([0x30, 0x40, 0x50]);
  });

  it("builds a program command", () => {
    const buf = BLEProtocol.buildProgramCommand(1234, 0xabcd, 2);
    const view = new DataView(buf);
    expect(buf.byteLength).toBe(8);
    expect(view.getUint8(0)).toBe(0x01);
    expect(String.fromCharCode(view.getUint8(1))).toBe("P");
    expect(view.getUint16(2, true)).toBe(1234);
    expect(view.getUint16(4, true)).toBe(0xabcd);
    expect(view.getUint8(6)).toBe(2);
    expect(view.getUint8(7)).toBe(0);
  });

  it("builds reset and reload commands", () => {
    const reset = new DataView(BLEProtocol.buildResetCommand());
    expect(reset.byteLength).toBe(2);
    expect(String.fromCharCode(reset.getUint8(1))).toBe("R");

    const reload = new DataView(BLEProtocol.buildReloadCommand());
    expect(reload.byteLength).toBe(2);
    expect(String.fromCharCode(reload.getUint8(1))).toBe("L");
  });
});
