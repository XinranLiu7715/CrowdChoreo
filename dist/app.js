(() => {
  'use strict';
  const data = window.CROWDCHOREO;
  data.forEach(s => {s.title=s.english;s.subtitle=s.formation;s.note='';s.persons.forEach(p=>p.color='#333333');});
  // Website-only formation correction requested for the third example.
  data[2].formation = 'triangle';
  data[2].subtitle = 'triangle';
  const $ = id => document.getElementById(id);
  const video = $('rgb'), canvas = $('skeleton'), ctx = canvas.getContext('2d');
  const boxCanvas = $('boxCanvas'), boxCtx = boxCanvas.getContext('2d');
  const map = $('formationMap'), mapCtx = map.getContext('2d');
  const edges = [[0,1],[0,2],[0,3],[1,4],[2,5],[3,6],[4,7],[5,8],[6,9],[7,10],[8,11],[9,12],[12,15],[9,13],[9,14],[13,16],[14,17],[16,18],[17,19],[18,20],[19,21],[20,22],[21,23]];
  const emotions = {};
  const formations = {};
  let sample = data[0], sampleIndex = 0, selectedPerson = 0;
  let showBoxes = false, currentFrame = 0, lastCaption = -1, lastMapFrame = -1;
  let camera = {yaw:0, elevation:.35}, targetCamera = {...camera}, cameraMode = 'space';
  let dimensions = {w:600,h:375}, activePointer = null;
  let toastTimer, generation = 0;
  const pad = n => String(n).padStart(2, '0');
  const time = t => `${pad(Math.floor(t/60))}:${pad(Math.floor(t)%60)}.${pad(Math.floor((t%1)*100 + .001))}`;
  const personName = i => 'P'+pad(i+1);
  const clockTime = t => `${t.toFixed(2)}s`;

  function toast(message) {
    $('toast').textContent = message; $('toast').classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2700);
  }

  function setSize(c, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(w*dpr); c.height = Math.round(h*dpr);
    c.getContext('2d').setTransform(dpr,0,0,dpr,0,0);
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    dimensions = {w:r.width,h:r.height};
    setSize(canvas,r.width,r.height);
    const b = boxCanvas.getBoundingClientRect(); setSize(boxCanvas,b.width,b.height);
    const m = map.getBoundingClientRect(); setSize(map,m.width,m.height);
    lastMapFrame = -1;
    render();
  }

  function selectSample(index, autoplay = false) {
    const previousPlaying = !video.paused;
    generation++;
    video.pause(); sampleIndex = index; sample = data[index];
    selectedPerson = 0; currentFrame = 0; lastCaption = -1; lastMapFrame = -1;
    cameraMode = 'space'; camera = {yaw:0,elevation:.35}; targetCamera = {...camera};
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('selected', b.dataset.view === cameraMode));
    $('exampleTitle').textContent = sample.title;
    $('exampleSubtitle').textContent = sample.subtitle+'  /  '+sample.persons.length+' dancers · 6 s window';
    $('exampleEnglish').textContent = sample.english;
    $('sampleCounter').textContent = pad(index+1)+' / 05';
    document.querySelectorAll('.sample').forEach((b,i) => {
      b.classList.toggle('active',i===index); b.setAttribute('aria-pressed',String(i===index));
    });
    video.poster = sample.poster;
    video.src = video.canPlayType('video/mp4; codecs="avc1.42E01E"') ? sample.video : sample.video.replace('.mp4','.webm');
    video.load();
    video.playbackRate = Number($('speed').value);
    $('scrubber').max = sample.frames[1]-sample.frames[0]-1;
    $('scrubber').value = 0;
    $('emotionValue').replaceChildren(document.createTextNode(sample.emotion.label));
    const zh = document.createElement('small'); zh.textContent = emotions[sample.emotion.label] || '';
    $('emotionValue').append(zh);
    $('emotionConfidence').textContent = 'Confidence: '+sample.emotion.confidence+' · clip-level label';
    $('emotionEvidence').textContent = sample.emotion.evidence;
    $('formationValue').textContent = formations[sample.formation] || sample.formation;
    $('formationEnglish').textContent = sample.formation;
    $('downloadAnnotations').href = `assets/${sample.id}/annotations.json`;
    $('provenanceText').textContent = sample.provenanceText || `${sample.batch} / ${sample.source} · ${sample.split} split. Source frames [${sample.frames[0]}, ${sample.frames[1]}), ${sample.fps} fps. Skeletons: final_theta030 / rotfix. Text: v8.2 selection. Formation: 2026-10-16 timeline. Emotion: final split annotations.`;
    buildPersonTabs(); buildTimeline(); update();
    if (autoplay || previousPlaying) safePlay();
  }

  function buildPersonTabs() {
    $('personTabs').replaceChildren(...sample.persons.map((p,i) => {
      const b = document.createElement('button'); b.type='button';
      const dot = document.createElement('i'); dot.style.background=p.color;
      b.append(dot,personName(i)); b.title=p.id+' · track '+p.track;
      b.setAttribute('aria-pressed',String(i===selectedPerson));
      b.classList.toggle('selected',i===selectedPerson);
      b.addEventListener('click',() => {
        selectedPerson=i; lastCaption=-1; buildPersonTabs(); buildTimeline(); update();
      });
      return b;
    }));
    $('livePerson').textContent = personName(selectedPerson);
    $('livePerson').style.color = sample.persons[selectedPerson].color;
  }

  function buildTimeline() {
    $('timeline').replaceChildren(...sample.persons[selectedPerson].segments.map((s,i) => {
      const b = document.createElement('button'); b.type='button'; b.className='segment';
      b.dataset.segment=i;
      b.setAttribute('aria-label',`${clockTime(s.start)} to ${clockTime(s.end)}，${s.text}`);
      const t=document.createElement('time'); t.textContent=s.start.toFixed(2)+'—'+s.end.toFixed(2)+'s';
      const text=document.createElement('p'); text.textContent=s.text; b.append(t,text);
      b.addEventListener('click',() => seek(s.start)); return b;
    }));
  }

  async function safePlay() {
    const request = generation;
    try { await video.play(); }
    catch(e) { if(request===generation && e.name!=='AbortError') toast('Click Play to start.'); }
  }
  function playPause() { video.paused ? safePlay() : video.pause(); }
  function seek(t) {
    const end = sample.duration-1/sample.fps;
    video.currentTime=Math.max(0,Math.min(end,t)); update();
  }
  function step(delta) { video.pause(); seek((Math.floor(video.currentTime*sample.fps+.0001)+delta)/sample.fps); }
  function update() {
    const t = Math.min(video.currentTime||0,sample.duration-1e-6);
    currentFrame = Math.max(0,Math.min(sample.frames[1]-sample.frames[0]-1,Math.floor(t*sample.fps+.001)));
    $('clock').textContent = time(t)+' / '+time(sample.duration);
    $('scrubber').value=currentFrame;
    $('frameNumber').textContent='F '+String(currentFrame).padStart(3,'0');
    $('sourceFrame').textContent=`Source frame ${sample.frames[0]+currentFrame} / [${sample.frames[0]}, ${sample.frames[1]}) · ${sample.fps} fps`;
    const segments=sample.persons[selectedPerson].segments;
    const sourceFrame=sample.frames[0]+currentFrame;
    const active=segments.findIndex(s => sourceFrame>=s.sourceFrames[0] && sourceFrame<s.sourceFrames[1]);
    const ix=active>=0?active:segments.length-1;
    if (ix!==lastCaption) {
      $('currentCaption').textContent=segments[ix].text;
      document.querySelectorAll('.segment').forEach((b,i) => {
        b.classList.toggle('active',i===ix); b.setAttribute('aria-current',i===ix?'true':'false');
      });
      lastCaption=ix;
    }
    render();
  }

  // These are independent orthographic projections of the stored world joints.
  // No RGB calibration, per-person repositioning, or invented joints are used.
  function makeProjection() {
    const [lo,hi]=sample.bounds, {w,h}=dimensions;
    const cx=(lo[0]+hi[0])/2, cy=(lo[1]+hi[1])/2, cz=(lo[2]+hi[2])/2;
    const sy=Math.sin(camera.yaw), co=Math.cos(camera.yaw), se=Math.sin(camera.elevation), ce=Math.cos(camera.elevation);
    const projectRaw = point => {
      const x=point[0]-cx,y=point[1]-cy,z=point[2]-cz;
      return [-(x*co-z*sy),y*ce+(x*sy+z*co)*se,(x*sy+z*co)*ce-y*se];
    };
    const points=[];
    for(const x of [lo[0],hi[0]]) for(const y of [lo[1],hi[1]]) for(const z of [lo[2],hi[2]]) points.push(projectRaw([x,y,z]));
    const xmin=Math.min(...points.map(p=>p[0])),xmax=Math.max(...points.map(p=>p[0]));
    const ymin=Math.min(...points.map(p=>p[1])),ymax=Math.max(...points.map(p=>p[1]));
    const scale=Math.min((w-70)/Math.max(xmax-xmin,.5),(h-75)/Math.max(ymax-ymin,.5));
    const project=point=>{const p=projectRaw(point);return [w/2+(p[0]-(xmin+xmax)/2)*scale,h/2-(p[1]-(ymin+ymax)/2)*scale+4,p[2]];};
    return {project,lo,hi,scale};
  }
  function line(context,a,b,color,width=1) {
    context.beginPath();context.moveTo(a[0],a[1]);context.lineTo(b[0],b[1]);context.strokeStyle=color;context.lineWidth=width;context.stroke();
  }
  function circle(context,p,r,color) {context.beginPath();context.arc(p[0],p[1],r,0,Math.PI*2);context.fillStyle=color;context.fill();}
  function render() {
    if(!dimensions.w || !sample) return;
    const {w,h}=dimensions, {project,lo,hi,scale}=makeProjection();
    ctx.clearRect(0,0,w,h);
    const bg=ctx.createRadialGradient(w*.5,h*.48,5,w*.5,h*.5,w*.7);
    bg.addColorStop(0,'#ffffff');bg.addColorStop(1,'#ffffff');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    const ground=lo[1]-.03;
    const x0=Math.floor(lo[0])-1,x1=Math.ceil(hi[0])+1,z0=Math.floor(lo[2])-1,z1=Math.ceil(hi[2])+1;
    ctx.save();ctx.globalAlpha=.7;
    for(let x=x0;x<=x1;x++)line(ctx,project([x,ground,z0]),project([x,ground,z1]),'#dddddd',.7);
    for(let z=z0;z<=z1;z++)line(ctx,project([x0,ground,z]),project([x1,ground,z]),'#dddddd',.7);
    ctx.restore();
    const ordered=sample.persons.map((p,i)=>({p,i,depth:project(p.joints[currentFrame][0])[2]})).sort((a,b)=>b.depth-a.depth);
    for(const {p,i} of ordered) {
      const joints=p.joints[currentFrame],pts=joints.map(project),root=joints[0];
      const foot=project([root[0],ground,root[2]]);
      ctx.save();ctx.globalAlpha=.15;ctx.fillStyle=p.color;ctx.beginPath();ctx.ellipse(foot[0],foot[1],Math.max(8,scale*.14),Math.max(2,scale*.05),0,0,Math.PI*2);ctx.fill();ctx.restore();
      ctx.save();ctx.globalAlpha=1;ctx.lineCap='round';ctx.lineJoin='round';
      ctx.shadowColor=p.color;ctx.shadowBlur=0;
      const lw=Math.max(1.6,Math.min(3,scale*.022));
      for(const [a,b] of edges)line(ctx,pts[a],pts[b],p.color,lw);
      ctx.shadowBlur=0;
      for(let k=0;k<pts.length;k++)circle(ctx,pts[k],k===15?Math.max(3,lw*1.8):Math.max(1.6,lw*.65),p.color);
      const head=pts[15];
      ctx.font='10px ui-monospace, monospace';ctx.textAlign='center';ctx.fillStyle=p.color;
      ctx.fillText(personName(i),head[0],Math.max(15,head[1]-15));ctx.restore();
    }
    ctx.fillStyle='#777777';ctx.font='8px ui-monospace, monospace';ctx.textAlign='left';
    ctx.fillText(cameraMode==='top'?'XZ · TOP VIEW':cameraMode==='front'?'XY · FRONT VIEW':'3D · ORTHOGRAPHIC',16,20);
    ctx.textAlign='right';ctx.fillStyle='#666666';ctx.fillText('24 JOINTS / DANCER',w-16,20);
    const annotationCanvas=$('annotationSkeleton');
    if(annotationCanvas){annotationCanvas.width=canvas.width;annotationCanvas.height=canvas.height;annotationCanvas.getContext('2d').drawImage(canvas,0,0);$('annotationSeek').value=currentFrame;$('annotationTime').textContent=(currentFrame/sample.fps).toFixed(2)+' s';}
    drawBoxes();
    if(lastMapFrame!==currentFrame){drawMap();lastMapFrame=currentFrame;}
  }

  function drawBoxes() {
    const r=boxCanvas.getBoundingClientRect(),w=r.width,h=r.height;
    boxCtx.clearRect(0,0,w,h);if(!showBoxes)return;
    const vw=video.videoWidth||960,vh=video.videoHeight||540;
    const fit=Math.min(w/vw,h/vh),ow=vw*fit,oh=vh*fit,ox=(w-ow)/2,oy=(h-oh)/2;
    const sx=ow/sample.sourceSize[0],sy=oh/sample.sourceSize[1];
    sample.persons.forEach((p,i)=>{
      const [x1,y1,x2,y2]=p.boxes[currentFrame];
      boxCtx.save();boxCtx.globalAlpha=i===selectedPerson?1:.55;
      boxCtx.strokeStyle=p.color;boxCtx.lineWidth=i===selectedPerson?2:1;
      boxCtx.strokeRect(ox+x1*sx,oy+y1*sy,(x2-x1)*sx,(y2-y1)*sy);
      boxCtx.fillStyle=p.color;const x=ox+x1*sx,y=Math.max(0,oy+y1*sy-18);
      boxCtx.fillRect(x,y,34,17);boxCtx.font='10px ui-monospace, monospace';boxCtx.fillStyle='#ffffff';boxCtx.fillText(personName(i),x+5,y+12);boxCtx.restore();
    });
  }
  function drawMap() {
    const {width:w,height:h}=map.getBoundingClientRect();mapCtx.clearRect(0,0,w,h);
    const [lo,hi]=sample.bounds;
    const span=Math.max(hi[0]-lo[0],hi[2]-lo[2],1),s=Math.min(w-30,h-24)/span;
    const to=point=>[w/2-(point[0]-(lo[0]+hi[0])/2)*s,h/2-(point[2]-(lo[2]+hi[2])/2)*s];
    for(let x=15;x<w;x+=15)for(let y=10;y<h;y+=15)circle(mapCtx,[x,y],.6,'#dddddd');
    const roots=sample.persons.map(p=>to(p.joints[currentFrame][0]));
    if(roots.length===3 && sample.formation==='triangle') {
      mapCtx.beginPath();mapCtx.moveTo(...roots[0]);mapCtx.lineTo(...roots[1]);mapCtx.lineTo(...roots[2]);mapCtx.closePath();mapCtx.fillStyle='#eeeeee';mapCtx.fill();mapCtx.setLineDash([2,3]);mapCtx.strokeStyle='#999999';mapCtx.lineWidth=1;mapCtx.stroke();mapCtx.setLineDash([]);
    }
    sample.persons.forEach((p,i)=>{
      const root=roots[i];circle(mapCtx,root,i===selectedPerson?4.5:3.5,'#333333');
      mapCtx.font='7px monospace';mapCtx.textAlign='center';mapCtx.fillStyle='#555555';mapCtx.fillText(personName(i),root[0],root[1]-8);
    });
  }

  data.forEach((s,i)=> {
    const b=document.createElement('button');b.type='button';b.className='sample';
    b.setAttribute('aria-label',`${pad(i+1)} ${s.title}，${s.subtitle}`);
    const image=document.createElement('div');image.className='sample-image';
    const img=document.createElement('img');img.src=s.poster;img.alt=s.subtitle;img.loading=i<3?'eager':'lazy';
    const index=document.createElement('span');index.className='sample-index';index.textContent=pad(i+1);image.append(img,index);
    const meta=document.createElement('div');meta.className='sample-meta';
    const title=document.createElement('strong');title.textContent=s.title;
    const count=document.createElement('span');count.textContent=s.persons.length+' dancers';meta.append(title,count);
    const description=document.createElement('p');description.textContent=s.subtitle;
    b.append(image,meta,description);b.addEventListener('click',()=>selectSample(i));$('gallery').append(b);
  });
  $('annotationPlay').addEventListener('click',playPause);
  $('annotationSeek').addEventListener('input',e=>seek(Number(e.target.value)/sample.fps));
  $('play').addEventListener('click',playPause);
  $('prevFrame').addEventListener('click',()=>step(-1));$('nextFrame').addEventListener('click',()=>step(1));
  $('scrubber').addEventListener('input',e=>seek(Number(e.target.value)/sample.fps));
  $('speed').addEventListener('change',e=>video.playbackRate=Number(e.target.value));
  $('boxes').addEventListener('click',()=>{showBoxes=!showBoxes;$('boxes').setAttribute('aria-pressed',String(showBoxes));drawBoxes();});
  $('mute').addEventListener('click',()=>{video.muted=!video.muted;$('mute').textContent=video.muted?'♪̸':'♪';$('mute').setAttribute('aria-label',video.muted?'Enable audio':'Muted');$('mute').title=video.muted?'Enable audio':'Muted';});
  $('loop').addEventListener('click',()=>{video.loop=!video.loop;$('loop').classList.toggle('active',video.loop);$('loop').setAttribute('aria-pressed',String(video.loop));});
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{
    cameraMode=b.dataset.view;
    targetCamera={yaw:0,elevation:cameraMode==='front'?0:cameraMode==='top'?Math.PI/2:.35};
    document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('selected',el===b));
  }));
  canvas.addEventListener('pointerdown',e=>{activePointer={x:e.clientX,y:e.clientY,yaw:camera.yaw,elevation:camera.elevation};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{
    if(!activePointer)return;
    targetCamera={yaw:activePointer.yaw+(e.clientX-activePointer.x)*.008,elevation:Math.max(-.05,Math.min(1.55,activePointer.elevation+(e.clientY-activePointer.y)*.006))};camera={...targetCamera};cameraMode='custom';
    document.querySelectorAll('[data-view]').forEach(el=>el.classList.remove('selected'));
  });
  canvas.addEventListener('pointerup',()=>activePointer=null);canvas.addEventListener('pointercancel',()=>activePointer=null);
  canvas.addEventListener('keydown',e=>{if(e.key==='Home'){cameraMode='space';camera=targetCamera={yaw:0,elevation:.35};}});
  document.addEventListener('keydown',e=>{
    if(e.target.matches('input,select,textarea,button,summary') || e.metaKey || e.ctrlKey || e.altKey)return;
    if(e.code==='Space'){e.preventDefault();playPause();}
    else if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}
    else if(e.key==='ArrowRight'){e.preventDefault();step(1);}
    else if(/^[1-5]$/.test(e.key)){selectSample(Number(e.key)-1);}
  });
  video.addEventListener('play',()=>{$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','Pause');});
  video.addEventListener('pause',()=>{$('play').textContent='▶';$('play').setAttribute('aria-label','Play');update();});
  for(const event of ['timeupdate','seeked','loadeddata','loadedmetadata'])video.addEventListener(event,update);
  video.addEventListener('error',()=>toast('Video could not load. Check the assets folder or network connection.'));
  video.addEventListener('ended',()=>{update();$('play').textContent='▶';});
  video.loop=true;
  // The cached RGB evidence windows have no audio track.
  $('mute').disabled=true; $('mute').textContent='Muted';
  $('mute').title='RGB evidence windows have no audio track'; $('mute').setAttribute('aria-label','RGB evidence windows have no audio track');
  new ResizeObserver(resize).observe(canvas.parentElement);
  new ResizeObserver(()=>{lastMapFrame=-1;resize();}).observe(map.parentElement);
  function animate(){
    const diff=Math.abs(camera.yaw-targetCamera.yaw)+Math.abs(camera.elevation-targetCamera.elevation);
    if(diff>.0001){camera.yaw+=(targetCamera.yaw-camera.yaw)*.17;camera.elevation+=(targetCamera.elevation-camera.elevation)*.17;}
    if(!video.paused)update();else if(diff>.0001)render();
    requestAnimationFrame(animate);
  }
  selectSample(0); resize(); requestAnimationFrame(animate);
})();
