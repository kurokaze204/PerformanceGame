import React from 'react';
import { ArrowRight, BookOpen, Bot, Handshake, Radar, Users } from 'lucide-react';
import type { GameSessionV2 } from '../types/gameV2.ts';

interface Props { session: GameSessionV2; onContinue: () => void; }

type Lesson = { title:string; icon:React.ElementType; p1:string; p2:string; interventions:string };
const LESSONS:Record<number,{eyebrow:string;heading:string;intro:string;items:Lesson[]}>= {
  1:{
    eyebrow:'Newbie mode · Round 1 unlock', heading:'Knowledge you already own',
    intro:'Start by seeing knowledge as an organisational resource with different forms. The first round focuses on capability inside your company and the people who hold unusually deep expertise.',
    items:[
      {title:'Organisational knowledge',icon:BookOpen,p1:'Teams carry practical know-how, local documentation preserves context, and corporate knowledge can make useful material available across the organisation. In real work these forms complement each other: publishing more content is not enough if people at the point of work lack the capability to understand and apply it.',p2:'After the opening knowledge-gap lesson, you will see two ways to move knowledge around the company: Knowledge Transfer moves practice directly from one site to another; the Corporate Intranet publishes knowledge for wider organisational access. You can also strengthen capability through Local Training, Corporate Training and Lessons Learned / AAR.',interventions:'Knowledge Transfer · Local Training · Corporate Training · Update Corporate Intranet · Lessons Learned / AAR'},
      {title:'Deep Experts',icon:Users,p1:'Experts provide judgement, pattern recognition and depth that is hard to capture completely. They are powerful precisely because they know more than the surrounding organisation, but relying on one person for critical capability can create a Single Point of Failure.',p2:'In the game, Experts can support difficult Challenges and can coach local teams through Local Training. Build capability around them rather than treating the Expert as the problem.',interventions:'Train Expert · Local Training'}
    ]
  },
  2:{
    eyebrow:'Newbie mode · Round 2 unlock',heading:'Knowledge you can access without owning',
    intro:'Round 1 was mostly about building what sits inside your organisation. Round 2 adds relationships: sometimes the smartest answer is to connect to expertise that sits elsewhere.',
    items:[
      {title:'Communities of Practice & networks',icon:Handshake,p1:'A Community of Practice creates trusted access to peers who solve similar problems. In real organisations this can expose people to experience, weak signals and specialist knowledge that would be too expensive—or too narrow—to employ permanently.',p2:'In the game, joining a CoP gives future network support in that domain. It complements internal capability rather than replacing it: your organisation still benefits from knowing enough to recognise, absorb and use what the network provides.',interventions:'Join Community of Practice · Ask our network for help'}
    ]
  },
  3:{
    eyebrow:'Newbie mode · Round 3 unlock',heading:'Anticipate and embed',
    intro:'You can now combine internal capability and networks with two more approaches: seeing knowledge needs earlier, and embedding repeatable knowledge into systems.',
    items:[
      {title:'Horizon scanning',icon:Radar,p1:'Horizon scanning is about creating warning time. It does not magically create expertise, but it can reveal emerging threats or opportunities early enough for people to prepare, seek knowledge or choose a different response.',p2:'In the game, a Horizon Scan arms one domain for the next round and can reveal matching Events early enough to delay one. Contrast this with training or publishing: scanning changes what you can anticipate, not the knowledge score itself.',interventions:'Horizon Scan'},
      {title:'Automation & embedded knowledge',icon:Bot,p1:'Some knowledge can be embedded in systems, workflows and controls so the organisation does not have to remember or recreate it every time. This is especially valuable for repeatable decisions, consistency and scale; human expertise remains important for ambiguity and edge cases.',p2:'In the game, Automation creates a persistent bonus for future Challenges in that domain. Unlike a consultant or favour, the capability remains after the immediate event.',interventions:'Automation'}
    ]
  }
};

export const NewbieLearningOverlay:React.FC<Props>=({session,onContinue})=>{
  const lesson=LESSONS[session.round];
  if(session.experienceMode!=='newbie'||!lesson)return null;
  return <div className="w-full max-w-4xl mx-auto mt-4 rounded-3xl border-2 border-indigo-500 bg-slate-950/97 p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="newbie-lesson-title">
    <div className="text-[10px] uppercase tracking-[.2em] text-indigo-300 font-black">{lesson.eyebrow}</div>
    <h2 id="newbie-lesson-title" className="text-2xl font-black text-white mt-1">{lesson.heading}</h2>
    <p className="text-sm text-slate-300 mt-2 max-w-3xl">{lesson.intro}</p>
    <div className={`grid gap-3 mt-4 ${lesson.items.length>1?'md:grid-cols-2':'grid-cols-1'}`}>{lesson.items.map(item=>{const Icon=item.icon;return <section key={item.title} className="rounded-2xl border border-slate-700 bg-slate-900/75 p-4"><div className="flex items-center gap-2"><Icon className="w-5 h-5 text-indigo-300" aria-hidden="true"/><h3 className="font-black text-white">{item.title}</h3></div><p className="text-xs leading-relaxed text-slate-300 mt-2">{item.p1}</p><p className="text-xs leading-relaxed text-slate-400 mt-2">{item.p2}</p><div className="mt-3 rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-[11px] text-emerald-200"><b>Now available:</b> {item.interventions}</div></section>})}</div>
    <button onClick={onContinue} className="mt-4 w-full rounded-xl bg-indigo-500 py-3 font-black text-white">CONTINUE TO THE COMPANY <ArrowRight className="inline w-4 h-4 ml-1"/></button>
  </div>;
};
