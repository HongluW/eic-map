# The Anarchy Atlas

An animated, hand-drawn historical map of the East India Company's rise in South Asia, 1739–1803, following William Dalrymple's *The Anarchy: The Relentless Rise of the East India Company*. A short epilogue carries the story to the British Raj in 1858.

The whole app is one React component, [`src/EICMap.jsx`](src/EICMap.jsx). It needs only React, `lucide-react` and Tailwind CSS.

## What it does

- Auto-plays through 100+ dated events, with pause, previous/next, speed control and a scrubbable timeline split into chapters.
- Territory changes hands region by region; protectorates are hatched in the protecting power's colour.
- Armies, fleets, trade convoys and payments animate along their routes, with a different symbol for each kind of force (drilled infantry, light and heavy cavalry, artillery, royal progresses, fleets, merchant ships, treasure).
- Three filters: all forces, the main four (Company, Mughals, Marathas, Bengal), or a single faction.
- A side panel with event detail, troop numbers, key figures and who held each office; a collapsible London box with Company stock, dividend, army size and Parliament's dealings with the Company.

Troop figures, stock prices and army sizes are approximate; region borders are generated, not surveyed.

## Running it

```bash
npm install
npm run dev
```

- `npm run build:single` builds a single self-contained HTML file in `dist-single/`.
- `npm run geo` regenerates the embedded map data (Natural Earth 1:50m coastline and the historic regions) at the bottom of `src/EICMap.jsx`.
