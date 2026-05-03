// Defender input model.
//
// The Williams operator board has TWO classes of switches that the original
// code lumped together as keypresses:
//
//  - LATCHED toggles (Auto-Up/Manual-Down, High-Score-Reset). On real hardware
//    these are panel switches that hold their state. They MUST be read as
//    "stuck on" for the entire game session; sampling-then-clearing on every
//    poll makes the board flip back to test mode within milliseconds.
//
//  - MOMENTARY buttons (Advance, Coin slots). These are ordinary push buttons:
//    held = true, released = false.
//
// The React UI owns the latched state (checkboxes). Momentary buttons can be
// pressed via either keyboard or on-screen button. The emulator reads the
// current state synchronously on each PIA poll — no throttling, no clearing.

export interface OperatorInputs {
  // Latched (toggle) switches
  autoUp: boolean;
  highScoreReset: boolean;
  // Momentary (push button) switches
  advance: boolean;
  rightCoin: boolean;
  leftCoin: boolean;
  centerCoin: boolean;
}

export interface PlayerInputs {
  fire: boolean;
  thrust: boolean;
  smartBomb: boolean;
  hyperspace: boolean;
  twoPlayer: boolean;
  onePlayer: boolean;
  reverse: boolean;
  down: boolean;
  up: boolean;
}

export const emptyOperatorInputs = (): OperatorInputs => ({
  // Default ON: Defender samples Auto-Up at reset to decide whether to enter
  // self-test (OFF) or attract mode (ON). Booting straight into attract mode
  // is what almost every user wants.
  autoUp: true,
  highScoreReset: false,
  advance: false,
  rightCoin: false,
  leftCoin: false,
  centerCoin: false,
});

export const emptyPlayerInputs = (): PlayerInputs => ({
  fire: false,
  thrust: false,
  smartBomb: false,
  hyperspace: false,
  twoPlayer: false,
  onePlayer: false,
  reverse: false,
  down: false,
  up: false,
});

// Default keyboard map for the player controls.
// Returns the matching PlayerInputs key or null.
export function playerKeyToField(key: string): keyof PlayerInputs | null {
  switch (key) {
    case " ":
      return "fire";
    case "ArrowRight":
      return "thrust";
    case "End":
      return "smartBomb";
    case "Enter":
      return "hyperspace";
    case "2":
      return "twoPlayer";
    case "1":
      return "onePlayer";
    case "ArrowLeft":
      return "reverse";
    case "ArrowDown":
      return "down";
    case "ArrowUp":
      return "up";
    default:
      return null;
  }
}

// Map momentary operator keys to fields. F1 is the only latched switch
// (Auto-Up = panel toggle that holds state); the rest are real push buttons
// on the operator panel — pressed once and they spring back.
export function momentaryOperatorKeyToField(key: string): keyof OperatorInputs | null {
  switch (key) {
    case "F2":
      return "advance";
    case "F3":
      return "rightCoin";
    case "F4":
      return "highScoreReset";
    case "F5":
      return "leftCoin";
    case "F6":
      return "centerCoin";
    default:
      return null;
  }
}

export function isLatchedOperatorKey(key: string): "autoUp" | null {
  if (key === "F1") return "autoUp";
  return null;
}
