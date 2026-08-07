import type { Settings } from './settings';

/** Small, original procedural soundscape. It has no samples or network requests. */
export class Soundscape {
  private context?: AudioContext; private master?: GainNode; private music?: GainNode; private effects?: GainNode; private timer?: number;
  start(settings: Settings) {
    if (!this.context) {
      const AudioContextClass = globalThis.AudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass(); this.master=this.context.createGain(); this.music=this.context.createGain(); this.effects=this.context.createGain();
      this.music.connect(this.master); this.effects.connect(this.master); this.master.connect(this.context.destination);
      let step=0; const notes=[196,246.94,293.66,369.99,293.66,220];
      this.timer=window.setInterval(()=>{if(!this.context||this.context.state!=='running'||!this.music)return;const now=this.context.currentTime,o=this.context.createOscillator(),g=this.context.createGain();o.type='triangle';o.frequency.value=notes[step++%notes.length];g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.055,now+.04);g.gain.exponentialRampToValueAtTime(.0001,now+.42);o.connect(g).connect(this.music);o.start(now);o.stop(now+.45)},520);
    }
    void this.context.resume().catch(()=>{}); this.update(settings);
  }
  update(settings: Settings) { if(!this.context||!this.master||!this.music||!this.effects)return;const t=this.context.currentTime;this.master.gain.setTargetAtTime(settings.masterVolume,t,.015);this.music.gain.setTargetAtTime(settings.musicVolume,t,.015);this.effects.gain.setTargetAtTime(settings.effectsVolume,t,.015) }
  cue(kind:'jump'|'progress'|'hurt'|'complete') { if(!this.context||!this.effects||this.context.state!=='running')return;const frequencies={jump:[280,410],progress:[440,660],hurt:[150,95],complete:[392,587]}[kind],now=this.context.currentTime,o=this.context.createOscillator(),g=this.context.createGain();o.type=kind==='hurt'?'sawtooth':'sine';o.frequency.setValueAtTime(frequencies[0],now);o.frequency.exponentialRampToValueAtTime(frequencies[1],now+.13);g.gain.setValueAtTime(.12,now);g.gain.exponentialRampToValueAtTime(.0001,now+.18);o.connect(g).connect(this.effects);o.start(now);o.stop(now+.2) }
  dispose(){if(this.timer)clearInterval(this.timer);void this.context?.close()}
}
