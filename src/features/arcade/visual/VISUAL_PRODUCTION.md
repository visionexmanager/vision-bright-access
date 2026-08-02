# Visionex Arcade visual production standard

## Required deliverables per game

- Cover: 1600 × 900 minimum, 3200 × 1800 Retina master.
- Thumbnail: responsive 480, 800, and 1200 pixel widths.
- Background: 1920 × 1080 minimum, 3840 × 2160 preferred master.
- Web delivery: AVIF first where supported, WebP fallback, then JPEG/PNG only when necessary.
- UI icons: SVG with a clear silhouette and no embedded raster image.

All assets need a documented focal point, safe crop on mobile, consistent Visionex lighting and finish, no embedded text needed for comprehension, no trademarked material, and meaningful alternative text only when the image conveys information.

## Technology selection

- DOM/CSS/SVG: cards, board pieces, icons, educational and turn-based interfaces.
- Canvas 2D: frequent sprites, particle fields, or dense real-time drawing that would overload the DOM.
- WebGL: only for measured 3D or high-volume effects where Canvas cannot meet the frame budget. Always retain a reduced-effects fallback.
- CSS transforms/opacity: interface transitions. Avoid layout-triggering animation.

## Performance budget

- Thumbnail: target ≤ 90 KB.
- Cover: target ≤ 220 KB.
- Background: target ≤ 450 KB.
- Decode only near the viewport; preload only the active game cover/background.
- Test at 1×, 2×, and 3× density, 360 px mobile width, 1440 px desktop, and 4K.
- Balanced mode reduces effects; Performance mode caps visual selection at 960 px and removes decorative transforms/filters.
