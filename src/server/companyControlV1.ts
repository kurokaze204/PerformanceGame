import type { Participant } from '../types/game.ts';
import type { GameSessionV2 } from '../types/gameV2.ts';

export function companyPlayersV1(session:GameSessionV2,companyId:string):Participant[]{
  return (session.participants||[]).filter(participant=>participant.role!=='facilitator'&&participant.companyId===companyId);
}

export function participantCanControlCompanyV1(session:GameSessionV2,companyId:string,participantId?:string|null):boolean{
  if(!participantId)return false;
  const company=session.companies.find(candidate=>candidate.id===companyId);
  if(!company||company.controllerParticipantId!==participantId)return false;
  const participant=(session.participants||[]).find(candidate=>candidate.id===participantId);
  return Boolean(participant&&participant.companyId===companyId&&participant.role==='controller');
}

/**
 * Repairs legacy sessions into the single-writer model.
 * Returns every participant whose persisted role changed.
 */
export function reconcileCompanyControllersV1(session:GameSessionV2):Participant[]{
  const changed=new Map<string,Participant>();
  for(const company of session.companies){
    const players=companyPlayersV1(session,company.id);
    if(!players.length){
      if(company.controllerParticipantId!==null)company.controllerParticipantId=null;
      continue;
    }

    let controller=players.find(player=>player.id===company.controllerParticipantId);
    if(!controller)controller=players.find(player=>player.role==='controller');
    if(!controller)controller=[...players].sort((a,b)=>new Date(a.lastSeen).getTime()-new Date(b.lastSeen).getTime())[0];

    if(company.controllerParticipantId!==controller.id)company.controllerParticipantId=controller.id;
    for(const player of players){
      const desired:Participant['role']=player.id===controller.id?'controller':'participant';
      if(player.role!==desired){
        player.role=desired;
        changed.set(player.id,player);
      }
    }
  }
  return [...changed.values()];
}

export function transferCompanyControllerV1(
  session:GameSessionV2,
  companyId:string,
  targetParticipantId:string,
  currentParticipantId?:string|null,
  facilitatorOverride=false,
):{success:boolean;message:string;changedParticipants:Participant[]}{
  const company=session.companies.find(candidate=>candidate.id===companyId);
  if(!company)return{success:false,message:'Company not found.',changedParticipants:[]};
  const target=companyPlayersV1(session,companyId).find(player=>player.id===targetParticipantId);
  if(!target)return{success:false,message:'The new CEO must already belong to this company.',changedParticipants:[]};
  if(!facilitatorOverride&&!participantCanControlCompanyV1(session,companyId,currentParticipantId)){
    return{success:false,message:'Only the current CEO can hand over control.',changedParticipants:[]};
  }
  const changed=new Map<string,Participant>();
  for(const player of companyPlayersV1(session,companyId)){
    const desired:Participant['role']=player.id===target.id?'controller':'participant';
    if(player.role!==desired){player.role=desired;changed.set(player.id,player);}
  }
  company.controllerParticipantId=target.id;
  return{success:true,message:`${target.name} is now CEO of ${company.name}.`,changedParticipants:[...changed.values()]};
}
