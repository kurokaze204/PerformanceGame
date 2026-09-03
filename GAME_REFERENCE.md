# The Performance Gap — Game Reference

**Status:** Living design, gameplay and architecture reference  
**Purpose:** This file is the authoritative human-readable reference for what The Performance Gap is, why it exists, how it should feel to play, how the game works, and how the software is structured. Future feature work should be checked against this document before implementation.

---

## 1. What the game is

**The Performance Gap** is a strategic business simulation about organisational knowledge, expertise, resilience and performance.

It is designed for business people rather than Knowledge Management specialists. Players run a company that must respond to operational and strategic Events while deliberately deciding how to use, move, protect and strengthen knowledge across the organisation.

The simulation is intended to make invisible knowledge dynamics visible enough to discuss. It should help players experience the difference between:

- having information and having usable capability;
- knowing that expertise exists and being able to deploy it;
- relying on a few individuals and building organisational resilience;
- reacting to problems and investing before problems occur;
- local knowledge and reusable corporate knowledge;
- temporary outside help and enduring internal capability;
- knowledge that exists somewhere and knowledge that is available at the right place and time.

The game should feel like a **business simulation with board-game clarity**, not a KM training application or an enterprise dashboard.

---

## 2. Core learning objective

The central idea is:

> Knowledge Management is not primarily about doing the organisation's knowledge work. It is about managing the conditions, infrastructure and flows that allow knowledge and expertise to create the greatest possible organisational impact.

The simulation should encourage players to think about how an organisation can:

1. **see its expertise and capability**;
2. **make knowledge available where work occurs**;
3. **protect scarce and vulnerable expertise**;
4. **move knowledge between people and locations**;
5. **turn individual expertise into broader organisational capability**;
6. **use codification, networks and automation appropriately**;
7. **anticipate knowledge risk before disruption exposes it**;
8. **balance short-term performance with long-term resilience**.

The game should not tell players that there is one correct KM strategy. It should create consequences that make different strategies discussable.

---

## 3. Intended audience and play style

Primary audience:

- executives and senior managers;
- operational and functional leaders;
- business professionals with little or no formal KM background;
- KM Week and conference participants;
- facilitated organisational learning groups.

The design supports:

- one-company solo play;
- multiple players collaborating as one company;
- multiple companies playing in parallel;
- facilitator-led sessions;
- local or remote participation.

The player interface should be simple enough to approach with roughly the cognitive overhead of a mainstream board game such as Monopoly. Complexity should emerge from decisions and consequences, not from navigating the software.

---

## 4. Player-experience design principles

These are enduring product rules.

### 4.1 The map is the primary board

The Australian company map is the player's main spatial reference. Sites, experts, turnover and organisational context should remain understandable from the board wherever practical.

### 4.2 Newbie and Expert are genuinely different experiences

**Newbie** progressively reveals concepts and reduces initial cognitive load. It may hide advanced concepts such as Finance and Local Codified Knowledge until appropriate.

**Expert** exposes the fuller model from the beginning and assumes players can tolerate more simultaneous choices and tighter action constraints.

### 4.3 Business language first

Player-facing wording should describe the business decision before the KM mechanism. Avoid unnecessary KM jargon, technical labels and software terminology.

### 4.4 Decisions should be visually obvious

Selection language is deliberately simple:

- empty circle = available;
- circled tick = selected;
- category tick = something inside that category has been selected.

### 4.5 The game should remain playable on ordinary laptops

Layouts should fit common laptop screens at normal browser zoom. The board should preserve its geometry and important content such as Tasmania and the phase indicator should not disappear below the viewport.

### 4.6 Immediate acknowledgement of user input is mandatory

**This is a design goal for every future feature.**

A player must never be left wondering whether a click or tap was received.

When the result can be predicted safely, use **optimistic UI**:

1. acknowledge the click immediately;
2. update the local visual state immediately;
3. calculate local deterministic implications immediately where practical;
4. send the authoritative write to the backend asynchronously;
5. reconcile to the backend response when it arrives;
6. roll back or explain only if the backend rejects the action.

Examples include tentative Event allocations and deterministic Invest actions.

When an action **cannot** be predicted safely because it is random, shared, irreversible or server-authoritative, do not fake completion. Instead:

- visibly depress/highlight the control immediately;
- disable or protect against duplicate submissions where appropriate;
- show a working/progress cursor or concise status such as **Working…**, **Resolving…** or **Saving…**;
- complete the visible state transition only when the authoritative response arrives.

Examples include resolving an Event, advancing a phase, Knowledge Risk resolution, Final Disruption resolution and facilitator commands.

**Performance work must change routing and timing, not game rules or user-visible meaning.**

### 4.7 Server authority remains intact

Optimistic presentation must never create a second set of game rules. The browser may predict deterministic outcomes for responsiveness, but the backend remains the final authority for shared game state.

### 4.8 Avoid accidental complexity

Do not add dashboards, persistent panels, extra navigation levels or technical status indicators unless they materially help the player's decision.

---

## 5. Knowledge model

The company operates across five knowledge domains:

- Engineering
- HR
- Marketing
- Operations
- Finance

Newbie mode may hide Finance from player-facing decisions. Finance remains part of the underlying model where required.

Knowledge exists through several mechanisms.

### Team Capability

What a local team can actually do. This is usable local capability, not merely stored information.

### Local Codified Knowledge

Reusable knowledge captured locally in documents or other explicit forms. This is more visible in Expert mode and may be hidden in Newbie mode to reduce cognitive load.

### Corporate Intranet

Knowledge made available corporately. Its value depends on whether the receiving site can actually make use of it; availability and absorptive capability are not treated as identical.

### Experts

Individuals holding deep knowledge in one or more domains. Experts have location, availability/activity state, domain strength and potential Single Point of Failure status.

### Communities of Practice / Network knowledge

Temporary access to useful knowledge outside the immediate local team through active expert networks.

### Automation

Knowledge embedded into systems and processes so capability does not depend solely on a person remembering or being available.

### External expertise

Temporary purchased capability. It can solve an immediate problem but does not automatically create enduring organisational knowledge.

### Reputation / favours

A scarce mechanism for drawing on relationships to guarantee or materially support a Challenge response.

---

## 6. The River Diagram

The **River** is the game's visual model for how knowledge capability is distributed across the company.

Its purpose is to help players see that the organisation does not possess one uniform knowledge level. Different sites have different strengths, experts are distributed unevenly, and knowledge can be moved or converted into broader capability.

The River should help players identify:

- strong and weak sites by domain;
- where useful expertise is located;
- where capability gaps exist;
- where knowledge transfer may create value;
- where expertise is concentrated in a small number of people;
- whether organisational capability is becoming more resilient over time.

The full River includes site and expert context and may support transfer decisions. A simplified River is also used in AAR/benchmark comparisons.

When explaining the River in the KM Manual or other player guidance, use a labelled visual example rather than relying on prose alone.

---

## 7. Core game loop

The principal round loop is:

**Events → Invest → Knowledge Risk → next round**

A phase tracker at the bottom of the board uses the game pawn to make current progression visible.

### Events

The company receives business Events representing problems or opportunities. Players decide what knowledge to bring to the situation.

Typical response choices are:

1. **Use what we already know**
2. **Ask one of our experts to help**
3. **Ask our network for help**
4. **Call in a favour**
5. **Engage external expertise**
6. **Accept the risk**

The Event card shows the financial exposure, relevant knowledge domain(s), available knowledge and resulting chance of success.

At 100% probability, the presentation should use plain language rather than making the player perform a meaningless roll.

Otherwise the player sees a transparent relationship between **Chance** and **Roll**.

### Invest

After Events, the company gets a limited shared pool of company actions. These are not individual-player action allowances: multiple players acting for the same company consume the same company pool.

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

Investment decisions consume company actions and may also consume turnover. Costs and availability are defined by the engine and configuration, not by the presentation layer.

### Knowledge Risk

The game then tests vulnerability in people and sites. This makes invisible concentration risk visible and creates consequences for fragile knowledge structures.

The Risk River can visually show site capability loss, expert departure and later expert replacement.

When an expert vacancy is created, the company may choose where the replacement expert will be based. Replacement capability is deliberately not identical to the departed expert's accumulated experience.

---

## 8. Newbie learning path

Newbie mode deliberately teaches concepts through play rather than presenting a large tutorial.

The first round contains a programmed learning failure presented as a credible business problem. The player initially has a restricted response set, including existing local capability and Corporate Intranet, so the failure establishes why merely having knowledge somewhere in the company is insufficient.

After the learning Event, the game introduces two distinct transfer mechanisms:

- **Knowledge Transfer** — direct site-to-site sharing of proven know-how;
- **Local Training** — an expert coaches a local team.

Additional capabilities are progressively unlocked over later rounds.

This progression must remain a learning scaffold rather than an artificial punishment. Underlying mechanics and display logic should continue to identify the programmed tutorial by its explicit tag, not by card position.

---

## 9. Event deck and foresight

Newbie normally presents fewer cards than Expert.

The deck is visually represented as physical cards beside the board. Dealt cards should feel like they came from a deck rather than a database list.

**Horizon Scan** allows a company to anticipate knowledge risk by revealing/delaying relevant future Events. Delayed cards persist and are brought forward deliberately rather than silently re-randomised.

---

## 10. Experts and SPOF risk

Experts are scarce organisational assets, not just bonus points.

Player-facing expert information should show:

- name;
- location;
- current activity/state;
- domain strengths;
- relevant Single Point of Failure information.

SPOF means that important organisational capability is too dependent on a particular person or small concentration of people. The game should make the affected domains visible and explain the term compactly when necessary.

Expert activity states include availability and work such as supporting Events, travelling, training, knowledge transfer, expertise capture, CoP participation and HQ assignment.

---

## 11. Geography and company board

The playable company is represented geographically across Australia. Current operating-site locations include Melbourne, Sydney, Brisbane, Perth, Adelaide and Darwin, with Hobart/Tasmania retained as geographic reference where appropriate.

Each site can display local turnover directly beneath its city name. Expert presence and site context should remain legible without turning the map into a dashboard.

Corporate HQ is represented separately as an organisational knowledge context rather than just another production site.

---

## 12. Money, actions and trade-offs

Turnover represents business performance and provides a common economic language for consequences.

Events expose turnover to loss or gain. Investments may reduce turnover now in order to improve future capability and resilience.

Where useful, the game should show Event loss/gain as both an amount and a percentage of the relevant site's or company's turnover so players can judge whether accepting risk is rational.

The limited action pool is intentionally prominent. Actions are a shared company resource and force prioritisation between short-term fixes and long-term capability building.

---

## 13. Final disruption and AAR

The session culminates in a larger disruption that tests the organisational capability built during play.

The game then supports After Action Review rather than simply declaring a winner.

The AAR should help players discuss:

1. What was planned?
2. What actually happened?
3. Why was there a difference?
4. What would we do better?

Benchmarking may compare companies using measures such as final turnover, Challenge success rate and pre-final capability. The visual benchmark includes a compact River for each company so financial outcomes can be interpreted alongside knowledge structure.

The conclusion includes a short invitation to continue learning about KM and DeltaKnowledge rather than abruptly clearing the session.

---

## 14. Facilitator model

Creating a game and becoming a facilitator are intentionally separate actions.

Normal game creation should not ask for a facilitator passcode.

During a current game:

**Clock → Facilitator login** opens a small passcode-only login for that current session. After successful authentication the facilitator enters the Facilitator Control Room directly.

The Control Room supports functions such as:

- observing team progress;
- managing the shared timer;
- moving players between companies;
- adjusting permitted session settings;
- viewing breakout/team assignments;
- returning to the game board.

Returning to the board should preserve the participant/player identity that was in use before facilitator mode. An authenticated facilitator can reopen the Control Room without re-entering the passcode during that session.

---

## 15. Timer and session flow

The game uses a shared session clock. Timing is intended to create decision pressure without cutting off a company in the middle of a round.

Solo launch can start the clock automatically. Solo play also exposes play/pause controls.

The clock menu is also a compact access point for session-level functions such as facilitator access, breakout rooms and reset.

Reset for playtesting is a hard reset: a genuinely fresh session is created and cached/local game state is cleared so test results are not contaminated by prior state.

---

## 16. KM Manual and tutorial guidance

The in-game KM Manual explains both:

- **In the game** — what a feature does in the simulation;
- **In the real world** — the KM principle it represents.

The manual covers domains, Events, the Knowledge Suite, experts/SPOFs, transfer, training, corporate knowledge, automation, Communities of Practice/external knowledge, Horizon Scan, reputation, the River, Knowledge Risk, AAR and valuing KM work.

The browser can generate a downloadable PDF version from the manual content. A standalone static PDF should only be added when the content has been reviewed and approved.

A short optional video tutorial may be added to the opening flow later. It should be skippable and should not block experienced players from starting.

---

## 17. Software architecture

The application uses three main runtime layers.

### Browser frontend

A React/TypeScript application renders the board and player interactions.

Primary orchestration currently lives in `src/AppBoardV6.tsx`, supported by specialised components for Events, Invest, the map, River, Risk, facilitator tools, AAR and reference material.

The browser handles presentation, temporary interaction state and safe deterministic previews.

### Render-hosted backend

The Node/TypeScript backend runs as the Render web service. `server-v3.ts` exposes HTTP/SSE endpoints and delegates game behaviour to the server service/engine modules.

The backend is the authoritative source for shared game state and is responsible for validating and applying game-changing actions.

### Neon PostgreSQL

Neon is the persistence/database layer. The browser should not treat Neon as the game server. The Render backend sits between clients and persistence.

Neon stores authoritative snapshots and longitudinal evidence used for AAR and benchmarking.

### Realtime updates

Clients receive session updates through the server's event stream/SSE path so multiple players can see shared company/session changes.

---

## 18. State and performance architecture

The system deliberately distinguishes **tentative UI state**, **predictable deterministic state** and **authoritative shared state**.

### Event selections

Tentative allocation selections are maintained locally so checks, highlighting, Chance percentages and predictable costs can react immediately. Writes are then queued to the backend in click order and reconciled when authoritative state returns.

### Invest actions

Where an Invest action is deterministic, the same game engine can be run locally against a cloned session to provide an immediate predicted result. The original action request is still sent to the backend. Server writes are serialised and the backend response remains authoritative.

### Authoritative/random actions

Actions involving random outcomes, shared phase transitions or otherwise unsafe prediction remain backend-authoritative. They receive immediate visual acknowledgement but do not pretend to be complete before confirmation.

### Duplicate-write protection

Identical in-flight writes are deduplicated where appropriate to prevent impatient double-clicking from creating repeated actions.

---

## 19. Core code map

Important current files include:

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

### Risk

- `src/components/AttritionModal.tsx`
- `src/components/RiskRiverDiagram.tsx`
- `src/engine/riskPhaseV4.ts`

### Facilitation and session tools

- `src/components/SharedGameTimerV2.tsx`
- `src/components/FacilitatorLoginModal.tsx`
- `src/components/FacilitatorControlRoomV2.tsx`
- `src/components/BreakoutRoomsOverlay.tsx`

### Learning and reference

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
- `src/server/gameServiceV2.ts` through the current service version

### Performance feedback

- `src/components/NetworkActionFeedback.tsx`
- `src/engine/optimisticInvestmentV1.ts`

---

## 20. Persistence and evidence

The game maintains current session state and captures longitudinal evidence so the AAR can distinguish business outcome, decision quality and luck.

Evidence includes items such as:

- initial and final strategy choices;
- turnover over time;
- Team Capability and corporate capability measures;
- investment and consultant expenditure;
- Event exposure;
- probability at reveal and commitment;
- expected versus actual successes;
- rules/deck/balance version identifiers.

Historical benchmarks should only compare runs that are meaningfully compatible.

---

## 21. Quality and regression protection

The branch quality workflow is `.github/workflows/new-interface-quality.yml`.

The standard quality gate includes:

- dependency installation;
- TypeScript/lint checks;
- production build;
- core smoke tests;
- UI-mode smoke tests.

Regression checks exist for critical gameplay transitions such as the Round 1 tutorial and direct transition from completed Events into Invest.

Do not declare a branch safe because code compiles locally. The workflow result should be checked before describing a change as passed.

---

## 22. Deployment model

The repository is hosted in GitHub.

The production application is deployed as a Render web service. Environment configuration, including database and facilitator secrets, is supplied through the hosting environment rather than committed to source control.

Neon provides PostgreSQL persistence.

The deployed architecture is therefore conceptually:

**Player browser ⇄ Render Node/TypeScript backend ⇄ Neon PostgreSQL**

with GitHub as source control and CI.

---

## 23. Change rules for future development

Before adding or modifying a feature, check the following:

1. Does it reinforce the central learning objective rather than merely add functionality?
2. Can a business person understand the decision without knowing KM jargon?
3. Does it preserve the board-game simplicity of the interface?
4. Is the map still the primary board where appropriate?
5. Is Newbie kept materially simpler than Expert?
6. Does it preserve the shared-company nature of decisions and resources?
7. Does every click/tap receive immediate acknowledgement?
8. Can predictable work be moved off the critical interaction path without altering the rules?
9. Is the backend still authoritative for shared/random/irreversible outcomes?
10. Does the feature avoid unnecessary panels, dashboards or tiny text?
11. Does it remain usable on ordinary laptop screens and touch devices?
12. Does it preserve cross-browser behaviour, including Safari/iOS considerations?
13. Are new rules implemented in the engine rather than duplicated in presentation code?
14. Are important gameplay regressions covered by smoke tests?
15. Has the quality workflow passed before the change is treated as complete?
16. If the feature changes the conceptual game, architecture or enduring design rules, has this file been updated as part of the same change?

---

## 24. What this file is for

This document should outlive individual branches and implementation conversations.

It is not intended to duplicate every line of configuration or source code. The source code remains authoritative for exact current constants. This file is authoritative for **intent, concepts, player experience, architecture boundaries and design constraints**.

When code and this document diverge because the game has deliberately evolved, update this document as part of the feature work so future development does not accidentally reintroduce superseded designs.
