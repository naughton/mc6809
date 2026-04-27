import { useEffect, useRef, useState } from "react";
import { Game } from "../defender/defender";
import { OperatorInputs, PlayerInputs, emptyOperatorInputs, emptyPlayerInputs, isLatchedOperatorKey, momentaryOperatorKeyToField, playerKeyToField } from "../defender/inputs";
import { Controls } from "./Controls";
import { EmulatorCanvas } from "./EmulatorCanvas";
import { OperatorPanel } from "./OperatorPanel";

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);

  // Live mutable refs read by the emulator on every PIA poll.
  const operatorRef = useRef<OperatorInputs>(emptyOperatorInputs());
  const playerRef = useRef<PlayerInputs>(emptyPlayerInputs());

  // React state mirror so the UI re-renders when input state changes.
  const [operator, setOperator] = useState<OperatorInputs>(emptyOperatorInputs());
  const [soundOn, setSoundOn] = useState(false);

  const updateOperator = (next: OperatorInputs) => {
    operatorRef.current = next;
    setOperator(next);
  };

  // Keyboard wiring.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const latched = isLatchedOperatorKey(e.key);
      if (latched) {
        if (!e.repeat) {
          updateOperator({ ...operatorRef.current, [latched]: !operatorRef.current[latched] });
        }
        e.preventDefault();
        return;
      }
      const opMomentary = momentaryOperatorKeyToField(e.key);
      if (opMomentary) {
        updateOperator({ ...operatorRef.current, [opMomentary]: true });
        e.preventDefault();
        return;
      }
      const pField = playerKeyToField(e.key);
      if (pField) {
        playerRef.current = { ...playerRef.current, [pField]: true };
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const opMomentary = momentaryOperatorKeyToField(e.key);
      if (opMomentary) {
        updateOperator({ ...operatorRef.current, [opMomentary]: false });
        e.preventDefault();
        return;
      }
      const pField = playerKeyToField(e.key);
      if (pField) {
        playerRef.current = { ...playerRef.current, [pField]: false };
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Boot the emulator on mount.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game({ canvas, operatorRef, playerRef });
    gameRef.current = game;
    // Expose for ad-hoc DevTools poking: `game.state()`, `game.sound.status()`, etc.
    (window as unknown as { game: Game }).game = game;
    let cancelled = false;
    game
      .load()
      .then(() => {
        if (cancelled) return;
        game.run();
      })
      .catch((err) => {
        console.error("ROM load failed", err);
      });
    return () => {
      cancelled = true;
      game.halt();
      gameRef.current = null;
    };
  }, []);

  const onMomentary = (key: keyof OperatorInputs, down: boolean) => {
    updateOperator({ ...operatorRef.current, [key]: down });
  };

  // Browser autoplay policy: AudioContext can only start from a user gesture.
  const onToggleSound = () => {
    const game = gameRef.current;
    if (!game) return;
    if (game.sound.isEnabled()) {
      game.sound.disable();
      setSoundOn(false);
    } else {
      game.sound.enable();
      setSoundOn(game.sound.isEnabled());
    }
  };

  return (
    <div style={{ background: "#000", color: "#0f0", padding: 12, minHeight: "100vh", fontFamily: "Consolas, monospace" }}>
      <h2 style={{ margin: "0 0 8px 0", color: "#0f0" }}>Defender (MC6809 Emulator)</h2>
      <EmulatorCanvas ref={canvasRef} width={304} height={256} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={onToggleSound}>{soundOn ? "🔊 Sound ON" : "🔇 Sound OFF"}</button>
      </div>
      <OperatorPanel
        state={operator}
        onToggleAutoUp={() => updateOperator({ ...operatorRef.current, autoUp: !operatorRef.current.autoUp })}
        onToggleHighScoreReset={() => updateOperator({ ...operatorRef.current, highScoreReset: !operatorRef.current.highScoreReset })}
        onMomentary={onMomentary}
      />
      <Controls />
    </div>
  );
}
