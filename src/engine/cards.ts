import { EventCard, EventScope, EventType } from '../types/game.ts';

type EventCardTemplate = Omit<EventCard, 'impact'>;

/**
 * Financial value is derived from the knowledge challenge rather than stored
 * independently on each card. Values are in $000s.
 *
 * Formula: $60k base + $15k per total challenge point
 *          + $40k for each additional knowledge domain.
 *
 * Keeping this deterministic makes the deck self-balancing when a card's
 * difficulty changes and prevents difficulty/value drift over time.
 */
export function calculateCardImpact(card: Pick<EventCardTemplate, 'domains'>): number {
  const totalChallenge = card.domains.reduce((sum, requirement) => sum + requirement.difficulty, 0);
  const additionalDomainPremium = Math.max(0, card.domains.length - 1) * 40;
  return 60 + (15 * totalChallenge) + additionalDomainPremium;
}

function withCalculatedImpact(card: EventCardTemplate): EventCard {
  return { ...card, impact: calculateCardImpact(card) };
}

const EVENT_CARD_TEMPLATES: EventCardTemplate[] = [
  // ==========================================
  // --- LOCAL PROBLEMS (18 cards) ---
  // ==========================================
  // 1-Domain (10 cards)
  {
    id: 'LOC-PROB-001', type: 'problem', scope: 'local',
    title: 'CNC Precision Lathe Bearing Seizure',
    description: 'High-tolerance fabrication spindle bearings seize due to thermal fatigue, halting local machining throughput.',
    domains: [{ domain: 'engineering', difficulty: 6 }],
    tags: ['equipment', 'engineering', 'maintenance']
  },
  {
    id: 'LOC-PROB-002', type: 'problem', scope: 'local',
    title: 'Specialized Boilermaker & Welder Deficit',
    description: 'Sudden certified welder resignations leave the site incapable of completing pressure-vessel sign-offs.',
    domains: [{ domain: 'hr', difficulty: 6 }],
    tags: ['workforce', 'skills', 'hr']
  },
  {
    id: 'LOC-PROB-003', type: 'problem', scope: 'local',
    title: 'Warehouse Bay Congestion & Bottleneck',
    description: 'Inbound freight stacking blocks outbound dispatch docks, creating cross-dock gridlock.',
    domains: [{ domain: 'operations', difficulty: 5 }],
    tags: ['logistics', 'operations', 'bottleneck']
  },
  {
    id: 'LOC-PROB-004', type: 'problem', scope: 'local',
    title: 'Major Regional Client Payment Default',
    description: 'A key regional buyer enters administration, freezing receivables and straining site cash balances.',
    domains: [{ domain: 'finance', difficulty: 6 }],
    tags: ['finance', 'credit', 'receivables']
  },
  {
    id: 'LOC-PROB-005', type: 'problem', scope: 'local',
    title: 'Localized Batch Quality Dispute & Media Alert',
    description: 'A regional customer flags surface blemishes in consumer packaging, triggering local news consumer watchdog scrutiny.',
    domains: [{ domain: 'marketing', difficulty: 6 }],
    tags: ['marketing', 'brand', 'reputation']
  },
  {
    id: 'LOC-PROB-006', type: 'problem', scope: 'local',
    title: 'R&D Structural Composite Micro-Fracture',
    description: 'Thermal stress cycle simulation on novel lightweight casing reveals unpredicted microscopic shear delamination.',
    domains: [{ domain: 'engineering', difficulty: 7 }],
    rdSiteOnly: true,
    tags: ['r&d', 'engineering', 'materials']
  },
  {
    id: 'LOC-PROB-007', type: 'problem', scope: 'local',
    title: 'Overtime & Shift Allowance Payroll Drift',
    description: 'Disputed penalty rate calculations cause widespread worker dissatisfaction and threatened administrative grievance filings.',
    domains: [{ domain: 'hr', difficulty: 5 }],
    tags: ['hr', 'payroll', 'compliance']
  },
  {
    id: 'LOC-PROB-008', type: 'problem', scope: 'local',
    title: 'Cold Storage Refrigeration Compressor Failure',
    description: 'Perishable component preservation temperature drifts above critical threshold, risking entire batch spoilage.',
    domains: [{ domain: 'operations', difficulty: 6 }],
    tags: ['operations', 'storage', 'facility']
  },
  {
    id: 'LOC-PROB-009', type: 'problem', scope: 'local',
    title: 'Regional Branch Working Capital Desync',
    description: 'Mismatch between vendor payment terms and inventory turnover produces acute local liquidity shortfall.',
    domains: [{ domain: 'finance', difficulty: 5 }],
    tags: ['finance', 'cashflow', 'liquidity']
  },
  {
    id: 'LOC-PROB-010', type: 'problem', scope: 'local',
    title: 'Aggressive Competitor Regional Ad Siphon',
    description: 'A predatory regional competitor buys out local billboards and trade sponsorships, poaching historical foot-traffic accounts.',
    domains: [{ domain: 'marketing', difficulty: 5 }],
    tags: ['marketing', 'competition', 'territory']
  },

  // 2-Domains (7 cards)
  {
    id: 'LOC-PROB-011', type: 'problem', scope: 'local',
    title: 'Critical Pump & Cooling Turbine Failure',
    description: 'A vital production pump and cooling turbine begins vibrating violently, threatening immediate production halt.',
    domains: [{ domain: 'engineering', difficulty: 6 }, { domain: 'operations', difficulty: 4 }],
    tags: ['equipment', 'maintenance', 'production']
  },
  {
    id: 'LOC-PROB-012', type: 'problem', scope: 'local',
    title: 'Key Operator Strike & Grievance',
    description: 'A wage parity and safety dispute at the local terminal leads to imminent work stoppage unless mediated quickly.',
    domains: [{ domain: 'hr', difficulty: 5 }, { domain: 'operations', difficulty: 4 }],
    tags: ['workforce', 'dispute', 'operations']
  },
  {
    id: 'LOC-PROB-013', type: 'problem', scope: 'local',
    title: 'Regional Hazardous Runoff Sanction',
    description: 'Regional environmental inspectors uncover drainage filtration discrepancies requiring technical redesign and reporting.',
    domains: [{ domain: 'operations', difficulty: 5 }, { domain: 'engineering', difficulty: 5 }],
    tags: ['compliance', 'environmental', 'engineering']
  },
  {
    id: 'LOC-PROB-014', type: 'problem', scope: 'local',
    title: 'Inventory Software Drift & Stockout',
    description: 'Local inventory database records drift wildly from physical warehouse bins, paralyzing customer shipments and invoicing.',
    domains: [{ domain: 'operations', difficulty: 5 }, { domain: 'finance', difficulty: 4 }],
    tags: ['logistics', 'inventory', 'finance']
  },
  {
    id: 'LOC-PROB-015', type: 'problem', scope: 'local',
    title: 'Equipment Lease Breach & Repossession Risk',
    description: 'Disputed contractual asset condition clauses threaten forfeiture of core heavy transport machinery.',
    domains: [{ domain: 'finance', difficulty: 6 }, { domain: 'engineering', difficulty: 4 }],
    tags: ['finance', 'assets', 'contracts']
  },
  {
    id: 'LOC-PROB-016', type: 'problem', scope: 'local',
    title: 'Machinery Guarding Safety Breach & Union Notice',
    description: 'Safety delegates issue a provisional improvement notice following safety sensor anomalies on high-speed press lines.',
    domains: [{ domain: 'hr', difficulty: 6 }, { domain: 'engineering', difficulty: 4 }],
    tags: ['safety', 'hr', 'compliance']
  },
  {
    id: 'LOC-PROB-017', type: 'problem', scope: 'local',
    title: 'Custom Packaging Defect & Client Refusal',
    description: 'A major wholesale client rejects an entire trailer of custom-branded freight citing print bleed and structural weakness.',
    domains: [{ domain: 'marketing', difficulty: 5 }, { domain: 'operations', difficulty: 5 }],
    tags: ['marketing', 'operations', 'quality']
  },

  // 3-Domains (1 card)
  {
    id: 'LOC-PROB-018', type: 'problem', scope: 'local',
    title: 'Catastrophic Kiln Flashover & Plant Evacuation',
    description: 'Thermal runaway in main curing furnace triggers emergency fire suppression, destroying inventory and requiring intensive safety overhaul.',
    domains: [{ domain: 'operations', difficulty: 6 }, { domain: 'engineering', difficulty: 6 }, { domain: 'hr', difficulty: 5 }],
    tags: ['crisis', 'safety', 'engineering', 'operations']
  },

  // ==========================================
  // --- LOCAL OPPORTUNITIES (12 cards) ---
  // ==========================================
  // 1-Domain (7 cards)
  {
    id: 'LOC-OPP-001', type: 'opportunity', scope: 'local',
    title: 'Lean 5S Kaizen Throughput Optimization',
    description: 'Floor supervisors design an optimized staging protocol that boosts daily packing velocity by 25%.',
    domains: [{ domain: 'operations', difficulty: 5 }],
    tags: ['lean', 'throughput', 'efficiency']
  },
  {
    id: 'LOC-OPP-002', type: 'opportunity', scope: 'local',
    title: 'Robotic Pick-and-Pack Feasibility Study',
    description: 'Engineering models demonstrate automated optical sorting can double precision packaging output.',
    domains: [{ domain: 'engineering', difficulty: 6 }],
    tags: ['automation', 'engineering', 'tech']
  },
  {
    id: 'LOC-OPP-003', type: 'opportunity', scope: 'local',
    title: 'State Vocational Apprenticeship Rebate',
    description: 'State workforce department offers substantial wage subsidies for structured technical cross-skilling programs.',
    domains: [{ domain: 'hr', difficulty: 5 }],
    tags: ['training', 'subsidy', 'hr']
  },
  {
    id: 'LOC-OPP-004', type: 'opportunity', scope: 'local',
    title: 'Regional Chamber of Commerce Showcase',
    description: 'Keynote spotlight at the annual regional business gala positions the site as preferred local manufacturing partner.',
    domains: [{ domain: 'marketing', difficulty: 5 }],
    tags: ['marketing', 'networking', 'sales']
  },
  {
    id: 'LOC-OPP-005', type: 'opportunity', scope: 'local',
    title: 'Early Settlement Supplier Discount Matrix',
    description: 'Re-negotiating regional supplier payment cycles captures guaranteed 3.5% discount yields across all raw consumables.',
    domains: [{ domain: 'finance', difficulty: 5 }],
    tags: ['finance', 'procurement', 'discounts']
  },
  {
    id: 'LOC-OPP-006', type: 'opportunity', scope: 'local',
    title: 'Advanced IoT Telemetry Sensor Retrofit',
    description: 'Installing vibration and temperature telemetry across assembly gears enables predictive breakdown prevention.',
    domains: [{ domain: 'engineering', difficulty: 5 }],
    tags: ['engineering', 'iot', 'predictive']
  },
  {
    id: 'LOC-OPP-007', type: 'opportunity', scope: 'local',
    title: 'Delivery Route Dynamic Dispatch Algorithm',
    description: 'Optimized multi-drop dispatch scheduling cuts transport fuel burn and fleet maintenance wear.',
    domains: [{ domain: 'operations', difficulty: 5 }],
    tags: ['operations', 'logistics', 'efficiency']
  },

  // 2-Domains (5 cards)
  {
    id: 'LOC-OPP-008', type: 'opportunity', scope: 'local',
    title: 'High-Margin Mining Consortium Bespoke Tender',
    description: 'A regional mining consortium issues a rapid-turnaround contract for custom high-spec engineering components.',
    domains: [{ domain: 'engineering', difficulty: 6 }, { domain: 'finance', difficulty: 5 }],
    tags: ['revenue', 'custom-order', 'growth']
  },
  {
    id: 'LOC-OPP-009', type: 'opportunity', scope: 'local',
    title: 'State Clean Energy Co-Investment Grant',
    description: 'Government matching fund co-finances on-site solar capture and variable-speed industrial drives.',
    domains: [{ domain: 'finance', difficulty: 5 }, { domain: 'engineering', difficulty: 4 }],
    tags: ['grant', 'government', 'finance', 'engineering']
  },
  {
    id: 'LOC-OPP-010', type: 'opportunity', scope: 'local',
    title: 'B2B Trade Demonstration & Client Seminar',
    description: 'Hosting an exclusive technical open-house for regional buyers drives pre-orders for the upcoming production season.',
    domains: [{ domain: 'marketing', difficulty: 5 }, { domain: 'operations', difficulty: 4 }],
    tags: ['marketing', 'operations', 'sales']
  },
  {
    id: 'LOC-OPP-011', type: 'opportunity', scope: 'local',
    title: 'Cross-Skilling Workforce Retention Incentive',
    description: 'Structured operator rotation program boosts team flexibility and secures federal training grants.',
    domains: [{ domain: 'hr', difficulty: 5 }, { domain: 'operations', difficulty: 4 }],
    tags: ['hr', 'training', 'operations']
  },
  {
    id: 'LOC-OPP-012', type: 'opportunity', scope: 'local',
    title: 'Off-Peak Energy Tariff Production Shift',
    description: 'Rescheduling heavy smelting and casting runs to off-peak night windows sharply reduces electricity tariffs.',
    domains: [{ domain: 'operations', difficulty: 5 }, { domain: 'finance', difficulty: 4 }],
    tags: ['operations', 'finance', 'energy']
  },

  // ==========================================
  // --- ENTERPRISE PROBLEMS (6 cards) ---
  // ==========================================
  {
    id: 'ENT-PROB-001', type: 'problem', scope: 'enterprise',
    title: 'Enterprise ERP Database Cluster Corruption',
    description: 'Core corporate server array experiences write-head desynchronization, threatening enterprise data consistency.',
    domains: [{ domain: 'engineering', difficulty: 8 }],
    tags: ['it', 'engineering', 'enterprise']
  },
  {
    id: 'ENT-PROB-002', type: 'problem', scope: 'enterprise',
    title: 'National Corporate Tax & Transfer Pricing Audit',
    description: 'Federal taxation office launches forensic scrutiny into interstate transfer pricing and capital depreciation schedules.',
    domains: [{ domain: 'finance', difficulty: 8 }],
    tags: ['tax', 'finance', 'compliance']
  },
  {
    id: 'ENT-PROB-003', type: 'problem', scope: 'enterprise',
    title: 'National Union Collective Bargaining Impasse',
    description: 'Multi-union enterprise agreement negotiations stall, risking coordinated national stop-work action.',
    domains: [{ domain: 'hr', difficulty: 8 }],
    tags: ['workforce', 'union', 'hr']
  },
  {
    id: 'ENT-PROB-004', type: 'problem', scope: 'enterprise',
    title: 'National Supply Chain Port Bottleneck Collapse',
    description: 'Primary container shipping terminal strike cascades across all manufacturing hubs, threatening national commitments.',
    domains: [{ domain: 'operations', difficulty: 8 }, { domain: 'finance', difficulty: 6 }],
    tags: ['supply-chain', 'enterprise', 'logistics']
  },
  {
    id: 'ENT-PROB-005', type: 'problem', scope: 'enterprise',
    title: 'Multi-State Competitor Price-War Blitz',
    description: 'An offshore competitor subsidizes aggressive discounting across your core product lines, squeezing margins.',
    domains: [{ domain: 'marketing', difficulty: 8 }, { domain: 'finance', difficulty: 7 }],
    tags: ['competition', 'pricing', 'market']
  },
  {
    id: 'ENT-PROB-006', type: 'problem', scope: 'enterprise',
    title: 'Corporate Ransomware & Blueprint Exfiltration',
    description: 'Intruders encrypt enterprise ERP and threaten public release of proprietary technical CAD designs and financial models.',
    domains: [{ domain: 'engineering', difficulty: 9 }, { domain: 'operations', difficulty: 7 }, { domain: 'finance', difficulty: 6 }],
    tags: ['cyber', 'security', 'enterprise', 'crisis']
  },

  // ==========================================
  // --- ENTERPRISE OPPORTUNITIES (4 cards) ---
  // ==========================================
  {
    id: 'ENT-OPP-001', type: 'opportunity', scope: 'enterprise',
    title: 'National Prime-Time Brand Re-Positioning',
    description: 'A high-impact national media campaign positions the company as Australia’s premier precision industrial supplier.',
    domains: [{ domain: 'marketing', difficulty: 8 }],
    tags: ['marketing', 'brand', 'nationwide']
  },
  {
    id: 'ENT-OPP-002', type: 'opportunity', scope: 'enterprise',
    title: 'Corporate Green Bond & ESG Debt Restructuring',
    description: 'Issuing accredited sustainability bonds cuts corporate interest charges and secures long-term institutional backing.',
    domains: [{ domain: 'finance', difficulty: 8 }],
    tags: ['finance', 'esg', 'capital']
  },
  {
    id: 'ENT-OPP-003', type: 'opportunity', scope: 'enterprise',
    title: 'Tier-1 Carbon Neutral Sustainable Certification',
    description: 'Securing national carbon-neutral engineering accreditation unlocks priority bidding on multi-billion dollar infrastructure tenders.',
    domains: [{ domain: 'engineering', difficulty: 8 }, { domain: 'marketing', difficulty: 7 }],
    tags: ['sustainability', 'esg', 'growth']
  },
  {
    id: 'ENT-OPP-004', type: 'opportunity', scope: 'enterprise',
    title: 'Turnkey Multi-State Retail Distribution Network',
    description: 'A major retail hardware network seeks a single turnkey supplier capable of delivering standardized stock nationwide.',
    domains: [{ domain: 'operations', difficulty: 8 }, { domain: 'marketing', difficulty: 7 }],
    tags: ['partnership', 'nationwide', 'expansion']
  }
];

export const EVENT_CARDS_DECK: EventCard[] = EVENT_CARD_TEMPLATES.map(withCalculatedImpact);

// --- FINAL DISRUPTIONS (Round 6) ---
const FINAL_DISRUPTION_TEMPLATES: EventCardTemplate[] = [
  {
    id: 'FINAL-DISRUPT-001', type: 'problem', scope: 'enterprise',
    title: 'Major Regulatory and Technology Disruption',
    description: 'A systemic disruption strikes the Australian market: sudden zero-emission mandate enforcement, automated supply integration mandates, and tightened liquidity reserves.',
    domains: [{ domain: 'engineering', difficulty: 9 }, { domain: 'operations', difficulty: 8 }, { domain: 'finance', difficulty: 7 }],
    tags: ['final-disruption', 'macro', 'resilience']
  },
  {
    id: 'FINAL-DISRUPT-002', type: 'problem', scope: 'enterprise',
    title: 'Severe Geopolitical Supply & Cyber Blackout',
    description: 'Critical foreign supply lines sever simultaneously with critical telecom blackout, forcing complete reliance on internal operational and technical resilience.',
    domains: [{ domain: 'operations', difficulty: 9 }, { domain: 'engineering', difficulty: 9 }, { domain: 'hr', difficulty: 7 }],
    tags: ['final-disruption', 'crisis', 'blackout']
  }
];

export const FINAL_DISRUPTION_CARDS: EventCard[] = FINAL_DISRUPTION_TEMPLATES.map(withCalculatedImpact);

export function getRandomEventCard(scope?: EventScope, type?: EventType): EventCard {
  let deck = EVENT_CARDS_DECK;
  if (scope) deck = deck.filter((c) => c.scope === scope);
  if (type) deck = deck.filter((c) => c.type === type);
  const idx = Math.floor(Math.random() * deck.length);
  return { ...deck[idx] };
}
