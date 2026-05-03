# mc6809

Simulator for Motorola 6809 processor and scaffolding for an early 80's Williams arcade console that will run Defender ROMS

### How to start a game of Defender

**Press `1`** for one-player start.

Player keys: `Space`=Fire, `→`=Thrust, `End`=Smart Bomb, `Enter`=Hyperspace,
`←`=Reverse, `↑`/`↓`=Up/Down, `1`/`2`=Start.

## Defender operator menu reference

The on-screen labels are generic Williams ones; the descriptions below come
from the Defender operator manual. To enter the menu: uncheck **Auto-Up**,
click **Reset**. To leave: re-check Auto-Up and Advance through to
Function 28, then click Advance once more.

### Bookkeeping totals (Functions 1-7)

In game-over mode, set the switch to AUTO-UP and depress ADVANCE. The CRT
indicates Function 1 and total left-chute coins. Continue ADVANCE through
each function. To review a total advanced past, set switch to MANUAL-DOWN
and depress ADVANCE.

| Function | Default | Description |
| --- | --- | --- |
| 1 | 0 | (Total) COINS LEFT |
| 2 | 0 | (Total) COINS CENTER |
| 3 | 0 | (Total) COINS RIGHT |
| 4 | 0 | TOTAL PAID (games) |
| 5 | 0 | (Total Bonus) SHIPS WON |
| 6 | 0 | TOTAL (Play) TIME (minutes) |
| 7 | 0 | TOTAL SHIPS (played) |

ADVANCE through to Function 28 (SPECIAL FUNCTION) to return to game-over
or zero the totals. With AUTO-UP set:

- **Return to game over** — depress ADVANCE.
- **Zero audit totals and return to game over** — operate HIGH SCORE RESET
  to indicate "35" on CRT Function 28, then depress ADVANCE.
  *Observed: this doesn't actually work in this emulator — only the full
  factory reset (value "45", below) clears audit totals.*

### Game adjustments (Functions 8-27)

Same entry: AUTO-UP, ADVANCE. Raise the function number with ADVANCE in
AUTO-UP, lower it with ADVANCE in MANUAL-DOWN. Raise the value with HIGH
SCORE RESET in AUTO-UP, lower it with HIGH SCORE RESET in MANUAL-DOWN. The
value left on the CRT is the new setting.

| Function | Factory | Description |
| --- | --- | --- |
| 8 | 10000 | BONUS SHIP LEVEL (0 = no bonus ships) |
| 9 | 3 | SHIPS PER GAME |
| 10 | 3 | COINAGE SELECT |
| 11 | 1 | LEFT COIN MULT |
| 12 | 4 | CENTER COIN MULT |
| 13 | 1 | RIGHT COIN MULT |
| 14 | 1 | COINS FOR CREDIT |
| 15 | 0 | COINS FOR BONUS |
| 16 | 0 | MINIMUM COINS |
| 17 | 0 | FREE PLAY (set to 1 for free play) |
| 18 | 0 | STARTING DIFFICULTY (0 = LIB; 1 = MOD; 2 = CONS) |
| 19 | 10 | PROGRESSIVE WAVE DIFFICULTY LIMIT (4-25; e.g. 5 = LIB, 10 = MOD, 15 = CONS) |
| 20 | 1 | BACKGROUND SOUND (0 = OFF, 1 = ON) |
| 21 | 5 | PLANET RESTORE WAVE NUMBER |
| 22-27 | 0 | NOT USED |

ADVANCE through to Function 28 (SPECIAL FUNCTION) when done, then either:

- **Return to game over** — AUTO-UP set, depress ADVANCE.
- **Restore factory settings + zero audit totals (full reset):**
  1. Operate HIGH SCORE RESET in AUTO-UP to indicate "45" on CRT Function 28.
  2. Depress ADVANCE — the game returns to audit Function 1.
  3. Set switch to MANUAL-DOWN, depress ADVANCE until Function 28 shows.
  4. Set switch to AUTO-UP, depress ADVANCE.

### Resetting high scores

In game-over (attract) mode, depress HIGH SCORE RESET. This clears the
high score table and erases entered signatures.
