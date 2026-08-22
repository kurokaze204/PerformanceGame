# The Performance Gap

**The Performance Gap** is a facilitated multiplayer business simulation about the gap between what an organisation knows and what it can actually do under pressure.

Players balance short-term turnover against investment in organisational capability, expertise, knowledge transfer, codification, relationships, automation and resilience.

## Core model

- Six Australian operating sites plus Corporate Headquarters.
- Five knowledge domains: Engineering, Human Resources, Marketing, Operations and Finance.
- Local **Team Capability**, **Local Codified Knowledge** and enterprise **Corporate Intranet** knowledge.
- Local absorptive capacity: `Usable Intranet = MIN(Intranet, Team Capability + 2)`.
- Base organisational knowledge: `MAX(Team Capability, Local Codified, Usable Intranet)`.
- Deep Experts are powerful, mobile and vulnerable Single Points of Failure (SPOFs).
- Communities of Practice provide temporary relational access to expertise only while companies continue participating.
- Horizon Scanning creates early warning: it can replace one matching event in the following round, not increase a knowledge score.
- Automation embeds persistent company-wide capability at a significant financial cost.
- External consultants rent temporary knowledge. Their price rises 35% after each engagement, making repeated dependence progressively expensive.
- Event uncertainty uses a **d12**. Knowledge decisions change the probability of success rather than guarantee it.

## Turn structure

1. **Events** — two business cards are dealt.
2. **Respond** — decide how to handle each card and resolve them one at a time.
3. **Consequences** — see financial outcomes and capture eligible experiential learning.
4. **Invest** — spend up to four Knowledge Actions to build future capability.
5. **Risk** — expert and workforce knowledge loss is resolved and shown before the next round.

Five ordinary rounds are followed by a common Final Disruption.

## Executive event choices

For each knowledge gap the intended player-facing choices are:

1. **Use what we already know**
2. **Deploy one of our experts**
3. **Ask our network for help**
4. **Buy external expertise**
5. **Accept the risk**

The interface should show the financial amount at stake and, for local events, that amount as a percentage of the affected site's current turnover.

## Event balance

A normal five-round game contains ten events per company: five Problems and five Opportunities in a shuffled hidden schedule. A late-session balancing rule is designed to correct a strong skew once approximately 40 minutes have elapsed, so shorter sessions do not accidentally expose one team mainly to Problems or mainly to Opportunities.

## Architecture

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Backend:** Express / Node.js
- **Rules:** server-authoritative TypeScript game engine
- **Realtime:** lightweight Server-Sent Events (SSE)
- **Persistence:** existing Neon PostgreSQL account
- **Source control:** GitHub
- **Runtime AI:** not required for V1

The recovery branch `fix/core-game-loop-v1` introduces a V2 state engine and server entrypoint while the original generated UI remains available for comparison. See `docs/core-v2-recovery.md`.

## Development

```bash
bun install
bun run lint
bun run test:core
bun run dev
```

Production build:

```bash
bun run build
bun start
```

Copy `.env.example` to `.env` and provide `DATABASE_URL` for Neon persistence. A `FACILITATOR_SECRET` is required before facilitator/destructive controls can be used.

## Current recovery status

The core V2 work focuses on reliable play before visual polish: authoritative phases, one-card-at-a-time resolution, correct local/enterprise turnover effects, expert travel/scarcity, current-round CoPs, one-round Horizon Scanning, consultant escalation, correct Risk timing, shared timer state and safer facilitator controls.

The target visual experience is a simple digital board game rather than an analytics dashboard: persistent company board, dealt event cards, obvious executive choices, strong action tokens, short animations and clear cause-and-effect.
