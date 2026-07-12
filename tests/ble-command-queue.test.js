/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink All Rights Reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

function createChar() {
  const calls = [];
  return {
    calls,
    properties: { write: true, writeWithoutResponse: true },
    writeValueWithResponse(buf) {
      calls.push(["response", buf]);
      return Promise.resolve();
    },
    writeValueWithoutResponse(buf) {
      calls.push(["no-response", buf]);
      return Promise.resolve();
    },
    readValue() {
      calls.push(["read"]);
      return Promise.resolve(new DataView(new ArrayBuffer(2)));
    },
  };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("BLECommandQueue", () => {
  let queue;

  beforeEach(async () => {
    // Re-import a fresh module instance so queue state does not leak
    // between tests.
    vi.resetModules();
    ({ BLECommandQueue: queue } = await import(
      "../src/app/state/ble-command-queue.js"
    ));
  });

  it("propagates operation errors to the caller", async () => {
    const char = createChar();
    char.readValue = () =>
      Promise.reject(new Error("GATT Server is disconnected"));
    await expect(
      queue.enqueueRead(char, { label: "heartbeat" }),
    ).rejects.toThrow("GATT Server is disconnected");
  });

  it("propagates timeouts to the caller", async () => {
    const char = createChar();
    char.readValue = () => new Promise(() => {});
    await expect(
      queue.enqueueRead(char, { label: "slow", timeout: 20 }),
    ).rejects.toThrow(/timed out/);
  });

  it("resolves with the operation result", async () => {
    const char = createChar();
    const view = await queue.enqueueRead(char, { label: "read" });
    expect(view).toBeInstanceOf(DataView);
  });

  it("keeps serializing after a failed operation", async () => {
    const char = createChar();
    const failing = {
      ...createChar(),
      readValue: () => Promise.reject(new Error("boom")),
    };
    await expect(queue.enqueueRead(failing, {})).rejects.toThrow("boom");
    await queue.enqueueWrite(char, new ArrayBuffer(1), { mode: "response" });
    expect(char.calls).toEqual([["response", expect.any(ArrayBuffer)]]);
  });

  it("runs operations strictly one at a time", async () => {
    const order = [];
    const first = deferred();
    const charA = {
      readValue: () => {
        order.push("a-start");
        return first.promise;
      },
    };
    const charB = {
      readValue: () => {
        order.push("b-start");
        return Promise.resolve();
      },
    };
    const pa = queue.enqueueRead(charA, {});
    const pb = queue.enqueueRead(charB, {});
    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual(["a-start"]);
    first.resolve(new DataView(new ArrayBuffer(1)));
    await Promise.all([pa, pb]);
    expect(order).toEqual(["a-start", "b-start"]);
  });

  it("waits for a timed-out operation to settle before starting the next", async () => {
    const order = [];
    const slow = deferred();
    const charSlow = {
      readValue: () => {
        order.push("slow-start");
        return slow.promise;
      },
    };
    const charNext = {
      readValue: () => {
        order.push("next-start");
        return Promise.resolve(new DataView(new ArrayBuffer(1)));
      },
    };
    const pSlow = queue.enqueueRead(charSlow, { timeout: 20 });
    const pNext = queue.enqueueRead(charNext, {});
    await expect(pSlow).rejects.toThrow(/timed out/);
    // The next operation must not start while the slow one is still in flight
    await new Promise((r) => setTimeout(r, 30));
    expect(order).toEqual(["slow-start"]);
    slow.resolve(new DataView(new ArrayBuffer(1)));
    await pNext;
    expect(order).toEqual(["slow-start", "next-start"]);
  });

  it("tracks pending count and resets on clear()", async () => {
    const gate = deferred();
    const char = { readValue: () => gate.promise };
    const p = queue.enqueueRead(char, {});
    expect(queue.size()).toBe(1);
    queue.clear({ reason: "test" });
    expect(queue.size()).toBe(0);
    gate.resolve(new DataView(new ArrayBuffer(1)));
    await p;
    expect(queue.size()).toBe(0);
  });
});
