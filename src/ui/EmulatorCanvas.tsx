import { forwardRef } from "react";

interface Props {
  width: number;
  height: number;
  scale?: number;
}

export const EmulatorCanvas = forwardRef<HTMLCanvasElement, Props>(function EmulatorCanvas(
  { width, height, scale = 2 },
  ref,
) {
  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{
        border: "1px solid #333",
        background: "black",
        width: width * scale,
        height: height * scale,
        imageRendering: "pixelated",
        display: "block",
      }}
    />
  );
});
