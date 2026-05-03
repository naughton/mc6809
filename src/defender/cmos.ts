// Williams Defender battery-backed CMOS RAM ($C400-$C5FF, 512 bytes).
// On real hardware this is preserved across power cycles by a coin-cell
// battery. Here we mirror it to localStorage so operator-set DIP/menu
// configuration and high scores persist across page reloads.

const STORAGE_KEY = "mc6809.defender.cmos.v1";
const SIZE = 0x200;

// Pre-baked working CMOS dump. Defender's first-boot path checks for valid
// configuration here; without it, the board enters operator setup. This was
// captured from a known-good local session — any user with empty localStorage
// (e.g. a fresh visit to the deployed site) gets these defaults so the game
// boots straight into attract.
const DEFAULT_CMOS_BASE64 =
  "AAAAAAAAAAAAAAAAAwAAAAMAAAAAAAAAAAAAAAIAAgESB3AERAVSBEoAAQiDARUFUwRBBE0AAQVZAiAETARFBEQA" +
  "AQRCCIUFUARHBEQAAQIlAiAEQwVSBEIAAQEQAzUETQVSBVMAAAiCBmUFUwVTBVIAAAZgARAFVARNBEgAAgVaAAEA" +
  "AAADAAMAAQAEAAEAAQAAAAAAAAAFARUAAQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

export class Cmos {
  private bytes: Uint8Array;

  constructor() {
    this.bytes = new Uint8Array(SIZE);
    this.load();
  }

  read(offset: number): number {
    return this.bytes[offset & (SIZE - 1)];
  }

  write(offset: number, val: number): void {
    const i = offset & (SIZE - 1);
    if (this.bytes[i] === (val & 0xff)) return;
    this.bytes[i] = val & 0xff;
    this.scheduleSave();
  }

  reset(): void {
    this.bytes.fill(0);
    this.persist();
  }

  // Wipe both the in-memory CMOS and the localStorage backing AND skip the
  // baked default on the next load — so the next CPU reset boots into
  // Defender's "factory uninitialized" path. Use this when walking operator
  // setup to capture a fresh dump.
  factoryReset(): void {
    this.bytes.fill(0);
    try {
      localStorage.removeItem(STORAGE_KEY);
      // Stash a tombstone so load() doesn't replace zeros with the baked
      // defaults next time.
      localStorage.setItem(STORAGE_KEY, btoa("\0".repeat(SIZE)));
    } catch {
      // Ignore.
    }
  }

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private scheduleSave() {
    if (this.saveTimer !== null) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.persist();
    }, 250);
  }

  private persist() {
    try {
      const b64 = btoa(String.fromCharCode(...this.bytes));
      localStorage.setItem(STORAGE_KEY, b64);
    } catch {
      // localStorage may be unavailable (private mode, SSR). Silently skip.
    }
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CMOS_BASE64;
      const decoded = atob(raw);
      const len = Math.min(decoded.length, SIZE);
      for (let i = 0; i < len; i++) {
        this.bytes[i] = decoded.charCodeAt(i);
      }
    } catch {
      // Corrupt localStorage entry — fall back to the baked defaults so the
      // game still boots straight into attract.
      try {
        const decoded = atob(DEFAULT_CMOS_BASE64);
        const len = Math.min(decoded.length, SIZE);
        for (let i = 0; i < len; i++) {
          this.bytes[i] = decoded.charCodeAt(i);
        }
      } catch {
        // Nothing more to do.
      }
    }
  }
}
