# Accessibility review — The Performance Gap

## Scope

This is a basic pre-playtest accessibility review, not a formal WCAG conformance audit. It focuses on keyboard and screen-reader use of the current board, Challenge, Invest, Control Panel, Charts, Knowledge Risk, climactic event and AAR experience. The goal at this stage is to remove obvious barriers without materially redesigning the board-game interface.

Basic changes made alongside this review include semantic dialog/region labels on newly touched interfaces, a skip-to-game link, live-region treatment for task messages, labelled form controls, keyboard-native buttons for game/team selection, visible focus through native controls, reduced-motion support, and explicit accessible labels for the compact Single Point of Failure control.

## Screen-reader walkthrough

### Entry and game setup

**Current experience:** Reasonably usable after the current changes. The Create Game controls use labels and native inputs/selects; Newbie/Expert choices are buttons; company selection is now keyboard-operable rather than a clickable visual container. The setup dialog has a name and modal semantics.

**Remaining issue — Medium:** Focus is not trapped inside the modal. A screen-reader or keyboard user can potentially tab into content behind it.

**Suggested fix:** Add a shared accessible modal primitive that traps focus, moves focus to the heading/first control when opened, closes with Escape where appropriate, and restores focus to the invoking control.

**Pros:** Consistent behaviour across all overlays and greatly improved keyboard predictability. **Cons:** Touches many existing overlays and should be regression-tested carefully, so it is better as a dedicated accessibility pass.

### Main board and Australia map

**Current experience:** This is the largest accessibility weakness. The site/Expert information is visually strong but the Australia map communicates location and relationships spatially. A screen reader cannot gain the same mental model from coordinates alone. The right-hand site selector and knowledge panels provide access to much of the underlying numeric information, but not the spatial overview.

**Priority — High.**

**Suggested fix:** Add an optional “Board as list/table” view using the same underlying data: Corporate HQ, then each site with turnover, Team Capability, Local Codified Knowledge and Experts located there. The view should be toggled rather than replacing the map.

**Pros:** Gives screen-reader users equivalent access to the state model and is also useful on small screens. **Cons:** Additional interface to maintain and it risks increasing visual complexity if not hidden behind an accessibility/view toggle.

### Round progress and timer

**Current experience:** The status now uses concise text such as “Complete tasks below” and is exposed as a polite live region. The timer has an accessible timer role/label rather than relying on visual colour.

**Remaining issue — Low/Medium:** Updating the timer’s accessible value every second would be noisy, so the visible seconds are deliberately not an assertive live region. Users need to move focus to it to query exact time.

**Suggested fix:** Keep the quiet timer, but announce threshold changes such as “10 minutes remaining — final window entered” and “5 minutes remaining”.

**Pros:** Useful without screen-reader chatter. **Cons:** Requires a small threshold-announcement state machine.

### Challenge cards

**Current experience:** Most controls are native buttons/selectors with text labels. Knowledge mechanisms are named, and results include textual SUCCESS/FAIL rather than colour alone.

**Remaining issue — High:** The visual connector line between a selected Knowledge Suite option and its detail box has no semantic equivalent. A screen-reader user can still hear the selected option and details, but the relationship is not explicitly announced.

**Suggested fix:** Add `aria-describedby` from each Knowledge Suite button to the active detail region, and announce the currently selected mechanism at the start of that region.

**Pros:** Small code change and makes the relationship explicit. **Cons:** Needs careful ID management because Challenge cards remount frequently.

**Remaining issue — Medium:** Resolution animation/spinner is primarily visual.

**Suggested fix:** Add a polite status message: “Resolving challenge”, followed by a single result announcement once the roll completes.

### Invest

**Current experience:** Actions are native buttons, the Action count has a text alternative, and form fields use labels. Newbie mode reduces cognitive load by progressively revealing groups of interventions rather than showing the full system immediately.

**Remaining issue — Medium:** The yellow arrows linking interventions to capabilities are visual. The text “boosts: …” provides the semantic equivalent, which is good, but focus order currently follows DOM columns rather than the conceptual flow a sighted user scans.

**Suggested fix:** Keep current DOM order for now because it is logical enough: capability list, interventions, selected action details. During a later usability test, check whether screen-reader users prefer interventions first followed by details.

**Pros:** No immediate disruptive change required. **Cons:** Spatial and reading order are not identical.

### Experts and Single Point of Failure

**Current experience:** The revised Expert control exposes “Single Point of Failure - [Domain]” as text and includes the same hazard icon used on “What is SPOF?”. The help overlay is labelled as a dialog and the button has an explicit accessible name. Information is not conveyed by red colour alone.

**Remaining issue — Medium:** The SPOF help dialog does not yet trap focus or automatically return focus to the Expert card/help button on close.

**Suggested fix:** Address through the shared modal primitive mentioned above.

### Knowledge Risk

**Current experience:** Risk outcomes are textual and domains are named, so the essential meaning is available without colour.

**Remaining issue — Medium:** Sequential reveal cards may move visual attention automatically without moving screen-reader focus or announcing the next card.

**Suggested fix:** Put focus on each new risk-card heading as it becomes active, or announce the new heading/result via a polite live region.

**Pros:** Makes the staged sequence understandable. **Cons:** Programmatic focus changes can be disorienting if overused; should be tested with NVDA/VoiceOver.

### Charts

**Current experience:** The shared legend controls line visibility and each chart has visible city/site titles. This works visually but SVG line geometry does not communicate useful data to a screen reader.

**Priority — High for equivalent AAR access, but not a blocker for the game because Charts are a supplementary tool.**

**Suggested fix:** Add a “View chart data as table” toggle. Rows should be Round; columns should be the currently enabled factors, with one table per site or a site selector.

**Pros:** Provides exact values, often more useful than a spoken description of a line chart. **Cons:** Adds another AAR surface and needs careful handling of many columns.

### Climactic event and AAR

**Current experience:** Both are predominantly text/card based, which is favourable for screen-reader use. AAR question navigation is button-based and permits linear Next navigation or non-linear switching.

**Remaining issue — Medium:** The AAR uses side-by-side evidence cards. Screen readers naturally linearise these, which is fine, but there is no explicit announcement when the question or evidence lens changes.

**Suggested fix:** Move programmatic focus to the new question heading/lens evidence heading and/or add a polite live announcement.

## Keyboard / TAB-order summary

The revised setup, Control Panel assignment controls, Newbie teaching overlay and Expert/SPOF controls all use native interactive elements and follow DOM order. A skip-to-game link has been added for repeated navigation.

The biggest keyboard risks are existing complex overlays that lack focus trapping and any map elements implemented as non-native interactive SVG/containers. These should be checked manually with keyboard-only play before public testing.

## Colour, contrast and non-colour cues

The game generally pairs colour with text (SUCCESS/FAIL, domain names, SPOF text), which is good. Some small slate/grey explanatory text may fall below ideal contrast at very small font sizes, particularly `text-slate-500` on dark backgrounds. This should be measured in a formal pass.

**Priority — Medium.** Prefer increasing contrast before increasing font size if compact layout is important.

## Motion

A `prefers-reduced-motion` rule has been added to suppress most animation/transitions for users who request reduced motion. Confetti may still need an explicit runtime check because canvas animation is not guaranteed to be covered by CSS.

**Priority — Low/Medium.** Suggested fix: skip confetti when `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.

## Recommended next accessibility pass

1. **High:** Add a structured non-map Board view.
2. **High:** Add chart data tables for AAR equivalence.
3. **High/Medium:** Introduce one reusable accessible modal/focus-management component and migrate overlays incrementally.
4. **Medium:** Add semantic relationships/live announcements to Challenge selection and resolution.
5. **Medium:** Test complete keyboard flow with no mouse: setup → strategy → challenge → invest → risk → next round → climactic event → AAR.
6. **Medium:** Test with NVDA + Chrome/Edge on Windows, then VoiceOver + Safari if Mac/iOS support matters.
7. **Medium:** Run automated axe/Lighthouse checks, but treat them as a supplement to the manual screen-reader test, not as proof of accessibility.

## Overall assessment

A screen-reader user can now operate substantially more of the administrative and decision UI than before, and the underlying text model is strong enough to make the simulation accessible in principle. The **main board map and Charts remain the two areas where visual users receive information that is not yet fully equivalent in non-visual form**. Those are the highest-value future fixes. A public claim of WCAG conformance would be premature until those views, modal focus management and manual assistive-technology testing are completed.
