export type KnowledgeDomain = 'engineering' | 'hr' | 'marketing' | 'operations' | 'finance';

export const DOMAIN_INFO: Record<KnowledgeDomain, { label: string; color: string; bgClass: string; textClass: string; borderClass: string; icon: string }> = {
  engineering: { label: 'Engineering', color: '#2563eb', bgClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300', textClass: 'text-blue-600 dark:text-blue-400', borderClass: 'border-blue-300 dark:border-blue-700', icon: 'wrench' },
  hr: { label: 'Human Resources', color: '#dc2626', bgClass: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300', textClass: 'text-red-600 dark:text-red-400', borderClass: 'border-red-300 dark:border-red-700', icon: 'users' },
  marketing: { label: 'Marketing', color: '#d97706', bgClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', textClass: 'text-amber-600 dark:text-amber-400', borderClass: 'border-amber-300 dark:border-amber-700', icon: 'trending-up' },
  operations: { label: 'Operations', color: '#16a34a', bgClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', textClass: 'text-emerald-600 dark:text-emerald-400', borderClass: 'border-emerald-300 dark:border-emerald-700', icon: 'cpu' },
  finance: { label: 'Finance', color: '#9333ea', bgClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300', textClass: 'text-purple-600 dark:text-purple-400', borderClass: 'border-purple-300 dark:border-purple-700', icon: 'dollar-sign' },
};

export type GamePhase = 'events' | 'respond' | 'consequences' | 'investment' | 'risk';
export interface DomainScoreMap { engineering:number; hr:number; marketing:number; operations:number; finance:number; }
export type ExpertState = 'Available'|'Supporting Event'|'Travelling'|'Training'|'Knowledge Transfer'|'Expertise Capture'|'CoP Participant'|'HQ Assignment';
export interface Expert { id:string; name:string; domains:{domain:KnowledgeDomain;score:number}[]; location:string; homeLocation:string; state:ExpertState; isSPOF:boolean; spofDomains:KnowledgeDomain[]; isVacant?:boolean; avatarSeed?:string; }
export interface Site { id:string; name:string; turnover:number; isRDSite:boolean; isClosed:boolean; teamCapability:DomainScoreMap; codifiedKnowledge:DomainScoreMap; coordinates:{x:number;y:number}; }
export interface Company { id:string; name:string; turnover:number; startingTurnover:number; intranet:DomainScoreMap; intranetRoundGrowth:DomainScoreMap; automatedDomains:KnowledgeDomain[]; horizonScanDomain:KnowledgeDomain|null; horizonScanUsedThisRound:boolean; actionsRemaining:number; sites:Site[]; experts:Expert[]; auditedSiteId:string|null; }
export type EventType='problem'|'opportunity';
export type EventScope='local'|'enterprise';
export interface EventDomainRequirement { domain:KnowledgeDomain; difficulty:number; }
export interface EventCard { id:string; type:EventType; scope:EventScope; title:string; description:string; domains:EventDomainRequirement[]; impact:number; rdSiteOnly?:boolean; tags:string[]; }
export interface ActiveEventAllocation { expertId?:string; useCoPSupport?:boolean; copContributingCompanyId?:string; copContributingExpertId?:string; }
export interface ActiveEvent { instanceId:string; card:EventCard; targetSiteId?:string; allocations:Record<KnowledgeDomain,ActiveEventAllocation>; isResolved:boolean; success?:boolean; domainResults?:{domain:KnowledgeDomain;baseKnowledge:number;usableIntranet:number;team:number;localCodified:number;expertBonus:number;copBonus:number;automationBonus:number;totalKnowledge:number;difficulty:number;dieRoll:number;requiredTotal:number;achievedTotal:number;domainSuccess:boolean;explanation:string;}[]; turnoverChangeApplied?:number; experientialLearningAwarded?:boolean; }

export interface SimulationConfig {
  starting_turnover:number;
  minimum_site_turnover:number;
  sites_per_company:number;
  experts_per_company:number;
  starting_intranet_score:number;
  site_knowledge_min:number;
  site_knowledge_max:number;
  expert_score_min:number;
  expert_score_max:number;
  rounds:number;
  events_per_round:number;
  actions_per_round:number;
  event_die:number;
  cost_die:number;
  resolution_offset:number;
  event_value_growth_factor?:number;
  event_difficulty_growth_per_move?:number;
  event_initial_impact_multiplier?:number;
  event_impact_cap_ratio?:number;
  event_difficulty_cap?:number;
  event_expert_moves_per_pressure_step?:number;
  absorptive_capacity_bonus:number;
  expert_support_bonus:number;
  cop_support_bonus:number;
  automation_bonus:number;
  spof_gap:number;
  normal_leave_threshold:number;
  spof_leave_threshold:number;
  normal_intranet_increment:number;
  hq_expert_intranet_increment:number;
  max_intranet_domain_growth_per_round:number;
  two_domain_ratio:number;
  three_domain_ratio:number;
}

export interface CoPMembership { companyId:string; domain:KnowledgeDomain; expertId:string; activeRound:number; }
export interface GameEventLog { id:string; sessionId:string; companyId?:string; participantId?:string; eventType:string; timestamp:string; round:number; phase:GamePhase; title:string; description:string; payload:Record<string,any>; }
export interface Participant { id:string; sessionId:string; name:string; companyId:string; role:'participant'|'controller'|'facilitator'; lastSeen:string; }
export interface GameSession { id:string; title:string; name?:string; round:number; phase:GamePhase; isPaused:boolean; isFinalDisruptionActive:boolean; finalDisruptionCard?:EventCard; finalDisruptionResolved?:boolean; companies:Company[]; activeEvents:Record<string,ActiveEvent[]>; copMemberships:CoPMembership[]; config:SimulationConfig; createdAt:string; updatedAt:string; }
export type ActionCategory='DEVELOP'|'CAPTURE'|'CONNECT'|'EMBED'|'DIAGNOSE';
export type ActionType='KNOWLEDGE_TRANSFER'|'TRAIN_EXPERT'|'CORPORATE_TRAINING'|'CODIFY_SITE'|'CODIFY_EXPERT'|'UPDATE_INTRANET'|'EXPERTISE_CAPTURE'|'LESSONS_LEARNED'|'JOIN_COP'|'LEAVE_COP'|'CAPTURE_COP_LEARNING'|'HORIZON_SCAN'|'AUTOMATE'|'KNOWLEDGE_AUDIT'|'MOVE_EXPERT';
export interface ActionPayload { type:ActionType; companyId:string; siteId?:string; expertId?:string; domain?:KnowledgeDomain; eventInstanceId?:string; targetLocation?:string; learningTarget?:'team'|'expert'|'codified'; }
