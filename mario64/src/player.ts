import type { Vec2 } from './input';
export interface PlayerState { position:{x:number;y:number;z:number}; velocity:{x:number;y:number;z:number}; grounded:boolean; facing:number }
export interface StepInput { move:Vec2; jumpPressed:boolean; run:boolean; cameraYaw:number; assist?:boolean }
export const initialPlayer = ():PlayerState => ({position:{x:0,y:0.8,z:4},velocity:{x:0,y:0,z:0},grounded:true,facing:Math.PI});
export function stepPlayer(s:PlayerState,input:StepInput,dt:number):PlayerState {
 const n:PlayerState=structuredClone(s), speed=input.run?8:5, c=Math.cos(input.cameraYaw), q=Math.sin(input.cameraYaw);
 const tx=(input.move.x*c+input.move.y*q)*speed, tz=(input.move.x*-q+input.move.y*c)*speed, accel=n.grounded?18:6;
 n.velocity.x=approach(n.velocity.x,tx,accel*dt); n.velocity.z=approach(n.velocity.z,tz,accel*dt);
 if(input.jumpPressed&&n.grounded){n.velocity.y=input.assist?9:8.2;n.grounded=false;} n.velocity.y-=22*dt;
 n.position.x+=n.velocity.x*dt;n.position.y+=n.velocity.y*dt;n.position.z+=n.velocity.z*dt;
 n.position.x=Math.max(-15,Math.min(15,n.position.x));n.position.z=Math.max(-12,Math.min(12,n.position.z));
 if(n.position.y<=0.8){n.position.y=0.8;n.velocity.y=0;n.grounded=true;}
 if(Math.hypot(n.velocity.x,n.velocity.z)>.1)n.facing=Math.atan2(n.velocity.x,n.velocity.z); return n;
}
const approach=(v:number,t:number,d:number)=>v<t?Math.min(t,v+d):Math.max(t,v-d);
