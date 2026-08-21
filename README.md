# SquarePool — Football Squares

Interactive football squares web app with multi-room support, admin console, and per-room multi-board management.

## Quick Start

```bash
npm install
npm start         # dev server at localhost:3000
```

## Architecture

```
src/
├── App.jsx                          # Root router — hash-based routing between landing + rooms
├── GameBoard.jsx                    # Room-level orchestrator — state, board switching, views
│
├── utils/                           # Pure functions — zero React, fully unit-testable
│   ├── constants.js                 # Grid size, storage key factories, defaults
│   ├── boardLogic.js                # Shuffle, generate, place, winner calc
│   └── colorUtils.js                # Hex color manipulation (darken)
│
├── hooks/
│   └── usePersistedState.js         # localStorage-backed useState with key-change support
│
├── styles/
│   ├── theme.js                     # Design tokens (colors, fonts, radii, shadows)
│   └── shared.js                    # Reusable style objects (buttons, cards, inputs)
│
└── components/
    ├── common/
    │   └── QRCode.jsx               # Deterministic QR-like SVG (swap for real lib in prod)
    │
    ├── grid/
    │   ├── SquaresGrid.jsx          # 10×10 board with team banners + winner highlighting
    │   ├── PrizePotBar.jsx          # Prize pot / quarterly payout display
    │   └── WinnersSummary.jsx       # Quarter-by-quarter winner cards
    │
    ├── admin/
    │   ├── AdminPanel.jsx           # Full admin modal — composes all admin sections
    │   ├── BoardManagementSection.jsx # Create, switch, archive boards
    │   ├── TeamColorSection.jsx     # Team names + color pickers with live preview
    │   ├── PrizePoolSection.jsx     # Total pot + quarterly payout config
    │   ├── QuarterScoresSection.jsx # Q1–Q4 score entry with clear buttons
    │   └── OverrideCellSection.jsx  # Manual cell name override
    │
    ├── join/
    │   ├── NameStep.jsx             # Step 1: first/last name entry
    │   ├── PaymentStep.jsx          # Step 2: QR code + amount + confirm
    │   └── PaymentSuccess.jsx       # Step 3: confirmation with square count
    │
    ├── layout/
    │   ├── Header.jsx               # Nav bar with room code + exit button
    │   ├── Footer.jsx               # Status bar (board name, price, fill count)
    │   ├── BackgroundDecor.jsx      # Decorative gradient orbs
    │   ├── AdminAuthModal.jsx       # Password gate for admin access
    │   ├── HomeView.jsx             # Landing for a room — board selector + join/view
    │   ├── JoinView.jsx             # Join flow container (name → payment → success)
    │   └── BoardView.jsx            # Board page — grid + winners + join button
    │
    └── landing/
        └── LandingPage.jsx          # App root — join existing board or create new one
```

## Routing

Hash-based routing (no server needed):

| URL                   | View                          |
|-----------------------|-------------------------------|
| `squares.app`         | Landing page (join/create)    |
| `squares.app#/fam`    | Room "fam" — game board       |

## Data Model

Storage is scoped per room + board:

```
fb-{roomCode}-meta                    → { boards: [...], activeBoardId }
fb-{roomCode}-{boardId}-board         → 10×10 grid
fb-{roomCode}-{boardId}-admin         → config (price, teams, colors, etc.)
fb-{roomCode}-{boardId}-participants  → participant history
fb-{roomCode}-{boardId}-scores        → quarter scores
fb-{roomCode}-{boardId}-headers       → randomized 0-9 axes
fb-squares-rooms                      → global room registry
```

## Features

- **Multi-room**: Each group gets a unique codeword (e.g. `/scriberfam`)
- **Multi-board per room**: Admin creates boards ("Week 1", "Super Bowl"), users switch via pill toggle
- **Board archiving**: Hide old boards; restore any time
- **Per-room admin passwords**: Set during room creation
- **State-driven UI**: Join button auto-disables when board is full, re-enables when admin clears cells
- **10×10 grid**: Randomized headers, team-colored axes, gold winner highlighting
- **3-step join flow**: Name → QR payment → confirmation with random placement
- **Full admin console**: Price, teams + colors, prize pool, scores, cell overrides, submissions toggle, board reset
- **localStorage persistence**: All data survives page refresh
- **Dark theme**: Gradient backgrounds, purple/violet accents

## Design Principles

| Layer         | Responsibility                              | React? |
|---------------|---------------------------------------------|--------|
| `utils/`      | Pure functions, business rules              | No     |
| `hooks/`      | Stateful behavior (persistence)             | Yes    |
| `styles/`     | Design tokens + reusable style objects      | No     |
| `components/` | UI rendering, grouped by feature domain     | Yes    |
| `App.jsx`     | Routing                                     | Yes    |
| `GameBoard.jsx` | Room-level state orchestration            | Yes    |
