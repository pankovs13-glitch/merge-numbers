(()=>{'use strict';
const $=id=>document.getElementById(id), N=4, KEY='merge-numbers-yandex-classic';
let grid=Array(16).fill(0),score=0,best=0,history=null,won=false,over=false,sound=true,freeUndos=1,locked=false,ctx=null,nextSpawn=null,nextValue=2,milestones=[];
const sdk={api:null,busy:false};
function status(s=''){$('adStatus').textContent=s}
async function initSDK(){if(!window.YaGames){status('Локальный режим · реклама отключена');return}try{sdk.api=await YaGames.init();sdk.api.features?.LoadingAPI?.ready?.();status('')}catch(e){status('SDK недоступен');console.warn(e)}}
function pauseGame(){try{sdk.api?.features?.GameplayAPI?.stop?.()}catch(e){}}
function resumeGame(){try{sdk.api?.features?.GameplayAPI?.start?.()}catch(e){}}
function fullscreen(done){if(!sdk.api?.adv?.showFullscreenAdv||sdk.busy){done();return}sdk.busy=true;pauseGame();let finished=false;const finish=()=>{if(finished)return;finished=true;sdk.busy=false;resumeGame();done()};try{sdk.api.adv.showFullscreenAdv({callbacks:{onClose:finish,onError:finish}})}catch(e){finish()}}
function save(){try{localStorage.setItem(KEY,JSON.stringify({grid,score,best,won,sound,freeUndos,history,nextSpawn,nextValue,milestones}))}catch(e){}}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY));if(!x||!Array.isArray(x.grid)||x.grid.length!==16||!x.grid.every(valid)||!Number.isSafeInteger(x.score)||x.score<0)return false;grid=x.grid;score=x.score;best=Math.max(x.best||0,score);won=!!x.won;sound=x.sound!==false;freeUndos=x.freeUndos===0?0:1;history=x.history&&Array.isArray(x.history.grid)&&x.history.grid.length===16&&x.history.grid.every(valid)?x.history:null;over=!possible();nextSpawn=Number.isInteger(x.nextSpawn)&&x.nextSpawn>=0&&x.nextSpawn<16?x.nextSpawn:null;nextValue=x.nextValue===4?4:2;milestones=Array.isArray(x.milestones)?x.milestones.filter(v=>[512,1024,2048].includes(v)):[];chooseTarget();return true}catch(e){return false}}
function valid(v){return Number.isSafeInteger(v)&&v>=0&&(v===0||(v&(v-1))===0)}
function tone(f=400){if(!sound)return;try{ctx??=new(window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=f;g.gain.setValueAtTime(.035,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.09);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.1)}catch(e){}}
function chooseTarget(){
 const empty=[];grid.forEach((v,i)=>{if(!v)empty.push(i)});
 if(!empty.length){nextSpawn=null;return}
 if(nextSpawn!==null&&empty.includes(nextSpawn))return;
 nextSpawn=empty[Math.floor(Math.random()*empty.length)];
}
function rollValue(){return Math.random()<.9?2:4}
function spawn(){const empty=[];grid.forEach((v,i)=>{if(!v)empty.push(i)});if(!empty.length)return;grid[empty[Math.floor(Math.random()*empty.length)]]=rollValue()}
function reset(){locked=false;grid=Array(16).fill(0);score=0;history=null;won=false;over=false;freeUndos=1;nextSpawn=null;nextValue=rollValue();milestones=[];spawn();spawn();chooseTarget();hideModal();save();render()}
function restart(){if(!confirm('Начать новую игру?'))return;fullscreen(reset)}
function render(changed=[]){const b=$('board');b.innerHTML='';grid.forEach((v,i)=>{const d=document.createElement('div');d.className='tile'+(v?'':' empty')+(v>=1024?' big':'')+(changed.includes(i)?' changed':'');if(v)d.dataset.v=String(Math.min(v,2048));d.textContent=v||'';b.append(d)});$('score').textContent=score.toLocaleString('ru-RU');$('best').textContent=best.toLocaleString('ru-RU');$('max').textContent=Math.max(...grid).toLocaleString('ru-RU');$('sound').setAttribute('aria-label',sound?'Выключить звук':'Включить звук');$('sound').textContent=sound?'🔊':'🔇';const highest=Math.max(...grid);$('progressFill').style.width=Math.min(100,(Math.max(2,highest)/2048)*100)+'%';$('progressLabel').textContent=highest>=2048?'Цель достигнута!':highest+' / 2048'}
function modal(title,body,continueGame=false){$('modalTitle').textContent=title;$('modalText').textContent=body;$('continue').classList.toggle('hidden',!continueGame);$('overlay').classList.remove('hidden')}
function hideModal(){$('overlay').classList.add('hidden')}
function possible(){if(grid.includes(0))return true;for(let r=0;r<4;r++)for(let c=0;c<4;c++){const i=r*4+c;if(c<3&&grid[i]===grid[i+1])return true;if(r<3&&grid[i]===grid[i+4])return true}return false}
function lineMove(values){const compact=values.filter(Boolean),out=[];let gain=0;for(let i=0;i<compact.length;i++){if(compact[i]===compact[i+1]){out.push(compact[i]*2);gain+=compact[i]*2;i++}else out.push(compact[i])}while(out.length<4)out.push(0);return {out,gain}}
function planMove(dir){
 const next=Array(16).fill(0),tracks=[],merged=[],gain={value:0};
 for(let n=0;n<4;n++){
  const ids=Array.from({length:4},(_,k)=>dir==='left'?n*4+k:dir==='right'?n*4+3-k:dir==='up'?k*4+n:(3-k)*4+n);
  const occupied=ids.map((id,k)=>({id,k,value:grid[id]})).filter(t=>t.value);
  let dest=0;
  for(let j=0;j<occupied.length;j++){
   const first=occupied[j],second=occupied[j+1],join=!!second&&first.value===second.value;
   const target=ids[dest++],value=join?first.value*2:first.value;
   next[target]=value;tracks.push({from:first.id,to:target,value:first.value});
   if(join){tracks.push({from:second.id,to:target,value:second.value});merged.push(target);gain.value+=value;j++}
  }
 }
 return {next,tracks,merged,gain:gain.value};
}
function animateTracks(tracks){
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return Promise.resolve();
 const board=$('board'),cells=[...board.children];
 const moving=tracks.filter(t=>t.from!==t.to);
 if(!moving.length)return Promise.resolve();
 // Leave every stationary tile visible. Hide only the original moving tiles,
 // replacing each with an identical clone that slides with its whole background.
 const layer=document.createElement('div');layer.className='motion-layer';
 const actors=[];
 for(const t of moving){
  const source=cells[t.from],target=cells[t.to];
  const clone=source.cloneNode(true);
  clone.classList.remove('changed','target');clone.classList.add('moving');
  clone.style.left=source.offsetLeft+'px';clone.style.top=source.offsetTop+'px';
  clone.style.width=source.offsetWidth+'px';clone.style.height=source.offsetHeight+'px';
  layer.append(clone);
  actors.push({clone,dx:target.offsetLeft-source.offsetLeft,dy:target.offsetTop-source.offsetTop});
  source.style.visibility='hidden';
 }
 board.append(layer);
 return new Promise(resolve=>{
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   actors.forEach(({clone,dx,dy})=>clone.style.transform=`translate(${dx}px,${dy}px)`);
  }));
  setTimeout(()=>{
   layer.remove();
   cells.forEach(cell=>cell.style.removeProperty('visibility'));
   resolve();
  },215);
 });
}

async function move(dir){
 if(locked||over||!$('overlay').classList.contains('hidden'))return;
 const prev=grid.slice(),oldScore=score,plan=planMove(dir);
 if(plan.next.every((v,i)=>v===prev[i]))return;
 locked=true;history=null;
 await animateTracks(plan.tracks);
 grid=plan.next;score+=plan.gain;best=Math.max(best,score);
 spawn();chooseTarget();locked=false;tone(plan.gain?640:360);save();
 render([...new Set([...plan.merged,...grid.map((v,i)=>v!==plan.next[i]?i:-1).filter(i=>i>=0)])]);
 const reached=!won&&!milestones.includes(2048)&&grid.some(v=>v>=2048);
 if(reached){milestones.push(2048);won=true;save();modal('2048! Победа!','Цель достигнута! Можно продолжать до 4096.',true)}
 else if(!possible()){over=true;modal('Ходы закончились','Результат: '+score.toLocaleString('ru-RU')+' очков. Начни новую игру и попробуй ещё раз.')}
}
let sx=0,sy=0;const board=$('board');board.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY});board.addEventListener('pointerup',e=>{const dx=e.clientX-sx,dy=e.clientY-sy;if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;move(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up')});document.addEventListener('keydown',e=>{const dirs={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down'};if(dirs[e.key]){e.preventDefault();move(dirs[e.key])}});
$('restart').onclick=restart;$('again').onclick=()=>{fullscreen(reset)};$('continue').onclick=hideModal;$('sound').onclick=()=>{sound=!sound;save();render()};
if(!load())reset();else render();$('tutorial').open=false;$('tutorial').addEventListener('toggle',()=>{try{if(!$('tutorial').open)localStorage.setItem('merge-numbers-help-seen','1')}catch(e){}});document.querySelectorAll('[data-dir]').forEach(b=>b.addEventListener('click',()=>move(b.dataset.dir)));document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();else if(!sdk.busy)resumeGame()});initSDK().then(()=>{render();if(over)modal('Ходы закончились','Начни новую игру и попробуй ещё раз.')});
})();
