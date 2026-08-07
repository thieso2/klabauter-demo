import * as THREE from 'three';
import {InputNormalizer,type FrameInput,type Action} from './input';
import {initialPlayer,stepPlayer,type PlayerState,type PlayerWorld,type Surface,type Vec3} from './player';
import type {Settings} from './settings';

interface Pad{x:number;z:number;y:number;w:number;d:number;h?:number;color?:string;name?:string;motion?:{axis:'x'|'z'|'y';range:number;speed:number;phase:number};mesh?:THREE.Mesh;last?:Vec3}
const pads:Pad[]=[
 {x:0,z:8,y:.8,w:14,d:10,color:'#d5b967',name:'Landing Shelf'},
 {x:-15,z:3,y:1.1,w:15,d:7,color:'#afc477',name:'Whispering Orchard'},
 {x:14,z:5,y:1.5,w:14,d:6,color:'#d8a75e',name:'Amber Run'},
 {x:1,z:-7,y:1.8,w:10,d:11,color:'#91b991',name:'Crystal Hollow'},
 {x:-7,z:-15,y:3,w:8,d:4},{x:2,z:-19,y:4.5,w:9,d:4},{x:11,z:-16,y:6,w:8,d:4},
 {x:16,z:-22,y:7.5,w:5,d:5,motion:{axis:'x',range:4,speed:.8,phase:0},name:'Wind Ferry'},
 {x:8,z:-28,y:9,w:6,d:5},{x:0,z:-31,y:11,w:4,d:5},{x:-6,z:-34,y:13,w:4,d:5},
 {x:-1,z:-41,y:15,w:5,d:5,motion:{axis:'z',range:4,speed:.65,phase:1.2},name:'Cloud Lift'},
 {x:7,z:-45,y:17,w:6,d:6},{x:0,z:-52,y:19,w:9,d:5},
 {x:0,z:-64,y:21,w:25,d:18,color:'#c4b27e',name:'Galecrest Crown'},
 // broad recovery terraces beneath the ascent
 {x:3,z:-23,y:1,w:28,d:7,color:'#789b78'},{x:-1,z:-38,y:2,w:25,d:7,color:'#789b78'},{x:3,z:-50,y:3,w:28,d:7,color:'#789b78'}
];
const walls=[{x:3,z:-31,y:13,w:.8,d:5,h:8},{x:-3,z:-34,y:15,w:.8,d:5,h:8},{x:0,z:-48,y:20,w:7,d:.8,h:5}];

export class Game{
 readonly input=new InputNormalizer();private renderer:THREE.WebGLRenderer;private scene=new THREE.Scene();private camera=new THREE.PerspectiveCamera(58,1,.1,150);private hero:THREE.Group;private state:PlayerState=initialPlayer();private accumulator=0;private last=0;private elapsed=0;private running=false;private yaw=0;private pitch=.45;private distance=9;private world:PlayerWorld;
 constructor(private host:HTMLElement,private settings:Settings,private onPause:()=>void){
  this.renderer=new THREE.WebGLRenderer({antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;host.prepend(this.renderer.domElement);
  this.scene.background=new THREE.Color('#86c9d5');this.scene.fog=new THREE.Fog('#86c9d5',48,115);this.scene.add(new THREE.HemisphereLight('#fff5ce','#274c59',2.4));const sun=new THREE.DirectionalLight('#fff0ad',2.7);sun.position.set(-18,35,12);sun.castShadow=true;this.scene.add(sun);
  this.buildIsland();this.world={ground:(x,z,py)=>this.ground(x,z,py),wall:(p,v)=>this.wall(p,v),bounds:{minX:-35,maxX:35,minZ:-78,maxZ:18,voidY:this.settings.assist?-5:-10}};
  this.hero=this.makeHero();this.scene.add(this.hero);this.bind();this.resize();
 }
 start(){this.running=true;this.last=performance.now();requestAnimationFrame(this.loop)}stop(){this.running=false;this.input.clearAll()}resume(){if(!this.running)this.start()}updateSettings(s:Settings){this.settings=s;if(this.world.bounds)this.world.bounds.voidY=s.assist?-5:-10}
 private buildIsland(){
  const stone=new THREE.MeshStandardMaterial({color:'#617a70',flatShading:true,roughness:1});
  for(const p of pads){const m=new THREE.Mesh(new THREE.BoxGeometry(p.w,Math.max(1,p.h??1.4),p.d),new THREE.MeshStandardMaterial({color:p.color??'#d0bb78',flatShading:true,roughness:.95}));m.position.set(p.x,p.y-(p.h??1.4)/2,p.z);m.castShadow=m.receiveShadow=true;p.mesh=m;p.last={x:p.x,y:p.y,z:p.z};this.scene.add(m);if(p.name)this.marker(p.name,p.x,p.y+.08,p.z);}
  for(const w of walls){const m=new THREE.Mesh(new THREE.BoxGeometry(w.w,w.h,w.d),stone);m.position.set(w.x,w.y-w.h/2,w.z);m.castShadow=true;this.scene.add(m)}
  // Original route language: curved wind arches, branch cairns, and a many-pointed summit canopy.
  for(let i=0;i<18;i++){const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.45+(i%4)*.18,0),stone);const a=i*2.4,r=10+i%8;rock.position.set(Math.sin(a)*r,.5,7+Math.cos(a)*r);rock.scale.y=1.6;this.scene.add(rock)}
  for(const [x,z,c] of [[-19,2,'#77d7dd'],[17,6,'#ffbd62'],[0,-10,'#ad8ee8']] as [number,number,string][]){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.2,.16,6,12),new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:.25}));ring.position.set(x,3,z);ring.rotation.x=Math.PI/2;this.scene.add(ring)}
  for(let i=0;i<7;i++){const fin=new THREE.Mesh(new THREE.ConeGeometry(.45,3.5,3),new THREE.MeshStandardMaterial({color:'#e8dfb3',flatShading:true}));const a=i/7*Math.PI*2;fin.position.set(Math.sin(a)*9,23, -64+Math.cos(a)*6);fin.rotation.z=a;this.scene.add(fin)}
 }
 private marker(label:string,x:number,y:number,z:number){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.09,1.8,5),new THREE.MeshStandardMaterial({color:'#f3e6b0'}));pole.position.set(x,y+.9,z);pole.userData.label=label;this.scene.add(pole)}
 private ground(x:number,z:number,previousY:number):Surface|undefined{let best:Surface|undefined;for(const p of pads){const pos=p.mesh?.position??new THREE.Vector3(p.x,p.y,p.z),top=pos.y+(p.h??1.4)/2;if(Math.abs(x-pos.x)<=p.w/2+.38&&Math.abs(z-pos.z)<=p.d/2+.38&&top<=previousY+.9&&(!best||top>best.y)){const velocity=p.last?{x:(pos.x-p.last.x)*60,y:(top-p.last.y)*60,z:(pos.z-p.last.z)*60}:{x:0,y:0,z:0};best={y:top,normal:{x:0,y:1,z:0},platform:p.motion?p.name:undefined,velocity}}}return best}
 private wall(p:Vec3,v:Vec3){for(const w of walls)if(Math.abs(p.x-w.x)<w.w/2+.55&&Math.abs(p.z-w.z)<w.d/2+.55&&p.y>w.y-w.h&&p.y<w.y+.4){const nx=Math.abs(p.x-w.x)/(w.w/2) > Math.abs(p.z-w.z)/(w.d/2)?Math.sign(p.x-w.x):0;return{normal:{x:nx,y:0,z:nx?0:Math.sign(p.z-w.z)},ledgeY:w.y}}return undefined}
 private updatePlatforms(dt:number){this.elapsed+=dt;for(const p of pads)if(p.motion&&p.mesh&&p.last){p.last={x:p.mesh.position.x,y:p.mesh.position.y+(p.h??1.4)/2,z:p.mesh.position.z};const d=Math.sin(this.elapsed*p.motion.speed+p.motion.phase)*p.motion.range;p.mesh.position[p.motion.axis]=(p as unknown as Record<string,number>)[p.motion.axis]+d}}
 private loop=(now:number)=>{if(!this.running)return;const elapsed=Math.min(.1,(now-this.last)/1000);this.last=now;this.accumulator+=elapsed;const frame=this.poll();this.orbit(frame);while(this.accumulator>=1/60){this.updatePlatforms(1/60);this.state=stepPlayer(this.state,{move:frame.move,jumpPressed:frame.pressed.has('jump'),run:frame.held.run,crouch:frame.held.crouch,crouchPressed:frame.pressed.has('crouch'),divePressed:frame.pressed.has('dive'),cameraYaw:this.yaw,assist:this.settings.assist},1/60,this.world);this.accumulator-=1/60;frame.pressed.clear()}this.hero.position.set(this.state.position.x,this.state.position.y-.8,this.state.position.z);this.hero.rotation.y=this.state.facing;this.hero.scale.y=this.state.state==='slide'||this.state.state==='dive'?0.65:1;this.placeCamera();this.renderer.render(this.scene,this.camera);requestAnimationFrame(this.loop)};
 private poll(){const p=(navigator.getGamepads?.()??[])[0];if(p){this.input.setMove('gamepad',{x:dead(p.axes[0]),y:dead(p.axes[1])});this.input.setCamera('gamepad',{x:dead(p.axes[2]),y:dead(p.axes[3])},performance.now());this.input.addZoom(((p.buttons[7]?.value??0)-(p.buttons[6]?.value??0))*3);for(const a of ['jump','run','crouch','dive','recenter','pause'] as Action[])this.input.setButton('gamepad',a,!!p.buttons[this.settings.gamepad[a]]?.pressed)}const f=this.input.sample();if(f.pressed.has('pause'))this.onPause();return f}
 private orbit(f:FrameInput){if(f.pressed.has('recenter'))this.yaw=this.state.facing+Math.PI;const scale=.025*this.settings.sensitivity;this.yaw-=f.camera.x*scale;this.pitch=Math.max(.15,Math.min(1.15,this.pitch+f.camera.y*scale*(this.settings.invertY?-1:1)));this.distance=Math.max(4,Math.min(13,this.distance+f.zoom*.008))}
 private placeCamera(){const target=new THREE.Vector3(this.state.position.x,this.state.position.y+.8,this.state.position.z),dir=new THREE.Vector3(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch));this.camera.position.copy(target).addScaledVector(dir,this.distance);this.camera.lookAt(target)}
 private makeHero(){const g=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:'#f5e7a8',flatShading:true}),accent=new THREE.MeshStandardMaterial({color:'#247986',flatShading:true});const body=new THREE.Mesh(new THREE.OctahedronGeometry(.55,1),mat);body.position.y=.65;const head=new THREE.Mesh(new THREE.DodecahedronGeometry(.4,0),accent);head.position.y=1.45;const wing=new THREE.Mesh(new THREE.ConeGeometry(.28,.8,3),accent);wing.rotation.z=Math.PI/2;wing.position.set(0,.8,.45);g.add(body,head,wing);g.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=true});return g}
 private bind(){const keys=new Set<string>(),sync=()=>{this.input.setMove('keyboard',{x:Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),y:Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))});for(const a of ['jump','run','crouch','dive','recenter','pause'] as Action[])this.input.setButton('keyboard',a,keys.has(this.settings.keyboard[a]))};addEventListener('keydown',e=>{keys.add(e.code);sync();if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault()});addEventListener('keyup',e=>{keys.delete(e.code);sync()});let drag=false,px=0,py=0;this.renderer.domElement.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'){if(e.button===0)this.input.setButton('mouse','dive',true);drag=true;px=e.clientX;py=e.clientY;this.renderer.domElement.setPointerCapture(e.pointerId)}});this.renderer.domElement.addEventListener('pointermove',e=>{if(drag){this.input.setCamera('mouse',{x:e.clientX-px,y:e.clientY-py});px=e.clientX;py=e.clientY}});this.renderer.domElement.addEventListener('pointerup',()=>{drag=false;this.input.setButton('mouse','dive',false)});this.renderer.domElement.addEventListener('wheel',e=>{this.input.addZoom(e.deltaY);e.preventDefault()},{passive:false});addEventListener('gamepaddisconnected',()=>this.input.clearSource('gamepad'));addEventListener('resize',()=>this.resize())}
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix()}
}
const dead=(v=0)=>Math.abs(v)<.16?0:v;
