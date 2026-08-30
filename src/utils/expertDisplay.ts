import type { Expert } from '../types/game.ts';

const CITY_CODES:Record<string,string>={
  melbourne:'MEL',
  sydney:'SYD',
  brisbane:'BNE',
  adelaide:'ADL',
  perth:'PER',
  darwin:'DRW',
  HQ:'HQ',
};

export const cityCode=(location?:string):string=>{
  if(!location)return '—';
  return CITY_CODES[location]||CITY_CODES[location.toLowerCase()]||location.slice(0,3).toUpperCase();
};

/** Home location is deliberately used: the label tells players where travel costs originate. */
export const expertDisplayName=(expert:Pick<Expert,'name'|'homeLocation'|'location'>):string=>`${expert.name} (${cityCode(expert.homeLocation||expert.location)})`;
