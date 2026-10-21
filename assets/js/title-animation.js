
/* Title scramble, adapted from bas3line/ascii scramble.ts (MIT, see licence above).
   Columns break into noise left to right, then settle back in the same direction.
   The trailing "_" cursor is left out of the effect. */
(function(){
const el=document.querySelector('.archive-title .scramble');if(!el)return;
const TEXT=el.textContent,N=TEXT.length;
const GLYPHS="!<>-\\/[]{}=+*^?#%&$@0123456789abcdefxyz"; // source set without "_"
const OUT=.022,IN=.05,LEAD=.32,FPS=20,REPEAT=9000;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const hash=(a,b)=>{let h=Math.imul(a|0,374761393)+Math.imul(b|0,668265263);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
const esc=c=>c==='&'?'&amp;':c==='<'?'&lt;':c==='>'?'&gt;':c;
let run=0,t0=0,tOut=[],tIn=[],timer=null,loop=null;
function plan(fromNoise){run++;const outEnd=fromNoise?0:N*OUT+.06;
 tOut=[...TEXT].map((_,i)=>fromNoise?-1:i*OUT+hash(i,run*7)*.06);
 tIn=[...TEXT].map((_,i)=>outEnd+LEAD+i*IN+hash(i,run*7+3)*.14);}
function draw(t){const tick=Math.floor(t*FPS);let html='',done=true;
 for(let i=0;i<N;i++){const c=TEXT[i];
  if(c===' '||t<tOut[i]){html+=esc(c);if(c!==' ')done=false;continue}
  if(t<tIn[i]){html+='<span class="g">'+esc(GLYPHS[Math.floor(hash(i,tick+run*977)*GLYPHS.length)])+'</span>';done=false}
  else html+=esc(c);}
 el.innerHTML=html;return done&&t>=Math.max(...tIn);}
function step(){timer=null;const t=(performance.now()-t0)/1000;if(draw(t)){el.textContent=TEXT;return}timer=setTimeout(step,1000/FPS);}
function play(fromNoise){if(reduced.matches||document.hidden){el.textContent=TEXT;return}
 if(timer)return; // let a running pass finish
 plan(fromNoise);t0=performance.now();step();}
function schedule(){clearInterval(loop);loop=null;if(!reduced.matches)loop=setInterval(()=>play(false),REPEAT);}
const title=el.closest('h1');
title.addEventListener('pointerenter',()=>play(false));
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);timer=null;el.textContent=TEXT}});
reduced.addEventListener('change',()=>{clearTimeout(timer);timer=null;el.textContent=TEXT;schedule()});
play(true);schedule();
})();
