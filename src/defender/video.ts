// Defender video memory blit.
// 304x256 display, 4 bits per pixel, 2 pixels per byte. The framebuffer is
// stored column-major starting at $0000 with $0000 = top-left, $00FF =
// bottom-left, $0100 = top of column 2 (pixels 3-4 of the top row), etc.
// The Williams hardware palette has 16 entries; the CPU writes RGB values
// (BBGGGRRR encoding) into $C000-$C00F.

export type Palette = number[][]; // 16 entries of [r, g, b]

export const initialPalette = (): Palette => {
  const p: Palette = [];
  for (let i = 0; i < 16; i++) p.push([0, 0, 0]);
  return p;
};

// Decode a Williams palette byte (BBGGGRRR -> [r,g,b] 0-255).
export function paletteEntryFromByte(val: number): [number, number, number] {
  const b = Math.round((255 * ((val >> 6) & 0x3)) / 4);
  const g = Math.round((255 * ((val >> 3) & 0x7)) / 8);
  const r = Math.round((255 * (val & 0x7)) / 8);
  return [r, g, b];
}

export function blit(
  ctx: CanvasRenderingContext2D,
  imageData: ImageData,
  vram: Uint8Array,
  vramStart: number,
  palette: Palette,
): void {
  const w = 304 / 2; // bytes per row of the framebuffer
  const h = 256;
  const data = imageData.data;
  const scanlineOffset = imageData.width * 4;
  let addr = vramStart;
  let colIndex = 0;

  for (let x = 0; x < w; x++) {
    let index = colIndex;
    for (let y = 0; y < h; y++) {
      const two = vram[addr++];
      let p = palette[(two >> 4) & 0xf];
      data[index] = p[0];
      data[index + 1] = p[1];
      data[index + 2] = p[2];
      data[index + 3] = 0xff;
      p = palette[two & 0xf];
      data[index + 4] = p[0];
      data[index + 5] = p[1];
      data[index + 6] = p[2];
      data[index + 7] = 0xff;
      index += scanlineOffset;
    }
    colIndex += 8;
  }

  ctx.putImageData(imageData, 0, 0);
}
