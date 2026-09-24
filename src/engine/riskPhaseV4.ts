import type { Company } from '../types/game.ts';
import type { GameSessionV2, RiskSummaryV2 } from '../types/gameV2.ts';
import { asCompanyV2 } from '../types/gameV2.ts';
import { executeRiskPhaseV2, recalculateCompanySPOFV2 } from './coreV2.ts';

/**
 * Playtest rule: routine site-level workforce knowledge loss uses a simple,
 * visible fixed probability rather than an inferred codification gap.
 *
 *   Newbie: 1 in 12
 *   Expert: 2 in 12
 *
 * The underlying V2 risk phase still chooses the two active sites/domains to
 * test. V4 supplies the authoritative d12 roll and fixed threshold, then
 * restores the site's capability when the roll does not trigger a loss.
 * Expert SPOF risk remains a separate expert-level mechanic.
 */
export function executeRiskPhaseV4(session: GameSessionV2, companyInput: Company): RiskSummaryV2 {
  const company = asCompanyV2(companyInput);
  const summary = executeRiskPhaseV2(session, company);

  for (const check of summary.siteChecks || []) {
    if (!check.knowledgeLost || !check.domain || check.previousScore == null) continue;

    const site = company.sites.find((candidate) => candidate.id === check.siteId && !candidate.isClosed);
    if (!site) continue;

    const roll = Math.floor(Math.random() * session.config.event_die) + 1;
    const fixedRisk = session.experienceMode === 'expert' ? 2 : 1;
    const threshold = Math.min(session.config.event_die, fixedRisk);
    const losesKnowledge = roll <= threshold;

    check.roll = roll;
    check.threshold = threshold;

    if (!losesKnowledge) {
      site.teamCapability[check.domain] = check.previousScore;
      check.newScore = check.previousScore;
      check.knowledgeLost = false;
      summary.workforceAttrition = summary.workforceAttrition.filter((entry) =>
        !(entry.siteName === check.siteName && entry.domain === check.domain),
      );
    }
  }

  recalculateCompanySPOFV2(company, session.config);
  return summary;
}
