// Williams Defender arcade harness.
//
// Wires the MC6809 CPU core to:
//  - 11 ROM chips (loaded over fetch from /defender/*)
//  - The bank-switched I/O / ROM region at $C000-$CFFF
//  - The PIA-style operator and player input ports
//  - The 304x256 framebuffer at $0000-$97FF
//  - Battery-backed CMOS at $C400-$C5FF (mirrored to localStorage)
//
// The Game class is framework-agnostic — the React shell hands it a canvas
// and live references to the operator/player input state and reads back its
// run/halt/blit hooks. No DOM lookups happen here.

import { Emulator, MemBlock, ROM } from "../cpu/cpu";
import { Cmos } from "./cmos";
import { OperatorInputs, PlayerInputs } from "./inputs";
import { Palette, blit, initialPalette, paletteEntryFromByte } from "./video";

const ROM_LAYOUT: { name: string; start: number; len: number }[] = [
  { name: "defend.1", start: 0xd000, len: 0x0800 },
  { name: "defend.4", start: 0xd800, len: 0x0800 },
  { name: "defend.2", start: 0xe000, len: 0x1000 },
  { name: "defend.3", start: 0xf000, len: 0x1000 },
  // bank 1
  { name: "defend.9", start: 0x1000, len: 0x0800 },
  { name: "defend.12", start: 0x1800, len: 0x0800 },
  // bank 2
  { name: "defend.8", start: 0x2000, len: 0x0800 },
  { name: "defend.11", start: 0x2800, len: 0x0800 },
  // bank 3
  { name: "defend.7", start: 0x3000, len: 0x0800 },
  { name: "defend.10", start: 0x3800, len: 0x0800 },
  // bank 7
  { name: "defend.6", start: 0x7000, len: 0x0800 },
];

export interface GameOptions {
  canvas: HTMLCanvasElement;
  // Live refs read on every PIA poll. The React shell mutates these in-place
  // so the emulator always sees current state without re-binding callbacks.
  operatorRef: { current: OperatorInputs };
  playerRef: { current: PlayerInputs };
  romBaseUrl?: string; // default "/defender/"
  onTime?: (ms: number) => void;
}

export class Game {
  private cpu: Emulator;
  private bank = 0;
  private cmos: Cmos;
  private palette: Palette = initialPalette();
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private imageData: ImageData;
  private operatorRef: { current: OperatorInputs };
  private playerRef: { current: PlayerInputs };
  private romBaseUrl: string;
  private onTime?: (ms: number) => void;

  private running = false;
  private rafHandle: number | null = null;
  private breakpoint = 0;

  constructor(opts: GameOptions) {
    this.cpu = new Emulator();
    this.cmos = new Cmos();
    this.canvas = opts.canvas;
    this.operatorRef = opts.operatorRef;
    this.playerRef = opts.playerRef;
    this.romBaseUrl = opts.romBaseUrl ?? "/defender/";
    this.onTime = opts.onTime;

    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire 2D canvas context");
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    this.imageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
  }

  async load(): Promise<void> {
    const roms = ROM_LAYOUT.map((r) => new ROM(this.romBaseUrl + r.name, new MemBlock(r.start, r.len)));
    await Promise.all(roms.map((r) => this.loadRom(r)));

    const ram = new MemBlock(0x0000, 0xc000);
    const rom = new MemBlock(0xd000, 0x3000);
    const bank = new MemBlock(0xc000, 0x1000, this.bankRead, this.bankWrite);
    const page = new MemBlock(0xd000, 1, this.bankSelectRead, this.bankSelectWrite);
    this.cpu.setMemoryMap([ram, rom, bank, page]);
    this.cpu.setStackAddress(0xbfff);
    this.cpu.reset();
    this.blit();
  }

  private async loadRom(rom: ROM): Promise<void> {
    const res = await fetch(rom.name);
    if (!res.ok) throw new Error(`Failed to load ROM ${rom.name}: ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    this.cpu.loadMemory(bytes, rom.mem.start);
  }

  // ---------- Bank switching ($D000) ----------

  private bankSelectWrite = (_addr: number, val: number): void => {
    this.bank = val;
  };

  private bankSelectRead = (_addr: number): number => {
    return this.cpu.readByteROM(0xd000);
  };

  private bankWrite = (addr: number, val: number): void => {
    if (this.bank === 0) {
      this.ioWrite(addr, val);
    } else {
      // CPU is writing to the banked window while a ROM bank is mapped.
      // Real hardware would just see the write disappear — same behavior here.
    }
  };

  private bankRead = (addr: number): number => {
    if (this.bank === 0) return this.ioRead(addr);
    const offset = this.bank * 0x1000 + (addr & 0x0fff);
    return this.cpu.readByteROM(offset);
  };

  // ---------- I/O ($C000-$CFFF when bank == 0) ----------

  private ioWrite = (addr: number, val: number): void => {
    if (addr >= 0xc000 && addr <= 0xc00f) {
      this.palette[addr - 0xc000] = paletteEntryFromByte(val) as unknown as number[];
      return;
    }
    if (addr >= 0xc400 && addr <= 0xc5ff) {
      this.cmos.write(addr - 0xc400, val);
      return;
    }
    if (addr === 0xc3fc) {
      // Watchdog kick — silently accept.
      return;
    }
    if (addr === 0xc010) {
      // Screen control register — not currently emulated.
      return;
    }
    if (addr === 0xc800) {
      // Video counter latch — not currently emulated.
      return;
    }
    if (addr >= 0xcc00 && addr <= 0xccff) {
      this.piaWrite(addr - 0xcc00, val);
      return;
    }
    // Unknown I/O write — silently ignore.
  };

  private ioRead = (addr: number): number => {
    // Video counter: top 6 bits of the raster line. Bumped each rAF tick so
    // any code polling "is the beam past line N" actually sees it advance.
    if (addr === 0xc800) {
      return this.videoCounter;
    }
    switch (addr) {
      case 0xcc00: {
        // Operator panel. Latched switches (auto-up, hi-score-reset) read
        // their current state every poll; momentary buttons (advance, coins)
        // read live too — no throttling, no clearing.
        const op = this.operatorRef.current;
        return (
          (op.autoUp ? 0x01 : 0) |
          (op.advance ? 0x02 : 0) |
          (op.rightCoin ? 0x04 : 0) |
          (op.highScoreReset ? 0x08 : 0) |
          (op.leftCoin ? 0x10 : 0) |
          (op.centerCoin ? 0x20 : 0)
        );
      }
      case 0xcc04: {
        const p = this.playerRef.current;
        return (
          (p.fire ? 0x01 : 0) |
          (p.thrust ? 0x02 : 0) |
          (p.smartBomb ? 0x04 : 0) |
          (p.hyperspace ? 0x08 : 0) |
          (p.twoPlayer ? 0x10 : 0) |
          (p.onePlayer ? 0x20 : 0) |
          (p.reverse ? 0x40 : 0) |
          (p.down ? 0x80 : 0)
        );
      }
      case 0xcc06:
        return this.playerRef.current.up ? 0x01 : 0;
    }
    if (addr >= 0xc400 && addr <= 0xc5ff) {
      return this.cmos.read(addr - 0xc400);
    }
    return 0;
  };

  // pia2_ctrlb at $cc07 is wired to the video-counter IRQ on Defender —
  // bit 0 enables the line. We also auto-arm in tick() once the boot code
  // installs a JMP trampoline at the IRQ vector's RAM target, since not
  // every code path goes through this register.
  private irqArmed = false;

  private piaWrite = (index: number, val: number): void => {
    if (index === 7) {
      this.irqArmed = (val & 0x01) !== 0;
    }
  };

  // ---------- Run loop ----------

  blit = (): void => {
    blit(this.ctx, this.imageData, this.cpu.mem, 0x10000, this.palette);
  };

  step = (n: number): void => {
    this.cpu.execute(n, 0);
    this.blit();
  };

  // INT_IRQ from src/cpu/flags.ts is `4`. Williams hardware actually fires
  // ~240Hz off the video counter; here we deliver one IRQ per rAF tick (~60Hz)
  // which is enough to drive the game loop, attract mode, and coin polling.
  private static readonly INT_IRQ = 4;

  setBreakpoint = (bp: number): void => {
    this.breakpoint = bp >>> 0;
  };

  run = (): void => {
    if (this.running) return;
    this.running = true;
    this.tick();
  };

  halt = (): void => {
    this.running = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.cpu.halt();
  };

  // Cold-reset the CPU. The operator panel state (Auto-Up etc.) lives in the
  // React layer and is read live each PIA poll, so whatever the user has
  // toggled is what the board sees on the next boot. Defender samples Auto-Up
  // at reset to decide whether to run self-test or go straight to attract.
  reset = (): void => {
    const wasRunning = this.running;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.running = false;
    this.cpu.halted = false;
    this.irqArmed = false;
    this.cpu.reset();
    this.blit();
    if (wasRunning) this.run();
  };

  toggleDebug = (): void => {
    this.cpu.toggleDebug();
  };

  state = (): string => this.cpu.state();

  isHalted = (): boolean => this.cpu.halted;

  // Fake video counter — top 6 bits of a Williams scanline counter. The real
  // chip cycles through 256 values per frame at 60Hz; bumping by 0x40 per
  // IRQ slice (4 slices/tick) gives one full sweep per frame.
  private videoCounter = 0;

  // Total CPU cycles to execute per rAF tick. ~67000 ≈ 4× the real 1 MHz
  // Defender CPU; lower toward 16667 for real-speed.
  private cyclesPerTick = 67000;
  setSpeed = (cyclesPerTick: number): void => {
    this.cyclesPerTick = Math.max(1000, cyclesPerTick | 0);
    console.log(`speed: ${this.cyclesPerTick} cycles/tick (~${(this.cyclesPerTick / 16667).toFixed(2)}× real)`);
  };

  private tick = (): void => {
    if (!this.running) return;
    const start = performance.now();
    // Auto-arm IRQ once the boot code has installed a JMP trampoline at the
    // IRQ vector's RAM target ($a08f for Defender). This sidesteps the
    // question of which exact PIA bit the game uses to enable interrupts —
    // if the trampoline is in place, IRQs are safe to fire.
    if (!this.irqArmed && this.cpu.mem[0x10000 + 0xa08f] === 0x7e) {
      this.irqArmed = true;
    }
    // Williams hardware fires 4 IRQs per video frame off the scanline counter.
    // Slice the per-tick cycle budget into 4 quarters so we deliver IRQ +
    // advance the video counter at each quarter boundary (~240Hz IRQ rate).
    //
    // Real Defender CPU runs at 1 MHz → 16667 cycles per 60Hz frame. We
    // default to 4× that (66667) for a snappy-but-recognizable feel; tune
    // with game.setSpeed(cyclesPerTick) from the console.
    const irq = this.irqArmed ? Game.INT_IRQ : 0;
    const sliceCycles = (this.cyclesPerTick / 4) | 0;
    for (let i = 0; i < 4; i++) {
      this.cpu.execute(sliceCycles, irq, this.breakpoint);
      this.videoCounter = (this.videoCounter + 0x40) & 0xfc;
      if (this.cpu.halted) break;
    }
    const took = performance.now() - start;
    this.onTime?.(took);
    this.blit();
    if (this.cpu.halted) {
      this.running = false;
      return;
    }
    this.rafHandle = requestAnimationFrame(this.tick);
  };
}
