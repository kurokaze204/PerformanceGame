# The Performance Gap — Game Reference

**Status:** Living design, gameplay and architecture reference  
**Purpose:** This is the authoritative human-readable reference for what The Performance Gap is, why it exists, how it should feel to play, how the game works, and how the software is structured. Future feature work should be checked against this document before implementation.

---

## 1. What the game is

**The Performance Gap** is a strategic business simulation about organisational knowledge, expertise, resilience and performance.

It is designed for business people rather than Knowledge Management specialists. Players run a company that must respond to operational and strategic Events while deliberately deciding how to use, move, protect and strengthen knowledge across the organisation.

The simulation makes normally invisible knowledge dynamics visible enough to discuss. It should help players experience the difference between:

- having information and having usable capability;
- knowing expertise exists and being able to deploy it;
- relying on a few individuals and building organisational resilience;
- reacting to problems and investing before problems occur;
- local knowledge and reusable corporate knowledge;
- temporary outside help and enduring internal capability;
- knowledge that exists somewhere and knowledge available at the right place and time.

The game should feel like a **business simulation with board-game clarity**, not a KM training application or enterprise dashboard.

---

## 2. Core learning objective

The central idea is:

> Knowledge Management is not primarily about doing the organisation's knowledge work. It is about managing the conditions, infrastructure and flows that allow knowledge and expertise to create the greatest possible organisational impact.

The simulation encourages players to think about how an organisation can:

1. see its expertise and capability;
2. make knowledge available where work occurs;
3. protect scarce and vulnerable expertise;
4. move knowledge between people and locations;
5. turn individual expertise into broader organisational capability;
6. use codification, networks and automation appropriately;
7. anticipate knowledge risk before disruption exposes it;
8. balance short-term performance with long-term resilience.

There is deliberately no single prescribed “correct KM strategy”. Different strategies should create consequences worth discussing.

---

## 3. Intended audience and play style

Primary audience:

- executives and senior managers;
- operational and functional leaders;
- business professionals with little or no formal KM background;
- KM Week and conference participants;
- facilitated organisational learning groups.

The design supports one-company solo play, multiple players collaborating as one company, multiple companies in parallel, facilitator-led sessions, and local or remote participation.

The interface should be approachable with roughly the cognitive overhead of a mainstream board game such as Monopoly. Complexity should emerge from decisions and consequences, not from navigating software.

---

## 4. Enduring player-experience design principles

### 4.1 The map is the primary board

The Australian company map is the player's main spatial reference. Sites, experts, turnover and organisational context should remain understandable from the board wherever practical.

### 4.2 Newbie and Expert are genuinely different experiences

**Newbie** progressively reveals concepts and reduces initial cognitive load. Finance and some codified-knowledge detail are hidden from normal player-facing decisions where appropriate.

**Expert** exposes the fuller model earlier and uses tighter action constraints.

### 4.3 Business language first

Player-facing wording should describe the business decision before the KM mechanism. Avoid unnecessary KM jargon, technical labels and software terminology.

### 4.4 Decisions should be visually obvious

Selection language is intentionally simple:

- empty circle = available;
- circled tick = selected;
- category tick = something inside the category has been selected.

### 4.5 Ordinary laptops are a first-class target

Layouts must work at normal browser zoom on common laptop screens. The board should preserve its geometry and important content such as Tasmania and the phase tracker must not disappear below the viewport.

### 4.6 Immediate acknowledgement of user input is mandatory

**This is a design goal for every future feature. A player must never be left wondering whether a click or tap was received.**

When a result can be predicted safely, use optimistic UI:

1. acknowledge the click immediately;
2. update local visual state immediately;
3. calculate deterministic implications locally where practical;
4. send the authoritative write to the backend asynchronously;
5. reconcile to the backend response;
6. roll back or explain only if the backend rejects the action.

Examples include tentative Event allocations and deterministic Invest actions.

When an action cannot be predicted safely because it is random, shared, irreversible or backend-authoritative, do not fake completion. Instead immediately depress/highlight the control, protect against duplicate submissions where appropriate, and show a progress cursor or concise state such as **Working…**, **Resolving…** or **Saving…** until confirmation returns.

**Performance changes must change routing and timing, not game rules or user-visible meaning.**

### 4.7 Backend authority remains intact

Optimistic presentation must never create a second rules engine. The browser may preview safe deterministic outcomes, but the backend remains the final authority for shared game state.

### 4.8 Avoid accidental complexity

Do not add dashboards, persistent panels, extra navigation levels or technical status indicators unless they materially improve a player's decision.

---

## 5. Knowledge model

The company operates across five knowledge domains:

- Engineering
- HR
- Marketing
- Operations
- Finance

Newbie normally hides Finance from player-facing choices.

Knowledge exists through several mechanisms.

**Team Capability** — what a local team can actually do.  
**Local Codified Knowledge** — reusable knowledge captured locally in explicit forms.  
**Corporate Intranet** — knowledge made available corporately; its usefulness depends on a receiving site's ability to understand and apply it.  
**Experts** — people holding deep expertise in one or more domains, with location, activity state and possible Single Point of Failure status.  
**Communities of Practice / network knowledge** — access to useful knowledge beyond the immediate local team.  
**Automation** — knowledge embedded into systems and processes.  
**External expertise** — temporary purchased capability that solves an immediate need without automatically creating enduring capability.  
**Reputation / favours** — a scarce relationship mechanism for guaranteeing or materially supporting a Challenge response.

---

## 6. The River Diagram

The **River** visualises how knowledge capability is distributed across the company. It exists to show that an organisation does not possess one uniform knowledge level: sites have different strengths, experts are unevenly distributed, and knowledge can be moved or converted into broader capability.

The River should help players see:

- strong and weak sites by domain;
- where useful expertise is located;
- internal performance/transfer gaps;
- where Knowledge Transfer may create value;
- where capability is concentrated in a small number of people;
- whether resilience is improving over time.

### Current River presentation rules

- Site capability is shown as small white city dots with city codes.
- Experts are shown as **yellow circular markers approximately four times the diameter of a city dot**, with a dark-grey person silhouette inside. Expert initials/location remain legible beside the marker.
- Remaining company Actions are shown at the top right as the same **yellow action dots** used by the game, rather than a separate green visual language.
- River typography should be deliberately larger than prototype/dashboard text; current chart/support text was increased during playtest polishing.
- Hovering over the chart provides a circular **2× magnifying lens** centred on the pointer so tightly grouped labels and markers can be inspected without permanently enlarging the chart.
- The River modal should use its vertical space efficiently. Avoid a large unused black area below the chart and avoid forcing scrolling on an ordinary laptop where the content can fit.
- The **River** reference button and the **Knowledge Transfer** intervention card during Invest both open this same River decision view. Do not create a second competing Knowledge Transfer configuration screen.

The simplified River used in AAR/benchmarking is intentionally more compact.

---

## 7. Core game loop

The main round loop is:

**Events → Invest → Knowledge Risk → next round**

A phase tracker at the bottom of the board uses the game pawn to make current progression visible.

### Events

The company receives business Events representing problems or opportunities. Players decide what knowledge to bring to the situation.

Typical response choices are:

1. Use what we already know
2. Ask one of our experts to help
3. Ask our network for help
4. Call in a favour
5. Engage external expertise
6. Accept the risk

The Event card shows financial exposure, relevant domains, available knowledge and the resulting Chance of success.

At 100% probability, use plain language rather than making the player perform a meaningless roll. Otherwise show the relationship between **Chance** and **Roll** transparently.

### Invest

After Events, the company has a limited **shared company Action pool**. Actions are not per-player allowances. If several players each perform an action for the same company, they consume the same pool.

Current intervention families include:

- Knowledge Transfer between sites;
- Local Training;
- Corporate Training;
- Codify Site Knowledge;
- Train Expert;
- Update Corporate Intranet;
- Lessons Learned / AAR;
- Join Community of Practice;
- Horizon Scan;
- Automation.

Investment decisions may consume both an Action and turnover. Exact costs/limits are engine/configuration rules and must not be duplicated independently in presentation code.

### Knowledge Risk

The game tests vulnerability in people and sites. This makes concentration risk visible and creates consequences for fragile knowledge structures.

The Risk River can show site capability loss, expert departure and later replacement.

---

## 8. Newbie learning path

Newbie teaches concepts through play rather than a large up-front tutorial.

The first round contains a programmed learning failure presented as a credible business problem. The player initially has a restricted response set so the failure establishes why “the company knows” is different from “the affected site can use that knowledge now”.

The tutorial then introduces two distinct mechanisms:

- **Knowledge Transfer** — direct site-to-site sharing of proven know-how;
- **Local Training** — an expert coaches a local team.

Additional capabilities progressively unlock. The programmed tutorial is identified by its explicit tag, never by card position.

---

## 9. Event deck and foresight

Newbie normally presents fewer cards than Expert. Cards should feel dealt from a physical deck rather than listed from a database.

**Horizon Scan** allows a company to anticipate relevant future Events. A delayed Event persists and is deliberately brought back rather than silently re-randomised.

---

## 10. Experts, SPOFs, attrition and replacement

Experts are scarce organisational assets, not just bonus points.

Player-facing expert information should show name, location, activity/state, domain strengths and relevant Single Point of Failure information.

SPOF means important capability depends too heavily on one person or a small concentration of people. Affected domains should be visible.

### Replacement experts

When an expert resigns:

- the resignation is shown on the relevant **Expert risk** check, not deferred to an unrelated City risk check;
- the replacement-location decision appears with that resignation;
- a replacement arrives next round with domain score **4** in the departed role's domains;
- the replacement receives a **new employee name** rather than reusing the departed person's name;
- expert names that have been consumed/departed are retained in a company-level retired-name history so later replacements cannot accidentally duplicate them;
- the replacement prompt identifies both people and the old base, for example: `New Employee is replacing Old Employee in MEL. Do you want to move this role to a new city?`;
- the city dropdown defaults to the role's existing city;
- each city option shows the relevant local domain score(s), giving the player enough context to decide whether relocation makes sense;
- leaving the default selected keeps the role in the same city; choosing another city updates the replacement base.

Replacement location is a strategic placement decision, not a separate Action.

---

## 11. Geography and company board

The playable company is represented geographically across Australia. Operating sites include Melbourne, Sydney, Brisbane, Perth, Adelaide and Darwin. Hobart/Tasmania remains visible as geographic reference where appropriate.

Each site can display local turnover beneath its city name. Expert presence and site context should remain legible without turning the map into a dashboard.

Corporate HQ is represented separately as organisational/corporate knowledge context.

---

## 12. Money, Actions and trade-offs

Turnover represents business performance and gives consequences a common economic language.

Events expose turnover to loss or gain. Investments may reduce turnover now to improve later capability and resilience.

Where useful, Event exposure should be shown as both an amount and a percentage of relevant turnover.

The limited Action pool is intentionally prominent and forces prioritisation between immediate response and long-term capability building.

---

## 13. Final disruption and AAR

The session culminates in a larger disruption that tests the organisational capability built during play.

The game then supports After Action Review rather than merely declaring a winner. The AAR should help players discuss:

1. What was planned?
2. What actually happened?
3. Why was there a difference?
4. What would we do better?

Benchmarking may compare companies using final turnover, Challenge success and pre-final capability. A compact River helps interpret financial outcomes alongside knowledge structure.

---

## 14. Creating, joining and populating games

Game creation and facilitator access are separate concepts.

The Create screen includes game mode, duration, company/action settings and **Max players / company**.

### Population option A — Fill, then create

Start with Company 1. Automatically assign players to it until it reaches Max players / company, then create Company 2 and fill it, then Company 3, and so on. In this mode the fixed Companies field is not used for initial team count.

Example with a maximum of five: C1 receives players 1–5; C2 receives 6–10; and so on.

### Population option B — Balance across configured companies

Create the number of companies selected in the Companies field and assign each auto-joining player to the smallest current team.

Example with three companies: C1 gets players 1 and 4, C2 gets 2 and 5, C3 gets 3.

The Create screen should show small visual examples and an explicit radio-style selection so the consequence is understandable before launch.

### Sharing a newly created game

For the creator, the Round 1 Welcome box displays the game code beneath the title:

`Share this game code with others you wish to join this game. [CODE] (Right click to copy)`

Right-clicking the code copies a complete invitation, not merely the code:

`[Player Name] has invited you to play The Performance Gap game. To get started, open the game at https://performancegapgame.deltaknowledge.net/ then enter your name and the code: [game code]. Have fun!`

This invitation is creator-specific and should not appear as though every joining player created the session.

---

## 15. Facilitator model

Normal game creation does **not** ask for a facilitator passcode.

During a current game, **Clock → Facilitator login** opens a small passcode-only dialog for that session. Successful authentication enters the Facilitator Control Room directly.

The Control Room supports observing team progress, shared timer control, moving players, permitted session settings, breakout/team assignments, and Return to Game.

Returning to the board preserves the player/team identity used before facilitator mode. An authenticated facilitator can reopen the Control Room without repeatedly entering the passcode during that session.

---

## 16. Timer, reset and session flow

The game uses a shared session clock to create decision pressure without intentionally cutting a company off mid-round. Solo launch can start the clock automatically and exposes play/pause controls.

The clock menu also provides compact access to facilitator functions, breakout rooms and reset.

### Reset Game

**Reset Game returns the browser to the initial Create/setup screen.** It does not silently create and join a replacement game.

Reset clears local/session `tpg_` state and relevant cached/service-worker state so the next test begins cleanly, then reloads into the Create tab. A fresh game is created only when the user deliberately launches one from that setup screen.

---

## 17. KM Manual and tutorial guidance

The in-game KM Manual explains both:

- **In the game** — what a feature does in the simulation;
- **In the real world** — the KM principle it represents.

It covers domains, Events, the Knowledge Suite, experts/SPOFs, transfer, training, corporate knowledge, automation, Communities of Practice/external expertise, Horizon Scan, reputation, River, Knowledge Risk, AAR and valuing KM work.

The browser can generate a downloadable PDF from current manual content. A standalone static PDF should only be added after content review and approval.

A short optional video tutorial may be added to the opening flow later. It should be skippable.

---

## 18. Software architecture

The application has three runtime layers.

### Browser frontend

React/TypeScript renders the board and interactions. Primary orchestration is currently in `src/AppBoardV6.tsx`, supported by specialised components for Events, Invest, map, River, Risk, facilitation, AAR and reference material.

The browser handles presentation, tentative state and safe deterministic previews.

### Render-hosted backend

The Node/TypeScript backend runs as the Render web service. `server-v3.ts` exposes HTTP/SSE endpoints and delegates game behaviour through the `src/server/gameService...` chain. The current service routing goes through **`gameServiceV7.ts`**.

The backend validates and applies authoritative game-changing actions.

### Neon PostgreSQL

Neon is persistence, not the browser-facing game server. The Render backend sits between clients and Neon.

Neon stores authoritative snapshots and longitudinal evidence used for AAR and benchmarking.

### Realtime updates

Clients receive shared session updates through SSE/event-stream connections.

Conceptually:

**Player browser ⇄ Render Node/TypeScript backend ⇄ Neon PostgreSQL**

GitHub provides source control and CI.

---

## 19. State and performance architecture

The system distinguishes **tentative UI state**, **predictable deterministic state** and **authoritative shared state**.

### Event selections

Tentative allocations are maintained locally so checks, highlighting, Chance percentages and predictable costs react immediately. Writes are queued to the backend in click order and reconciled to authoritative state.

### Invest actions

Where an Invest action is deterministic, the same rules can be run locally on a cloned session to provide an immediate preview. The unchanged action request still goes to the backend. Writes are serialised and the backend response remains authoritative.

### Random/shared actions

Random outcomes, shared phase transitions and other unsafe-to-predict actions remain backend-authoritative. They receive immediate visual acknowledgement but do not pretend to have completed early.

### Duplicate-write protection

Identical in-flight writes are deduplicated where appropriate to stop impatient double-clicks creating repeated actions.

---

## 20. Core code map

### Application and board
- `src/AppBoardV6.tsx`
- `src/components/AustraliaMap.tsx`
- `src/components/BoardShell.tsx`
- `src/components/BoardToolTabsV1.tsx`
- `src/components/PhaseTrackV1.tsx`

### Events
- `src/components/EventDeckV1.tsx`
- `src/components/EventDecisionCardV4.tsx`
- `src/components/EventDecisionCardPlaytestV1.tsx`
- `src/engine/eventProgressionV5.ts`
- `src/engine/challengeResponseV2.ts`

### Investment and knowledge movement
- `src/components/ActionsPanelV5.tsx`
- `src/components/InvestmentDecisionDockV1.tsx`
- `src/components/RiverDiagramOverlay.tsx`
- `src/engine/investmentActionsV4.ts`
- `src/engine/riverKnowledgeV1.ts`
- `src/engine/optimisticInvestmentV1.ts`

### Risk
- `src/components/AttritionModal.tsx`
- `src/components/RiskRiverDiagram.tsx`
- `src/engine/riskPhaseV4.ts`

### Facilitation/session tools
- `src/components/SharedGameTimerV2.tsx`
- `src/components/FacilitatorLoginModal.tsx`
- `src/components/FacilitatorControlRoomV2.tsx`
- `src/components/BreakoutRoomsOverlay.tsx`
- `src/components/SessionJoinModalV2.tsx`

### Learning/reference
- `src/components/NewbieLearningOverlay.tsx`
- `src/components/NewbieTransferUnlockOverlay.tsx`
- `src/components/KMManualOverlay.tsx`
- `src/components/kmManualContent.ts`

### AAR
- `src/components/AARDebriefView.tsx`
- `src/components/MiniRiverBenchmark.tsx`
- `src/components/CompanyChartsOverlay.tsx`

### Backend
- `server-v3.ts`
- `src/server/gameServiceV2.ts` through `src/server/gameServiceV7.ts`

### Interaction/performance feedback
- `src/components/NetworkActionFeedback.tsx`

---

## 21. Persistence and evidence

The game maintains current session state and captures longitudinal evidence so AAR can distinguish business outcome, decision quality and luck.

Evidence includes strategy choices, turnover over time, capability measures, investment and consultant expenditure, Event exposure, probability at reveal/commitment, expected versus actual successes, and rules/deck/balance version identifiers.

Historical benchmarks should only compare meaningfully compatible runs.

---

## 22. Quality and regression protection

The branch quality workflow is `.github/workflows/new-interface-quality.yml`.

The standard gate includes:

- dependency installation;
- TypeScript/lint checks;
- production build;
- core smoke tests;
- UI-mode smoke tests.

Regression checks protect critical transitions including the Round 1 tutorial and direct Event → Invest flow.

Do not describe a branch as passed until the workflow result has actually been checked.

---

## 23. Deployment model

The repository is hosted in GitHub. Production is a Render web service. Environment configuration, including database and facilitator secrets, is supplied through hosting configuration rather than committed to source control. Neon provides PostgreSQL persistence.

The public custom game address is intended to be:

`https://performancegapgame.deltaknowledge.net/`

TLS/certificate provisioning for that custom domain is managed by Render after DNS verification.

---

## 24. Change rules for future development

Before adding or modifying a feature, check:

1. Does it reinforce the central learning objective rather than merely add functionality?
2. Can a business person understand the decision without knowing KM jargon?
3. Does it preserve board-game simplicity?
4. Is the map still the primary board where appropriate?
5. Is Newbie materially simpler than Expert?
6. Does it preserve the shared-company nature of decisions/resources?
7. Does every click/tap receive immediate acknowledgement?
8. Can predictable work move off the critical interaction path without altering rules?
9. Is the backend still authoritative for shared/random/irreversible outcomes?
10. Does the feature avoid unnecessary panels, dashboards and tiny text?
11. Does it remain usable on ordinary laptops and touch devices?
12. Does it preserve cross-browser behaviour, including Safari/iOS considerations?
13. Are new rules implemented in the engine rather than independently duplicated in presentation code?
14. Are important gameplay regressions covered by smoke tests?
15. Has the quality workflow passed before the change is treated as complete?
16. If the conceptual game, architecture or enduring design rules changed, was this file updated in the same work?

---

## 25. What this file is for

This document should outlive individual branches and implementation conversations.

It is not intended to duplicate every constant or line of source code. Source code remains authoritative for exact current constants. This file is authoritative for **intent, concepts, player experience, architecture boundaries and enduring design constraints**.

When the game deliberately evolves, update this document as part of the same feature work so later development does not accidentally reintroduce superseded designs.
