(() => {
  const canvas = document.querySelector('#view');
  const ctx = canvas.getContext('2d', { alpha: false });
  const intro = document.querySelector('#intro');
  const endScreen = document.querySelector('#endScreen');
  const prompt = document.querySelector('#prompt');
  const objective = document.querySelector('#objective');
  const keys = new Set();
  const COLS = 32, ROWS = 24, FOV = Math.PI / 3;
  const world = Array.from({length: ROWS}, () => Array(COLS).fill(1));
  const carve = (x1,y1,x2,y2) => { for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++) world[y][x]=0; };
  // Four patient wards connect to a cross-shaped service corridor.
  carve(2,2,9,8); carve(22,2,29,8); carve(2,15,9,21); carve(22,15,29,21);
  carve(10,5,21,6); carve(10,17,21,18); carve(15,1,16,22); carve(1,11,30,12);
  // Door gaps in the ward walls.
  carve(9,5,10,5); carve(21,5,22,5); carve(9,18,10,18); carve(21,18,22,18);
  // A few alcoves and broken sections make the route feel less like a grid.
  carve(5,8,6,9); carve(26,8,27,9); carve(5,14,6,15); carve(26,14,27,15);
  const player = {x:15.5,y:11.5,angle:-Math.PI/2,stamina:100,battery:86,flash:true};
  const keyItems = [{x:5.5,y:4.7,got:false},{x:26.3,y:6.5,got:false},{x:5.3,y:18.7,got:false}];
  const exit = {x:26.2,y:18.1};
  const enemy = {x:26.1,y:4.2,route:0,step:0,path:[],repath:0,alert:0};
  const patrol = [{x:26.1,y:4.2},{x:23.2,y:6.8},{x:15.5,y:11.5},{x:5.5,y:18.5},{x:15.5,y:11.5}];
  let running=false, ended=false, last=0, flashTimer=0, whisperTimer=12, pointer=false, soundOn=true, audio=null;
  let w=0,h=0,depth=[],lastPrompt='';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function resize(){const d=Math.min(devicePixelRatio||1,1.5);w=Math.max(1,Math.floor(innerWidth*d));h=Math.max(1,Math.floor(innerHeight*d));canvas.width=w;canvas.height=h;depth=new Float32Array(w);}
  addEventListener('resize',resize); resize();
  function wall(x,y){return x<0||y<0||x>=COLS||y>=ROWS||world[y][x]!==0;}
  function canStand(x,y,r=.2){return !wall(Math.floor(x-r),Math.floor(y-r))&&!wall(Math.floor(x+r),Math.floor(y-r))&&!wall(Math.floor(x-r),Math.floor(y+r))&&!wall(Math.floor(x+r),Math.floor(y+r));}
  function startAudio(){if(!soundOn)return;try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume();if(!audio.started){const osc=audio.createOscillator(),gain=audio.createGain(),filter=audio.createBiquadFilter();osc.type='sine';osc.frequency.value=47;filter.type='lowpass';filter.frequency.value=110;gain.gain.value=.025;osc.connect(filter);filter.connect(gain);gain.connect(audio.destination);osc.start();audio.started=true;}}catch(e){}}
  function begin(){if(ended)return;running=true;intro.classList.remove('visible');intro.classList.add('hidden');startAudio();if(innerWidth>750&&canvas.requestPointerLock)canvas.requestPointerLock();}
  document.querySelector('#startBtn').addEventListener('click',begin);
  document.querySelector('#restartBtn').addEventListener('click',()=>location.reload());
  document.querySelector('#soundBtn').addEventListener('click',()=>{soundOn=!soundOn;document.querySelector('#soundBtn').innerHTML=`♫ <span>SOUND ${soundOn?'ON':'OFF'}</span>`;if(!soundOn&&audio)audio.suspend();else if(audio)audio.resume();});
  document.addEventListener('pointerlockchange',()=>pointer=document.pointerLockElement===canvas);
  document.addEventListener('mousemove',e=>{if(pointer&&running)player.angle+=e.movementX*.0022;});
  canvas.addEventListener('click',()=>{if(running&&innerWidth>750&&!pointer)canvas.requestPointerLock?.();});
  document.addEventListener('keydown',e=>{const k=e.key.toLowerCase();keys.add(k);if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(k==='f'&&!e.repeat&&running){player.flash=!player.flash;}if((k==='e'||k===' ')&&!e.repeat&&running)interact();if(k==='escape'&&running&&pointer)document.exitPointerLock();});
  document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  // Touch controls: buttons are held controls, while a swipe on the view turns the camera.
  document.querySelectorAll('[data-move]').forEach(btn=>{const key={forward:'w',back:'s',left:'a',right:'d'}[btn.dataset.move];btn.addEventListener('pointerdown',e=>{e.preventDefault();keys.add(key);btn.setPointerCapture(e.pointerId)});['pointerup','pointercancel','lostpointercapture'].forEach(ev=>btn.addEventListener(ev,()=>keys.delete(key)));});
  document.querySelector('#mobileRun').addEventListener('pointerdown',()=>keys.add('shift'));document.querySelector('#mobileRun').addEventListener('pointerup',()=>keys.delete('shift'));document.querySelector('#mobileRun').addEventListener('pointercancel',()=>keys.delete('shift'));
  document.querySelector('#mobileInteract').addEventListener('pointerdown',e=>{e.preventDefault();interact()});
  let touchX=null;canvas.addEventListener('touchstart',e=>touchX=e.touches[0]?.clientX,{passive:true});canvas.addEventListener('touchmove',e=>{if(touchX!==null){const x=e.touches[0].clientX;player.angle+=(x-touchX)*.006;touchX=x;}},{passive:true});canvas.addEventListener('touchend',()=>touchX=null);
  function interact(){if(!running||ended)return;const d=dist(player,exit);if(d<1.6){if(keyItems.every(k=>k.got))finish(true);else hint(`THE EXIT NEEDS ${3-keyItems.filter(k=>k.got).length} MORE WARD KEY${keyItems.filter(k=>k.got).length===2?'':'S'}`);}}
  function hint(text){prompt.textContent=text;prompt.classList.add('show');setTimeout(()=>{if(prompt.textContent===text)prompt.classList.remove('show')},1800);}
  function finish(win){ended=true;running=false;if(document.pointerLockElement)document.exitPointerLock();document.querySelector('#endKicker').textContent=win?'FIELD REPORT · 02:41 AM':'SIGNAL LOST · 02:17 AM';document.querySelector('#endTitle').textContent=win?'YOU MADE IT OUT':'THE WING KEEPS YOU';document.querySelector('#endText').textContent=win?'The cold air hits your lungs. Behind you, one last door slams shut. St. Agnes is quiet again. For now.':'The footsteps stop just behind you. The ward keys fall from your hand. Somewhere, a night nurse marks you absent.';endScreen.classList.remove('hidden');endScreen.classList.add('visible');}
  function update(dt){if(!running||ended)return;
    const turn=(keys.has('arrowleft')?1:0)-(keys.has('arrowright')?1:0);player.angle+=turn*dt*1.9;
    const forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0),side=(keys.has('d')?1:0)-(keys.has('a')?1:0);
    const wantsRun=(keys.has('shift')||keys.has('shiftleft'))&&forward>0&&player.stamina>2;const speed=wantsRun?3.05:1.75;
    if(wantsRun)player.stamina=Math.max(0,player.stamina-dt*24);else player.stamina=Math.min(100,player.stamina+dt*13);
    const mag=Math.hypot(forward,side)||1,dx=(Math.cos(player.angle)*forward+Math.cos(player.angle+Math.PI/2)*side)/mag*speed*dt,dy=(Math.sin(player.angle)*forward+Math.sin(player.angle+Math.PI/2)*side)/mag*speed*dt;
    if(canStand(player.x+dx,player.y))player.x+=dx;if(canStand(player.x,player.y+dy))player.y+=dy;
    if(player.flash){player.battery=Math.max(0,player.battery-dt*.42);if(!player.battery)player.flash=false;}else player.battery=Math.min(100,player.battery+dt*.11);
    keyItems.forEach((key,i)=>{if(!key.got&&dist(player,key)<.75){key.got=true;document.querySelector(`#key${i}`).classList.add('found');startAudio();hint('WARD KEY RECOVERED');objective.textContent=keyItems.every(k=>k.got)?'Reach the east exit door':'Find the remaining ward keys';}});
    updateEnemy(dt);if(dist(player,enemy)<.48)finish(false);
    let target='';if(dist(player,exit)<1.6)target=keyItems.every(k=>k.got)?'[ E ]  UNLOCK THE EXIT':'[ E ]  EXIT LOCKED — WARD KEYS REQUIRED';else if(dist(player,enemy)<5)target='KEEP MOVING';
    if(target){prompt.textContent=target;prompt.classList.add('show')}else prompt.classList.remove('show');
    whisperTimer-=dt;if(whisperTimer<=0){whisperTimer=18+Math.random()*18;const el=document.querySelector('#whisper');el.textContent=['They know you are here.','Don’t let it hear you run.','The keys are still warm.','Someone is in the day room.'][Math.floor(Math.random()*4)];el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2800);}
    document.querySelector('#staminaBar').style.width=`${player.stamina}%`;document.querySelector('#staminaText').textContent=`${Math.round(player.stamina)}%`;document.querySelector('#batteryBar').style.width=`${player.battery}%`;document.querySelector('#batteryText').textContent=`${Math.round(player.battery)}%`;
  }
  function updateEnemy(dt){const d=dist(player,enemy);enemy.alert=Math.max(0,enemy.alert-dt*.18);if(d<9)enemy.alert=Math.min(1,enemy.alert+dt*.24);const chasing=enemy.alert>.12;enemy.repath-=dt;
    if(enemy.repath<=0){enemy.repath=chasing?.65:2.2;let target=chasing?{x:Math.floor(player.x),y:Math.floor(player.y)}:patrol[enemy.route];enemy.path=findPath(Math.floor(enemy.x),Math.floor(enemy.y),Math.floor(target.x),Math.floor(target.y));if(!chasing&&enemy.path.length<2){enemy.route=(enemy.route+1)%patrol.length;}}
    if(enemy.path.length){const p=enemy.path[0],tx=p.x+.5,ty=p.y+.5,dx=tx-enemy.x,dy=ty-enemy.y,len=Math.hypot(dx,dy);if(len<.18){enemy.path.shift();}else{const sp=chasing?1.13:.46;enemy.x+=dx/len*sp*dt;enemy.y+=dy/len*sp*dt;}}
  }
  function findPath(sx,sy,gx,gy){const q=[[sx,sy]],prev=new Map(),key=(x,y)=>x+','+y;prev.set(key(sx,sy),null);let end=null;for(let i=0;i<q.length&&i<3000;i++){const [x,y]=q[i];if(x===gx&&y===gy){end=[x,y];break;}for(const [ax,ay] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+ax,ny=y+ay,k=key(nx,ny);if(!wall(nx,ny)&&!prev.has(k)){prev.set(k,[x,y]);q.push([nx,ny]);}}}if(!end)return [];const out=[];let cur=end;while(cur&&!(cur[0]===sx&&cur[1]===sy)){out.unshift({x:cur[0],y:cur[1]});cur=prev.get(key(...cur));}return out;}
  function castRay(angle){const rx=Math.cos(angle),ry=Math.sin(angle);let mx=Math.floor(player.x),my=Math.floor(player.y),ddx=Math.abs(1/(rx||1e-9)),ddy=Math.abs(1/(ry||1e-9)),sx=rx<0?-1:1,sy=ry<0?-1:1,sdx=(rx<0?player.x-mx:mx+1-player.x)*ddx,sdy=(ry<0?player.y-my:my+1-player.y)*ddy,side=0,steps=0;while(steps++<90){if(sdx<sdy){sdx+=ddx;mx+=sx;side=0}else{sdy+=ddy;my+=sy;side=1}if(wall(mx,my))break;}let d=side===0?sdx-ddx:sdy-ddy;d=Math.max(.08,d);const hit=side===0?player.y+ry*d:player.x+rx*d;return {d,side,hit:hit-Math.floor(hit),mx,my,rx,ry};}
  function render(){if(!w||!h)return;
    const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#11272a');bg.addColorStop(.42,'#17292a');bg.addColorStop(.43,'#202c29');bg.addColorStop(1,'#080f11');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    // Cold fluorescent ceiling glow and floor perspective seams.
    const horizon=h*.5+Math.sin(performance.now()*.001)*h*.002;const glow=ctx.createRadialGradient(w*.51,h*.28,2,w*.51,h*.28,w*.48);glow.addColorStop(0,'rgba(136,210,197,.15)');glow.addColorStop(1,'rgba(80,144,141,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h*.53);
    ctx.save();ctx.globalAlpha=.12;for(let y=Math.ceil(horizon+4);y<h;y+=Math.max(3,Math.floor((y-horizon)*.14))){let d=(h*.5)/(y-horizon);ctx.strokeStyle=`rgba(136,184,170,${Math.max(.03,.13-d*.018)})`;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}ctx.restore();
    const step=Math.max(1,Math.floor(w/500));
    for(let x=0;x<w;x+=step){const cam=(2*x/w-1),angle=player.angle+Math.atan(cam*Math.tan(FOV/2));const r=castRay(angle);const corrected=r.d*Math.cos(angle-player.angle);for(let xx=x;xx<Math.min(w,x+step);xx++)depth[xx]=corrected;
      const wallH=Math.min(h*2,h/(corrected*.82)),top=horizon-wallH*.5,bottom=horizon+wallH*.5;const cell=(r.mx*13+r.my*29)%7;const base=cell<2?[62,89,85]:cell<4?[73,94,88]:[83,101,93];const facing=r.side===1?.72:1;const beam=player.flash?Math.max(.15,1-Math.abs(Math.atan2(Math.sin(angle-player.angle),Math.cos(angle-player.angle)))/.78):.2;const fog=Math.exp(-corrected*.085);const light=(.22+beam*.78)*fog*facing;
      const seam=Math.floor(r.hit*12)%7===0?-.12:0;const brightness=clamp(light+seam,.08,1);const rr=Math.floor(base[0]*brightness),gg=Math.floor(base[1]*brightness),bb=Math.floor(base[2]*brightness);const topY=Math.max(0,top),bottomY=Math.min(h,bottom);if(bottomY>topY){const wallGrad=ctx.createLinearGradient(0,topY,0,bottomY);wallGrad.addColorStop(0,`rgb(${Math.floor(rr*.62)},${Math.floor(gg*.65)},${Math.floor(bb*.65)})`);wallGrad.addColorStop(.18,`rgb(${rr},${gg},${bb})`);wallGrad.addColorStop(.82,`rgb(${rr},${gg},${bb})`);wallGrad.addColorStop(1,`rgb(${Math.floor(rr*.48)},${Math.floor(gg*.5)},${Math.floor(bb*.5)})`);ctx.fillStyle=wallGrad;ctx.fillRect(x,topY,step+1,bottomY-topY);if(Math.floor(r.hit*22)%19===0){ctx.fillStyle=`rgba(3,10,11,${.16*fog})`;ctx.fillRect(x,topY+wallH*.6,step+1,Math.max(1,wallH*.012));}}
      if(top>=0&&top<h){ctx.fillStyle=`rgba(179,226,207,${Math.max(0,light*.16)})`;ctx.fillRect(x,top,step+1,Math.max(1,wallH*.012));}
    }
    drawSprites(horizon,step);
    // Occasional fluorescent tube spill, scratches and a soft camera vignette.
    ctx.fillStyle='rgba(180,240,218,.055)';ctx.fillRect(w*.475,h*.06,w*.05,2);const vign=ctx.createRadialGradient(w/2,h*.48,h*.1,w/2,h*.48,h*.75);vign.addColorStop(.45,'rgba(0,0,0,0)');vign.addColorStop(1,'rgba(0,4,7,.6)');ctx.fillStyle=vign;ctx.fillRect(0,0,w,h);
  }
  function drawSprites(horizon,step){const sprites=[];keyItems.forEach((k,i)=>{if(!k.got)sprites.push({x:k.x,y:k.y,type:'key',i,d:dist(player,k)});});sprites.push({x:exit.x,y:exit.y,type:'exit',d:dist(player,exit)});sprites.push({x:enemy.x,y:enemy.y,type:'enemy',d:dist(player,enemy)});sprites.sort((a,b)=>b.d-a.d);
    for(const s of sprites){let a=Math.atan2(s.y-player.y,s.x-player.x)-player.angle;while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;if(Math.abs(a)>FOV*.74||s.d<.2)continue;const sx=(.5+a/FOV)*w,sy=horizon+Math.sin(performance.now()*.002+s.d)*1.5;const size=Math.min(h*1.3,h/(s.d*.83));if(sx<0||sx>=w||s.d>depth[Math.floor(sx)]-0.18)continue;ctx.save();ctx.translate(sx,sy);
      if(s.type==='key'){const sz=clamp(size*.17,8,37),bob=Math.sin(performance.now()*.003+s.i)*sz*.12;ctx.translate(0,-size*.22+bob);ctx.shadowColor='#9effdf';ctx.shadowBlur=sz*.75;ctx.strokeStyle='#c9ffe3';ctx.lineWidth=Math.max(2,sz*.1);ctx.beginPath();ctx.arc(-sz*.15,0,sz*.19,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(0,sz*.08);ctx.lineTo(sz*.43,sz*.5);ctx.lineTo(sz*.58,sz*.35);ctx.moveTo(sz*.29,sz*.35);ctx.lineTo(sz*.42,sz*.22);ctx.stroke();ctx.fillStyle='#82d5c3';ctx.font=`${Math.max(6,sz*.35)}px monospace`;ctx.fillText('WARD',-sz*.43,sz*.88);}
      if(s.type==='exit'){const ww=size*.45,hh=size*.91;ctx.fillStyle='rgba(6,17,20,.96)';ctx.fillRect(-ww/2,-hh*.5,ww,hh);ctx.strokeStyle=keyItems.every(k=>k.got)?'#81dfcb':'#694a45';ctx.lineWidth=Math.max(2,size*.025);ctx.strokeRect(-ww/2,-hh*.5,ww,hh);ctx.fillStyle=keyItems.every(k=>k.got)?'#99f1d8':'#c47e68';ctx.fillRect(-ww*.3,-hh*.36,ww*.6,hh*.13);ctx.fillStyle='#d2c49a';ctx.beginPath();ctx.arc(ww*.31,hh*.1,Math.max(2,size*.025),0,Math.PI*2);ctx.fill();ctx.fillStyle='#a1b9b2';ctx.font=`${Math.max(7,size*.055)}px monospace`;ctx.textAlign='center';ctx.fillText('EXIT',0,-hh*.26);}
      if(s.type==='enemy'){const pulse=.85+Math.sin(performance.now()*.009)*.15;const body=size*.78;ctx.shadowColor='#091215';ctx.shadowBlur=size*.22;ctx.fillStyle='#080d0e';ctx.beginPath();ctx.ellipse(0,-body*.15,body*.21,body*.47,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(0,-body*.72,body*.15,0,Math.PI*2);ctx.fill();ctx.fillStyle=`rgba(210,66,54,${.72*pulse})`;ctx.shadowColor='#ff3e32';ctx.shadowBlur=size*.1;ctx.beginPath();ctx.arc(-body*.065,-body*.73,Math.max(1.5,size*.013),0,Math.PI*2);ctx.arc(body*.065,-body*.73,Math.max(1.5,size*.013),0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(3,9,10,.9)';ctx.lineWidth=Math.max(2,body*.12);ctx.beginPath();ctx.moveTo(-body*.13,-body*.2);ctx.lineTo(-body*.25,body*.35);ctx.moveTo(body*.13,-body*.2);ctx.lineTo(body*.25,body*.35);ctx.stroke();}
      ctx.restore();}
  }
  function frame(t){const dt=Math.min(.04,(t-last)/1000||0);last=t;update(dt);render();requestAnimationFrame(frame);}requestAnimationFrame(frame);
})();
