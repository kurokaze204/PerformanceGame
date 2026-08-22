# The Performance Gap — Simulation Platform

**The Performance Gap** is an interactive, multiplayer strategic simulation platform exploring organizational knowledge, deep expertise, absorptive capacity, single points of failure (SPOF), relational knowledge networks (Communities of Practice), and enterprise resilience.

---

## 🌟 Core Simulation Concepts & Mechanics

1. **6 Operating Sites & Geographic Map**:
   - Melbourne, Sydney, Brisbane, Perth, Adelaide, and Darwin.
   - Each site maintains localized **Team Capability** (determines operational absorptive capacity) and **Local Codified Knowledge** (survives employee turnover).
2. **Deep Experts & Single Point of Failure (SPOF)**:
   - Deep Experts possess high individual expertise (score 4–6).
   - If an expert's score exceeds site capability by $\ge 3$, they become a **SPOF** with heightened attrition vulnerability ($d12 \le 2$).
3. **Corporate Headquarters & Intranet**:
   - Enterprise knowledge repository accessible by all sites up to their local absorptive capacity limit ($\text{Team Capability} + 2$).
   - Experts stationed at HQ boost corporate codification up to $+2$ per round.
4. **Relational Knowledge & Communities of Practice (CoP)**:
   - Inter-organizational knowledge exchange across the 5 domains (Engineering, HR, Marketing, Operations, Finance).
   - Becomes active when $\ge 2$ companies maintain participating experts.
5. **Dynamic 5-Phase Round Engine**:
   - **Phase 1 (Draw)**: Receive local operational problems and market opportunities.
   - **Phase 2 (Respond & Resolve)**: Allocate deep experts, CoP assistance, and evaluate success probabilities with 2d6 event dice rolls.
   - **Phase 3 (Consequences & Learning)**: Apply financial turnover impact and convert successful opportunities into experiential learning.
   - **Phase 4 (Knowledge Investment)**: Spend 4 strategic actions across *Develop*, *Capture*, *Connect*, *Embed*, and *Diagnose*.
   - **Phase 5 (Attrition & Solvency)**: d12 expert resignation checks, workforce turnover, and site solvency evaluations.
6. **Round 6 Final Disruption**:
   - Macro shock testing accumulated corporate capability, automation, and organizational resilience.
7. **Facilitator Command & AI Executive Debrief**:
   - Comprehensive dashboard with full session overrides, event logs, 17 facilitation questions, and AI-powered AAR executive summaries via the Gemini API.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ or 20+
- npm or yarn

### Installation
```bash
npm install
```

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your `GEMINI_API_KEY` (for AI debriefs) and optional `DATABASE_URL` for PostgreSQL persistence (defaults to fast in-memory storage if omitted).

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
```bash
npm run build
npm start
```

---

## 🏛️ Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons + Canvas Confetti
- **Backend Server**: Express custom server running on Node.js / `dist/server.cjs`
- **Real-Time Concurrency**: Server-Sent Events (SSE) streaming state updates across all connected cohort participants
- **AI Integration**: Google Gemini API (`@google/genai`) for real-time strategic debrief generation
- **Persistence Layer**: Dual-mode PostgreSQL with atomic transactions and seamless In-Memory fallback
