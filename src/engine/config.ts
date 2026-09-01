import { SimulationConfig } from '../types/game.ts';

export const DEFAULT_CONFIG: SimulationConfig = {
  starting_turnover: 875,
  minimum_site_turnover: 75,
  sites_per_company: 6,
  experts_per_company: 3,

  starting_intranet_score: 2,
  site_knowledge_min: 1,
  site_knowledge_max: 3,
  expert_score_min: 4,
  expert_score_max: 6,

  rounds: 5,
  events_per_round: 2,
  actions_per_round: 5,

  event_die: 12,
  cost_die: 6,
  resolution_offset: 1,

  event_value_growth_factor: 1.40,
  event_difficulty_growth_per_move: 0.28,
  event_initial_impact_multiplier: 0.12,
  event_impact_cap_ratio: 0.35,
  event_difficulty_cap: 9,
  event_expert_moves_per_pressure_step: 6,

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

// Positions are plotted against the stylised but geographically proportioned
// Australia outline in australiaGrid.ts. They correspond to the real relative
// locations of the capital cities rather than being moved to make UI space.
export const AUSTRALIAN_CITIES = [
  { id: 'melbourne', name: 'Melbourne', coordinates: { x: 72.7, y: 79.4 } },
  { id: 'sydney', name: 'Sydney', coordinates: { x: 83.2, y: 65.4 } },
  { id: 'brisbane', name: 'Brisbane', coordinates: { x: 86.0, y: 52.1 } },
  { id: 'adelaide', name: 'Adelaide', coordinates: { x: 61.0, y: 72.3 } },
  { id: 'perth', name: 'Perth', coordinates: { x: 16.9, y: 67.2 } },
  { id: 'darwin', name: 'Darwin', coordinates: { x: 44.6, y: 15.1 } },
];

// Hobart is not a playable site, but Tasmania remains on the board and this
// reference point is available for labels/visual orientation in the new UI.
export const HOBART_COORDINATES = { x: 75.1, y: 92.2 };
export const HQ_COORDINATES = { x: 50, y: 48 };
