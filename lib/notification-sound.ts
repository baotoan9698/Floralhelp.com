"use client";
let context: AudioContext | undefined;
export const soundEnabled = () => localStorage.getItem('floralhelp-sound') === 'on';
export async function unlockSound() {
 if (!soundEnabled()) return;
 context ??= new AudioContext();
 if(context.state === 'suspended') await context.resume();
}
export async function playTing(key?: string) {
 if(!soundEnabled()) return;
 if(key && localStorage.getItem(`floralhelp-heard:${key}`))return;
 await unlockSound();
 if(!context || context.state !== 'running')return;
 if(key)localStorage.setItem(`floralhelp-heard:${key}`,String(Date.now()));
 const start=context.currentTime;
 [1046.5,1568].forEach((frequency,index)=>{
  const oscillator=context!.createOscillator(),gain=context!.createGain();
  oscillator.type='sine';oscillator.frequency.value=frequency;
  const time=start+index*.14;
  gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(.16,time+.012);gain.gain.exponentialRampToValueAtTime(.0001,time+.85);
  oscillator.connect(gain);gain.connect(context!.destination);oscillator.start(time);oscillator.stop(time+.9);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
 });
}
