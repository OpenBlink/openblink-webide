/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, it, expect } from "vitest";
import { removeLvarSection } from "../src/app/mrbc-runtime.js";

// Builds a minimal RITE binary: 20-byte header plus the given sections.
// Each section is { ident: "IREP"/"LVAR"/"END\0"/..., payload: bytes }.
function buildRiteBinary(sections) {
  const size =
    20 + sections.reduce((acc, s) => acc + 8 + s.payload.length, 0);
  const buf = new Uint8Array(size);
  buf.set([0x52, 0x49, 0x54, 0x45], 0); // "RITE"
  buf.set([0x30, 0x33, 0x30, 0x30], 4); // format version "0300"
  new DataView(buf.buffer).setUint32(8, size);
  buf.set([0x4d, 0x41, 0x54, 0x5a], 12); // "MATZ"
  buf.set([0x30, 0x30, 0x30, 0x30], 16); // "0000"
  let pos = 20;
  for (const s of sections) {
    for (let i = 0; i < 4; i++) buf[pos + i] = s.ident.charCodeAt(i) || 0;
    new DataView(buf.buffer).setUint32(pos + 4, 8 + s.payload.length);
    buf.set(s.payload, pos + 8);
    pos += 8 + s.payload.length;
  }
  return buf;
}

const IREP = { ident: "IREP", payload: new Uint8Array([1, 2, 3, 4]) };
const LVAR = { ident: "LVAR", payload: new Uint8Array([9, 9, 9]) };
const END = { ident: "END\0", payload: new Uint8Array(0) };

describe("removeLvarSection", () => {
  it("strips the LVAR section and fixes the header size", () => {
    const input = buildRiteBinary([IREP, LVAR, END]);
    const out = removeLvarSection(input);
    expect(out.length).toBe(input.length - (8 + LVAR.payload.length));
    expect(new DataView(out.buffer).getUint32(8)).toBe(out.length);
    // IREP and END survive, LVAR is gone.
    const idents = [];
    let pos = 20;
    const view = new DataView(out.buffer);
    while (pos + 8 <= out.length) {
      const size = view.getUint32(pos + 4);
      idents.push(String.fromCharCode(...out.slice(pos, pos + 4)));
      pos += size;
    }
    expect(idents).toEqual(["IREP", "END\0"]);
    expect(pos).toBe(out.length);
  });

  it("returns the input unchanged when no LVAR section exists", () => {
    const input = buildRiteBinary([IREP, END]);
    expect(removeLvarSection(input)).toBe(input);
  });

  it("passes through non-RITE input", () => {
    const input = new Uint8Array(64);
    expect(removeLvarSection(input)).toBe(input);
  });

  it("passes through truncated input", () => {
    const input = new Uint8Array([0x52, 0x49, 0x54, 0x45]); // "RITE" only
    expect(removeLvarSection(input)).toBe(input);
  });

  it("passes through a binary with a corrupt section size", () => {
    const input = buildRiteBinary([IREP, LVAR, END]);
    // Corrupt IREP section size so it overruns the buffer.
    new DataView(input.buffer).setUint32(24, input.length);
    expect(removeLvarSection(input)).toBe(input);
  });
});
