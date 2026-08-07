import {describe,expect,it} from 'vitest';
import {BEACON_IDS,MOTE_IDS,initialRun,reduceRun} from './run-state';
import {initialEncounter,stepEncounter} from './encounter';

describe('start-to-finish smoke seam',()=>{
 it('passes the real objective gates, three valid exposures, and crest completion',()=>{
  let run=initialRun();for(const id of BEACON_IDS)run=reduceRun(run,{type:'beacon',id});expect(run.phase).toBe('ascent');
  for(const id of MOTE_IDS)run=reduceRun(run,{type:'mote',id});expect(run.phase).toBe('summit');
  let encounter=initialEncounter();for(let hit=1;hit<=3;hit++){encounter.guardian.mode='exposed';encounter.guardian.timer=3;encounter.guardian.position={x:0,y:20,z:-64};encounter.guardian.hitThisExposure=false;const result=stepEncounter(encounter,{player:{x:0,y:21,z:-64},playerVelocity:{x:0,y:-4,z:0},playerMove:'groundPound',phase:'summit'},1/60);expect(result.guardianHit).toBe(hit);encounter=result.state}
  expect(encounter.guardian.mode).toBe('defeated');run=reduceRun(run,{type:'tick',seconds:83.25});run=reduceRun(run,{type:'complete'});expect(run).toMatchObject({phase:'complete',timerRunning:false,elapsed:83.25});expect(reduceRun(run,{type:'tick',seconds:10}).elapsed).toBe(83.25);
 });
});
