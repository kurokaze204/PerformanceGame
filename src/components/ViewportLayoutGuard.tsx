import React,{useEffect}from'react';

export const ViewportLayoutGuard:React.FC=()=>{
 useEffect(()=>{
  let observer:ResizeObserver|null=null;
  const bind=()=>{
   const header=document.querySelector('header') as HTMLElement|null;
   if(!header)return;
   const update=()=>document.documentElement.style.setProperty('--tpg-header-height',`${Math.ceil(header.getBoundingClientRect().height)}px`);
   update();
   observer?.disconnect();observer=new ResizeObserver(update);observer.observe(header);
  };
  bind();
  const mutation=new MutationObserver(bind);mutation.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('resize',bind);
  return()=>{observer?.disconnect();mutation.disconnect();window.removeEventListener('resize',bind)};
 },[]);
 return null;
};
