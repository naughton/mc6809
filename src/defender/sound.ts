// Williams Defender sound board emulation.
//
// Hardware:
//   - Motorola 6808 CPU @ ~894886 Hz
//   - 128 bytes internal RAM ($0000-$007F)
//   - 6821 PIA at $0400-$0403:
//       $0400 PA = 8-bit DAC output  (port A is all outputs)
//       $0401 CRA
//       $0402 PB = 6-bit command input from main CPU
//       $0403 CRB — bit 0 enables the CB1 IRQ when main CPU strobes
//   - 2KB ROM (defend.snd) at $F800-$FFFF
//
// Wire-up: when the main 6809 writes a value to its own $cc02 (PIA1 port B
// going to the sound board), call `Sound.command(value)`. We latch it into
// the sound PIA's port B and pulse CB1, which raises IRQ on the 6808.
//
// Audio: every time the sound program writes to PIA port A, we capture the
// new DAC value with a sound-CPU cycle timestamp. Once per host frame we
// downsample those writes into a small AudioBuffer at the audio context's
// native sample rate and schedule it for playback. Sample-and-hold between
// writes — exactly what the real hardware does into the DAC.

import { M6808 } from "./m6808";

const SOUND_CPU_HZ = 894_886;

export class Sound {
  private cpu: M6808;
  private rom: Uint8Array | null = null;

  // PIA registers (mirroring the on-chip PIA layout)
  private piaPortA = 0;       // DAC output
  private piaCRA = 0;
  private piaPortB = 0;       // command from main CPU (latched)
  private piaCRB = 0;
  private cb1Latched = false; // sticky: cleared by reading PB

  // DAC capture: array of [cycleOffset, value] pairs collected during a tick.
  private dacWrites: number[] = []; // flat: [cycle0, val0, cycle1, val1, ...]
  private cyclesAtTickStart = 0;

  // WebAudio
  private audioCtx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private nextStart = 0;
  private currentDacValue = 0x80; // mid-rail, signed 0
  private enabled = false;

  constructor() {
    this.cpu = new M6808(this.read, this.write);
  }

  // Load the ROM; mirrors it across the top 2KB of address space ($F800-$FFFF).
  async load(romUrl: string): Promise<void> {
    const res = await fetch(romUrl);
    if (!res.ok) throw new Error(`Failed to load sound ROM: ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length !== 0x800) {
      console.warn(`sound ROM length ${bytes.length}, expected 0x800`);
    }
    this.rom = bytes;
    this.cpu.loadRom(bytes, 0xf800);
    this.cpu.reset();
  }

  // ---- audio enable (must be called from a user gesture) ----

  enable(): void {
    if (this.enabled) return;
    try {
      this.audioCtx = new AudioContext();
      this.gain = this.audioCtx.createGain();
      this.gain.gain.value = 0.4;
      this.gain.connect(this.audioCtx.destination);
      this.nextStart = this.audioCtx.currentTime + 0.05;
      this.enabled = true;
      console.log(`[sound] AudioContext started: rate=${this.audioCtx.sampleRate}Hz state=${this.audioCtx.state}`);
      // Resume in case the browser created it suspended despite the user gesture.
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume().then(() => {
          console.log(`[sound] resumed: state=${this.audioCtx?.state}`);
        });
      }
    } catch (err) {
      console.warn("[sound] AudioContext failed:", err);
    }
  }

  disable(): void {
    this.enabled = false;
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
      this.gain = null;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setVolume(v: number): void {
    if (this.gain) this.gain.gain.value = Math.max(0, Math.min(1, v));
  }

  // ---- wiring from the main CPU ----

  // Called whenever the main 6809 writes a value to $cc02. Latch into PB and
  // strobe CB1.
  private commandCount = 0;
  command(value: number): void {
    this.piaPortB = value & 0xff;
    this.cb1Latched = true;
    if (this.commandCount < 8) {
      console.log(`[sound] cmd #${this.commandCount} = $${(value & 0xff).toString(16)}`);
      this.commandCount++;
    }
  }

  // Advance the sound CPU by `realTimeMs` of wall-clock time. The sound board
  // runs at its native ~894 kHz regardless of how aggressively the main CPU
  // is overclocked — otherwise audio plays at the main CPU's multiplier and
  // ends up unrecognizable at high speed. We also clamp to keep tab-restore
  // from dumping a huge backlog of audio.
  tick(realTimeMs: number): void {
    if (!this.rom) return;
    const ms = Math.max(1, Math.min(50, realTimeMs));
    const soundCycles = ((ms * SOUND_CPU_HZ) / 1000) | 0;
    this.cyclesAtTickStart = this.cpu.cycles;
    this.cpu.irqLine = this.cb1Latched && (this.piaCRB & 0x01) !== 0;
    this.cpu.execute(soundCycles);

    if (this.enabled && this.audioCtx) {
      this.flushAudio(soundCycles);
    } else {
      // Discard captured DAC writes when audio is off.
      this.dacWrites.length = 0;
    }
  }

  // ---- 6808 memory hooks ----
  // Return undefined to let the default backing array handle it.

  private read = (addr: number): number | undefined => {
    if (addr >= 0x0400 && addr <= 0x0403) {
      switch (addr & 3) {
        case 0: return this.piaPortA; // PA reads back what was last written
        case 1: return this.piaCRA;
        case 2: {
          // Reading PB clears CB1 latch on real hardware.
          this.cb1Latched = false;
          return this.piaPortB;
        }
        case 3: return this.piaCRB;
      }
    }
    return undefined;
  };

  private write = (addr: number, val: number): boolean | void => {
    if (addr >= 0x0400 && addr <= 0x0403) {
      switch (addr & 3) {
        case 0: { // PA = DAC (when CRA bit 2 = 1) or DDRA (when bit 2 = 0)
          // During init the sound program flips CRA between DDR-access (set
          // direction) and PR-access (real data). Treat any write here as a
          // potential DAC sample — bogus init values get drowned out by the
          // real audio that follows.
          this.piaPortA = val;
          if (val !== this.currentDacValue) {
            if (this.dacWriteCount < 4) {
              console.log(`[sound] DAC write #${this.dacWriteCount} = $${val.toString(16)} at sound-cpu cycle ${this.cpu.cycles}`);
              this.dacWriteCount++;
            }
            const off = this.cpu.cycles - this.cyclesAtTickStart;
            this.dacWrites.push(off, val);
            this.currentDacValue = val;
          }
          return true;
        }
        case 1: this.piaCRA = val; return true;
        case 2: this.piaPortB = val; return true; // shouldn't really happen (PB is input)
        case 3: this.piaCRB = val; return true;
      }
    }
    return undefined;
  };

  // ---- audio downsample + scheduling ----

  private flushAudio(soundCyclesThisTick: number): void {
    if (!this.audioCtx || !this.gain) return;
    const sampleRate = this.audioCtx.sampleRate;
    const numSamples = Math.max(1, ((soundCyclesThisTick * sampleRate) / SOUND_CPU_HZ) | 0);
    const samples = new Float32Array(numSamples);

    // Walk DAC writes in cycle order, sample-and-hold.
    let writeIdx = 0;
    let dacValue = this.lastSampleValue;
    const cyclesPerSample = soundCyclesThisTick / numSamples;
    for (let i = 0; i < numSamples; i++) {
      const targetCycle = i * cyclesPerSample;
      while (writeIdx < this.dacWrites.length && this.dacWrites[writeIdx] <= targetCycle) {
        dacValue = this.dacWrites[writeIdx + 1];
        writeIdx += 2;
      }
      // 0..255 → -1..+1, with 0x80 as the silent center.
      samples[i] = (dacValue - 0x80) / 128;
    }
    // Drain any writes past the last sample so the hold value is correct
    // for the next flush.
    while (writeIdx < this.dacWrites.length) {
      dacValue = this.dacWrites[writeIdx + 1];
      writeIdx += 2;
    }
    this.lastSampleValue = dacValue;
    this.dacWrites.length = 0;

    const buf = this.audioCtx.createBuffer(1, numSamples, sampleRate);
    buf.getChannelData(0).set(samples);

    const now = this.audioCtx.currentTime;
    const lookaheadSec = this.nextStart - now;
    if (lookaheadSec < 0.01) {
      // Underrun (first frame, tab backgrounded, fresh enable) — restart.
      this.nextStart = now + 0.05;
    } else if (lookaheadSec > 0.15) {
      // Overrun — we've accumulated too much audio (typically because the
      // sound CPU was running too fast before a fix landed, or the rAF tick
      // burst-fired catching up after a stall). Drop the backlog and resync.
      this.nextStart = now + 0.05;
      console.log(`[sound] dropped ${(lookaheadSec * 1000).toFixed(0)}ms audio backlog`);
    }
    const src = this.audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(this.gain);
    src.start(this.nextStart);
    this.nextStart += numSamples / sampleRate;
  }

  private lastSampleValue = 0x80;
  private dacWriteCount = 0;

  // Diagnostic snapshot: how is the sound CPU doing?
  status(): string {
    return (
      `sound: enabled=${this.enabled} cmds=${this.commandCount} dac-writes=${this.dacWriteCount} ` +
      `cb1=${this.cb1Latched} CRA=$${this.piaCRA.toString(16)} CRB=$${this.piaCRB.toString(16)} ` +
      `cpu PC=$${this.cpu.regPC.toString(16)} cycles=${this.cpu.cycles}`
    );
  }
}
