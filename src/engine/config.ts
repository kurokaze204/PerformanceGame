import { SimulationConfig } from '../types/game.ts';

export const DEFAULT_CONFIG: SimulationConfig = {
  starting_turnover: 3500,
  minimum_site_turnover: 300,
  sites_per_company: 6,
  experts_per_company: 3,

  starting_intranet_score: 2,
  site_knowledge_min: 1,
  site_knowledge_max: 3,
  expert_score_min: 4,
  expert_score_max: 6,

  rounds: 5,
  events_per_round: 2,
  actions_per_round: 4,

  event_die: 12,
  cost_die: 6,
  // Original rule: succeed when d12 roll is higher than the remaining
  // knowledge gap. In integer form this is roll + knowledge >= difficulty + 1.
  resolution_offset: 1,

  absorptive_capacity_bonus: 2,
  expert_support_bonus: 2,
  cop_support_bonus: 2,
  automation_bonus: 2,

  spof_gap: 3,
  normal_leave_threshold: 1,
  spof_leave_threshold: 2,

  normal_intranet_increment: 1,
  hq_expert_intranet_increment: 2,
  max_intranet_domain_growth_per_round: 2,

  two_domain_ratio: 0.40,
  three_domain_ratio: 0.05,
};

export const AUSTRALIAN_CITIES = [
  { id: 'melbourne', name: 'Melbourne', coordinates: { x: 74, y: 81 } },
  { id: 'sydney', name: 'Sydney', coordinates: { x: 86, y: 64 } },
  { id: 'brisbane', name: 'Brisbane', coordinates: { x: 88, y: 46 } },
  { id: 'adelaide', name: 'Adelaide', coordinates: { x: 58, y: 72 } },
  { id: 'perth', name: 'Perth', coordinates: { x: 17, y: 66 } },
  { id: 'darwin', name: 'Darwin', coordinates: { x: 44, y: 15 } },
];

export const HQ_COORDINATES = { x: 50, y: 48 }; // Centered Inland Strategic Hub
