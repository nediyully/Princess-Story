'use strict';
/* No dependencies. Frame order comes exclusively from manifest.json. */
const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const ui = Object.fromEntries(['cover','opening','viewer','ending','play','progress','speed','status','retry','picture','reader','audio','music','volume'].map(id=>[id,$(id)]));
let config, manifest, story, letter, pool;
let state='closed', index=0, fps=12, epoch=0, raf=0, last=0, elapsed=0, endTimer=0;
let displayed=false, desiredIndex=0;
let opened=false, opening=false, wantsPlay=false, musicEnabled=true, musicAvailable=false, musicBlocked=false;
let retryAction=null, dialogKind=null, returnFocus=null, priorState='paused';
const ctx=ui.picture.getContext('2d',{alpha:false});
const time = seconds => `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));

class FramePool {
  constructor(frames){this.frames=frames;this.cache=new Map();this.jobs=new Map();this.queue=[];this.active=0;this.center=0;this.errors=new Map();this.maxConcurrent=4;}
  window(center){
    this.center=center;
    const allowed=i=>i>=Math.max(0,center-4)&&i<=Math.min(this.frames.length-1,center+47);
    for(const [i,bitmap] of this.cache) if(!allowed(i)){bitmap.close?.();this.cache.delete(i);}
    for(const [i,job] of this.jobs) if(!allowed(i)){
      if(job.active){job.controller.abort();this.jobs.delete(i);}
      else {this.jobs.delete(i);job.reject(new DOMException('Superseded','AbortError'));}
    }
    this.queue=this.queue.filter(job=>this.jobs.get(job.i)===job&&!job.controller.signal.aborted);
    for(const i of this.errors.keys())if(!allowed(i))this.errors.delete(i);
    for(let i=center;i<=Math.min(this.frames.length-1,center+47);i++)this.get(i).catch(()=>{});
  }
  get(i,priority=false){
    if(this.cache.has(i))return Promise.resolve(this.cache.get(i));
    if(this.errors.has(i))return Promise.reject(this.errors.get(i));
    if(this.jobs.has(i)){
      const job=this.jobs.get(i);
      if(priority&&!job.active){this.queue=this.queue.filter(x=>x!==job);this.queue.unshift(job);}
      return job.promise;
    }
    const job={i,controller:new AbortController(),active:false};
    job.promise=new Promise((resolve,reject)=>{job.resolve=resolve;job.reject=reject;});
    this.jobs.set(i,job);priority?this.queue.unshift(job):this.queue.push(job);this.pump();return job.promise;
  }
  pump(){
    while(this.active<this.maxConcurrent&&this.queue.length){
      const job=this.queue.shift();if(this.jobs.get(job.i)!==job)continue;
      job.active=true;this.active++;
      this.fetchFrame(job).then(bitmap=>{
        if(job.controller.signal.aborted||job.i<this.center-4||job.i>this.center+47){bitmap.close?.();throw new DOMException('Superseded','AbortError');}
        this.cache.set(job.i,bitmap);job.resolve(bitmap);
      }).catch(error=>{if(error.name!=='AbortError')this.errors.set(job.i,error);job.reject(error);}).finally(()=>{if(this.jobs.get(job.i)===job)this.jobs.delete(job.i);this.active--;this.pump();});
    }
  }
  async fetchFrame(job){
    const res=await fetch(this.frames[job.i].file,{signal:job.controller.signal});
    if(!res.ok)throw Error(`Không tải được trang ${job.i+1}`);
    const blob=await res.blob();
    if(typeof createImageBitmap==='function')return createImageBitmap(blob);
    const url=URL.createObjectURL(blob),img=new Image();
    try{img.src=url;await img.decode();return img;}finally{URL.revokeObjectURL(url);}
  }
  retry(i){this.errors.delete(i);}
}
function status(message='',retry=null){ui.status.textContent=message;retryAction=retry;ui.retry.hidden=!retry;}
function setState(next){state=next;document.body.dataset.state=next;ui.play.textContent=wantsPlay?'Tạm dừng':'Phát';ui.play.setAttribute('aria-label',wantsPlay?'Tạm dừng câu chuyện':'Phát câu chuyện');}
function clearEnd(){clearTimeout(endTimer);endTimer=0;}
function stopLoop(){cancelAnimationFrame(raf);raf=0;last=0;elapsed=0;}
function invalidate(){epoch++;stopLoop();clearEnd();}
function updateTime(){
  $('elapsed').textContent=time((index+(state==='envelope'||state==='letter'?1:0))/fps);
  $('duration').textContent=time(manifest.frames.length/fps);
  ui.progress.value=String(index);
  ui.progress.setAttribute('aria-valuetext',`Trang ${index+1} trên ${manifest.frames.length}, ${time(index/fps)}`);
  $('frame-number').textContent=`${index+1} / ${manifest.frames.length}`;
  $('previous').disabled=index===0;$('next').disabled=index===manifest.frames.length-1;
}
function draw(i,bitmap){
  const w=ui.picture.width,h=ui.picture.height;
  const scale=Math.min(w/bitmap.width,h/bitmap.height),dw=bitmap.width*scale,dh=bitmap.height*scale;
  ctx.fillStyle='#f6edde';ctx.fillRect(0,0,w,h);ctx.drawImage(bitmap,(w-dw)/2,(h-dh)/2,dw,dh);
  index=i;desiredIndex=i;displayed=true;ui.picture.setAttribute('aria-label',`Tranh minh họa ${i+1} trên ${manifest.frames.length}`);updateTime();
}
function musicUI(){
  $('music-controls').hidden=!musicAvailable;
  ui.music.textContent=musicBlocked?'♫ Chạm để bật nhạc':musicEnabled?'♫ Nhạc: bật':'♫ Nhạc: tắt';
  ui.music.setAttribute('aria-pressed',String(musicEnabled&&!musicBlocked));
}
async function playMusic(soft=false){
  ui.audio.volume=Number(ui.volume.value)*(soft?.5:1);
  if(!musicAvailable||!musicEnabled||document.hidden)return;
  try{await ui.audio.play();musicBlocked=false;}catch(error){if(error.name==='NotAllowedError')musicBlocked=true;}
  musicUI();
}
function pause(){
  wantsPlay=false;invalidate();ui.audio.pause();
  if(opened&&!ui.reader.open&&state!=='envelope'&&state!=='letter')setState('paused');
  status();
}
function start(){
  if(!opened||ui.reader.open||document.hidden)return;
  if(!displayed||desiredIndex!==index){seek(desiredIndex,true);return;}
  clearEnd();wantsPlay=true;setState('playing');status();playMusic();
  if(!raf){last=0;elapsed=0;raf=requestAnimationFrame(tick);}
}
function finish(){
  stopLoop();wantsPlay=false;setState('paused');ui.play.textContent='Phát';
  const ticket=epoch;
  endTimer=setTimeout(()=>{
    endTimer=0;if(ticket!==epoch||document.hidden||ui.reader.open)return;
    ui.viewer.hidden=true;ui.ending.hidden=false;setState('envelope');updateTime();playMusic(true);$('envelope').focus();
  },2000);
}
function tick(now){
  raf=0;if(!wantsPlay||state!=='playing')return;
  if(!last)last=now;elapsed+=now-last;last=now;
  const interval=1000/fps;
  if(elapsed>=interval){
    // At most ONE frame per paint: never skip a frame to catch up after a stall.
    elapsed=elapsed>interval*2?0:elapsed-interval;
    if(index===manifest.frames.length-1){finish();return;}
    const next=index+1;
    if(pool.cache.has(next)){draw(next,pool.cache.get(next));pool.window(next);}
    else{seek(next,true);return;}
  }
  raf=requestAnimationFrame(tick);
}
async function seek(target,autoplay=false,initial=false){
  invalidate();const ticket=epoch;
  target=Math.max(0,Math.min(manifest.frames.length-1,Number(target)));
  desiredIndex=target;wantsPlay=autoplay;ui.audio.pause();ui.ending.hidden=true;ui.viewer.hidden=false;setState('loading');status('Đang tải những trang tiếp theo…');
  // Request the new destination before background frames; old requests cannot draw.
  pool.window(target);
  try{
    const bitmap=await pool.get(target,true);
    if(initial)await Promise.all(Array.from({length:Math.min(12,manifest.frames.length-target)},(_,n)=>pool.get(target+n,true)));
    if(ticket!==epoch||ui.reader.open||document.hidden)return;
    draw(target,bitmap);status();
    if(wantsPlay)start();else setState('paused');
  }catch(error){
    if(ticket!==epoch||error.name==='AbortError')return;
    const resume=wantsPlay;wantsPlay=false;setState('paused');
    status(`Chưa tải được trang ${target+1}. Tranh hiện tại vẫn được giữ lại.`,()=>{
      pool.errors.clear();seek(target,resume,initial);
    });
  }
}
async function openCover(){
  if(opened||opening||!manifest)return;
  opening=true;$('read-story').disabled=true;document.body.dataset.started='true';ui.cover.disabled=true;
  playMusic();ui.cover.classList.add('opening');
  $('opening-hint').textContent='Đang mở câu chuyện…';
  await delay(reduced.matches?0:1150);
  opened=true;opening=false;$('read-story').disabled=false;ui.opening.hidden=true;
  await seek(0,!reduced.matches,true);
  if(reduced.matches)status('Nhấn Phát khi em sẵn sàng.');
  ui.play.focus();
}
function replay(){
  if(ui.reader.open)closeReader(false);
  $('envelope').classList.remove('unsealed');
  ui.audio.pause();try{ui.audio.currentTime=0;}catch{}
  ui.ending.hidden=true;seek(0,true);ui.play.focus();
}
function renderReading(data){
  $('reader-title').textContent=data.title;$('reader-text').replaceChildren();
  let blank=false;
  for(const text of data.paragraphs){
    if(!text.trim()){blank=true;continue;}
    const p=document.createElement('p');p.textContent=text;if(blank)p.className='break';blank=false;$('reader-text').append(p);
  }
}
function openReader(kind){
  if(ui.reader.open||opening)return;
  returnFocus=document.activeElement;priorState=state;dialogKind=kind;
  wantsPlay=false;invalidate();renderReading(kind==='story'?story:letter);
  setState(kind==='story'?'reading':'letter');
  $('resume').hidden=kind!=='story';$('letter-replay').hidden=kind!=='letter';
  $('resume').textContent=opened?'Tiếp tục xem':'Mở câu chuyện';
  ui.reader.showModal();$('reader-scroll').scrollTop=0;$('close-reader').focus();
  playMusic(true);
}
function closeReader(resume=false){
  if(!ui.reader.open)return;
  const kind=dialogKind;ui.reader.close();dialogKind=null;
  if(kind==='letter')setState('envelope');
  else if(!opened)setState('closed');
  else if(priorState==='envelope'||priorState==='letter')setState('envelope');
  else setState('paused');
  if(state==='paused'||state==='closed')ui.audio.pause();
  returnFocus?.focus();
  if(resume){if(!opened)openCover();else if(state==='envelope'){ui.viewer.hidden=false;ui.ending.hidden=true;start();}else start();}
}
async function openLetter(){
  if(state!=='envelope')return;
  $('envelope').classList.add('unsealed');
  const ticket=epoch;await delay(reduced.matches?0:550);
  if(ticket===epoch&&state==='envelope')openReader('letter');
}
async function boot(){
  try{
    const files=await Promise.all(['data/config.json','manifest.json','data/story.json','data/letter.json'].map(async path=>{const r=await fetch(path);if(!r.ok)throw Error(path);return r.json();}));
    [config,manifest,story,letter]=files;
    if(!Array.isArray(manifest.frames)||!manifest.frames.length)throw Error('manifest.json không có ảnh');
    pool=new FramePool(manifest.frames);fps=[6,12,18,24].includes(config.defaultFps)?config.defaultFps:12;
    document.title=config.title;$('book-title').textContent=config.title;
    // Preserve carefully typeset default cover; custom titles are plain text.
    if(config.title!=='CÔNG CHÚA VÀ NGỌN NẾN THỨ HAI MƯƠI BA')$('cover-title').textContent=config.title;
    $('dedication').textContent=config.dedication;ui.speed.value=String(fps);ui.volume.value=String(config.defaultVolume??.22);
    ui.progress.max=String(manifest.frames.length-1);updateTime();
    musicAvailable=Boolean(config.music);if(musicAvailable)ui.audio.src=config.music;musicUI();
    ui.cover.disabled=false;$('read-story').disabled=false;$('opening-hint').textContent='Chạm vào bìa để mở câu chuyện';status();
    $('fullscreen').hidden=!document.fullscreenEnabled;
  }catch(error){status('Không mở được dữ liệu. Hãy chạy website bằng máy chủ local và thử lại.',boot);}
}
ui.cover.addEventListener('click',openCover);
ui.play.addEventListener('click',()=>{if(wantsPlay)pause();else start();});
$('replay').addEventListener('click',replay);$('ending-replay').addEventListener('click',replay);$('letter-replay').addEventListener('click',replay);
$('previous').addEventListener('click',()=>seek(index-1,false));$('next').addEventListener('click',()=>seek(index+1,false));
ui.progress.addEventListener('input',()=>seek(ui.progress.value,wantsPlay));
ui.speed.addEventListener('change',()=>{fps=Number(ui.speed.value);last=0;elapsed=0;updateTime();});
$('read-story').addEventListener('click',()=>openReader('story'));
$('close-reader').addEventListener('click',()=>closeReader(false));$('resume').addEventListener('click',()=>closeReader(true));
ui.reader.addEventListener('cancel',event=>{event.preventDefault();closeReader(false);});
$('envelope').addEventListener('click',openLetter);$('read-letter').addEventListener('click',openLetter);
ui.retry.addEventListener('click',()=>retryAction?.());
ui.music.addEventListener('click',()=>{
  musicEnabled=musicBlocked?true:!musicEnabled;musicBlocked=false;
  if(musicEnabled&&(opening||['playing','reading','letter','envelope'].includes(state)))playMusic(state==='reading'||state==='letter'||state==='envelope');else ui.audio.pause();musicUI();
});
ui.volume.addEventListener('input',()=>{ui.audio.volume=Number(ui.volume.value)*(['reading','letter','envelope'].includes(state)?.5:1);});
ui.audio.addEventListener('error',()=>{musicAvailable=false;musicEnabled=false;ui.audio.pause();musicUI();status('Không tải được nhạc. Em vẫn có thể xem câu chuyện.');});
$('fullscreen').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await $('experience').requestFullscreen();}catch{status('Thiết bị chưa cho phép mở toàn màn hình.');}
});
document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'Thoát toàn màn hình':'Toàn màn hình';});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){wantsPlay=false;invalidate();ui.audio.pause();if(opened&&!ui.reader.open&&!['envelope','letter'].includes(state))setState('paused');}
  else if(opened&&state==='paused')status('Nhấn Phát để tiếp tục câu chuyện.');
});
document.addEventListener('keydown',event=>{
  if(!opened||ui.reader.open||ui.viewer.hidden||event.altKey||event.ctrlKey||event.metaKey)return;
  if(['INPUT','SELECT','BUTTON','TEXTAREA'].includes(event.target.tagName))return;
  if(event.code==='Space'){event.preventDefault();wantsPlay?pause():start();}
  if(event.key==='ArrowLeft'){event.preventDefault();seek(index-1,false);}
  if(event.key==='ArrowRight'){event.preventDefault();seek(index+1,false);}
});
boot();
