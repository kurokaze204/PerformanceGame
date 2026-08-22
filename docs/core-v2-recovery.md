# Core V2 recovery branch

This branch isolates the repaired state engine from the current presentation layer. It is intentionally a draft until TypeScript/build checks and a full five-round playtest pass.

## Core invariants

- Server phase is authoritative.
- Events resolve one card at a time.
- Every company receives an equal final mix of problems and opportunities; late-session balancing corrects skew.
- Local knowledge uses MAX(Team, Local Codified, Usable Intranet), where Usable Intranet = MIN(Intranet, Team + 2).
- An expert can be committed to one event per round; local deployment from another location incurs travel cost.
- CoP support requires at least two current-round company participants.
- Horizon Scan applies once in the following round and redraws the same event type.
- Consultants rent temporary knowledge only. Starting rate is $15k/point and increases 35% after each engagement.
- Risk is resolved when entering the Risk phase, so the Risk screen reports an outcome that has already happened.
- All turnover-changing costs ultimately change site balances so company turnover remains the sum of sites.
- Participant identity is created through the join endpoint.
- Session timer is shared/server-authoritative.
