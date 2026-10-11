export type KMWeekSelectionState='none'|'depth'|'breadth';
export function toggleKMWeekSourceV1(local:KMWeekSelectionState,expert:KMWeekSelectionState,source:'local'|'expert',localScore:number,expertScore:number){
 if(source==='local')local=local==='none'?'depth':'none';
 else expert=expert==='none'?'depth':'none';
 if(local!=='none'&&expert!=='none'){
  if(expertScore>=localScore){expert='depth';local='breadth';}
  else{local='depth';expert='breadth';}
 }else{
  if(local!=='none')local='depth';
  if(expert!=='none')expert='depth';
 }
 return {local,expert};
}
