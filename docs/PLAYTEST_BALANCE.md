# Playtest balance notes

This file records intentionally provisional mechanics that should be revisited as structured playtesting produces evidence.

## Site workforce knowledge loss — provisional rule

**Status:** active playtest rule; tune after observing several complete games.

During the Knowledge Risk phase, two active city offices are selected at random. For each selected office, the game identifies domains where Team Capability is higher than Local Codified Knowledge. One vulnerable domain is selected for the test.

The risk is based on the **uncodified knowledge gap**:

`gap = Team Capability - Local Codified Knowledge`

Roll a d12. The site loses 1 Team Capability in that domain when:

`d12 roll <= gap`

Examples:

| Team | Codified | Gap | Knowledge-loss chance |
| ---: | ---: | ---: | ---: |
| 4 | 4 | 0 | No exposure / no loss |
| 4 | 3 | 1 | 1/12 = 8.3% |
| 4 | 2 | 2 | 2/12 = 16.7% |
| 5 | 2 | 3 | 3/12 = 25.0% |
| 6 | 2 | 4 | 4/12 = 33.3% |

### Design intent

The mechanic is meant to represent routine employee turnover without implying that every departure destroys organisational capability. Knowledge loss becomes more likely when a site relies heavily on uncodified team know-how, and codification directly reduces that exposure.

This should make the KM lesson visible to players: **staff turnover is normal; losing important knowledge because it only existed in people's heads is manageable risk.**

### What to watch in playtesting

Track whether:

- site knowledge loss happens often enough to matter but not so often that it feels inevitable;
- players understand that codification reduces probability rather than preventing staff turnover itself;
- a one-point gap feels meaningfully safer than a three- or four-point gap;
- Codify Site Knowledge becomes useful without becoming an automatic dominant strategy;
- two site checks per round creates the right amount of pressure over a five-round game.

If losses are still too frequent, possible tuning levers are fewer site checks, a larger die, or requiring `roll < gap` rather than `roll <= gap`. If losses become too rare, use a smaller die or add a small baseline turnover risk.
