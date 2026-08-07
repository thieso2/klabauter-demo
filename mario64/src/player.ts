import type { Vec2 } from './input';

export type MoveState='idle'|'run'|'skid'|'jump'|'fall'|'slide'|'dive'|'groundPound'|'hang'|'climb'|'land'|'hurt'|'recover';
export interface Vec3{x:number;y:number;z:number}
export interface Surface { y:number; normal:Vec3; platform?:string; velocity?:Vec3 }
export interface WallHit { normal:Vec3; ledgeY?:number }
export interface PlayerWorld {
  ground(x:number,z:number,previousY:number):Surface|undefined;
  wall?(position:Vec3,velocity:Vec3):WallHit|undefined;
  bounds?:{minX:number;maxX:number;minZ:number;maxZ:number;voidY:number};
}
export interface PlayerState {
 position:Vec3; velocity:Vec3; grounded:boolean; facing:number; state:MoveState;
 jumpChain:number; chainTimer:number; coyote:number; jumpBuffer:number; wallGrace:number;
 crouching:boolean; platform?:string; fallPeak:number; stun:number; ledge?:{x:number;y:number;z:number;normal:Vec3};
}
export interface StepInput { move:Vec2;jumpPressed:boolean;run:boolean;cameraYaw:number;assist?:boolean;crouch?:boolean;crouchPressed?:boolean;divePressed?:boolean }

const FLAT:PlayerWorld={ground:()=>({y:.8,normal:{x:0,y:1,z:0}}),bounds:{minX:-15,maxX:15,minZ:-12,maxZ:12,voidY:-20}};
export const initialPlayer=(position:Vec3={x:0,y:.8,z:4}):PlayerState=>({position:{...position},velocity:{x:0,y:0,z:0},grounded:true,facing:Math.PI,state:'idle',jumpChain:0,chainTimer:0,coyote:.12,jumpBuffer:0,wallGrace:0,crouching:false,fallPeak:position.y,stun:0});

export function stepPlayer(s:PlayerState,input:StepInput,dt:number,world:PlayerWorld=FLAT):PlayerState{
 const n:PlayerState=structuredClone(s), assist=!!input.assist, coyoteMax=assist?.2:.12, bufferMax=assist?.2:.12;
 if(input.jumpPressed)n.jumpBuffer=bufferMax;else n.jumpBuffer=Math.max(0,n.jumpBuffer-dt);
 n.chainTimer=Math.max(0,n.chainTimer-dt);n.wallGrace=Math.max(0,n.wallGrace-dt);n.stun=Math.max(0,n.stun-dt);n.crouching=!!input.crouch;
 const mag=Math.min(1,Math.hypot(input.move.x,input.move.y)),c=Math.cos(input.cameraYaw),q=Math.sin(input.cameraYaw);
 const dx=mag? (input.move.x*c+input.move.y*q)/mag:0,dz=mag?(input.move.x*-q+input.move.y*c)/mag:0;
 const currentSpeed=Math.hypot(n.velocity.x,n.velocity.z), dot=currentSpeed? (n.velocity.x*dx+n.velocity.z*dz)/currentSpeed:1;
 if(n.state==='hurt'||n.state==='recover'){if(n.stun<=0)n.state=n.grounded?'idle':'fall';}
 if(n.state==='hang'){
   n.velocity={x:0,y:0,z:0};
   if(n.jumpBuffer>0&&n.ledge){n.state='climb';n.stun=.22;n.position.y=n.ledge.y+.82;n.position.x-=n.ledge.normal.x*.65;n.position.z-=n.ledge.normal.z*.65;n.grounded=true;n.jumpBuffer=0;}
   else if(input.crouch){n.state='fall';n.ledge=undefined;n.velocity.y=-1;}
   return n;
 }
 if(n.state==='climb'&&n.stun>0)return n;
 const canControl=n.state!=='hurt'&&n.state!=='recover'&&n.state!=='groundPound';
 // A ground move chosen this tick (skid, crouch slide, dive). The landing resolution below
 // re-derives a state every frame the player rests on a surface, so without remembering the
 // deliberate choice here it would immediately overwrite it with plain 'run'/'land'.
 let groundMove:MoveState|undefined;
 if(canControl){
   if(n.grounded&&dot<-.45&&currentSpeed>5){groundMove='skid';n.state='skid';n.velocity.x=approach(n.velocity.x,0,24*dt);n.velocity.z=approach(n.velocity.z,0,24*dt);}
   else {const speed=(input.run?8.5:5)*mag,accel=n.grounded?24:8;n.velocity.x=approach(n.velocity.x,dx*speed,accel*dt);n.velocity.z=approach(n.velocity.z,dz*speed,accel*dt);}
 }
 if(n.grounded){n.coyote=coyoteMax;n.fallPeak=n.position.y;
   if(input.crouch&&currentSpeed>4.2){groundMove='slide';n.state='slide';n.velocity.x*=1-.55*dt;n.velocity.z*=1-.55*dt;}
   if(input.divePressed&&currentSpeed>1){groundMove='slide';n.state='slide';n.velocity.x=dx*11;n.velocity.z=dz*11;}
 }else {n.coyote=Math.max(0,n.coyote-dt);n.fallPeak=Math.max(n.fallPeak,n.position.y);}
 if(input.crouchPressed&&!n.grounded&&n.state!=='groundPound'){n.state='groundPound';n.velocity.x*=.25;n.velocity.z*=.25;n.velocity.y=-15;}
 if(input.divePressed&&!n.grounded&&n.state!=='groundPound'){n.state='dive';n.velocity.x=Math.sin(n.facing)*12;n.velocity.z=Math.cos(n.facing)*12;n.velocity.y=1.5;}
 const wall=world.wall?.(n.position,n.velocity);
 if(wall&&!n.grounded){n.wallGrace=assist?.18:.11;
   if(n.velocity.y<1&&wall.ledgeY!==undefined&&wall.ledgeY-n.position.y>.35&&wall.ledgeY-n.position.y<1.45){n.state='hang';n.ledge={x:n.position.x,y:wall.ledgeY,z:n.position.z,normal:wall.normal};n.position.y=wall.ledgeY-.8;n.velocity={x:0,y:0,z:0};return n;}
   if(n.jumpBuffer>0){n.velocity.x=wall.normal.x*8;n.velocity.z=wall.normal.z*8;n.velocity.y=9;n.facing=Math.atan2(wall.normal.x,wall.normal.z);n.state='jump';n.jumpBuffer=0;n.wallGrace=0;}
 }
 if(n.jumpBuffer>0&&(n.grounded||n.coyote>0)){
   let vy=8.2;
   if(input.crouch&&mag>.35){vy=6.2;n.velocity.x=dx*11.5;n.velocity.z=dz*11.5;n.state='jump';}
   else if(input.crouch){vy=10.5;n.velocity.x=-Math.sin(n.facing)*3;n.velocity.z=-Math.cos(n.facing)*3;n.state='jump';}
   else if(dot<-.35&&currentSpeed>3){vy=10;n.velocity.x=dx*7;n.velocity.z=dz*7;n.state='jump';}
   else {n.jumpChain=n.chainTimer>0?Math.min(3,n.jumpChain+1):1;vy=n.jumpChain===3?11:n.jumpChain===2?9.2:8.2;n.state='jump';}
   n.velocity.y=vy;n.grounded=false;n.coyote=0;n.jumpBuffer=0;n.chainTimer=.42;
 }
 if(!n.grounded&&n.state!=='groundPound')n.velocity.y-=22*dt;
 n.position.x+=n.velocity.x*dt;n.position.y+=n.velocity.y*dt;n.position.z+=n.velocity.z*dt;
 const b=world.bounds;
 // Falling out of the level is decided before any surface is considered: resolving ground
 // first would let an out-of-bounds player be snapped back onto it and never recover.
 if(b&&n.position.y<b.voidY){Object.assign(n,initialPlayer());n.state='recover';n.stun=assist?.15:.35;return n;}
 const surface=world.ground(n.position.x,n.position.z,s.position.y);
 // Settle only onto a surface the player was standing on or descending toward. Landing purely
 // on "below the surface" would teleport a player who is under the floor back up onto it.
 if(surface&&n.velocity.y<=0&&n.position.y<=surface.y+.12&&s.position.y>=surface.y-.75){
   const impact=n.velocity.y,drop=n.fallPeak-surface.y;n.position.y=surface.y;n.velocity.y=0;n.grounded=true;n.platform=surface.platform;
   // Touching down opens the window to continue a jump chain; a completed triple starts over.
   if(!s.grounded){n.chainTimer=.42;if(n.jumpChain>=3)n.jumpChain=0;}
   if(surface.velocity){n.position.x+=surface.velocity.x*dt;n.position.y+=surface.velocity.y*dt;n.position.z+=surface.velocity.z*dt;}
   const steep=surface.normal.y<.68;
   if(steep){n.state='slide';n.velocity.x+=surface.normal.x*12*dt;n.velocity.z+=surface.normal.z*12*dt;n.grounded=false;}
   else if(n.state==='dive'||n.state==='groundPound')n.state=n.state==='dive'?'slide':'land';
   else if(drop>8||impact<-13){n.state='hurt';n.stun=assist?.25:.55;n.velocity.x*=.3;n.velocity.z*=.3;}
   else n.state=groundMove??(mag?'run':'land');
 }else if(!n.grounded&&n.state!=='dive'&&n.state!=='groundPound')n.state=n.velocity.y>0?'jump':'fall';
 if(n.grounded&&surface?.velocity){n.position.x+=surface.velocity.x*dt;n.position.y+=surface.velocity.y*dt;n.position.z+=surface.velocity.z*dt;}
 if(b){n.position.x=Math.max(b.minX,Math.min(b.maxX,n.position.x));n.position.z=Math.max(b.minZ,Math.min(b.maxZ,n.position.z));}
 if(Math.hypot(n.velocity.x,n.velocity.z)>.15)n.facing=Math.atan2(n.velocity.x,n.velocity.z);return n;
}
const approach=(v:number,t:number,d:number)=>v<t?Math.min(t,v+d):Math.max(t,v-d);
