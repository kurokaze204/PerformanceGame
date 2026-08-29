# Escalating stakes model — playtest controls

This branch deliberately changes the economic arc of The Performance Gap before detailed balancing begins. The intended player experience is:

1. **Low-risk learning:** early cards are cheap, simple and forgiving enough for a first-time player to understand the response mechanics.
2. **Material decisions:** subsequent moves become large enough that intervention cost, knowledge gaps and site-level exposure matter.
3. **High-stakes capability pressure:** later cards can represent a substantial share of site/company turnover, making earlier capability-building decisions visibly consequential.

## Programmed opening failure — knowledge exists, but is not accessible

The first Challenge is deliberately engineered as a **productive failure** and applies in both Newbie and Expert/full-game mode. It is a low-cost local problem rather than a serious financial punishment.

At game creation the engine looks across the company's actual starting knowledge and finds a domain where one operating site has materially stronger Team/Codified knowledge than another. The first Challenge is assigned to the weaker site in that domain. The stronger site is retained as the contrast case for the teaching moment.

During this opening Challenge the player can inspect and use knowledge already accessible at the affected site, but the usual rescue routes are deliberately withheld. The Corporate Intranet has not yet been introduced as an intervention; Expert deployment, network support, external consultants, favours and Horizon redraw are also prevented from bypassing the lesson. The Challenge is configured to fail so the instructional sequence is reliable rather than dependent on a lucky roll.

When the Challenge phase finishes and Invest opens, the game explicitly reveals the counterfactual: **the organisation already knew more than the affected site could access**. It names the stronger site, the affected site, the relevant knowledge domain and their approximate scores. The player is then introduced to the Corporate Intranet as a mechanism for turning isolated local knowledge into reusable organisational capability. Clicking **OPEN THE CORPORATE INTRANET** immediately exposes and selects the Update Corporate Intranet intervention.

The learning objective is the distinction between **knowledge possession** and **knowledge accessibility**. The game should leave the player thinking, “We did not fail because nobody knew; we failed because the knowledge was in the wrong place when the decision was made.” The follow-up explanation also preserves the absorptive-capacity idea: publication does not make every local team expert, but it makes stronger organisational knowledge reachable and reusable.

This is intentionally designed rather than random. During playtesting watch for two risks: players may perceive the forced loss as unfair if the post-failure explanation is not immediate and convincing, or they may interpret the Intranet as a magic universal solution rather than one part of a wider knowledge system. Keep the initial financial loss small and tune the copy/intervention timing before removing the programmed failure itself.

## Starting company

`starting_turnover` is now **$875k**, one quarter of the previous $3.5m. `minimum_site_turnover` is $75k, preserving six viable sites while making local financial exposure meaningful.

## Event value progression

The primary playtest control is:

`event_value_growth_factor = 1.8`

Each successive Challenge move applies another power of this factor. It is intentionally a configuration value rather than hard-coded deck logic so playtests can tune the curve quickly.

The opening Challenge is the programmed knowledge-isolation lesson above. The other early Challenge uses the dedicated low-stakes learning mini-deck. From move 3 the broader deck returns, scaled from a low initial multiplier. From move 5 there is also a strong chance of drawing one of the new high-stakes cards whose wording explicitly matches the magnitude of the exposure.

Related control:

`event_initial_impact_multiplier = 0.12`

This prevents the existing mature deck from starting at its old absolute values before the 1.8 growth curve has had time to operate.

## Difficulty progression

`event_difficulty_growth_per_move = 0.75`

Difficulty rises linearly by move while financial exposure rises exponentially. This is deliberate: knowledge-building must become increasingly important without making later cards mathematically impossible. Tune this separately from financial value.

## Card language

Cards are now visibly tiered as **LEARNING**, **MATERIAL**, **HIGH STAKES** and **CRITICAL**. Eight simple learning cards and eight high-stakes emergency/opportunity cards have been added in the progression layer. Existing deck cards remain available in the middle game.

The new high-stakes wording explicitly connects value to plausible business scale: site shutdown, safety-critical failure, major customer insolvency, national contracts, strategic tenders, distribution partnerships and specialist-team acquisition.

## Initial knowledge diversity

After the existing random generation runs, every site's **Team Capability** and **Local Codified Knowledge** are diversified independently:

- choose one of the highest domains and add **+2**;
- choose one of the lowest domains and subtract **1**;
- minimum score is **0**;
- ties are resolved randomly.

The Corporate Intranet receives the same treatment. This creates recognisable strengths and weaknesses rather than six mostly homogeneous offices.

## Playtest questions

Before changing intervention costs, watch:

- Does the opening failure produce the intended “the knowledge existed, but not where we needed it” insight rather than frustration?
- Does introducing the Intranet immediately afterward make the purpose of corporate knowledge sharing obvious?
- Do players still understand that local capability and absorptive capacity matter after the Intranet is introduced?
- Do the remaining early moves genuinely feel safe enough to experiment?
- At what move do players first say an event is a serious percentage of site/company turnover?
- Does the 1.8 curve become absurd too quickly for fast-playing teams?
- Does difficulty rise quickly enough to create demand for capability-building without making consultants mandatory?
- Do players notice and exploit initial knowledge strengths/weaknesses?
- Are high-value card narratives credible relative to their financial exposure?

These parameters are provisional and should be tuned from completed playtest data rather than treated as final balance values.
