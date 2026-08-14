---
name: game-studio-pro
description: Design, build, upgrade, debug, and release polished games in Visionex Arcade. Use for game mechanics, levels, scoring, progression, rewards, difficulty, game loops, game assets, or remaining game upgrades.
---

# Visionex game studio

1. Define the core loop, player goal, controls, feedback, fail/win states, session length, and learning curve.
2. Make gameplay deterministic where tests require it; isolate randomness behind injectable seeds.
3. Separate simulation, rendering, audio, input, persistence, and UI state.
4. Support keyboard, touch, switch-like input, screen readers where applicable, pause, reduced motion, and audio-only play when feasible.
5. Register every game in all four locations documented in `AGENTS.md`.
6. Protect score, VX rewards, unlocks, persistence, replay, and anti-abuse invariants.
7. Test initial, active, paused, success, failure, restart, route reload, mobile, RTL, and degraded-asset states.
8. Coordinate motion, visuals, and sound as synchronized gameplay feedback, not decoration.
