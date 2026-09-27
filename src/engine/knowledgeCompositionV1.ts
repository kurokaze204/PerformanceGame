export interface KnowledgeComposition {
  depth:number;
  breadth:number;
  sourceCount:number;
  total:number;
}

export function composeKnowledgeSources(values:number[]):KnowledgeComposition{
  const active=values.map(value=>Math.max(0,Number(value)||0)).filter(value=>value>0);
  if(!active.length)return{depth:0,breadth:0,sourceCount:0,total:0};
  const depth=Math.max(...active);
  const breadth=Math.max(0,active.length-1);
  return{depth,breadth,sourceCount:active.length,total:depth+breadth};
}
