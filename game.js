(() => {
  'use strict';
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const titleScreen = document.querySelector('#title-screen');
  const pauseScreen = document.querySelector('#pause-screen');
  const endScreen = document.querySelector('#end-screen');
  const topbar = document.querySelector('#topbar');
  const bottomNote = document.querySelector('#bottom-note');
  const toast = document.querySelector('#toast');
  const memoryCount = document.querySelector('#memory-count');
  const controls = { left:false, right:false, jump:false };
  let W = 1000, H = 600, groundY = 478;
  const worldW = 3400;
  let state = 'title', last = 0, elapsed = 0, camera = 0, toastTimer = 0;
  let dpr = 1, muted = false, audio = null, jumpQueued = false;
  let player, shards, platforms, checkpoint, distortion = 0, screenShake = 0;
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const rng = (n) => { const x=Math.sin(n*127.1+311.7)*43758.5453; return x-Math.floor(x); };
  function resize(){
    const rect=canvas.getBoundingClientRect(); dpr=Math.min(2,window.devicePixelRatio||1);
    W=rect.width; H=rect.height; groundY=H*.797;
    canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr);
  }
  window.addEventListener('resize',resize); resize();
  function makeLevel(){
    const grounds=[[0,505],[565,1015],[1080,1550],[1615,2115],[2180,2675],[2735,3400]];
    platforms=grounds.map((g,i)=>({x:g[0],y:groundY,w:g[1]-g[0],h:H-groundY+80,ground:true,id:i,collapse:0,broken:false,checkpoint:i>0&&i%2===0}));
    [[250,410,145],[390,370,125],[675,397,150],[825,350,112],[1150,405,155],[1320,365,120],[1695,405,150],[1860,365,125],[2240,405,155],[2420,360,120],[2810,405,150],[3000,365,130]].forEach((p,i)=>platforms.push({x:p[0],y:groundY-(478-p[1]),w:p[2],h:16,id:grounds.length+i,ground:false,collapse:0,broken:false}));
    shards=[250,685,1160,1710,2260,2825].map((x,i)=>({x,y:groundY-(478-(i===0?378:i===1?365:373)),got:false,phase:i*1.7}));
    player={x:72,y:groundY-44,vx:0,vy:0,w:25,h:44,grounded:true,coyote:0,buffer:0,face:1,blink:0};
    checkpoint=72; camera=0; elapsed=0; distortion=0; screenShake=0;
  }
  function start(){makeLevel();memoryCount.textContent='0 / 6';state='playing';titleScreen.hidden=true;pauseScreen.hidden=true;endScreen.hidden=true;topbar.hidden=false;bottomNote.hidden=false;last=performance.now();playTone(360,.12,'sine',.04);}
  function togglePause(){if(state==='playing'){state='paused';pauseScreen.hidden=false;}else if(state==='paused'){state='playing';pauseScreen.hidden=true;last=performance.now();}}
  function setToast(text){toast.textContent=text;toast.classList.add('show');toastTimer=2.2;}
  function playTone(freq,duration,type='sine',volume=.035){
    if(muted)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,audio.currentTime);gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}catch(_){/* Audio is optional. */}
  }
  document.querySelector('#start-button').addEventListener('click',start);
  document.querySelector('#resume-button').addEventListener('click',togglePause);
  document.querySelector('#again-button').addEventListener('click',()=>{titleScreen.hidden=false;endScreen.hidden=true;topbar.hidden=true;bottomNote.hidden=true;state='title';});
  document.querySelector('#pause-button').addEventListener('click',togglePause);
  document.querySelector('#sound-button').addEventListener('click',e=>{muted=!muted;e.currentTarget.textContent=muted?'♫̸':'♫';e.currentTarget.setAttribute('aria-label',muted?'Turn sound on':'Turn sound off');if(!muted)playTone(500,.1);});
  window.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase();if(['arrowleft','arrowright','arrowup',' ','w','a','s','d'].includes(key))e.preventDefault();
    if(key==='escape'||key==='p'){togglePause();return;} if(state==='title'&&(key==='enter'||key===' ')){start();return;}
    if(key==='arrowleft'||key==='a')controls.left=true;if(key==='arrowright'||key==='d')controls.right=true;
    if(key===' '||key==='arrowup'||key==='w'){controls.jump=true;jumpQueued=true;}
  });
  window.addEventListener('keyup',e=>{const key=e.key.toLowerCase();if(key==='arrowleft'||key==='a')controls.left=false;if(key==='arrowright'||key==='d')controls.right=false;if(key===' '||key==='arrowup'||key==='w')controls.jump=false;});
  document.querySelectorAll('[data-control]').forEach(button=>{
    const name=button.dataset.control;
    const down=e=>{e.preventDefault();controls[name]=true;if(name==='jump')jumpQueued=true;button.setPointerCapture?.(e.pointerId);};
    const up=e=>{e.preventDefault();controls[name]=false;};
    button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('lostpointercapture',up);
  });
  function respawn(){player.x=checkpoint;player.y=groundY-44;player.vx=0;player.vy=0;player.grounded=true;screenShake=.22;setToast('The dream gives you another chance.');}
  function update(dt){
    elapsed+=dt;const speed=260,accel=1500;const direction=(controls.right?1:0)-(controls.left?1:0);
    if(direction){player.vx+=direction*accel*dt;player.face=direction;}else player.vx*=Math.pow(.001,dt);
    player.vx=clamp(player.vx,-speed,speed);player.x+=player.vx*dt;
    if(player.grounded)player.coyote=.11;else player.coyote-=dt;
    if(jumpQueued)player.buffer=.13;else player.buffer-=dt;jumpQueued=false;
    if(player.buffer>0&&player.coyote>0){player.vy=-615;player.grounded=false;player.coyote=0;player.buffer=0;playTone(300,.09,'triangle',.025);}
    const oldBottom=player.y+player.h;player.vy+=1540*dt;player.y+=player.vy*dt;player.grounded=false;
    for(const p of platforms){
      if(p.broken||player.x+player.w<p.x||player.x>p.x+p.w)continue;
      if(oldBottom<=p.y+3&&player.y+player.h>=p.y&&player.vy>=0){player.y=p.y-player.h;player.vy=0;player.grounded=true;
        if(p.ground&&!p.broken){if(p.collapse===0)p.collapse=elapsed+3.1;if(p.checkpoint&&player.x>p.x+50&&player.x>checkpoint+150){checkpoint=p.x+45;setToast('A quiet place to begin again.');}}
      }
    }
    if(player.y>H+90)respawn();
    player.x=clamp(player.x,0,worldW-player.w);
    for(const shard of shards){if(shard.got)continue;const sy=shard.y+Math.sin(elapsed*2.4+shard.phase)*5;if(Math.abs(player.x+player.w/2-shard.x)<29&&Math.abs(player.y+player.h/2-sy)<43){shard.got=true;playTone(620+shards.filter(s=>s.got).length*65,.35,'sine',.055);memoryCount.textContent=`${shards.filter(s=>s.got).length} / ${shards.length}`;setToast(['A voice you almost know.','The smell of rain on warm stone.','A laugh, somewhere in the light.','Your own name, spoken gently.','The shape of a hand in yours.','Morning, waiting on the other side.'][shards.filter(s=>s.got).length-1]);}}
    const got=shards.filter(s=>s.got).length;
    if(player.x>worldW-180&&got===shards.length){state='won';endScreen.hidden=false;playTone(440,.7,'sine',.05);playTone(660,1,'sine',.03);}
    if(player.x>worldW-180&&got<shards.length&&elapsed%2<dt)setToast('Something is still missing.');
    for(const p of platforms){if(p.ground&&p.collapse>0&&elapsed>p.collapse){p.broken=true;}}
    const target=clamp(player.x-W*.36,0,worldW-W);camera+=(target-camera)*Math.min(1,dt*4.5);
    distortion=clamp((player.x/worldW)*.75+Math.sin(elapsed*.53)*.08,0,.92);screenShake=Math.max(0,screenShake-dt*1.8);
    if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)toast.classList.remove('show');}
  }
  function drawBackground(){
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#111a2b');sky.addColorStop(.58,'#28374a');sky.addColorStop(1,'#655f64');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    const glow=ctx.createRadialGradient(W*.69-camera*.035,H*.34,5,W*.69-camera*.035,H*.34,320);glow.addColorStop(0,'rgba(236,199,147,.24)');glow.addColorStop(1,'rgba(236,199,147,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
    // Distant, half-remembered skyline.
    for(let i=0;i<24;i++){const x=((i*103-camera*.12)%1250+1250)%1250-120;const w=34+rng(i+3)*54,h=75+rng(i+31)*185,y=groundY-30-h;ctx.fillStyle=i%3===0?'rgba(26,35,49,.52)':'rgba(34,44,58,.55)';ctx.fillRect(x,y,w,h);ctx.fillStyle='rgba(237,205,151,.14)';for(let r=0;r<4;r++)for(let c=0;c<2;c++)if(rng(i*9+r*3+c)>.5)ctx.fillRect(x+8+c*18,y+13+r*24,3,7);}
    // Floating fragments of the old sky.
    for(let i=0;i<17;i++){const x=((i*137-camera*.27)%1150+1150)%1150-50;const y=108+rng(i+82)*205+Math.sin(elapsed*.4+i)*9;ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(elapsed*.25+i)*.04);ctx.fillStyle='rgba(186,187,178,.12)';ctx.fillRect(-12,-2,24,4);ctx.restore();}
    ctx.fillStyle='rgba(255,244,218,.65)';for(let i=0;i<46;i++){const x=((i*83-camera*.06)%1050+1050)%1050;const y=35+rng(i+6)*240;ctx.globalAlpha=.25+.45*(.5+.5*Math.sin(elapsed*1.5+i));ctx.fillRect(x,y,1.3,1.3);}ctx.globalAlpha=1;
    // Broken moon.
    const mx=W*.76-camera*.025,my=H*.17;ctx.fillStyle='rgba(238,222,190,.48)';ctx.beginPath();ctx.arc(mx,my,31,0,Math.PI*2);ctx.fill();ctx.fillStyle='#192337';ctx.beginPath();ctx.moveTo(mx+12,my-35);ctx.lineTo(mx+34,my-28);ctx.lineTo(mx+23,my-8);ctx.lineTo(mx+40,my+2);ctx.lineTo(mx+17,my+12);ctx.lineTo(mx+8,my-8);ctx.fill();
  }
  function drawPlatform(p){
    if(p.broken)return;const x=p.x-camera;if(x+p.w< -10||x>W+10)return;const shake=p.ground&&p.collapse>0?Math.sin(elapsed*34)*Math.max(0,1-(p.collapse-elapsed)/3.1)*1.5:0;
    ctx.save();ctx.translate(0,shake);const top=p.y;
    ctx.fillStyle=p.ground?'#343d4a':'#48505a';ctx.fillRect(x,top,p.w,p.h);
    ctx.fillStyle=p.ground?'#a99a82':'#c1ad8c';ctx.fillRect(x,top,p.w,3);
    ctx.fillStyle='rgba(225,206,171,.13)';ctx.fillRect(x+8,top+7,p.w-16,1);
    for(let k=0;k<Math.floor(p.w/48);k++){const xx=x+15+k*48;ctx.fillStyle='rgba(15,21,32,.16)';ctx.fillRect(xx,top+20+(k%3)*15,18,2);ctx.fillRect(xx+23,top+45+(k%2)*18,9,2);}
    if(p.ground){ctx.fillStyle='rgba(14,18,27,.56)';ctx.fillRect(x,top+16,p.w,p.h-16);ctx.fillStyle='rgba(221,195,154,.16)';for(let i=0;i<Math.floor(p.w/26);i++){const xx=x+i*26;ctx.fillRect(xx,top+20,1,65+rng(i+p.id)*55);}}
    if(p.collapse>0&&!p.broken){const left=p.collapse-elapsed;if(left<1.6){ctx.strokeStyle=`rgba(234,197,135,${.35+(1.6-left)*.3})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+p.w*.25,top);ctx.lineTo(x+p.w*.29,top+20);ctx.lineTo(x+p.w*.24,top+37);ctx.moveTo(x+p.w*.73,top);ctx.lineTo(x+p.w*.69,top+16);ctx.lineTo(x+p.w*.75,top+28);ctx.stroke();}}
    ctx.restore();
  }
  function drawShard(s){if(s.got)return;const x=s.x-camera,y=s.y+Math.sin(elapsed*2.4+s.phase)*5;ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(elapsed*1.4+s.phase)*.18);ctx.shadowColor='#eed7a1';ctx.shadowBlur=21;ctx.fillStyle='#f0d7a2';ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(9,0);ctx.lineTo(0,14);ctx.lineTo(-9,0);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(3,0);ctx.lineTo(0,7);ctx.lineTo(-3,0);ctx.fill();ctx.restore();}
  function drawPlayer(){const x=player.x-camera,y=player.y;ctx.save();ctx.translate(x+player.w/2,y+player.h/2);if(player.face<0)ctx.scale(-1,1);
    // soft footprint glow
    ctx.fillStyle='rgba(13,17,25,.3)';ctx.beginPath();ctx.ellipse(0,player.h/2+2,18,4,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(240,209,161,.22)';ctx.beginPath();ctx.ellipse(0,-7,17,22,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#b9aa91';ctx.beginPath();ctx.ellipse(0,-14,7,9,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#3a4653';ctx.beginPath();ctx.moveTo(-6,-7);ctx.lineTo(6,-7);ctx.lineTo(11,17);ctx.lineTo(-10,17);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#c9b58e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-6,-5);ctx.lineTo(-10,8);ctx.moveTo(6,-5);ctx.lineTo(10,6);ctx.stroke();
    ctx.fillStyle='#202a39';ctx.fillRect(-8,16,6,7);ctx.fillRect(3,16,6,7);ctx.fillStyle='rgba(247,220,172,.85)';ctx.fillRect(2,-15,2,2);ctx.restore();}
  function drawExit(){const x=worldW-95-camera,y=groundY-104;ctx.save();ctx.translate(x,y);const open=shards.every(s=>s.got);ctx.strokeStyle=open?'rgba(239,215,164,.9)':'rgba(176,178,177,.55)';ctx.lineWidth=3;ctx.shadowColor=open?'#e7c88e':'transparent';ctx.shadowBlur=open?25:0;ctx.beginPath();ctx.moveTo(-29,50);ctx.lineTo(-29,0);ctx.quadraticCurveTo(-29,-25,0,-25);ctx.quadraticCurveTo(29,-25,29,0);ctx.lineTo(29,50);ctx.stroke();ctx.fillStyle=open?'rgba(218,190,143,.2)':'rgba(157,171,179,.12)';ctx.fillRect(-25,-1,50,51);if(open){ctx.fillStyle='#f4ddac';ctx.beginPath();ctx.arc(10,25,2,0,Math.PI*2);ctx.fill();}else{ctx.fillStyle='rgba(220,220,210,.62)';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText('?',0,28);}ctx.restore();}
  function drawRifts(){
    const amount=distortion;if(amount<.1)return;ctx.save();ctx.globalAlpha=.12+amount*.19;for(let i=0;i<7;i++){const x=((i*179+elapsed*(22+i*3))%1050);const y=100+rng(i+42)*380;ctx.strokeStyle=i%2?'#e6c997':'#bacbd3';ctx.lineWidth=i%3===0?2:1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+7,y+24);ctx.lineTo(x-3,y+42);ctx.lineTo(x+8,y+59);ctx.stroke();}ctx.restore();
  }
  function render(){ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);const shake=screenShake?((Math.random()-.5)*screenShake*12):0;ctx.save();ctx.translate(shake,0);drawBackground();ctx.fillStyle='rgba(14,17,24,.28)';ctx.fillRect(0,groundY,W,H-groundY);for(const p of platforms)drawPlatform(p);for(const shard of shards)drawShard(shard);drawExit();drawPlayer();drawRifts();
    // The seams of the dream briefly misalign as it unravels.
    if(distortion>.48){ctx.globalAlpha=(distortion-.48)*.17;ctx.fillStyle='#d99d91';ctx.fillRect(0,Math.sin(elapsed*3)*2+180,W,1);ctx.fillStyle='#91b9c9';ctx.fillRect(0,Math.cos(elapsed*2)*2+181,W,1);ctx.globalAlpha=1;}
    ctx.restore();
  }
  function frame(now){const dt=Math.min(.033,(now-last)/1000||0);last=now;if(state==='playing')update(dt);render();requestAnimationFrame(frame);}
  makeLevel();requestAnimationFrame(frame);
})();
