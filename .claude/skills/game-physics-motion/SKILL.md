---
name: game-physics-motion
description: Implement realistic, stable game physics, animation, collisions, camera movement, character motion, and state machines in Visionex. Use when game movement must feel natural, responsive, or physically believable.
---

# Game physics and motion

1. Use a fixed simulation timestep or a bounded accumulator; render independently with interpolation when useful.
2. Keep units, coordinate spaces, collision layers, and state transitions explicit.
3. Clamp extreme delta time and prevent tunneling, duplicate collision resolution, unstable springs, and accumulating drift.
4. Tune acceleration, deceleration, anticipation, impact, recovery, easing, and camera motion around player intent.
5. Keep gameplay authority separate from visual animation; animation must not silently decide score or rewards.
6. Respect reduced-motion settings and provide equivalent non-motion feedback.
7. Test multiple frame rates, tab suspension, resizing, touch/keyboard input, boundaries, simultaneous contacts, and restart cleanup.
8. Prefer measurable tuning constants and deterministic tests over timing guesses.
