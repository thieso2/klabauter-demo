import {describe,expect,it} from 'vitest';
import {BEACON_IDS,CHECKPOINTS,MOTE_IDS,initialRun,reduceRun} from './run-state';

const send=(events:Parameters<typeof reduceRun>[1][])=>events.reduce(reduceRun,initialRun());
describe('run state',()=>{
 it('accepts out-of-order beacons once and opens ascent on exactly three',()=>{
  const first=send([{type:'beacon',id:'hollow'},{type:'beacon',id:'hollow'},{type:'beacon',id:'orchard'}]);
  expect(first).toMatchObject({phase:'beacons',beacons:['hollow','orchard'],checkpoint:'landing'});
  expect(reduceRun(first,{type:'beacon',id:'amber'})).toMatchObject({phase:'ascent',checkpoint:'ascent'});
 });
 it('rejects early and duplicate motes then opens the summit after all five',()=>{
  let state=send([{type:'mote',id:'threshold'},...BEACON_IDS.map(id=>({type:'beacon' as const,id}))]);
  expect(state.motes).toEqual([]);
  for(const id of [...MOTE_IDS].reverse())state=reduceRun(state,{type:'mote',id});
  expect(state).toMatchObject({phase:'summit',checkpoint:'summit'});
  expect(reduceRun(state,{type:'mote',id:'threshold'})).toBe(state);
 });
 it('preserves durable collections and checkpoint while recovery resets feedback only',()=>{
  let state=send([...BEACON_IDS.map(id=>({type:'beacon' as const,id})),{type:'mote',id:'threshold'},{type:'shard',id:'s1'}]);
  const recovered=reduceRun(state,{type:'recover'});
  expect(recovered).toMatchObject({phase:'ascent',beacons:[...BEACON_IDS],motes:['threshold'],shards:['s1'],checkpoint:'ascent'});
  expect(CHECKPOINTS[recovered.checkpoint]).toEqual({x:-7,y:3,z:-15});
  state=MOTE_IDS.slice(1).reduce((s,id)=>reduceRun(s,{type:'mote',id}),recovered);
  expect(CHECKPOINTS[state.checkpoint]).toEqual({x:0,y:19,z:-52});
 });
 it('runs a monotonic timer and ignores duplicate optional shards',()=>{
  const state=send([{type:'tick',seconds:2},{type:'tick',seconds:-1},{type:'shard',id:'a'},{type:'shard',id:'a'},{type:'stop-timer'},{type:'tick',seconds:4}]);
  expect(state.elapsed).toBe(2);expect(state.shards).toEqual(['a']);expect(state.timerRunning).toBe(false);
 });
});
