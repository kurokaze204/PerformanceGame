# The Performance Gap — Simulation Platform

**The Performance Gap** is a multiplayer business simulation exploring how organisations turn expertise into performance and resilience.

## V2 recovery branch

The current recovery work lives on `fix/core-game-loop-v1`. It introduces an authoritative V2 rules engine and a simplified board-game style player interface. Do not merge the draft PR to `main` until the branch has completed a full playtest.

### Core V2 mechanics

- Five knowledge domains: Engineering, HR, Marketing, Operations and Finance.
- Six operating sites with Team Capability and Local Codified Knowledge.
- Corporate Intranet constrained by local absorptive capacity.
- Deep Experts, expert location, travel, SPOF risk and attrition.
- Current-round Communities of Practice and one-round Horizon Scanning.
- Automation as persistent embedded capability.
- Consultants as temporary external expertise: starting at $15k per knowledge point, +35% after each engagement, maximum three points per domain/event.
- Two cards per round, resolved one at a time using a d12.
- Four Knowledge Actions per round.
- Shared 50-minute session timer.

## AAR and benchmarking evidence

V2 keeps the live game snapshot but also writes structured longitudinal evidence to Neon/PostgreSQL for After Action Review and cross-game benchmarking.

The analytics model records:

- initial business and knowledge strategy choices;
- post-game knowledge strategy choice, shown alongside the original choice;
- turnover through the game;
- average Team Capability;
- average Local Codified Knowledge;
- average Corporate Intranet and average Usable Intranet;
- knowledge-investment and consultant expenditure;
- event financial exposure and net financial impact;
- probability of success when an event is revealed and after the team commits its interventions;
- expected versus actual successes, allowing the AAR to distinguish decision quality from unusually good or bad dice rolls;
- version identifiers for rules, deck and balance settings so historical comparisons only combine genuinely comparable games.

Primary tables are:

- `performance_gap.session_snapshots_v2` — current authoritative game state;
- `performance_gap.game_runs_v2` — one row per simulation run;
- `performance_gap.company_runs_v2` — one row per company/run for benchmark summaries;
- `performance_gap.event_decisions_v2` — reveal, commitment and result evidence for every event;
- `performance_gap.company_metrics_v2` — time-series snapshots for turnover and knowledge capability;
- existing `performance_gap.game_events` — append-only narrative event log.

AAR endpoints:

- `GET /api/sessions/:id/aar`
- `GET /api/sessions/:id/benchmark/:companyId`

The AAR presentation should support the standard questions rather than prescribe conclusions:

1. What was planned?
2. What actually happened?
3. Why was there a difference?
4. What would you do better?

### Final disruption and luck variance

Expected-versus-actual success is now captured explicitly. A small hidden final-disruption variance correction is intentionally **not activated yet**. Its threshold and cap should be calibrated from early playtests so it reduces extreme bad-luck noise without rescuing poor strategy. Persistent Team Capability, Codification, Usable Intranet, Automation, expert depth and reduced SPOF exposure remain the primary resilience mechanisms.

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

`DATABASE_URL` should point to the Neon database. If omitted, the simulation can run in memory but AAR/benchmark history will report that analytics persistence is unavailable.

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
npm run build
```

## Google AI Studio

Google AI Studio Build mode supports importing a GitHub repository and two-way GitHub sync. For this recovery work, keep the draft branch separate from `main` while testing.

Preferred test path:

1. In AI Studio Build mode, use **Add files (+) → Import from GitHub**.
2. Import `kurokaze204/PerformanceGame` as a separate test app.
3. If AI Studio offers a branch/ref choice, select `fix/core-game-loop-v1`.
4. If the existing linked project can explicitly pull that branch, that is also fine.
5. If AI Studio only follows `main`, do **not** merge the draft PR just to make the code visible; use a separate import/workspace where possible, or validate the branch elsewhere first.
6. Add `DATABASE_URL` and `FACILITATOR_SECRET` to the AI Studio app's secrets/environment configuration before starting a test game.
7. Start with a new one-company solo session so the analytics tables are created automatically and the strategy prompts/event flow can be checked end-to-end.

The runtime does not require Gemini. AI features are optional; game rules, persistence and AAR evidence are deterministic application code.
