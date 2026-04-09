# Swine Shredders

A tiny endless-runner skateboarding game starring a pig, built for mobile browsers. Vanilla HTML + CSS + Canvas2D. No build step, no dependencies.

## Play it

Open `index.html` in any modern browser, or serve the folder locally:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000 on desktop
# or http://<your-lan-ip>:8000 from a phone on the same wifi
```

High scores are saved to `localStorage` on the device.

## How to play

You're a pig on a skateboard rolling through Pork City. Dodge obstacles, grab truffles, pull tricks, build combos, don't wipe out.

### Touch controls
| Action | Gesture |
| --- | --- |
| Ollie (jump) | Tap |
| Charged jump | Hold, then release |
| Kickflip | Swipe up (mid-air) |
| Grab | Swipe down (mid-air) |
| Grind | Swipe down (on ground) |
| Pause | Tap the `II` button |

### Keyboard controls (desktop)
| Action | Key |
| --- | --- |
| Jump | `Space` / `W` / `↑` |
| Kickflip | `Z` |
| Grab / Grind | `X` |
| Pause | `P` / `Esc` |

### Scoring
- **Passive** — score ticks up with distance, faster as you speed up.
- **Truffles** — +15 each, collected in arcs that tempt you into jumps.
- **Tricks** — Grind +20, Grab +40, Kickflip +60. Landing any mid-air trick adds another +30.
- **Combo** — each scoring action multiplies the next (x1 → x8) as long as you keep chaining within ~2 seconds.

Speed ramps over time. Spawn rate tightens the further you get. Wipeout ends the run — your best score persists.

## Files

```
index.html   canvas, HUD chips, menu/pause/gameover overlays
style.css    neon panels, safe-area padding, animated hero pig
game.js      full engine: state machine, input, physics, render loop
```

Everything else is vanilla — no frameworks, no assets, no network calls. The pig, the skateboard, the buildings, and the truffles are all drawn from canvas primitives. The only external image is an inline SVG data URI for the menu hero in `style.css`.

## Implementation notes

- **DPR + letterbox** — canvas is sized to `window.innerWidth/Height * devicePixelRatio`, but the game logic lives in a fixed 800×450 design space. Rendering applies a scale+offset transform so the design space is always centered and letterboxed.
- **State machine** — `MENU → PLAY → PAUSE ⇄ PLAY → OVER → MENU`. Each state toggles an overlay `div`; the HUD is only visible during `PLAY`.
- **Input** — pointer events (touch + mouse unified). On `pointerdown` the ollie starts charging; on `pointerup` without a swipe, the charged jump fires. Swipes are detected by distance threshold on `pointermove` and consumed per-press.
- **Physics** — simple gravity on the player's `vy`, ground is a flat line at `y = 360`. Collisions use AABB with a tightened player hitbox so glancing edges feel fair.
- **Spawning** — cooldown-driven; each spawn randomly picks an obstacle, a truffle arc, or both. Cooldown shortens linearly with `game.time`, clamped.
- **Parallax** — four background layers scroll at 0.1×, 0.3×, 0.6×, 1.0× of world speed for depth. Windows on the mid-buildings are deterministic from position so they don't flicker.

## Mobile notes

- `viewport` is locked with `user-scalable=no` and `touch-action: none` so the page doesn't scroll or zoom while skating.
- Safe-area insets are respected for the HUD on notched phones.
- The game loop caps `dt` at 50 ms so tab-switching doesn't teleport the pig into an obstacle.

## License

Do whatever you like with it.
