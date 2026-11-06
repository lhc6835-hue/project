# Adapter: Web UI (stub)

Back to [README.md](README.md). Principles: [../principles.md](../principles.md).

Status: stub, planned after v1. Fill in the six sections listed in README.md and cite sources in RESEARCH.md before using it in a report.

## Moments

click, hover, focus, submit, success, error, loading, route change, toast, drag (IDs `web.<moment>`).

## Where it lives

CSS `transition`/`animation`/`@keyframes`, `prefers-reduced-motion`, framer-motion, GSAP, Web Animations API, `navigator.vibrate`.

## Defaults (unverified starting points)

Press feedback 50-100 ms; hover 150-200 ms ease-out; route transitions 200-300 ms; honor `prefers-reduced-motion` (WCAG 2.3.3).