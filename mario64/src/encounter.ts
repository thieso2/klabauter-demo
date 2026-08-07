import type {MoveState,Vec3} from './player';

export type EnemyKind='charger'|'spitter'|'bloom';
export type EnemyMode='idle'|'telegraph'|'attack'|'cooldown'|'defeated';
export interface EnemyState{id:string;kind:EnemyKind;position:Vec3;home:Vec3;mode:EnemyMode;timer:number;facing:Vec3;hop:number}
export interface Projectile{id:number;position:Vec3;velocity:Vec3;life:number}
export type GuardianMode='dormant'|'telegraph'|'charge'|'exposed'|'recover'|'defeated';
export interface GuardianState{mode:GuardianMode;hits:number;timer:number;exposure:number;hitThisExposure:boolean;enabledConductor:number;position:Vec3;velocity:Vec3}
export interface EncounterState{health:number;maxHealth:number;invulnerable:number;enemies:EnemyState[];projectiles:Projectile[];guardian:GuardianState;nextProjectile:number;feedback:string;feedbackSerial:number}
export type AttackKind='none'|'stomp'|'dive'|'groundPound';
export interface EncounterInput{player:Vec3;playerVelocity:Vec3;playerMove:MoveState;phase:'beacons'|'ascent'|'summit';assist?:boolean}
export interface EncounterStep{state:EncounterState;damage?:{amount:number;source:Vec3};enemyDefeated?:string;guardianHit?:number;guardianDefeated?:boolean}

const enemy=(id:string,kind:EnemyKind,position:Vec3):EnemyState=>({id,kind,position:{...position},home:{...position},mode:'idle',timer:kind==='spitter'?.8:.3,facing:{x:0,y:0,z:1},hop:0});
export const initialEncounter=():EncounterState=>({health:6,maxHealth:6,invulnerable:0,enemies:[
 enemy('gale-runner','charger',{x:12,y:1.5,z:5}),enemy('puff-hopper','spitter',{x:-15,y:1.1,z:3}),enemy('thorn-bloom','bloom',{x:1,y:1.8,z:-7})
],projectiles:[],guardian:{mode:'dormant',hits:0,timer:0,exposure:0,hitThisExposure:false,enabledConductor:0,position:{x:0,y:22,z:-65},velocity:{x:0,y:0,z:0}},nextProjectile:1,feedback:'',feedbackSerial:0});

export function attackKind(move:MoveState,velocity:Vec3):AttackKind{
 if(move==='groundPound')return'groundPound';if(move==='dive'||move==='slide')return'dive';if((move==='fall'||move==='jump')&&velocity.y<0)return'stomp';return'none';
}
export function resetTransient(s:EncounterState,objectiveThree=false):EncounterState{
 const fresh=initialEncounter();return {...fresh,health:s.maxHealth,guardian:objectiveThree?fresh.guardian:{...fresh.guardian,hits:s.guardian.hits},feedback:'Encounter reset · health restored',feedbackSerial:s.feedbackSerial+1};
}
// Assist mode's promise is "less damage": every hit costs half of what it otherwise would, so the
// same six-pip health bar absorbs twice as many. Returning the amount unchanged, as before, made
// the setting purely cosmetic.
export const assistedDamage=(amount:number,assist?:boolean)=>assist?amount/2:amount;
export function heal(s:EncounterState,amount:number):EncounterState{return amount>0&&s.health<s.maxHealth?{...s,health:Math.min(s.maxHealth,s.health+amount),feedback:'Health restored',feedbackSerial:s.feedbackSerial+1}:s}
export function damage(s:EncounterState,amount:number):EncounterState{
 if(amount<=0||s.invulnerable>0||s.guardian.mode==='defeated')return s;return {...s,health:Math.max(0,s.health-amount),invulnerable:1.05,feedback:`Impact · ${Math.max(0,s.health-amount)}/${s.maxHealth} health`,feedbackSerial:s.feedbackSerial+1};
}

export function stepEncounter(source:EncounterState,input:EncounterInput,dt:number):EncounterStep{
 const s:EncounterState=structuredClone(source),result:EncounterStep={state:s};s.invulnerable=Math.max(0,s.invulnerable-dt);const attack=attackKind(input.playerMove,input.playerVelocity);
 // Pellets fired this tick are held back from the integration pass below. Letting them move a
 // full frame from their muzzle would skip them past anything standing close to the shooter.
 const spawned:Projectile[]=[];
 for(const e of s.enemies){if(e.mode==='defeated')continue;e.timer-=dt;const dx=input.player.x-e.position.x,dz=input.player.z-e.position.z,d=Math.hypot(dx,dz),nearY=Math.abs(input.player.y-e.position.y)<1.8;
  if(d<1.25&&nearY&&attack!=='none'&&input.player.y>=e.position.y+.35){e.mode='defeated';e.timer=0;result.enemyDefeated=e.id;s.feedback=`${e.kind} dispersed`;s.feedbackSerial++;continue}
  if(e.kind==='charger')stepCharger(e,dx,dz,d,dt);
  else if(e.kind==='spitter'){e.hop=Math.max(0,Math.sin((e.timer+2)*5))*.28;if(e.mode==='telegraph'&&e.timer<=0){const n=Math.max(.001,d);spawned.push({id:s.nextProjectile++,position:{x:e.position.x,y:e.position.y+.65,z:e.position.z},velocity:{x:dx/n*4.2,y:1.2,z:dz/n*4.2},life:4});e.mode='cooldown';e.timer=2.2}else if((e.mode==='idle'||e.mode==='cooldown')&&e.timer<=0&&d<14){e.mode='telegraph';e.timer=.55}}
  else {if(d<3.2){e.mode=e.timer>.35?'telegraph':'attack';if(e.timer<=0)e.timer=1.15}else e.mode='idle'}
  if(d<1.05&&nearY&&attacking(e))result.damage??={amount:1,source:e.position};
 }
 s.projectiles=s.projectiles.filter(p=>{p.life-=dt;p.position.x+=p.velocity.x*dt;p.position.y+=p.velocity.y*dt;p.position.z+=p.velocity.z*dt;p.velocity.y-=2.5*dt;if(p.life>0&&distance(p.position,input.player)<.75){result.damage??={amount:1,source:p.position};return false}return p.life>0});
 s.projectiles.push(...spawned);
 if(input.phase==='summit')stepGuardian(s,input,dt,result);else s.guardian.mode='dormant';
 return result;
}
function stepCharger(e:EnemyState,dx:number,dz:number,d:number,dt:number){if(e.mode==='idle'&&d<10){e.mode='telegraph';e.timer=.75;e.facing={x:dx/Math.max(d,.01),y:0,z:dz/Math.max(d,.01)}}else if(e.mode==='telegraph'&&e.timer<=0){e.mode='attack';e.timer=.8}else if(e.mode==='attack'){e.position.x+=e.facing.x*10*dt;e.position.z+=e.facing.z*10*dt;if(e.timer<=0){e.mode='cooldown';e.timer=1.3}}else if(e.mode==='cooldown'&&e.timer<=0){e.position={...e.home};e.mode='idle'}}
function stepGuardian(s:EncounterState,input:EncounterInput,dt:number,result:EncounterStep){const g=s.guardian;if(g.mode==='dormant'){g.mode='telegraph';g.timer=1.35;g.enabledConductor=g.hits%3;return}g.timer-=dt;
 if(g.mode==='telegraph'&&g.timer<=0){const dx=input.player.x-g.position.x,dz=input.player.z-g.position.z,n=Math.max(.01,Math.hypot(dx,dz));g.velocity={x:dx/n*(7+g.hits*1.2),y:0,z:dz/n*(7+g.hits*1.2)};g.mode='charge';g.timer=1.7}
 else if(g.mode==='charge'){g.position.x+=g.velocity.x*dt;g.position.z+=g.velocity.z*dt;const c=conductors[g.enabledConductor];if(distanceXZ(g.position,c)<1.5){g.mode='exposed';g.timer=4+(input.assist?.4:0);g.exposure++;g.hitThisExposure=false;s.feedback='Conductor struck · core exposed!';s.feedbackSerial++}else if(g.timer<=0){g.position={x:0,y:22,z:-65};g.mode='telegraph';g.timer=Math.max(.65,1.25-g.hits*.15)}}
 else if(g.mode==='exposed'){if(!g.hitThisExposure&&attackKind(input.playerMove,input.playerVelocity)!=='none'&&distance(input.player,g.position)<1.8){g.hitThisExposure=true;g.hits++;result.guardianHit=g.hits;s.feedback=`Core struck · ${g.hits}/3`;s.feedbackSerial++;if(g.hits===3){g.mode='defeated';result.guardianDefeated=true;s.feedback='Guardian calmed · claim the Windglass Crest';s.feedbackSerial++}else{g.mode='recover';g.timer=.9}}else if(g.timer<=0){g.mode='recover';g.timer=.65}}
 else if(g.mode==='recover'&&g.timer<=0){g.position={x:0,y:22,z:-65};g.enabledConductor=(g.enabledConductor+1)%3;g.mode='telegraph';g.timer=Math.max(.65,1.2-g.hits*.16)}}
export const conductors:readonly Vec3[]=[{x:-8,y:21,z:-68},{x:8,y:21,z:-68},{x:0,y:21,z:-58}];
// Read through a helper so the check sees the full EnemyMode union: the per-kind updates above
// reach 'attack' through mutation that narrowing cannot follow.
const attacking=(e:EnemyState)=>e.mode==='attack';
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z),distanceXZ=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.z-b.z);
