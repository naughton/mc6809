// Motorola 6808 / 6800 CPU emulator.
//
// Used here for the Williams Defender sound board (6808 @ ~894 kHz running
// defend.snd in the top 2KB of address space).
//
// Differences from the 6809:
//  - 8-bit accumulators A and B (no D pair register, but you can stuff
//    A:B in some ops via the D pseudo-register conventions).
//  - 16-bit X (no Y / U).
//  - 16-bit SP (no separate U stack).
//  - CCR layout: 11 H I N Z V C  (bits 7,6 always read as 1 on real silicon).
//  - Addressing modes: inherent, immediate, direct (0-page), extended,
//    indexed (X+u8 offset), relative (signed branch).
//  - No post-byte indexed gymnastics, no LEA, no MUL, no SEX, no TFR/EXG.
//
// Memory access goes through optional read/write hooks so the host can
// trap PIA registers without owning the whole address space.

const enum F {
  CARRY = 0x01,
  OVERFLOW = 0x02,
  ZERO = 0x04,
  NEGATIVE = 0x08,
  IRQMASK = 0x10,
  HALFCARRY = 0x20,
}

// Bits 6 and 7 of the real chip's CCR are always 1.
const CC_BASE = 0xc0;

export type ReadHook = (addr: number) => number | undefined;
export type WriteHook = (addr: number, val: number) => boolean | void;

export class M6808 {
  // Public for tests / wiring.
  public mem = new Uint8Array(0x10000);
  public regPC = 0;
  public regSP = 0;
  public regA = 0;
  public regB = 0;
  public regX = 0;
  public regCC = CC_BASE | F.IRQMASK;

  public irqLine = false; // External IRQ line (active high here for simplicity).
  public halted = false;
  public cycles = 0;

  private readHook?: ReadHook;
  private writeHook?: WriteHook;

  constructor(readHook?: ReadHook, writeHook?: WriteHook) {
    this.readHook = readHook;
    this.writeHook = writeHook;
  }

  reset(): void {
    this.regPC = this.read16(0xfffe);
    this.regSP = 0x00ff; // Top of zero-page RAM is conventional.
    this.regA = 0;
    this.regB = 0;
    this.regX = 0;
    this.regCC = CC_BASE | F.IRQMASK;
    this.halted = false;
  }

  loadRom(bytes: Uint8Array, start: number): void {
    this.mem.set(bytes, start);
  }

  // ---- memory ----

  read(addr: number): number {
    addr &= 0xffff;
    if (this.readHook) {
      const v = this.readHook(addr);
      if (v !== undefined) return v & 0xff;
    }
    return this.mem[addr];
  }

  write(addr: number, val: number): void {
    addr &= 0xffff;
    val &= 0xff;
    if (this.writeHook) {
      const handled = this.writeHook(addr, val);
      if (handled) return;
    }
    this.mem[addr] = val;
  }

  read16(addr: number): number {
    return ((this.read(addr) << 8) | this.read((addr + 1) & 0xffff)) & 0xffff;
  }

  write16(addr: number, val: number): void {
    this.write(addr, (val >> 8) & 0xff);
    this.write((addr + 1) & 0xffff, val & 0xff);
  }

  // ---- fetch ----

  private fetch8(): number {
    const v = this.read(this.regPC);
    this.regPC = (this.regPC + 1) & 0xffff;
    return v;
  }

  private fetch16(): number {
    const v = this.read16(this.regPC);
    this.regPC = (this.regPC + 2) & 0xffff;
    return v;
  }

  // ---- stack (SP points to next free slot, post-decrement on push) ----

  private push8(val: number): void {
    this.write(this.regSP, val & 0xff);
    this.regSP = (this.regSP - 1) & 0xffff;
  }

  private pull8(): number {
    this.regSP = (this.regSP + 1) & 0xffff;
    return this.read(this.regSP);
  }

  private push16(val: number): void {
    this.push8(val & 0xff);
    this.push8((val >> 8) & 0xff);
  }

  private pull16(): number {
    const hi = this.pull8();
    const lo = this.pull8();
    return ((hi << 8) | lo) & 0xffff;
  }

  // ---- addressing ----

  private addrDir(): number {
    return this.fetch8();
  }

  private addrExt(): number {
    return this.fetch16();
  }

  private addrIdx(): number {
    return (this.regX + this.fetch8()) & 0xffff;
  }

  private branchOffset(): number {
    const u = this.fetch8();
    return u < 0x80 ? u : u - 0x100;
  }

  // ---- flag helpers ----

  private setNZ8(val: number): void {
    val &= 0xff;
    this.regCC =
      (this.regCC & ~(F.NEGATIVE | F.ZERO)) |
      (val & 0x80 ? F.NEGATIVE : 0) |
      (val === 0 ? F.ZERO : 0);
  }

  private setNZ16(val: number): void {
    val &= 0xffff;
    this.regCC =
      (this.regCC & ~(F.NEGATIVE | F.ZERO)) |
      (val & 0x8000 ? F.NEGATIVE : 0) |
      (val === 0 ? F.ZERO : 0);
  }

  // V for 8-bit ADD: a, b same sign, result different sign.
  private vAdd8(a: number, b: number, r: number): number {
    return (~(a ^ b) & (a ^ r) & 0x80) !== 0 ? F.OVERFLOW : 0;
  }
  // V for 8-bit SUB / CMP: a, b different sign, a and result different sign.
  private vSub8(a: number, b: number, r: number): number {
    return ((a ^ b) & (a ^ r) & 0x80) !== 0 ? F.OVERFLOW : 0;
  }

  // ---- ALU primitives ----

  private add8(a: number, b: number, carryIn: number): number {
    const r = (a & 0xff) + (b & 0xff) + carryIn;
    let cc = this.regCC & ~(F.HALFCARRY | F.NEGATIVE | F.ZERO | F.OVERFLOW | F.CARRY);
    if (((a & 0xf) + (b & 0xf) + carryIn) & 0x10) cc |= F.HALFCARRY;
    if (r & 0x100) cc |= F.CARRY;
    cc |= this.vAdd8(a, b, r);
    if (r & 0x80) cc |= F.NEGATIVE;
    if ((r & 0xff) === 0) cc |= F.ZERO;
    this.regCC = cc;
    return r & 0xff;
  }

  private sub8(a: number, b: number, borrowIn: number): number {
    const r = (a & 0xff) - (b & 0xff) - borrowIn;
    let cc = this.regCC & ~(F.NEGATIVE | F.ZERO | F.OVERFLOW | F.CARRY);
    if (r & 0x100) cc |= F.CARRY; // borrow
    cc |= this.vSub8(a, b, r);
    if (r & 0x80) cc |= F.NEGATIVE;
    if ((r & 0xff) === 0) cc |= F.ZERO;
    this.regCC = cc;
    return r & 0xff;
  }

  private and8(a: number, b: number): number {
    const r = a & b & 0xff;
    this.regCC = (this.regCC & ~(F.OVERFLOW | F.NEGATIVE | F.ZERO)) |
                 (r & 0x80 ? F.NEGATIVE : 0) |
                 (r === 0 ? F.ZERO : 0);
    return r;
  }

  private or8(a: number, b: number): number {
    const r = (a | b) & 0xff;
    this.regCC = (this.regCC & ~(F.OVERFLOW | F.NEGATIVE | F.ZERO)) |
                 (r & 0x80 ? F.NEGATIVE : 0) |
                 (r === 0 ? F.ZERO : 0);
    return r;
  }

  private eor8(a: number, b: number): number {
    const r = (a ^ b) & 0xff;
    this.regCC = (this.regCC & ~(F.OVERFLOW | F.NEGATIVE | F.ZERO)) |
                 (r & 0x80 ? F.NEGATIVE : 0) |
                 (r === 0 ? F.ZERO : 0);
    return r;
  }

  private inc8(v: number): number {
    const r = (v + 1) & 0xff;
    this.regCC = (this.regCC & ~(F.OVERFLOW | F.NEGATIVE | F.ZERO)) |
                 (v === 0x7f ? F.OVERFLOW : 0) |
                 (r & 0x80 ? F.NEGATIVE : 0) |
                 (r === 0 ? F.ZERO : 0);
    return r;
  }

  private dec8(v: number): number {
    const r = (v - 1) & 0xff;
    this.regCC = (this.regCC & ~(F.OVERFLOW | F.NEGATIVE | F.ZERO)) |
                 (v === 0x80 ? F.OVERFLOW : 0) |
                 (r & 0x80 ? F.NEGATIVE : 0) |
                 (r === 0 ? F.ZERO : 0);
    return r;
  }

  private neg8(v: number): number {
    const r = (-v) & 0xff;
    let cc = this.regCC & ~(F.OVERFLOW | F.CARRY | F.NEGATIVE | F.ZERO);
    if (v === 0x80) cc |= F.OVERFLOW;
    if (v !== 0) cc |= F.CARRY;
    if (r & 0x80) cc |= F.NEGATIVE;
    if (r === 0) cc |= F.ZERO;
    this.regCC = cc;
    return r;
  }

  private com8(v: number): number {
    const r = (~v) & 0xff;
    this.regCC = (this.regCC & ~(F.OVERFLOW | F.NEGATIVE | F.ZERO)) |
                 F.CARRY | // 6800 COM always sets C
                 (r & 0x80 ? F.NEGATIVE : 0) |
                 (r === 0 ? F.ZERO : 0);
    return r;
  }

  private lsr8(v: number): number {
    const r = (v >> 1) & 0xff;
    let cc = this.regCC & ~(F.OVERFLOW | F.CARRY | F.NEGATIVE | F.ZERO);
    if (v & 1) cc |= F.CARRY;
    // V = N XOR C  (6800 spec); after LSR N is always 0, so V = C.
    if (cc & F.CARRY) cc |= F.OVERFLOW;
    if (r === 0) cc |= F.ZERO;
    this.regCC = cc;
    return r;
  }

  private asr8(v: number): number {
    const r = ((v >> 1) | (v & 0x80)) & 0xff;
    let cc = this.regCC & ~(F.OVERFLOW | F.CARRY | F.NEGATIVE | F.ZERO);
    if (v & 1) cc |= F.CARRY;
    if (r & 0x80) cc |= F.NEGATIVE;
    if (r === 0) cc |= F.ZERO;
    if (((cc & F.NEGATIVE) ? 1 : 0) ^ ((cc & F.CARRY) ? 1 : 0)) cc |= F.OVERFLOW;
    this.regCC = cc;
    return r;
  }

  private asl8(v: number): number {
    const r = (v << 1) & 0xff;
    let cc = this.regCC & ~(F.OVERFLOW | F.CARRY | F.NEGATIVE | F.ZERO);
    if (v & 0x80) cc |= F.CARRY;
    if (r & 0x80) cc |= F.NEGATIVE;
    if (r === 0) cc |= F.ZERO;
    if (((cc & F.NEGATIVE) ? 1 : 0) ^ ((cc & F.CARRY) ? 1 : 0)) cc |= F.OVERFLOW;
    this.regCC = cc;
    return r;
  }

  private rol8(v: number): number {
    const oldC = this.regCC & F.CARRY;
    const r = ((v << 1) | oldC) & 0xff;
    let cc = this.regCC & ~(F.OVERFLOW | F.CARRY | F.NEGATIVE | F.ZERO);
    if (v & 0x80) cc |= F.CARRY;
    if (r & 0x80) cc |= F.NEGATIVE;
    if (r === 0) cc |= F.ZERO;
    if (((cc & F.NEGATIVE) ? 1 : 0) ^ ((cc & F.CARRY) ? 1 : 0)) cc |= F.OVERFLOW;
    this.regCC = cc;
    return r;
  }

  private ror8(v: number): number {
    const oldC = this.regCC & F.CARRY;
    const r = ((v >> 1) | (oldC ? 0x80 : 0)) & 0xff;
    let cc = this.regCC & ~(F.OVERFLOW | F.CARRY | F.NEGATIVE | F.ZERO);
    if (v & 1) cc |= F.CARRY;
    if (r & 0x80) cc |= F.NEGATIVE;
    if (r === 0) cc |= F.ZERO;
    if (((cc & F.NEGATIVE) ? 1 : 0) ^ ((cc & F.CARRY) ? 1 : 0)) cc |= F.OVERFLOW;
    this.regCC = cc;
    return r;
  }

  private clr8(): number {
    this.regCC = (this.regCC & ~(F.NEGATIVE | F.OVERFLOW | F.CARRY)) | F.ZERO;
    return 0;
  }

  private tst8(v: number): void {
    this.regCC = (this.regCC & ~(F.OVERFLOW | F.CARRY | F.NEGATIVE | F.ZERO)) |
                 (v & 0x80 ? F.NEGATIVE : 0) |
                 ((v & 0xff) === 0 ? F.ZERO : 0);
  }

  // BIT — AND but discard result, set flags.
  private bit8(a: number, b: number): void {
    const r = a & b & 0xff;
    this.regCC = (this.regCC & ~(F.OVERFLOW | F.NEGATIVE | F.ZERO)) |
                 (r & 0x80 ? F.NEGATIVE : 0) |
                 (r === 0 ? F.ZERO : 0);
  }

  private cmp8(a: number, b: number): void {
    this.sub8(a, b, 0);
  }

  // ---- 16-bit ALU ----

  private cpx16(v: number): void {
    const r = (this.regX & 0xffff) - (v & 0xffff);
    let cc = this.regCC & ~(F.NEGATIVE | F.ZERO | F.OVERFLOW);
    if (r & 0x8000) cc |= F.NEGATIVE;
    if ((r & 0xffff) === 0) cc |= F.ZERO;
    // V = sign(X) ^ sign(operand) AND sign(X) ^ sign(result)
    if (((this.regX ^ v) & (this.regX ^ r) & 0x8000) !== 0) cc |= F.OVERFLOW;
    this.regCC = cc;
  }

  // ---- DAA ----

  private daa(): void {
    let a = this.regA & 0xff;
    const hi = (a >> 4) & 0xf;
    const lo = a & 0xf;
    const c = this.regCC & F.CARRY;
    const h = this.regCC & F.HALFCARRY;
    let add = 0;
    let setC = false;
    if (h || lo > 9) add |= 0x06;
    if (c || hi > 9 || (hi >= 9 && lo > 9)) {
      add |= 0x60;
      setC = true;
    }
    a = (a + add) & 0xff;
    this.regA = a;
    this.regCC = (this.regCC & ~(F.NEGATIVE | F.ZERO | F.CARRY)) |
                 (a & 0x80 ? F.NEGATIVE : 0) |
                 (a === 0 ? F.ZERO : 0) |
                 (setC || c ? F.CARRY : 0);
  }

  // ---- interrupts ----

  private serviceIrq(): void {
    this.push16(this.regPC);
    this.push16(this.regX);
    this.push8(this.regA);
    this.push8(this.regB);
    this.push8(this.regCC);
    this.regCC |= F.IRQMASK;
    this.regPC = this.read16(0xfff8);
    this.cycles += 12;
  }

  // ---- main dispatch ----

  // Returns when this.cycles >= cyclesToRun, or halted.
  execute(cyclesToRun: number): void {
    const target = this.cycles + cyclesToRun;
    while (this.cycles < target && !this.halted) {
      if (this.irqLine && !(this.regCC & F.IRQMASK)) {
        this.serviceIrq();
      }
      const op = this.fetch8();
      this.dispatch(op);
    }
  }

  private dispatch(op: number): void {
    let addr = 0, v = 0, r = 0;
    switch (op) {
      // 0x01 NOP
      case 0x01: this.cycles += 2; return;

      // 0x06 TAP — A → CCR
      case 0x06: this.regCC = (this.regA & 0x3f) | CC_BASE; this.cycles += 2; return;
      // 0x07 TPA — CCR → A
      case 0x07: this.regA = this.regCC | CC_BASE; this.cycles += 2; return;

      // 0x08 INX
      case 0x08:
        this.regX = (this.regX + 1) & 0xffff;
        this.regCC = (this.regCC & ~F.ZERO) | (this.regX === 0 ? F.ZERO : 0);
        this.cycles += 4; return;
      // 0x09 DEX
      case 0x09:
        this.regX = (this.regX - 1) & 0xffff;
        this.regCC = (this.regCC & ~F.ZERO) | (this.regX === 0 ? F.ZERO : 0);
        this.cycles += 4; return;

      // 0x0A CLV  0x0B SEV  0x0C CLC  0x0D SEC  0x0E CLI  0x0F SEI
      case 0x0a: this.regCC &= ~F.OVERFLOW; this.cycles += 2; return;
      case 0x0b: this.regCC |= F.OVERFLOW; this.cycles += 2; return;
      case 0x0c: this.regCC &= ~F.CARRY; this.cycles += 2; return;
      case 0x0d: this.regCC |= F.CARRY; this.cycles += 2; return;
      case 0x0e: this.regCC &= ~F.IRQMASK; this.cycles += 2; return;
      case 0x0f: this.regCC |= F.IRQMASK; this.cycles += 2; return;

      // 0x10 SBA — A = A - B
      case 0x10: this.regA = this.sub8(this.regA, this.regB, 0); this.cycles += 2; return;
      // 0x11 CBA — compare A and B
      case 0x11: this.cmp8(this.regA, this.regB); this.cycles += 2; return;
      // 0x16 TAB — A → B
      case 0x16: this.regB = this.regA; this.setNZ8(this.regB); this.regCC &= ~F.OVERFLOW; this.cycles += 2; return;
      // 0x17 TBA — B → A
      case 0x17: this.regA = this.regB; this.setNZ8(this.regA); this.regCC &= ~F.OVERFLOW; this.cycles += 2; return;
      // 0x19 DAA
      case 0x19: this.daa(); this.cycles += 2; return;
      // 0x1B ABA — A = A + B
      case 0x1b: this.regA = this.add8(this.regA, this.regB, 0); this.cycles += 2; return;

      // 0x20-0x2F branches (relative, +4 cycles whether taken or not)
      case 0x20: this.branchIf(true); this.cycles += 4; return; // BRA
      case 0x22: this.branchIf(!(this.regCC & F.CARRY) && !(this.regCC & F.ZERO)); this.cycles += 4; return; // BHI
      case 0x23: this.branchIf(!!(this.regCC & F.CARRY) || !!(this.regCC & F.ZERO)); this.cycles += 4; return; // BLS
      case 0x24: this.branchIf(!(this.regCC & F.CARRY)); this.cycles += 4; return; // BCC / BHS
      case 0x25: this.branchIf(!!(this.regCC & F.CARRY)); this.cycles += 4; return; // BCS / BLO
      case 0x26: this.branchIf(!(this.regCC & F.ZERO)); this.cycles += 4; return; // BNE
      case 0x27: this.branchIf(!!(this.regCC & F.ZERO)); this.cycles += 4; return; // BEQ
      case 0x28: this.branchIf(!(this.regCC & F.OVERFLOW)); this.cycles += 4; return; // BVC
      case 0x29: this.branchIf(!!(this.regCC & F.OVERFLOW)); this.cycles += 4; return; // BVS
      case 0x2a: this.branchIf(!(this.regCC & F.NEGATIVE)); this.cycles += 4; return; // BPL
      case 0x2b: this.branchIf(!!(this.regCC & F.NEGATIVE)); this.cycles += 4; return; // BMI
      case 0x2c: { // BGE: N XOR V == 0
        const n = !!(this.regCC & F.NEGATIVE);
        const vf = !!(this.regCC & F.OVERFLOW);
        this.branchIf(n === vf);
        this.cycles += 4; return;
      }
      case 0x2d: { // BLT: N XOR V == 1
        const n = !!(this.regCC & F.NEGATIVE);
        const vf = !!(this.regCC & F.OVERFLOW);
        this.branchIf(n !== vf);
        this.cycles += 4; return;
      }
      case 0x2e: { // BGT: Z == 0 AND N XOR V == 0
        const z = !!(this.regCC & F.ZERO);
        const n = !!(this.regCC & F.NEGATIVE);
        const vf = !!(this.regCC & F.OVERFLOW);
        this.branchIf(!z && n === vf);
        this.cycles += 4; return;
      }
      case 0x2f: { // BLE: Z == 1 OR N XOR V == 1
        const z = !!(this.regCC & F.ZERO);
        const n = !!(this.regCC & F.NEGATIVE);
        const vf = !!(this.regCC & F.OVERFLOW);
        this.branchIf(z || n !== vf);
        this.cycles += 4; return;
      }

      // 0x30 TSX — X = SP+1
      case 0x30: this.regX = (this.regSP + 1) & 0xffff; this.cycles += 4; return;
      // 0x31 INS — SP++
      case 0x31: this.regSP = (this.regSP + 1) & 0xffff; this.cycles += 4; return;
      // 0x32 PULA  0x33 PULB
      case 0x32: this.regA = this.pull8(); this.cycles += 4; return;
      case 0x33: this.regB = this.pull8(); this.cycles += 4; return;
      // 0x34 DES — SP--
      case 0x34: this.regSP = (this.regSP - 1) & 0xffff; this.cycles += 4; return;
      // 0x35 TXS — SP = X-1
      case 0x35: this.regSP = (this.regX - 1) & 0xffff; this.cycles += 4; return;
      // 0x36 PSHA  0x37 PSHB
      case 0x36: this.push8(this.regA); this.cycles += 4; return;
      case 0x37: this.push8(this.regB); this.cycles += 4; return;
      // 0x39 RTS
      case 0x39: this.regPC = this.pull16(); this.cycles += 5; return;
      // 0x3B RTI
      case 0x3b:
        this.regCC = this.pull8() | CC_BASE;
        this.regB = this.pull8();
        this.regA = this.pull8();
        this.regX = this.pull16();
        this.regPC = this.pull16();
        this.cycles += 10; return;
      // 0x3E WAI — wait for interrupt. We push state and stall.
      case 0x3e:
        this.push16(this.regPC);
        this.push16(this.regX);
        this.push8(this.regA);
        this.push8(this.regB);
        this.push8(this.regCC);
        // Real WAI halts the CPU. We approximate by burning the rest of this
        // execute() budget and clearing IRQMASK so the next interrupt will
        // service. To avoid double-pushing on IRQ, we adjust SP back.
        if (this.irqLine && !(this.regCC & F.IRQMASK)) {
          this.regCC |= F.IRQMASK;
          this.regPC = this.read16(0xfff8);
        } else {
          // No IRQ pending — rewind the push so we don't stack indefinitely.
          this.regSP = (this.regSP + 7) & 0xffff;
          // Leave PC pointing at the WAI so we re-execute it next tick.
          this.regPC = (this.regPC - 1) & 0xffff;
        }
        this.cycles += 9; return;
      // 0x3F SWI — software interrupt
      case 0x3f:
        this.push16(this.regPC);
        this.push16(this.regX);
        this.push8(this.regA);
        this.push8(this.regB);
        this.push8(this.regCC);
        this.regCC |= F.IRQMASK;
        this.regPC = this.read16(0xfffa);
        this.cycles += 12; return;

      // ---- 0x40-0x4F: A inherent ----
      case 0x40: this.regA = this.neg8(this.regA); this.cycles += 2; return; // NEGA
      case 0x43: this.regA = this.com8(this.regA); this.cycles += 2; return; // COMA
      case 0x44: this.regA = this.lsr8(this.regA); this.cycles += 2; return; // LSRA
      case 0x46: this.regA = this.ror8(this.regA); this.cycles += 2; return; // RORA
      case 0x47: this.regA = this.asr8(this.regA); this.cycles += 2; return; // ASRA
      case 0x48: this.regA = this.asl8(this.regA); this.cycles += 2; return; // ASLA
      case 0x49: this.regA = this.rol8(this.regA); this.cycles += 2; return; // ROLA
      case 0x4a: this.regA = this.dec8(this.regA); this.cycles += 2; return; // DECA
      case 0x4c: this.regA = this.inc8(this.regA); this.cycles += 2; return; // INCA
      case 0x4d: this.tst8(this.regA); this.cycles += 2; return;             // TSTA
      case 0x4f: this.regA = this.clr8(); this.cycles += 2; return;          // CLRA

      // ---- 0x50-0x5F: B inherent ----
      case 0x50: this.regB = this.neg8(this.regB); this.cycles += 2; return;
      case 0x53: this.regB = this.com8(this.regB); this.cycles += 2; return;
      case 0x54: this.regB = this.lsr8(this.regB); this.cycles += 2; return;
      case 0x56: this.regB = this.ror8(this.regB); this.cycles += 2; return;
      case 0x57: this.regB = this.asr8(this.regB); this.cycles += 2; return;
      case 0x58: this.regB = this.asl8(this.regB); this.cycles += 2; return;
      case 0x59: this.regB = this.rol8(this.regB); this.cycles += 2; return;
      case 0x5a: this.regB = this.dec8(this.regB); this.cycles += 2; return;
      case 0x5c: this.regB = this.inc8(this.regB); this.cycles += 2; return;
      case 0x5d: this.tst8(this.regB); this.cycles += 2; return;
      case 0x5f: this.regB = this.clr8(); this.cycles += 2; return;

      // ---- 0x60-0x6F: indexed RMW ----
      case 0x60: addr = this.addrIdx(); v = this.read(addr); this.write(addr, this.neg8(v)); this.cycles += 7; return;
      case 0x63: addr = this.addrIdx(); v = this.read(addr); this.write(addr, this.com8(v)); this.cycles += 7; return;
      case 0x64: addr = this.addrIdx(); v = this.read(addr); this.write(addr, this.lsr8(v)); this.cycles += 7; return;
      case 0x66: addr = this.addrIdx(); v = this.read(addr); this.write(addr, this.ror8(v)); this.cycles += 7; return;
      case 0x67: addr = this.addrIdx(); v = this.read(addr); this.write(addr, this.asr8(v)); this.cycles += 7; return;
      case 0x68: addr = this.addrIdx(); v = this.read(addr); this.write(addr, this.asl8(v)); this.cycles += 7; return;
      case 0x69: addr = this.addrIdx(); v = this.read(addr); this.write(addr, this.rol8(v)); this.cycles += 7; return;
      case 0x6a: addr = this.addrIdx(); v = this.read(addr); this.write(addr, this.dec8(v)); this.cycles += 7; return;
      case 0x6c: addr = this.addrIdx(); v = this.read(addr); this.write(addr, this.inc8(v)); this.cycles += 7; return;
      case 0x6d: addr = this.addrIdx(); this.tst8(this.read(addr)); this.cycles += 7; return;
      case 0x6e: this.regPC = this.addrIdx(); this.cycles += 4; return;       // JMP idx
      case 0x6f: addr = this.addrIdx(); this.write(addr, this.clr8()); this.cycles += 7; return;

      // ---- 0x70-0x7F: extended RMW ----
      case 0x70: addr = this.addrExt(); v = this.read(addr); this.write(addr, this.neg8(v)); this.cycles += 6; return;
      case 0x73: addr = this.addrExt(); v = this.read(addr); this.write(addr, this.com8(v)); this.cycles += 6; return;
      case 0x74: addr = this.addrExt(); v = this.read(addr); this.write(addr, this.lsr8(v)); this.cycles += 6; return;
      case 0x76: addr = this.addrExt(); v = this.read(addr); this.write(addr, this.ror8(v)); this.cycles += 6; return;
      case 0x77: addr = this.addrExt(); v = this.read(addr); this.write(addr, this.asr8(v)); this.cycles += 6; return;
      case 0x78: addr = this.addrExt(); v = this.read(addr); this.write(addr, this.asl8(v)); this.cycles += 6; return;
      case 0x79: addr = this.addrExt(); v = this.read(addr); this.write(addr, this.rol8(v)); this.cycles += 6; return;
      case 0x7a: addr = this.addrExt(); v = this.read(addr); this.write(addr, this.dec8(v)); this.cycles += 6; return;
      case 0x7c: addr = this.addrExt(); v = this.read(addr); this.write(addr, this.inc8(v)); this.cycles += 6; return;
      case 0x7d: addr = this.addrExt(); this.tst8(this.read(addr)); this.cycles += 6; return;
      case 0x7e: this.regPC = this.addrExt(); this.cycles += 3; return;       // JMP ext
      case 0x7f: addr = this.addrExt(); this.write(addr, this.clr8()); this.cycles += 6; return;

      // ---- 0x80-0x8F: A immediate / misc ----
      case 0x80: this.regA = this.sub8(this.regA, this.fetch8(), 0); this.cycles += 2; return; // SUBA #
      case 0x81: this.cmp8(this.regA, this.fetch8()); this.cycles += 2; return;                 // CMPA #
      case 0x82: this.regA = this.sub8(this.regA, this.fetch8(), this.regCC & F.CARRY); this.cycles += 2; return; // SBCA #
      case 0x84: this.regA = this.and8(this.regA, this.fetch8()); this.cycles += 2; return;     // ANDA #
      case 0x85: this.bit8(this.regA, this.fetch8()); this.cycles += 2; return;                  // BITA #
      case 0x86: this.regA = this.fetch8(); this.setNZ8(this.regA); this.regCC &= ~F.OVERFLOW; this.cycles += 2; return; // LDAA #
      case 0x88: this.regA = this.eor8(this.regA, this.fetch8()); this.cycles += 2; return;     // EORA #
      case 0x89: this.regA = this.add8(this.regA, this.fetch8(), this.regCC & F.CARRY); this.cycles += 2; return; // ADCA #
      case 0x8a: this.regA = this.or8(this.regA, this.fetch8()); this.cycles += 2; return;      // ORAA #
      case 0x8b: this.regA = this.add8(this.regA, this.fetch8(), 0); this.cycles += 2; return;  // ADDA #
      case 0x8c: this.cpx16(this.fetch16()); this.cycles += 3; return;                           // CPX #
      case 0x8d: { // BSR
        const off = this.branchOffset();
        this.push16(this.regPC);
        this.regPC = (this.regPC + off) & 0xffff;
        this.cycles += 8; return;
      }
      case 0x8e: this.regSP = this.fetch16(); this.setNZ16(this.regSP); this.regCC &= ~F.OVERFLOW; this.cycles += 3; return; // LDS #

      // ---- 0x90-0x9F: A direct ----
      case 0x90: addr = this.addrDir(); this.regA = this.sub8(this.regA, this.read(addr), 0); this.cycles += 3; return;
      case 0x91: addr = this.addrDir(); this.cmp8(this.regA, this.read(addr)); this.cycles += 3; return;
      case 0x92: addr = this.addrDir(); this.regA = this.sub8(this.regA, this.read(addr), this.regCC & F.CARRY); this.cycles += 3; return;
      case 0x94: addr = this.addrDir(); this.regA = this.and8(this.regA, this.read(addr)); this.cycles += 3; return;
      case 0x95: addr = this.addrDir(); this.bit8(this.regA, this.read(addr)); this.cycles += 3; return;
      case 0x96: addr = this.addrDir(); this.regA = this.read(addr); this.setNZ8(this.regA); this.regCC &= ~F.OVERFLOW; this.cycles += 3; return; // LDAA d
      case 0x97: addr = this.addrDir(); this.write(addr, this.regA); this.setNZ8(this.regA); this.regCC &= ~F.OVERFLOW; this.cycles += 4; return; // STAA d
      case 0x98: addr = this.addrDir(); this.regA = this.eor8(this.regA, this.read(addr)); this.cycles += 3; return;
      case 0x99: addr = this.addrDir(); this.regA = this.add8(this.regA, this.read(addr), this.regCC & F.CARRY); this.cycles += 3; return;
      case 0x9a: addr = this.addrDir(); this.regA = this.or8(this.regA, this.read(addr)); this.cycles += 3; return;
      case 0x9b: addr = this.addrDir(); this.regA = this.add8(this.regA, this.read(addr), 0); this.cycles += 3; return;
      case 0x9c: addr = this.addrDir(); this.cpx16(this.read16(addr)); this.cycles += 4; return; // CPX d
      case 0x9e: addr = this.addrDir(); this.regSP = this.read16(addr); this.setNZ16(this.regSP); this.regCC &= ~F.OVERFLOW; this.cycles += 4; return; // LDS d
      case 0x9f: addr = this.addrDir(); this.write16(addr, this.regSP); this.setNZ16(this.regSP); this.regCC &= ~F.OVERFLOW; this.cycles += 5; return; // STS d

      // ---- 0xA0-0xAF: A indexed ----
      case 0xa0: addr = this.addrIdx(); this.regA = this.sub8(this.regA, this.read(addr), 0); this.cycles += 5; return;
      case 0xa1: addr = this.addrIdx(); this.cmp8(this.regA, this.read(addr)); this.cycles += 5; return;
      case 0xa2: addr = this.addrIdx(); this.regA = this.sub8(this.regA, this.read(addr), this.regCC & F.CARRY); this.cycles += 5; return;
      case 0xa4: addr = this.addrIdx(); this.regA = this.and8(this.regA, this.read(addr)); this.cycles += 5; return;
      case 0xa5: addr = this.addrIdx(); this.bit8(this.regA, this.read(addr)); this.cycles += 5; return;
      case 0xa6: addr = this.addrIdx(); this.regA = this.read(addr); this.setNZ8(this.regA); this.regCC &= ~F.OVERFLOW; this.cycles += 5; return;
      case 0xa7: addr = this.addrIdx(); this.write(addr, this.regA); this.setNZ8(this.regA); this.regCC &= ~F.OVERFLOW; this.cycles += 6; return;
      case 0xa8: addr = this.addrIdx(); this.regA = this.eor8(this.regA, this.read(addr)); this.cycles += 5; return;
      case 0xa9: addr = this.addrIdx(); this.regA = this.add8(this.regA, this.read(addr), this.regCC & F.CARRY); this.cycles += 5; return;
      case 0xaa: addr = this.addrIdx(); this.regA = this.or8(this.regA, this.read(addr)); this.cycles += 5; return;
      case 0xab: addr = this.addrIdx(); this.regA = this.add8(this.regA, this.read(addr), 0); this.cycles += 5; return;
      case 0xac: addr = this.addrIdx(); this.cpx16(this.read16(addr)); this.cycles += 6; return;
      case 0xad: { // JSR idx
        addr = this.addrIdx();
        this.push16(this.regPC);
        this.regPC = addr;
        this.cycles += 8; return;
      }
      case 0xae: addr = this.addrIdx(); this.regSP = this.read16(addr); this.setNZ16(this.regSP); this.regCC &= ~F.OVERFLOW; this.cycles += 6; return;
      case 0xaf: addr = this.addrIdx(); this.write16(addr, this.regSP); this.setNZ16(this.regSP); this.regCC &= ~F.OVERFLOW; this.cycles += 7; return;

      // ---- 0xB0-0xBF: A extended ----
      case 0xb0: addr = this.addrExt(); this.regA = this.sub8(this.regA, this.read(addr), 0); this.cycles += 4; return;
      case 0xb1: addr = this.addrExt(); this.cmp8(this.regA, this.read(addr)); this.cycles += 4; return;
      case 0xb2: addr = this.addrExt(); this.regA = this.sub8(this.regA, this.read(addr), this.regCC & F.CARRY); this.cycles += 4; return;
      case 0xb4: addr = this.addrExt(); this.regA = this.and8(this.regA, this.read(addr)); this.cycles += 4; return;
      case 0xb5: addr = this.addrExt(); this.bit8(this.regA, this.read(addr)); this.cycles += 4; return;
      case 0xb6: addr = this.addrExt(); this.regA = this.read(addr); this.setNZ8(this.regA); this.regCC &= ~F.OVERFLOW; this.cycles += 4; return;
      case 0xb7: addr = this.addrExt(); this.write(addr, this.regA); this.setNZ8(this.regA); this.regCC &= ~F.OVERFLOW; this.cycles += 5; return;
      case 0xb8: addr = this.addrExt(); this.regA = this.eor8(this.regA, this.read(addr)); this.cycles += 4; return;
      case 0xb9: addr = this.addrExt(); this.regA = this.add8(this.regA, this.read(addr), this.regCC & F.CARRY); this.cycles += 4; return;
      case 0xba: addr = this.addrExt(); this.regA = this.or8(this.regA, this.read(addr)); this.cycles += 4; return;
      case 0xbb: addr = this.addrExt(); this.regA = this.add8(this.regA, this.read(addr), 0); this.cycles += 4; return;
      case 0xbc: addr = this.addrExt(); this.cpx16(this.read16(addr)); this.cycles += 5; return;
      case 0xbd: { // JSR ext
        addr = this.addrExt();
        this.push16(this.regPC);
        this.regPC = addr;
        this.cycles += 9; return;
      }
      case 0xbe: addr = this.addrExt(); this.regSP = this.read16(addr); this.setNZ16(this.regSP); this.regCC &= ~F.OVERFLOW; this.cycles += 5; return;
      case 0xbf: addr = this.addrExt(); this.write16(addr, this.regSP); this.setNZ16(this.regSP); this.regCC &= ~F.OVERFLOW; this.cycles += 6; return;

      // ---- 0xC0-0xCF: B immediate / misc ----
      case 0xc0: this.regB = this.sub8(this.regB, this.fetch8(), 0); this.cycles += 2; return;
      case 0xc1: this.cmp8(this.regB, this.fetch8()); this.cycles += 2; return;
      case 0xc2: this.regB = this.sub8(this.regB, this.fetch8(), this.regCC & F.CARRY); this.cycles += 2; return;
      case 0xc4: this.regB = this.and8(this.regB, this.fetch8()); this.cycles += 2; return;
      case 0xc5: this.bit8(this.regB, this.fetch8()); this.cycles += 2; return;
      case 0xc6: this.regB = this.fetch8(); this.setNZ8(this.regB); this.regCC &= ~F.OVERFLOW; this.cycles += 2; return; // LDAB #
      case 0xc8: this.regB = this.eor8(this.regB, this.fetch8()); this.cycles += 2; return;
      case 0xc9: this.regB = this.add8(this.regB, this.fetch8(), this.regCC & F.CARRY); this.cycles += 2; return;
      case 0xca: this.regB = this.or8(this.regB, this.fetch8()); this.cycles += 2; return;
      case 0xcb: this.regB = this.add8(this.regB, this.fetch8(), 0); this.cycles += 2; return;
      case 0xce: this.regX = this.fetch16(); this.setNZ16(this.regX); this.regCC &= ~F.OVERFLOW; this.cycles += 3; return; // LDX #

      // ---- 0xD0-0xDF: B direct ----
      case 0xd0: addr = this.addrDir(); this.regB = this.sub8(this.regB, this.read(addr), 0); this.cycles += 3; return;
      case 0xd1: addr = this.addrDir(); this.cmp8(this.regB, this.read(addr)); this.cycles += 3; return;
      case 0xd2: addr = this.addrDir(); this.regB = this.sub8(this.regB, this.read(addr), this.regCC & F.CARRY); this.cycles += 3; return;
      case 0xd4: addr = this.addrDir(); this.regB = this.and8(this.regB, this.read(addr)); this.cycles += 3; return;
      case 0xd5: addr = this.addrDir(); this.bit8(this.regB, this.read(addr)); this.cycles += 3; return;
      case 0xd6: addr = this.addrDir(); this.regB = this.read(addr); this.setNZ8(this.regB); this.regCC &= ~F.OVERFLOW; this.cycles += 3; return;
      case 0xd7: addr = this.addrDir(); this.write(addr, this.regB); this.setNZ8(this.regB); this.regCC &= ~F.OVERFLOW; this.cycles += 4; return;
      case 0xd8: addr = this.addrDir(); this.regB = this.eor8(this.regB, this.read(addr)); this.cycles += 3; return;
      case 0xd9: addr = this.addrDir(); this.regB = this.add8(this.regB, this.read(addr), this.regCC & F.CARRY); this.cycles += 3; return;
      case 0xda: addr = this.addrDir(); this.regB = this.or8(this.regB, this.read(addr)); this.cycles += 3; return;
      case 0xdb: addr = this.addrDir(); this.regB = this.add8(this.regB, this.read(addr), 0); this.cycles += 3; return;
      case 0xde: addr = this.addrDir(); this.regX = this.read16(addr); this.setNZ16(this.regX); this.regCC &= ~F.OVERFLOW; this.cycles += 4; return;
      case 0xdf: addr = this.addrDir(); this.write16(addr, this.regX); this.setNZ16(this.regX); this.regCC &= ~F.OVERFLOW; this.cycles += 5; return;

      // ---- 0xE0-0xEF: B indexed ----
      case 0xe0: addr = this.addrIdx(); this.regB = this.sub8(this.regB, this.read(addr), 0); this.cycles += 5; return;
      case 0xe1: addr = this.addrIdx(); this.cmp8(this.regB, this.read(addr)); this.cycles += 5; return;
      case 0xe2: addr = this.addrIdx(); this.regB = this.sub8(this.regB, this.read(addr), this.regCC & F.CARRY); this.cycles += 5; return;
      case 0xe4: addr = this.addrIdx(); this.regB = this.and8(this.regB, this.read(addr)); this.cycles += 5; return;
      case 0xe5: addr = this.addrIdx(); this.bit8(this.regB, this.read(addr)); this.cycles += 5; return;
      case 0xe6: addr = this.addrIdx(); this.regB = this.read(addr); this.setNZ8(this.regB); this.regCC &= ~F.OVERFLOW; this.cycles += 5; return;
      case 0xe7: addr = this.addrIdx(); this.write(addr, this.regB); this.setNZ8(this.regB); this.regCC &= ~F.OVERFLOW; this.cycles += 6; return;
      case 0xe8: addr = this.addrIdx(); this.regB = this.eor8(this.regB, this.read(addr)); this.cycles += 5; return;
      case 0xe9: addr = this.addrIdx(); this.regB = this.add8(this.regB, this.read(addr), this.regCC & F.CARRY); this.cycles += 5; return;
      case 0xea: addr = this.addrIdx(); this.regB = this.or8(this.regB, this.read(addr)); this.cycles += 5; return;
      case 0xeb: addr = this.addrIdx(); this.regB = this.add8(this.regB, this.read(addr), 0); this.cycles += 5; return;
      case 0xee: addr = this.addrIdx(); this.regX = this.read16(addr); this.setNZ16(this.regX); this.regCC &= ~F.OVERFLOW; this.cycles += 6; return;
      case 0xef: addr = this.addrIdx(); this.write16(addr, this.regX); this.setNZ16(this.regX); this.regCC &= ~F.OVERFLOW; this.cycles += 7; return;

      // ---- 0xF0-0xFF: B extended ----
      case 0xf0: addr = this.addrExt(); this.regB = this.sub8(this.regB, this.read(addr), 0); this.cycles += 4; return;
      case 0xf1: addr = this.addrExt(); this.cmp8(this.regB, this.read(addr)); this.cycles += 4; return;
      case 0xf2: addr = this.addrExt(); this.regB = this.sub8(this.regB, this.read(addr), this.regCC & F.CARRY); this.cycles += 4; return;
      case 0xf4: addr = this.addrExt(); this.regB = this.and8(this.regB, this.read(addr)); this.cycles += 4; return;
      case 0xf5: addr = this.addrExt(); this.bit8(this.regB, this.read(addr)); this.cycles += 4; return;
      case 0xf6: addr = this.addrExt(); this.regB = this.read(addr); this.setNZ8(this.regB); this.regCC &= ~F.OVERFLOW; this.cycles += 4; return;
      case 0xf7: addr = this.addrExt(); this.write(addr, this.regB); this.setNZ8(this.regB); this.regCC &= ~F.OVERFLOW; this.cycles += 5; return;
      case 0xf8: addr = this.addrExt(); this.regB = this.eor8(this.regB, this.read(addr)); this.cycles += 4; return;
      case 0xf9: addr = this.addrExt(); this.regB = this.add8(this.regB, this.read(addr), this.regCC & F.CARRY); this.cycles += 4; return;
      case 0xfa: addr = this.addrExt(); this.regB = this.or8(this.regB, this.read(addr)); this.cycles += 4; return;
      case 0xfb: addr = this.addrExt(); this.regB = this.add8(this.regB, this.read(addr), 0); this.cycles += 4; return;
      case 0xfe: addr = this.addrExt(); this.regX = this.read16(addr); this.setNZ16(this.regX); this.regCC &= ~F.OVERFLOW; this.cycles += 5; return;
      case 0xff: addr = this.addrExt(); this.write16(addr, this.regX); this.setNZ16(this.regX); this.regCC &= ~F.OVERFLOW; this.cycles += 6; return;

      default:
        // Unknown opcode — log once and treat as NOP rather than halting,
        // since the sound CPU loop tolerates a few stray cycles better than
        // a hard halt.
        // eslint-disable-next-line no-console
        console.warn(`m6808: illegal opcode $${op.toString(16)} at $${(this.regPC - 1).toString(16)}`);
        this.cycles += 2;
        return;
    }

    // Should never reach: each case returns explicitly. Keep dummy use of r/v
    // to satisfy strictness if shape changes.
    void r; void v;
  }

  private branchIf(cond: boolean): void {
    const off = this.branchOffset();
    if (cond) this.regPC = (this.regPC + off) & 0xffff;
  }
}
