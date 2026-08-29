# After Action Review phase — design and playtest notes

## Purpose

The AAR is where the simulation becomes transferable learning. It is not a score screen and not a lecture about Knowledge Management. The interface should help a group reconstruct intent, compare it with evidence, explain differences without blame, and identify one useful real-world change.

The four canonical questions are retained exactly:

1. What did you plan to happen?
2. What actually happened?
3. Why was it different?
4. What would you improve next time (in real life)?

The default visual path is linear for first-time users, but all four question tabs remain clickable so experienced groups can move naturally between questions. Component lenses let a group run the same four questions against a single Expert, site, Challenge or knowledge mechanism and then zoom back out.

## Why the previous charts are not the primary AAR interface

The trend charts remain available as an evidence tool, but multiple measures on the same chart can obscure causality and encourage superficial pattern matching. The AAR therefore foregrounds discrete evidence cards with an explicit relationship to decisions:

- strategy selected at the start;
- Challenge outcome, committed probability, financial exposure and intervention cost;
- start-to-finish knowledge capability changes;
- current Expert/SPOF position;
- site capability and turnover;
- automation, CoP and corporate knowledge position;
- knowledge and consultant expenditure.

Charts are deliberately one click away rather than removed.

## Psychological safety / first-time AAR design

The interface consistently frames the exercise as learning rather than judgement:

- review successes as well as failures;
- describe evidence before interpretation;
- discuss decisions, constraints, information and timing rather than blame;
- allow people to pass on a question;
- recommend 20–30 seconds of silent thinking before discussion;
- label generated explanations as hypotheses to test, never conclusions;
- ask for evidence and alternative explanations.

This is especially important for participants who are not accustomed to discussing failure publicly.

## Learning-objective mapping

### Corporate knowledge as a visible resource

The AAR separates Experts, local Team Capability, Local Codified Knowledge, Corporate Knowledge, networks and automation so participants can reconstruct the organisation as a portfolio of knowledge forms rather than a single score.

### Knowledge limitations can be managed

The evidence lenses show that capability can be developed, transferred, codified, networked, embedded or purchased. The improvement screen translates these game mechanisms into general management choices.

### Knowledge risk has a real price

Expert vacancies/SPOF exposure, site outcomes, Challenge exposure and intervention costs are presented alongside turnover rather than as abstract KM measures.

### Confidence for KM and L&D practitioners

The interface gives participants a small vocabulary and a repeatable four-question debrief structure they can explain to others without specialist theory.

## Archetype walkthrough

### CEO — non-gamer: “What is the point?”

Risk: sees KM mechanics as detail and wants the business consequence.

Design response:
- AAR begins with original business and knowledge strategy.
- Whole-company evidence leads with turnover, Challenge success, knowledge investment and net Challenge impact.
- The final question explicitly asks for a real-world change, not a better game tactic.

Expected takeaway: knowledge choices alter business resilience and operating options; the objective is not “more knowledge” but appropriate capability at acceptable cost.

### CIO — “Where is the technology, and is this game well built?”

Risk: interprets knowledge as technology or judges the product architecture rather than the management model.

Design response:
- Networks & technology is a first-class lens.
- Automation and corporate knowledge are shown as powerful but bounded mechanisms.
- The AAR explicitly states that technology stores/distributes/embeds knowledge but does not automatically create local judgement or absorptive capacity.

Expected takeaway: technology is part of the knowledge architecture, not the whole architecture.

### Experienced Knowledge Manager

Risk: simplification feels naive or doctrinaire.

Design response:
- AAR does not prescribe one “correct” knowledge strategy.
- Explanations are framed as hypotheses requiring evidence.
- The interface distinguishes access, local capability, codification, expertise, networks and automation.
- Component lenses support non-linear discussion rather than forcing a training-script sequence.

Expected takeaway: a deliberately simplified but internally coherent model that can be used to explain KM trade-offs to managers.

### Beginner KMer / practitioner who knows only one technique

Risk: anchors on the familiar method (for example documentation, training or CoPs).

Design response:
- Six evidence lenses make alternative mechanisms visible.
- The improvement screen presents a small repertoire: visibility, backup capability, deliberate learning, access plus capability, networks, and selective embedding.

Expected takeaway: no single KM method solves every knowledge limitation.

### Change Manager

Risk: wants behaviour, adoption and conditions rather than asset scores.

Design response:
- “Why was it different?” asks about information, constraints, timing and decisions.
- Usable corporate knowledge exposes the difference between publishing something and creating capacity to use it.

Expected takeaway: knowledge interventions change the conditions in which people act; access without uptake/capability is insufficient.

### L&D Manager / Learning Design Architect

Risk: sees training as the default answer.

Design response:
- Team capability is visible but sits alongside codification, expertise, network and automation.
- AAR itself models reflection as an intervention that converts experience into future capability.

Expected takeaway: training is one mechanism in a wider capability system; learning can be designed into work and reflection.

### Operations person

Risk: asks for the process takeaway and may disengage from conceptual language.

Design response:
- Challenge cards in the AAR show outcome, probability, exposure and intervention cost.
- Component lenses encourage tracing one event or site through the four questions.
- Real-world commitments are phrased as concrete management practices.

Expected takeaway: identify critical knowledge, know where it is, protect/transfer/codify it appropriately, and review significant work deliberately.

### Introverted legal professional nervous about public interaction

Risk: psychologically unsafe discussion produces compliance or silence rather than learning.

Design response:
- explicit no-blame rule;
- permission to pass;
- silent thinking cue before discussion;
- evidence cards provide something concrete to react to rather than requiring immediate self-disclosure;
- generated prompts focus on system conditions, not people.

Expected takeaway: participation can begin with observation and evidence; disagreement does not require personal exposure.

## Current analytics constraint

The repository contains the analytics schema and AAR endpoint but not the runtime PostgreSQL data from recent playtests. Historical test-run values therefore cannot be inspected through the GitHub connector alone. The deployed AAR fetches the full current-session event and metric history from `/api/sessions/:id/aar` when `DATABASE_URL` is configured. If the analytics database is unavailable, the AAR degrades to end-state evidence from the current session and says so explicitly.

When the simulation is hosted for the inner test group, review the accumulated analytics after several complete games and tune:

- probability calibration versus actual outcomes;
- intervention cost/value balance;
- frequency and consequence of Expert/SPOF loss;
- whether CoP and automation benefits are noticed and used;
- whether the final disruption discriminates meaningfully between different knowledge strategies;
- AAR evidence cards that participants actually use versus ignore.
