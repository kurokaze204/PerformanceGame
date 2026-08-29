import type { Company } from '../types/game.ts';
import type { GameSessionV2, RiskSummaryV2 } from '../types/gameV2.ts';
import { asCompanyV2 } from '../types/gameV2.ts';
import { executeRiskPhaseV2, recalculateCompanySPOFV2 } from './coreV2.ts';

/**
 * Playtest rule: routine workforce knowledge loss is probabilistic rather than
 * automatic. The existing V2 risk phase still selects two random active sites
 * and identifies one vulnerable domain at each. V4 then tests the size of the
 * uncodified knowledge gap on a d12:
 *
 *   loss when d12 <= (Team Capability - Local Codified Knowledge)
 *
 * Examples: gap 1 = 1/12, gap 2 = 2/12, gap 3 = 3/12. A fully codified domain
 * has no vulnerable gap and therefore no loss test. This deliberately makes
 * codification a visible risk-control mechanism. The exact probabilities are
 * provisional and should be tuned from playtest data.
 */
export function executeRiskPhaseV4(session: GameSessionV2, companyInput: Company): RiskSummaryV2 {
  const company = asCompanyV2(companyInput);
  const summary = executeRiskPhaseV2(session, company);

  for (const check of summary.siteChecks || []) {
    if (!check.knowledgeLost || !check.domain || check.previousScore == null) continue;

    const site = company.sites.find((candidate) => candidate.id === check.siteId && !candidate.isClosed);
    if (!site) continue;

    const codified = site.codifiedKnowledge[check.domain] || 0;
    const gap = Math.max(0, check.previousScore - codified);
    const roll = Math.floor(Math.random() * session.config.event_die) + 1;
    const threshold = Math.min(session.config.event_die, gap);
    const losesKnowledge = threshold > 0 && roll <= threshold;

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
