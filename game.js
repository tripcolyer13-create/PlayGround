(() => {
  'use strict';
  const canvas=document.querySelector('#game'), title=document.querySelector('#title-screen'), pauseScreen=document.querySelector('#pause-screen'), endScreen=document.querySelector('#end-screen');
  const topbar=document.querySelector('#topbar'), countEl=document.querySelector('#memory-count'), objective=document.querySelector('#objective'), roomLabel=document.querySelector('#room-label'), crosshair=document.querySelector('#crosshair'), interaction=document.querySelector('#interaction'), toast=document.querySelector('#toast');
  const controls={forward:false,back:false,left:false,right:false}, memories=[], colliders=[];
  let scene,camera,renderer,clock,player={x:-12.2,z:0,yaw:-Math.PI/2,pitch:0},state='title',found=0,active=null,roomNow=-1,toastTime=0,muted=false,audio=null,dragLook=false,lastTouch=null;
  const HOUSE={minX:-15,maxX:25,minZ:-8,maxZ:8};
  const mats={};
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function mat(name,color,roughness=.85,emissive=0){return mats[name]||(mats[name]=new THREE.MeshStandardMaterial({color,roughness,metalness:.02,emissive,emissiveIntensity:emissive?1:0}));}
  function box(x,y,z,w,h,d,material,solid=false){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);if(solid)colliders.push({x1:x-w/2,x2:x+w/2,z1:z-d/2,z2:z+d/2});return m;}
  function cylinder(x,y,z,r1,r2,h,material,segments=16){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
  function sphere(x,y,z,r,material){const m=new THREE.Mesh(new THREE.SphereGeometry(r,20,14),material);m.position.set(x,y,z);m.castShadow=true;scene.add(m);return m;}
  function light(x,y,z,color,intensity,distance=11){const l=new THREE.PointLight(color,intensity,distance,2);l.position.set(x,y,z);scene.add(l);return l;}
  function canvasTexture(kind){const c=document.createElement('canvas');c.width=256;c.height=192;const g=c.getContext('2d');g.fillStyle='#35312c';g.fillRect(0,0,256,192);if(kind==='portrait'){g.fillStyle='#776c5a';g.fillRect(22,18,212,156);g.fillStyle='#c2a982';g.beginPath();g.ellipse(128,78,32,41,0,0,7);g.fill();g.fillStyle='#454a48';g.beginPath();g.moveTo(67,176);g.quadraticCurveTo(77,111,128,112);g.quadraticCurveTo(183,112,191,176);g.fill();g.fillStyle='#dfc99e';g.fillRect(39,29,178,4);}else{g.fillStyle='#5e7375';g.fillRect(18,16,220,160);g.fillStyle='#d3bd8f';g.beginPath();g.arc(176,58,22,0,7);g.fill();g.fillStyle='#263c42';g.beginPath();g.moveTo(18,150);g.lineTo(82,80);g.lineTo(121,128);g.lineTo(170,69);g.lineTo(238,151);g.fill();g.fillStyle='#a5a079';g.fillRect(20,157,216,12);}return new THREE.CanvasTexture(c);}
  function painting(x,z,kind='landscape'){const frame=mat('frame',0x604c39), image=new THREE.MeshStandardMaterial({map:canvasTexture(kind),roughness:.8});box(x,2.52,z,1.75,1.28,.13,frame);box(x,2.52,z+.075,1.52,1.05,.035,image);}
  function wall(x,y,z,w,h,d,color,solid=true){return box(x,y,z,w,h,d,mat('wall'+color,color),solid);}
  function buildRoomShell(){
    const floorColors=[0x55483b,0x514638,0x46413a,0x514238,0x3e4140];
    for(let i=0;i<5;i++){
      const a=-15+i*8,b=a+8,c=(a+b)/2;
      box(c,-.18,0,8,.36,16,mat('floor'+i,floorColors[i]));
      // Ceiling is deliberately low-lit, giving each room a warm pool of light.
      box(c,4.1,0,8,.22,16,mat('ceil'+i,0x292722));
      for(let z=-7.45;z<8;z+=.55)box(c,-.005,z,8,.018,.025,mat('grain'+i,0x67594b));
      // Dividers have a broad, unobstructed central doorway.
      if(i>0){const x=a;wall(x,2.03,-4.75,.24,4.05,6.5,0x49443b);wall(x,2.03,4.75,.24,4.05,6.5,0x49443b);box(x,3.55,0,.33,.32,3.05,mat('lintel',0x594a3a));
        box(x-.14,.035,0,.04,.07,2.8,mat('threshold',0x947858));}
      // The room divider depth is outside player radius, so no collision is needed for doorway lintels.
      light(c,3.55,0,i===2?0xffd49a:0xffd8a5,i===4?.72:.9,12);
      // Moulding, ceiling beams and restrained wall trim.
      box(c,3.83,-7.72,7.8,.12,.24,mat('trim',0x806a4d));box(c,3.83,7.72,7.8,.12,.24,mat('trim',0x806a4d));
      box(c,3.95,0,-5.7,.12,.16,mat('beam',0x43382e));box(c,3.95,0,5.7,.12,.16,mat('beam',0x43382e));
    }
    wall(-15,2,0,.25,4,16,0x51463c);wall(25,2,0,.25,4,16,0x433f3c);wall(5,2,-8,40,4,.25,0x49443b);wall(5,2,8,40,4,.25,0x49443b);
    // Long rear window panels and frames, faintly luminous in the dusk.
    for(let x=-12;x<=20;x+=8){box(x,2.55,-7.84,2.4,1.65,.035,mat('glass',0x657879,0.3,0x182b2d));box(x,2.55,-7.78,.09,1.8,.08,mat('windowwood',0x766044));box(x,2.55,-7.77,2.55,.09,.08,mat('windowwood',0x766044));box(x,2.55,-7.77,.06,1.6,.08,mat('windowwood',0x766044));box(x,2.55,-7.77,2.3,.055,.08,mat('windowwood',0x766044));}
    for(let i=0;i<5;i++)painting(-11+i*8,-7.76,i===0?'portrait':'landscape');
  }
  function rug(x,z,w,d,color){box(x,.025,z,w,.035,d,mat('rug'+color,color));box(x,.047,z,w-.22,.012,d-.22,mat('ruginner'+color,color===0x765d46?0x927657:0x77705e));}
  function lamp(x,z){box(x,.82,z,.3,.06,.3,mat('lampbase',0x72583d));cylinder(x,1.22,z,.035,.035,.78,mat('lampstem',0x6d563e));const shade=cylinder(x,1.7,z,.25,.13,.34,mat('shade',0xd6b87c));light(x,1.55,z,0xffd69a,.52,5);}
  function makeBedroom(){
    rug(-11,0,5.4,6,0x765d46);box(-12.2,.48,-2.1,3.1,.78,2.5,mat('bedbase',0x514033),true);box(-12.2,.95,-2.1,3.15,.22,2.55,mat('linen',0xc2b59b));box(-12.2,1.09,-2.75,3.05,.2,1.2,mat('blanket',0x66716b));box(-13,1.1,-.95,.88,.25,.65,mat('pillow',0xe1d7c3));box(-11.4,1.1,-.95,.88,.25,.65,mat('pillow',0xe1d7c3));box(-13.95,1.2,-2.1,.28,2.1,2.8,mat('headboard',0x644d38),true);box(-9.65,.62,-2.05,1.15,1.15,1.1,mat('nightstand',0x6c5238),true);lamp(-9.65, -2.05);box(-9.65,.03,-2.05,1.05,.08,1.02,mat('wood',0x71583d));box(-8.8,1.25,4.8,1.45,2.45,1.2,mat('wardrobe',0x594632),true);box(-8.8,2.4,4.17,1.22,.12,.05,mat('wood',0x826a49));
  }
  function makeKitchen(){
    rug(-3,0,4.5,5.2,0x6a5945);box(-3.1,.82,3.15,4.5,1.6,1.15,mat('cabinet',0x66533c),true);box(-3.1,1.66,3.15,4.7,.18,1.32,mat('counter',0xc3b89e));for(let x=-4.5;x<-.9;x+=1.2){box(x,.82,2.55,.035,1.25,.04,mat('cabdetail',0x927451));cylinder(x,.92,2.46,.045,.045,.08,mat('handle',0xbba47a));}
    box(-4.3,.48,-1.5,2.3,.9,1.15,mat('island',0x6b553d),true);box(-4.3,.96,-1.5,2.4,.15,1.25,mat('counter',0xbeb39b));cylinder(-4.2,1.08,-1.5,.18,.18,.08,mat('bowl',0x8c7661));sphere(-4.2,1.19,-1.5,.17,mat('fruit',0xb9764f));box(-1.7,.42,4.7,1.3,.84,.9,mat('fridge',0x9a9586),true);box(-1.7,.45,4.2,.07,.45,.04,mat('handle',0xd1c4a4));
    for(let i=0;i<3;i++){box(-5.4+i*1.35,2.5,-7.55,.75,.9,.09,mat('cabinetdoor',0x706047));}
  }
  function makeLiving(){
    rug(5,0,6.3,6.3,0x62574a);box(5.1,.55,-2.9,4.2,1.05,1.5,mat('sofa',0x727164),true);box(5.1,1.13,-3.45,4.2,1.1,.4,mat('sofaback',0x77786b),true);for(let x=3.45;x<6.9;x+=1.6)box(x,1.06,-2.9,.12,.58,1.28,mat('sofacushion',0x858272));box(5,.43,-1.25,2.2,.72,1.3,mat('coffee',0x684d34),true);box(5,.83,-1.25,2.3,.1,1.4,mat('tabletop',0x977451));box(4.5,.91,-1.3,.75,.08,.42,mat('book',0x96704e));box(5.7,.94,-1.23,.22,.11,.22,mat('vase',0xa98961));cylinder(7.7,.8,-5.4,.65,.65,1.6,mat('fireplace',0x4a4036));box(7.7,1.35,-5.4,1.45,.16,.28,mat('mantel',0x796248));box(7.7,.8,-5.22,.88,.9,.08,mat('fireglow',0x251d19,1,0.25));light(7.7,1,-4.7,0xff8c4c,.38,4);box(2.2,.4,3.7,1.3,.8,1,mat('armchair',0x775d45),true);
  }
  function makeNursery(){
    rug(13,0,5.5,6,0x77705e);box(12.8,.62,-1.4,2.7,.35,1.8,mat('cribbase',0x765d43),true);box(12.8,1.12,-2.2,2.9,1.15,.16,mat('cribrail',0x9e8866),true);box(11.45,.92,-1.4,.14,.95,1.8,mat('cribrail',0x9e8866));box(14.15,.92,-1.4,.14,.95,1.8,mat('cribrail',0x9e8866));for(let x=11.7;x<14;x+=.35)box(x,.95,-2.2,.045,.9,.05,mat('cribslat',0xb29b74));box(12.8,.88,-1.4,2.3,.12,1.45,mat('babyblanket',0x9da69a));sphere(12.6,1.06,-1.6,.22,mat('toy',0xc5a77a));box(15.1,.55,2.4,1.1,1.1,1.1,mat('rocker',0x735b40),true);box(11.1,2.9,0,2.7,.07,.08,mat('mobile',0x8b7757));for(let i=0;i<4;i++){const m=sphere(10.2+i*.58,2.45+(i%2)*.25,0,.13,mat('mobiletoy'+i,[0xc99575,0x889b91,0xceb276,0x9994aa][i]));const thread=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.5,6),mat('thread',0x988563));thread.position.set(10.2+i*.58,2.68+(i%2)*.12,0);scene.add(thread);}
  }
  function makeObservatory(){
    rug(21,0,5.5,6,0x4e514e);box(21,.65,-3.5,3.3,1.25,1.35,mat('desk',0x68513a),true);box(21,1.31,-3.5,3.5,.15,1.5,mat('desktop',0x9c8058));box(20.3,1.43,-3.55,.85,.035,.58,mat('journal',0x514b42));box(20.3,1.46,-3.55,.7,.018,.52,mat('paper',0xc5b99d));sphere(22.1,1.58,-3.65,.2,mat('globe',0x72827e));cylinder(22.1,1.38,-3.65,.04,.04,.28,mat('globeStem',0x997d51));
    const tripodMat=mat('tripod',0x806743);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;const leg=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,1.6,8),tripodMat);leg.position.set(19.2+Math.cos(a)*.5,1.05,2.2+Math.sin(a)*.5);leg.rotation.z=Math.cos(a)*.48;leg.rotation.x=Math.sin(a)*.48;scene.add(leg);}const scope=cylinder(19.2,2.03,2.2,.17,.23,1.25,mat('scope',0x806e50));scope.rotation.z=-.42;cylinder(19.47,2.33,2.2,.22,.22,.1,mat('lens',0x788987,.25,0x283b3c)).rotation.z=-.42;light(19.2,2.1,2.2,0x96b7b0,.3,4);
    // The impossible little door faces the center of the house.
    box(23.7,1.5,4.2,1.9,3,.18,mat('sourceframe',0x716146));const portal=new THREE.Mesh(new THREE.PlaneGeometry(1.55,2.65),new THREE.MeshBasicMaterial({color:0x9bc0bb,transparent:true,opacity:.2,side:THREE.DoubleSide}));portal.position.set(23.7,1.5,4.08);scene.add(portal);portal.userData.portal=true;light(23.6,1.8,3.2,0x9bd4cb,.5,5);
  }
  function makeMemory(index,x,y,z,label,text,color){
    const group=new THREE.Group();group.position.set(x,y,z);scene.add(group);const core=new THREE.Mesh(new THREE.OctahedronGeometry(.2,0),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.75,roughness:.25,metalness:.2}));group.add(core);const halo=new THREE.Mesh(new THREE.TorusGeometry(.34,.012,6,36),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.72}));halo.rotation.x=Math.PI/2;group.add(halo);light(x,y,z,color,.28,3);memories.push({group,x,y,z,label,text,found:false,core,halo});}
  function buildScene(){
    scene=new THREE.Scene();scene.background=new THREE.Color(0x171719);scene.fog=new THREE.Fog(0x171719,16,39);
    camera=new THREE.PerspectiveCamera(73,1,.08,90);camera.position.set(player.x,1.62,player.z);camera.rotation.order='YXZ';
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
    scene.add(new THREE.HemisphereLight(0xb4bdc3,0x493b2c,.52));const ambient=new THREE.AmbientLight(0x746f62,.28);scene.add(ambient);
    buildRoomShell();makeBedroom();makeKitchen();makeLiving();makeNursery();makeObservatory();
    // Glowing recollections appear where ordinary objects have gone quiet.
    makeMemory(0,-9.6,1.55,0,'THE BEDROOM','A hand on your forehead. A voice saying the storm will pass.',0xe4c68c);
    makeMemory(1,-2.9,1.65,0,'THE KITCHEN','The first thing you learned to make was something warm for someone else.',0xf0b77e);
    makeMemory(2,5.65,1.38,0,'THE LIVING ROOM','A whole world can begin with someone leaving a light on.',0xd7c797);
    makeMemory(3,15.2,1.55,0,'THE NURSERY','Before you knew the names of things, you knew you were held.',0xb9c9b3);
    makeMemory(4,21.3,1.55,0,'THE OBSERVATORY','You looked up and asked where everything came from. Nobody knew.',0x9ec9c2);
    const source=new THREE.Group();source.position.set(23.7,1.55,3.55);scene.add(source);const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(.38,1),new THREE.MeshStandardMaterial({color:0x9bd4cb,emissive:0x548d85,emissiveIntensity:.5,roughness:.2,metalness:.25}));source.add(orb);const ring=new THREE.Mesh(new THREE.TorusGeometry(.62,.018,8,60),new THREE.MeshBasicMaterial({color:0xc2e2d7,transparent:true,opacity:.6}));ring.rotation.x=.8;source.add(ring);source.userData.source=true;memories.push({group:source,x:23.7,y:1.55,z:3.55,label:'THE SOURCE',text:'Press E to ask the house where your reality comes from.',found:false,final:true,core:orb,halo:ring});light(23.7,1.7,3.5,0x8ed6cc,.65,6);
    window.addEventListener('resize',resize);resize();
  }
  function resize(){if(!renderer)return;const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix();}
  function updateCount(){countEl.textContent=`${found} / 5`;objective.textContent=found<5?'WANDER THE HOUSE  ·  LISTEN FOR WHAT IT REMEMBERS':'THE FIVE MEMORIES ARE YOURS  ·  FIND THE SOURCE';}
  function say(text){toast.textContent=text;toast.classList.add('show');toastTime=3.5;}
  function sound(freq=440,duration=.22){if(muted)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.72,audio.currentTime+duration);g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch(_){}}
  function start(){if(!renderer){try{buildScene();}catch(e){console.error(e);say('The house could not be opened. Please reload.');return;}}state='playing';title.hidden=true;pauseScreen.hidden=true;topbar.hidden=false;objective.hidden=false;crosshair.hidden=false;roomLabel.hidden=false;document.querySelector('#bottom-note').hidden=false;updateCount();if(canvas.requestPointerLock&&!matchMedia('(pointer:coarse)').matches){try{canvas.requestPointerLock();}catch(_){}}}
  function pause(){if(state!=='playing')return;state='paused';pauseScreen.hidden=false;if(document.pointerLockElement)document.exitPointerLock();}
  function resume(){state='playing';pauseScreen.hidden=true;if(canvas.requestPointerLock&&!matchMedia('(pointer:coarse)').matches){try{canvas.requestPointerLock();}catch(_){}}}
  document.querySelector('#start-button').addEventListener('click',start);document.querySelector('#resume-button').addEventListener('click',resume);document.querySelector('#pause-button').addEventListener('click',pause);
  document.querySelector('#sound-button').addEventListener('click',e=>{muted=!muted;e.currentTarget.textContent=muted?'♫̸':'♫';if(!muted)sound(530,.14);});
  document.querySelector('#again-button').addEventListener('click',()=>location.reload());
  document.querySelector('#touch-listen').addEventListener('click',interact);
  document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&state==='playing'&&!matchMedia('(pointer:coarse)').matches){state='paused';pauseScreen.hidden=false;}});
  document.addEventListener('mousemove',e=>{if(state!=='playing')return;if(document.pointerLockElement){player.yaw-=e.movementX*.0022;player.pitch=clamp(player.pitch-e.movementY*.0018,-1.15,1.15);}else if(dragLook){player.yaw-=e.movementX*.004;player.pitch=clamp(player.pitch-e.movementY*.003,-1.15,1.15);}});
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){lastTouch={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}else if(state==='playing'&&!document.pointerLockElement){dragLook=true;}});
  canvas.addEventListener('pointermove',e=>{if(e.pointerType==='touch'&&lastTouch&&state==='playing'){const dx=e.clientX-lastTouch.x,dy=e.clientY-lastTouch.y;player.yaw-=dx*.006;player.pitch=clamp(player.pitch-dy*.005,-1.15,1.15);lastTouch={x:e.clientX,y:e.clientY};}});
  canvas.addEventListener('pointerup',()=>{dragLook=false;lastTouch=null;});canvas.addEventListener('pointercancel',()=>{dragLook=false;lastTouch=null;});
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();if(k==='escape'||k==='p'){if(state==='playing')pause();else if(state==='paused')resume();return;}if(k==='e'||k==='enter'){if(state==='playing')interact();return;}if(state!=='playing')return;if(k==='w'||k==='arrowup')controls.forward=true;if(k==='s'||k==='arrowdown')controls.back=true;if(k==='a'||k==='arrowleft')controls.left=true;if(k==='d'||k==='arrowright')controls.right=true;});
  window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k==='w'||k==='arrowup')controls.forward=false;if(k==='s'||k==='arrowdown')controls.back=false;if(k==='a'||k==='arrowleft')controls.left=false;if(k==='d'||k==='arrowright')controls.right=false;});
  document.querySelectorAll('[data-control]').forEach(button=>{const name=button.dataset.control;const down=e=>{e.preventDefault();controls[name]=true;button.setPointerCapture?.(e.pointerId);};const up=e=>{e.preventDefault();controls[name]=false;};button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('lostpointercapture',up);});
  function interact(){if(state!=='playing'||!active)return;if(active.final){if(found<5){say('Five memories are missing. The source is not ready to answer.');sound(185,.3);return;}state='won';endScreen.hidden=false;document.exitPointerLock?.();sound(523,.5);setTimeout(()=>sound(659,.7),180);return;}if(active.found)return;active.found=true;active.group.visible=false;found++;updateCount();say(`${active.label} — “${active.text}”`);sound(430+found*75,.42);}
  function collides(x,z){const r=.28;if(x< HOUSE.minX+.32||x>HOUSE.maxX-.32||z<HOUSE.minZ+.32||z>HOUSE.maxZ-.32)return true;for(const b of colliders){const px=clamp(x,b.x1,b.x2),pz=clamp(z,b.z1,b.z2);if((x-px)**2+(z-pz)**2<r*r)return true;}return false;}
  function roomAt(x){return clamp(Math.floor((x+15)/8),0,4);}
  const roomNames=['THE BEDROOM','THE KITCHEN','THE LIVING ROOM','THE NURSERY','THE OBSERVATORY'];
  function update(dt){
    const forward=(controls.forward?1:0)-(controls.back?1:0),side=(controls.right?1:0)-(controls.left?1:0);let dx=0,dz=0;
    if(forward||side){const mag=Math.hypot(forward,side)||1,f=forward/mag,s=side/mag;dx=(-Math.sin(player.yaw)*f+Math.cos(player.yaw)*s)*3.05*dt;dz=(-Math.cos(player.yaw)*f-Math.sin(player.yaw)*s)*3.05*dt;}
    if(!collides(player.x+dx,player.z))player.x+=dx;if(!collides(player.x,player.z+dz))player.z+=dz;
    camera.position.set(player.x,1.62,player.z);camera.rotation.set(player.pitch,player.yaw,0,'YXZ');
    const room=roomAt(player.x);if(room!==roomNow){roomNow=room;roomLabel.textContent=roomNames[room];roomLabel.style.opacity='1';clearTimeout(roomLabel._fade);roomLabel._fade=setTimeout(()=>roomLabel.style.opacity='.32',2400);}
    let nearest=null,best=2.8;for(const item of memories){if(item.found)continue;if(item.final&&found<5)continue;const d=Math.hypot(player.x-item.x,player.z-item.z);if(d<best){best=d;nearest=item;}}
    active=nearest;interaction.hidden=!nearest;
    const t=clock.elapsedTime;for(const item of memories){if(item.found)continue;item.group.position.y=item.y+Math.sin(t*1.35+(item.final?2:item.x))*.09;item.group.rotation.y=t*.32;if(item.halo)item.halo.rotation.z=t*.42;}
    if(toastTime>0){toastTime-=dt;if(toastTime<=0)toast.classList.remove('show');}
  }
  function frame(){requestAnimationFrame(frame);if(!renderer)return;const dt=Math.min(clock.getDelta(),.15);if(state==='playing')update(dt);renderer.render(scene,camera);}
  try{buildScene();clock=new THREE.Clock();}catch(e){console.error(e);}
  requestAnimationFrame(frame);
})();
