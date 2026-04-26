// Williams Defender battery-backed CMOS RAM ($C400-$C5FF, 512 bytes).
// On real hardware this is preserved across power cycles by a coin-cell
// battery. Here we mirror it to localStorage so operator-set DIP/menu
// configuration and high scores persist across page reloads.

const STORAGE_KEY = "mc6809.defender.cmos.v1";
const SIZE = 0x200;

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
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const decoded = atob(raw);
      const len = Math.min(decoded.length, SIZE);
      for (let i = 0; i < len; i++) {
        this.bytes[i] = decoded.charCodeAt(i);
      }
    } catch {
      // Ignore corrupt or missing data.
    }
  }
}
