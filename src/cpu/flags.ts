export enum F {
  CARRY = 1,
  OVERFLOW = 2,
  ZERO = 4,
  NEGATIVE = 8,
  IRQMASK = 16,
  HALFCARRY = 32,
  FIRQMASK = 64,
  ENTIRE = 128,
}

export const INT_NMI = 1;
export const INT_FIRQ = 2;
export const INT_IRQ = 4;

export function makeSignedByte(x: number): number {
  return (x << 24) >> 24;
}

export function makeSignedWord(x: number): number {
  return (x << 16) >> 16;
}

// Standard Motorola overflow-flag trick. The result `r` MUST be the *unmasked*
// raw arithmetic result so that bit 8/16 (the carry-out) and the JS arithmetic
// right-shift sign extension are visible to the formula. Callers in cpu.ts
// pass `(a & 0xff) +/- (b & 0xff)` directly without masking the result.
//
// Worked examples:
//   0x80 + 0x80 = 0x100 → bit7((a^b^r^(r>>1))) = bit7(0x100^0x80) = bit7(0x180) = 1, V SET ✓
//   0x05 - 0x06 = -1     → r = -1, r>>1 = -1, XOR cancels, V CLEAR ✓
// Masking the inputs would break both — see flags.test.ts for regressions.
export function SET_V8(a: number, b: number, r: number): number {
  return ((a ^ b ^ r ^ (r >> 1)) & 0x80) >> 6;
}

export function SET_V16(a: number, b: number, r: number): number {
  return ((a ^ b ^ r ^ (r >> 1)) & 0x8000) >> 14;
}
