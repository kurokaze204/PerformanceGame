# The Performance Gap — Simulation Platform

**The Performance Gap** is a multiplayer strategic business simulation exploring how organisations turn knowledge and expertise into performance and resilience.

## Living game reference

The authoritative human-readable reference for the game's objectives, player experience, mechanics, terminology, architecture and enduring design rules is:

**[`GAME_REFERENCE.md`](./GAME_REFERENCE.md)**

Future feature work should be checked against that file, and changes to the conceptual game or architecture should update it as part of the same change.

## Runtime architecture

The deployed application is conceptually:

**Player browser ⇄ Render Node/TypeScript backend ⇄ Neon PostgreSQL**

The React/TypeScript browser client handles presentation and safe local previews. The Render backend remains authoritative for shared game state and game-changing actions. Neon provides persistence and AAR/benchmark evidence.

## Development

### Prerequisites

- Node.js 18+ or 20+
- npm, yarn or Bun

### Environment

Copy `.env.example` to `.env` and configure at least:

```bash
DATABASE_URL=postgresql://...
FACILITATOR_SECRET=choose-a-test-passcode
```

`DATABASE_URL` should point to the Neon database. Secrets and production environment values must not be committed to source control.

### Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Validate

```bash
npm run lint
npm run test:core
npm run test:ui
npm run build
```

The branch quality workflow is `.github/workflows/new-interface-quality.yml`. Check its result before treating a change as passed.

## Key design rule

Every player input must receive immediate visual acknowledgement. Predictable deterministic work should be performed locally first where safe and reconciled with the backend afterwards. Random, shared or irreversible actions remain backend-authoritative but must still show immediate pressed/working feedback so the player never wonders whether a click was received.
