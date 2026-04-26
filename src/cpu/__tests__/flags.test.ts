import { describe, expect, it } from "vitest";
import { SET_V8, SET_V16, makeSignedByte, makeSignedWord } from "../flags";

describe("makeSignedByte", () => {
  it("preserves positive values", () => {
    expect(makeSignedByte(0x00)).toBe(0);
    expect(makeSignedByte(0x7f)).toBe(127);
  });
  it("sign-extends 0x80..0xff to negative", () => {
    expect(makeSignedByte(0x80)).toBe(-128);
    expect(makeSignedByte(0xff)).toBe(-1);
  });
});

describe("makeSignedWord", () => {
  it("preserves positive values", () => {
    expect(makeSignedWord(0x0000)).toBe(0);
    expect(makeSignedWord(0x7fff)).toBe(32767);
  });
  it("sign-extends 0x8000..0xffff to negative", () => {
    expect(makeSignedWord(0x8000)).toBe(-32768);
    expect(makeSignedWord(0xffff)).toBe(-1);
  });
});

describe("SET_V8 (overflow flag for 8-bit add/sub)", () => {
  // The V flag bit is at position 1 (0x02). SET_V8 returns either 0 or 0x02.
  it("returns 0 when no signed overflow occurred (positive + positive = positive)", () => {
    // 1 + 1 = 2; no overflow.
    expect(SET_V8(0x01, 0x01, 0x02)).toBe(0);
  });

  it("flags overflow when positive + positive wraps to negative", () => {
    // 0x40 + 0x40 = 0x80 — two positive operands sum to a negative result.
    expect(SET_V8(0x40, 0x40, 0x80)).toBe(0x02);
  });

  it("flags overflow when negative - positive wraps to positive (subtract case)", () => {
    // 0x80 - 0x01 = 0x7f — most-negative minus 1 wraps to most-positive.
    // Result of subtraction in JS arithmetic is 0x7f.
    expect(SET_V8(0x80, 0x01, 0x7f)).toBe(0x02);
  });

  it("handles negative subtraction results without spurious V (callers pass raw signed r)", () => {
    // 0x05 - 0x06 = -1 in JS arithmetic. The formula relies on JS's
    // sign-extending arithmetic right shift to make r and (r>>1) cancel above
    // bit 7 — masking r to 0xff would break this and incorrectly set V.
    expect(SET_V8(0x05, 0x06, -1)).toBe(0);
  });

  it("handles 9-bit add carry-out correctly (callers pass raw r = a + b)", () => {
    // 0x80 + 0x80 = 0x100. Two negatives (signed) summing past the negative
    // range should set V. The formula needs bit 8 of r to be visible —
    // masking would clear it and miss the overflow.
    expect(SET_V8(0x80, 0x80, 0x100)).toBe(0x02);
  });
});

describe("SET_V16 (overflow flag for 16-bit add/sub)", () => {
  it("returns 0 when no signed overflow occurred", () => {
    expect(SET_V16(0x0001, 0x0001, 0x0002)).toBe(0);
  });

  it("flags overflow when positive + positive wraps to negative", () => {
    expect(SET_V16(0x4000, 0x4000, 0x8000)).toBe(0x02);
  });

  it("handles negative 17-bit subtraction results (raw signed r)", () => {
    // 0x0005 - 0x0006 = -1; same sign-extension reasoning as the 8-bit case.
    expect(SET_V16(0x0005, 0x0006, -1)).toBe(0);
  });

  it("handles 17-bit add carry-out correctly", () => {
    // 0x8000 + 0x8000 = 0x10000 — two most-negative wraps to non-negative.
    expect(SET_V16(0x8000, 0x8000, 0x10000)).toBe(0x02);
  });
});
