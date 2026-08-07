import type {Vec3} from './player';

export const BEACON_IDS=['orchard','amber','hollow'] as const;
export const MOTE_IDS=['threshold','switchback','ferry','wallkick','crownstep'] as const;
export type RunPhase='beacons'|'ascent'|'summit'|'complete';
export type CheckpointId='landing'|'ascent'|'summit';
export interface RunState{
 phase:RunPhase;beacons:readonly string[];motes:readonly string[];shards:readonly string[];
 checkpoint:CheckpointId;elapsed:number;timerRunning:boolean;feedback:string;feedbackSerial:number;
}
export type RunEvent=
 |{type:'tick';seconds:number}|{type:'beacon';id:string}|{type:'mote';id:string}
 |{type:'shard';id:string}|{type:'recover'}|{type:'defeat'}|{type:'void'}|{type:'complete'}|{type:'stop-timer'};

export const CHECKPOINTS:Record<CheckpointId,Vec3>={
 landing:{x:0,y:.8,z:7},ascent:{x:-7,y:3,z:-15},summit:{x:0,y:19,z:-52}
};
export const initialRun=():RunState=>({phase:'beacons',beacons:[],motes:[],shards:[],checkpoint:'landing',elapsed:0,timerRunning:true,feedback:'Seek three beacons in the Orchard, Amber Run, and Crystal Hollow.',feedbackSerial:0});

export function reduceRun(state:RunState,event:RunEvent):RunState{
 if(event.type==='tick')return state.timerRunning&&event.seconds>0?{...state,elapsed:state.elapsed+event.seconds}:state;
 if(event.type==='stop-timer')return state.timerRunning?{...state,timerRunning:false}:state;
 if(event.type==='complete'&&state.phase==='summit')return {...state,phase:'complete',timerRunning:false,feedback:'Windglass Crest claimed · Galecrest Isle complete!',feedbackSerial:state.feedbackSerial+1};
 // Defeat and void-fall are separate causes so the reducer can be driven, and read, per the cause
 // the spec names. Both keep durable progress and return the player to the same checkpoint.
 if(event.type==='recover'||event.type==='defeat'||event.type==='void')
  return {...state,feedback:event.type==='defeat'?`Defeated · recovered at the ${state.checkpoint} checkpoint.`:event.type==='void'?`Fell · recovered at the ${state.checkpoint} checkpoint.`:`Recovered at the ${state.checkpoint} checkpoint.`,feedbackSerial:state.feedbackSerial+1};
 if(event.type==='shard')return addUnique(state,'shards',event.id,`Optional shard found · ${state.shards.length+1}`);
 if(event.type==='beacon'){
  if(state.phase!=='beacons'||!BEACON_IDS.includes(event.id as typeof BEACON_IDS[number])||state.beacons.includes(event.id))return state;
  const beacons=[...state.beacons,event.id];
  if(beacons.length===BEACON_IDS.length)return {...state,beacons,phase:'ascent',checkpoint:'ascent',feedback:'◆ Wind network awake · ascent gate open',feedbackSerial:state.feedbackSerial+1};
  return {...state,beacons,feedback:`◆ Beacon awake · ${beacons.length}/${BEACON_IDS.length}`,feedbackSerial:state.feedbackSerial+1};
 }
 if(event.type==='mote'){
  if(state.phase!=='ascent'||!MOTE_IDS.includes(event.id as typeof MOTE_IDS[number])||state.motes.includes(event.id))return state;
  const motes=[...state.motes,event.id];
  if(motes.length===MOTE_IDS.length)return {...state,motes,phase:'summit',checkpoint:'summit',feedback:'⬟ Ascent powered · summit gate open',feedbackSerial:state.feedbackSerial+1};
  return {...state,motes,feedback:`⬟ Energy mote gathered · ${motes.length}/${MOTE_IDS.length}`,feedbackSerial:state.feedbackSerial+1};
 }
 return state;
}
function addUnique(state:RunState,key:'shards',id:string,feedback:string):RunState{
 if(!id||state[key].includes(id))return state;
 return {...state,[key]:[...state[key],id],feedback,feedbackSerial:state.feedbackSerial+1};
}

export const objectiveText=(s:RunState)=>s.phase==='beacons'
 ?`Wake the wind network · ${s.beacons.length}/3`
 :s.phase==='ascent'?`Power the ascent · ${s.motes.length}/5`:s.phase==='summit'?'Calm the summit guardian':'Galecrest Isle complete';
export const guidanceText=(s:RunState)=>s.phase==='beacons'
 ?'Search the Orchard, Amber Run, and Crystal Hollow for ◆ beacons.'
 :s.phase==='ascent'?'Follow the rising paths and gather every ⬟ mote.':s.phase==='summit'?'Bait its charge into the glowing conductor, then movement-attack the core.':'The Windglass Crest is yours.';
