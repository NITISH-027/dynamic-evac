# DYNAMIC EVACUATION // Adaptive Emergency Pathfinding Engine

A high-performance, cinematic scrollytelling web application and interactive AI pathfinding sandbox comparing static 2019 emergency blueprints against real-time adaptive vector field rerouting.

---

## Key Features

- **Continuous 227-Frame Playback**: Seamlessly combines Part 1 (83 frames, indices 0..82) and Part 2 (144 frames, indices 83..226) with zero white flashing.
- **Cyber-Styled Preloader**: Fast concurrent texture preloading with memory status and radar scanner.
- **Calibrated Cinematic Scrubbing**:
  - Dynamically calibrated track height (`PIXELS_PER_FRAME = 20`) for ~4.5s deliberate mouse wheel scrub.
  - Virtual dampening (`LERP_FACTOR = 0.09`) for weighted cinematic inertia.
  - `@studio-freight/lenis` smooth scroll integration for Windows & WebKit notched mouse wheels.
- **Low-Profile Documentary Subtitles**: Smooth analog opacity crossfading based on frame ranges.
- **ACT 4 Live Interactive Sandbox**:
  - Top-down blueprint floor plan with rooms, hallways, and 3 exits:
    - **Exit A** (Main Lobby / 2019 Static Plan)
    - **Exit B** (West Fire Escape)
    - **Exit C** (North Service Dock)
  - Autonomous flocking occupants (Boids steering physics).
  - Click anywhere to drop pulsing thermal fire hazard nodes.
  - Dual Mode comparison: `[STATIC (2019 PLAN)]` vs `[DYNAMIC AI ENGINE]`.
- **Procedural Web Audio Engine**: Synthesizes telemetry alerts, reroute locks, and evacuation blips.
- **Cinema Mode**: Hotkey `C` or `H` hides all UI overlays instantly.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open `http://localhost:5173/` in your browser.

### 3. Build for Production
```bash
npm run build
```

---

## Keyboard Shortcuts
- `C` / `H`: Toggle Cinema Mode (hides all UI overlays)
- `S`: Quick jump to ACT 4 Live Simulation Sandbox
- `Space`: Toggle cinematic autoplay fly-through
- `M`: Toggle Static vs Dynamic AI mode in sandbox
- `R`: Reset simulation occupants
