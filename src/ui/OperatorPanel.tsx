import type { OperatorInputs } from "../defender/inputs";

interface Props {
  state: OperatorInputs;
  onToggleAutoUp: () => void;
  onMomentary: (key: keyof OperatorInputs, down: boolean) => void;
}

export function OperatorPanel({ state, onToggleAutoUp, onMomentary }: Props) {
  const momentaryHandlers = (key: keyof OperatorInputs) => ({
    onMouseDown: () => onMomentary(key, true),
    onMouseUp: () => onMomentary(key, false),
    onMouseLeave: () => onMomentary(key, false),
    onTouchStart: () => onMomentary(key, true),
    onTouchEnd: () => onMomentary(key, false),
  });

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
      <label title="F1 toggles. Must be ON to start a game.">
        <input type="checkbox" checked={state.autoUp} onChange={onToggleAutoUp} /> Auto-Up (F1)
      </label>
      <button {...momentaryHandlers("advance")} style={pressedStyle(state.advance)}>
        Advance (F2)
      </button>
      <button {...momentaryHandlers("highScoreReset")} style={pressedStyle(state.highScoreReset)}>
        High-Score Reset (F4)
      </button>
      <button {...momentaryHandlers("rightCoin")} style={pressedStyle(state.rightCoin)}>
        Right Coin (F3)
      </button>
      <button {...momentaryHandlers("leftCoin")} style={pressedStyle(state.leftCoin)}>
        Left Coin (F5)
      </button>
      <button {...momentaryHandlers("centerCoin")} style={pressedStyle(state.centerCoin)}>
        Center Coin (F6)
      </button>
    </div>
  );
}

function pressedStyle(down: boolean): React.CSSProperties {
  return {
    background: down ? "#0f0" : "#222",
    color: down ? "#000" : "#0f0",
    border: "1px solid #333",
    padding: "4px 10px",
    cursor: "pointer",
    fontFamily: "Consolas, monospace",
  };
}
