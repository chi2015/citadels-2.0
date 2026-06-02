# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # Production build
npm run preview   # Preview production build
```

No test or lint scripts are configured.

## Architecture

This is a 2-player (human vs. AI) digital implementation of the Citadels board game. It uses **React 18 + Vite**, with all UI in a single root component and all game rules in a separate `src/game/` engine layer.

### Game Engine (`src/game/`)

The engine is pure JS (no React) with these classes:

- **`Game.js`** — Central orchestrator. Manages game phase state machine: `start → choose → discard → action → end`. Owns players, deck, and character roster. Saves/loads from `localStorage`.
- **`Player.js`** — Holds per-player state (coins, cards in hand, built districts, active character). Score calculation lives here, including all special-district bonuses.
- **`Character.js`** — Base class + 16 subclasses (8 classic, 8 extended). Each subclass implements its unique ability. Characters track per-turn state flags: `assassinated`, `robbed`, `bewitched`, `took`, `built`, `used_*`.
- **`Characters.js`** — Instantiates the correct 8-character roster for classic vs. extended game mode.
- **`Deck.js`** — 54 classic + 14 extended purple district cards. Handles draw, discard, and card-status lifecycle (`in_deck`, `on_choice`, `on_wizard`, `on_graveyard`).
- **`Card.js`** — Simple data model: `name`, `cost`, `color`, `description`, `pic`, `status`.
- **`Strategy.js`** — AI decision engine. Called during robot turns to choose characters, discard cards, and execute actions. Uses configurable delays to simulate human-like pacing.

### UI (`src/App.jsx`)

All React code lives in one ~850-line file. It contains nested sub-components (StartScreen, GameBoard, PlayerBoard, ActionPanel, etc.) and orchestrates the game by calling `Game.js` methods in response to user interactions. Uses `useReducer` for game state and `useEffect` for robot-turn automation.

### Classic vs. Extended Mode

Selected at game start. In extended mode, each of the 8 character slots swaps in an alternate character (e.g., Witch instead of Assassin, Wizard instead of Magician) and adds 14 special purple district cards to the deck.

### Persistence

`Game.js` serializes the entire game state to `localStorage` on page unload and restores it on load, enabling session continuity.

## Key Data Flows

1. User action in `App.jsx` → calls a method on `game` instance → updates game state → `App.jsx` re-renders via `setGame({...game})`
2. Robot turns are triggered by `useEffect` watching `game.current_player` — when it's the robot's turn, `Strategy.js` methods fire with async delays
3. Special district card effects (graveyard, armory, lighthouse, etc.) are handled in both `Player.js` (capability) and `App.jsx` (UI prompt flow)
