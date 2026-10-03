const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=require('path').resolve(__dirname,'..')+'/';
class El{
 constructor(id){this.id=id;this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.listeners={};this.style={};this.dataset={};this.open=false;this.tagName='BUTTON';this.attrs={};this.classList={add(){},remove(){}};}
 addEventListener(t,f){(this.listeners[t]??=[]).push(f)}
 setAttribute(k,v){this.attrs[k]=v}replaceChildren(){this.children=[]}append(x){(this.children??=[]).push(x)}focus(){document.activeElement=this}
 showModal(){this.open=true}close(){this.open=false}
 getContext(){return {fillRect(){},drawImage(b){drawn.push(b.frame)}}}
 play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}
}
const ids=[...fs.readFileSync(root+'index.html','utf8').matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
const els=Object.fromEntries(ids.map(id=>[id,new El(id)]));els.picture.width=960;els.picture.height=720;els.volume.value='.22';
const document={hidden:false,body:new El('body'),getElementById:id=>els[id],createElement:()=>new El('p'),listeners:{},addEventListener(t,f){(this.listeners[t]??=[]).push(f)},fullscreenEnabled:false};
let drawn=[],nextId=0,rafs=new Map(),timers=new Map(),requests=0,maxRequests=0,closed=0,failed=new Set(),slow=new Set(),deferred=[];
const sandbox={console,document,matchMedia:()=>({matches:true}),DOMException,AbortController,Image:class{},URL,Map,Promise,Error,Array,Number,String,Math,Boolean,
 setTimeout(fn,ms){const id=++nextId;if(ms>=1000)timers.set(id,fn);else queueMicrotask(fn);return id},clearTimeout(id){timers.delete(id)},
 requestAnimationFrame(fn){const id=++nextId;rafs.set(id,fn);return id},cancelAnimationFrame(id){rafs.delete(id)},
 async fetch(path,opts={}){
  if(!path.startsWith('frames/'))return {ok:true,json:async()=>JSON.parse(fs.readFileSync(root+path))};
  const frame=+path.match(/\d+/)[0];requests++;maxRequests=Math.max(maxRequests,requests);
  try{
   await new Promise((resolve,reject)=>{const go=()=>opts.signal?.aborted?reject(new DOMException('Abort','AbortError')):resolve();if(slow.has(frame))deferred.push(go);else setImmediate(go);opts.signal?.addEventListener('abort',()=>reject(new DOMException('Abort','AbortError')),{once:true});});
   if(failed.has(frame))return {ok:false};
   return {ok:true,blob:async()=>({frame,width:414,height:311})};
  }finally{requests--;}
 },async createImageBitmap(blob){return {...blob,close(){closed++}}}
};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(root+'script.js','utf8'),sandbox);
const run=code=>vm.runInContext(code,sandbox);
const settle=async(n=35)=>{for(let i=0;i<n;i++)await new Promise(setImmediate)};
async function event(id,type){for(const f of els[id].listeners[type]??[])await f({target:els[id],preventDefault(){}});await settle();}
function tick(t){const jobs=[...rafs.values()];rafs.clear();for(const fn of jobs)fn(t)}
(async()=>{
 await settle();assert.equal(els.cover.disabled,false);assert.equal(run('manifest.frames.length'),1716);assert.equal(els.audio.paused,undefined);
 await event('cover','click');assert.equal(run('state'),'paused');assert.equal(run('index'),0);assert.equal(drawn[0],1);assert.equal(els.audio.paused,true);
 await event('play','click');assert.equal(run('state'),'playing');let t=100;
 for(let i=0;i<100;i++){tick(t);t+=84;await settle(3);assert(rafs.size<=1)}
 assert(drawn.length>90);assert(drawn.every((n,i)=>i===0||n===drawn[i-1]+1));assert(run('pool.cache.size')<=52);assert(maxRequests<=4);
 await event('play','click');const saved=run('index');await event('read-story','click');assert.equal(run('state'),'reading');assert.equal(els.reader.open,true);assert.equal(run('index'),saved);
 await event('resume','click');assert.equal(run('index'),saved);assert.equal(run('state'),'playing');assert.equal(els.reader.open,false);
 // Rapid seek: a delayed old destination must never paint after a new one.
 slow.add(601);run('seek(600,true)');await settle(2);run('seek(1200,false)');await settle();for(const fn of deferred)fn();deferred=[];await settle();assert.equal(run('index'),1200);assert.equal(drawn.at(-1),1201);assert(maxRequests<=4);
 failed.add(1501);await run('seek(1500,true)');await settle();assert.equal(run('index'),1200);assert.equal(els.retry.hidden,false);failed.clear();await event('retry','click');assert.equal(run('index'),1500);assert.equal(run('state'),'playing');
 els.speed.value='24';await event('speed','change');assert.equal(run('fps'),24);assert.equal(els.duration.textContent,'1:11');
 await run('seek(1715,true)');await settle();tick(1000);tick(1050);assert.equal(timers.size,1);assert.equal(drawn.at(-1),1716);
 for(const [id,fn] of [...timers]){timers.delete(id);fn()}assert.equal(run('state'),'envelope');assert.equal(els.ending.hidden,false);
 await event('envelope','click');assert.equal(run('state'),'letter');assert.equal(els['reader-text'].children.length,16);
 await event('letter-replay','click');await settle();assert.equal(run('index'),0);assert.equal(run('fps'),24);assert.equal(run('state'),'playing');assert.equal(els.audio.currentTime,0);assert.equal(timers.size,0);assert.equal(els.reader.open,false);
 document.hidden=true;for(const fn of document.listeners.visibilitychange)fn();assert.equal(run('state'),'paused');assert.equal(els.audio.paused,true);assert.equal(rafs.size,0);
 document.hidden=false;for(const fn of document.listeners.visibilitychange)fn();assert.equal(run('state'),'paused');
 // Replay invalidates the previous ending timer.
 await run('seek(1715,true)');await settle();tick(2000);tick(2050);assert.equal(timers.size,1);run('replay()');await settle();assert.equal(timers.size,0);assert.equal(run('index'),0);
 // Mute and volume preferences survive replay.
 await event('music','click');els.volume.value='.35';await event('volume','input');run('replay()');await settle();assert.equal(run('musicEnabled'),false);assert.equal(els.volume.value,'.35');assert.equal(els.audio.paused,true);
 console.log(JSON.stringify({passed:true,checks:['no autoplay','reduced motion waits','sequential frames','single RAF','bounded cache/concurrency','story resumes in place','stale seek ignored','load error/retry','speed/time','ending once','letter complete','replay clears timers','hidden tab pauses','music preferences'],drawCount:drawn.length,maxRequests,cacheSize:run('pool.cache.size'),releasedBitmaps:closed},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
