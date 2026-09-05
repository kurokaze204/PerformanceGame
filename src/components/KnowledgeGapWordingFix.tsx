import React,{useEffect}from'react';

const OLD='The knowledge existed inside the organisation; it was stranded in another place when the decision had to be made.';
const NEXT='The knowledge existed inside the organisation, but it was stranded in another place when the decision had to be made.';

export const KnowledgeGapWordingFix:React.FC=()=>{
 useEffect(()=>{
  const apply=()=>{const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node:Node|null;while((node=walker.nextNode())){if(node.nodeValue?.includes(OLD))node.nodeValue=node.nodeValue.replace(OLD,NEXT);}};
  apply();const observer=new MutationObserver(apply);observer.observe(document.body,{subtree:true,childList:true,characterData:true});return()=>observer.disconnect();
 },[]);
 return null;
};
