# Polynovea Web — 3D & Animation Stack

**Project location:** `D:\PolyNovea\polynovea-web`
**Framework:** Next.js 16.2.5 (App Router, Turbopack)

---

## Libraries Installed

| Library | Version | Purpose |
|---|---|---|
| `three` | ^0.184.0 | WebGL 3D engine |
| `@react-three/fiber` | ^9.6.1 | React renderer for Three.js |
| `@react-three/drei` | ^10.7.7 | R3F helpers (OrbitControls, etc.) |
| `gsap` | ^3.15.0 | ScrollTrigger, text reveals, timeline animations |
| `lenis` | ^1.3.23 | Smooth scroll with inertia |
| `@types/three` | ^0.184.0 | TypeScript types for Three.js |

---

## What Is Built (as of May 2026)

### Hero — React Three Fiber Particle Network
**File:** `components/HeroScene.tsx`

- 120 instanced sphere nodes (`THREE.InstancedMesh`) drifting autonomously
- Connection lines drawn between nodes within `CONNECTION_DISTANCE = 1.8` units
- Nodes pulse in scale and color intensity via `useFrame` sine wave
- Mouse parallax — `CameraRig` component shifts camera.x/y toward cursor (0.03 lerp factor)
- Canvas: `alpha: true`, transparent background, layered behind hero text via `z-index: 0`
- Node color: `#7C3AED` (accent-intelligence violet)
- Connection color: `#7C3AED` at 15% opacity

**Known issue:** `THREE.Clock` deprecation warning from R3F internals — harmless, R3F team handles in future release.

### Smooth Scroll
**File:** `components/SmoothScroll.tsx`

- Lenis v1.3.23
- Duration: 1.2s, easing: `1 - 2^(-10t)` (exponential ease-out)
- Wraps entire app in root layout

### Custom Cursor
**File:** `components/CustomCursor.tsx`

- Small violet dot (8px, `#7C3AED`) follows cursor directly via `mousemove`
- Outer ring (40px) lags behind with 0.12 lerp factor via `requestAnimationFrame`
- Expands to 12px dot + 56px ring on hover over `a`, `button`, `[role="button"]`
- Gold color on expanded state (`--accent-authority`)
- Hidden on touch devices via `@media (hover: none)`

### Scroll Reveal
**File:** `components/ScrollReveal.tsx`

- `IntersectionObserver` watching all `[data-reveal]` elements
- Adds `.is-revealed` class on enter viewport (threshold: 0.1, rootMargin: -60px bottom)
- Supports `data-reveal-delay="ms"` for stagger
- CSS handles the transition: `opacity 0→1`, `translateY 28px→0`, `0.65s ease-out`

### Hero Entrance Animations
**File:** `app/globals.css` — `@keyframes fadeUp`

- Pure CSS, no JS dependency (avoids React Strict Mode double-fire bug)
- Classes: `.hero-animate-1` through `.hero-animate-4` with staggered delays (0.2s, 0.5s, 0.85s, 1.1s)
- `animation-fill-mode: both` — elements stay visible after animation

### Grain Overlay
**File:** `app/globals.css` — `body::before`

- SVG `feTurbulence` noise, `baseFrequency: 0.9`, 4 octaves
- `opacity: 0.035` (3.5%)
- `position: fixed`, `pointer-events: none`, `z-index: 9999`

---

## What Is NOT Built Yet (Next Phase)

### GSAP ScrollTrigger Reveals
- Text wipe-in (clip-path, not just fade)
- Section content staggered rise (proper ScrollTrigger, not IntersectionObserver)
- Each section entrance timed to scroll position

### Scroll-Linked Hero Camera
- Camera Z pulls back as user scrolls past hero
- Gold particle intensity increases on scroll
- Needs Lenis → ScrollTrigger integration (`lenis.on('scroll', ScrollTrigger.update)`)

### Glassmorphism Cards
- `backdrop-filter: blur(20px)`
- `background: rgba(24, 24, 27, 0.6)`
- Gradient border glow: `border: 1px solid rgba(124, 58, 237, 0.3)`
- Hover: violet glow `box-shadow: 0 0 32px rgba(124, 58, 237, 0.2)`

### 3D Card Tilt on Hover
- Mouse position → `rotateX` / `rotateY` transform (max ±8deg)
- `perspective: 1000px` on card container
- Feels physical, tracks cursor
- Reset on mouse leave with smooth ease-out

### Animated Gradient Mesh Backgrounds
- Per-section slowly shifting gradient blobs
- CSS `@keyframes` or WebGL shader
- Replaces static section backgrounds

### 3D Flow Diagram — The System Section
- Nodes pulse in sequence (Decision → Pattern → Intelligence → Engine → Output)
- Either CSS 3D transforms + GSAP timeline, or small R3F scene embedded in section
- Rotating network graph option (R3F `<mesh>` with orbit)

### Text Reveal Animations
- Clip-path wipe: `clip-path: inset(0 100% 0 0)` → `inset(0 0% 0 0)`
- Per-word or per-line
- GSAP SplitText or manual span wrapping

---

## Design Token Reference

```
--accent-intelligence: #7C3AED   (violet — primary 3D color)
--accent-authority:    #E6D3A3   (gold — scroll intensity, hover states)
--bg-primary:          #0A0A0A
--bg-card:             #18181B
--border-active:       #7C3AED
```

---

## Architecture Notes

- All 3D/animation components are `"use client"` — they run client-side only
- HeroScene uses `dynamic(() => import(...), { ssr: false })` — no SSR for WebGL
- GSAP must be imported dynamically inside `useEffect` to avoid SSR issues
- `gsap.from({ opacity: 0 })` is BANNED — React Strict Mode runs effects twice, causing permanent blank sections. Use `gsap.to()` on elements pre-hidden via CSS, or CSS `@keyframes`.
- Lenis + GSAP ScrollTrigger integration: `lenis.on('scroll', ScrollTrigger.update)` + `gsap.ticker.add((time) => lenis.raf(time * 1000))`
