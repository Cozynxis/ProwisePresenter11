(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const uid = () => Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const deep=o=>JSON.parse(JSON.stringify(o));

const refs={
  app:$('#app'), board:$('#board'), svg:$('#svgCanvas'), content:$('#contentLayer'), interaction:$('#interactionLayer'), dom:$('#domLayer'), laser:$('#laserDot'),
  panel:$('#sidePanel'), panelTitle:$('#panelTitle'), panelSubtitle:$('#panelSubtitle'), panelContent:$('#panelContent'),
  title:$('#documentTitle'), saveState:$('#saveState'), color:$('#strokeColor'), width:$('#strokeWidth'), widthValue:$('#strokeWidthValue'), fillToggle:$('#fillToggle'), fillColor:$('#fillColor'),
  pageCounter:$('#pageCounterBtn'), zoomLabel:$('#zoomLabel'), stageScaler:$('#stageScaler'), imageInput:$('#imageInput'), importInput:$('#importInput'),
  modal:$('#modal'), modalTitle:$('#modalTitle'), modalBody:$('#modalBody'), inspector:$('#inspector'), inspectorContent:$('#inspectorContent')
};

const defaultPage=()=>({id:uid(),name:'Nieuwe pagina',background:'blank',objects:[],notes:''});
const state={
  title:'Naamloze les',pages:[defaultPage()],pageIndex:0,tool:'select',stroke:'#1d4ed8',strokeWidth:4,fill:false,fillColor:'#bfdbfe',zoom:1,
  selectedId:null,history:[],future:[],clipboard:null,dirty:false,panel:'pages',presentation:false,gridSnap:false
};
let gesture=null, saveTimer=null;

function page(){return state.pages[state.pageIndex]}
function toast(msg){const n=document.createElement('div');n.className='toast';n.textContent=msg;$('#toastHost').append(n);setTimeout(()=>n.remove(),2600)}
function markDirty(){state.dirty=true;refs.saveState.textContent='Opslaan…';clearTimeout(saveTimer);saveTimer=setTimeout(saveLocal,500)}
function saveLocal(){const payload={title:state.title,pages:state.pages,pageIndex:state.pageIndex};localStorage.setItem('presenterNova.document',JSON.stringify(payload));state.dirty=false;refs.saveState.textContent='Opgeslagen'}
function loadLocal(){try{const raw=localStorage.getItem('presenterNova.document');if(!raw)return;const d=JSON.parse(raw);if(d&&Array.isArray(d.pages)&&d.pages.length){state.title=d.title||state.title;state.pages=d.pages;state.pageIndex=clamp(d.pageIndex||0,0,state.pages.length-1)}}catch(e){console.warn(e)}}
function snapshot(){state.history.push(JSON.stringify({pages:state.pages,pageIndex:state.pageIndex,title:state.title}));if(state.history.length>80)state.history.shift();state.future=[]}
function restore(str){const d=JSON.parse(str);state.pages=d.pages;state.pageIndex=d.pageIndex;state.title=d.title;refs.title.value=state.title;state.selectedId=null;renderAll();markDirty()}
function undo(){if(!state.history.length)return;state.future.push(JSON.stringify({pages:state.pages,pageIndex:state.pageIndex,title:state.title}));restore(state.history.pop())}
function redo(){if(!state.future.length)return;state.history.push(JSON.stringify({pages:state.pages,pageIndex:state.pageIndex,title:state.title}));restore(state.future.pop())}

function boardPoint(ev){const r=refs.board.getBoundingClientRect();return{x:(ev.clientX-r.left)/r.width*1600,y:(ev.clientY-r.top)/r.height*900}}
function objById(id){return page().objects.find(o=>o.id===id)}
function addObj(o){snapshot();page().objects.push({id:uid(),...o});state.selectedId=page().objects.at(-1).id;renderAll();markDirty()}
function updateObj(id,patch,history=false){const o=objById(id);if(!o)return;if(history)snapshot();Object.assign(o,patch);renderAll();markDirty()}
function removeSelected(){if(!state.selectedId)return;snapshot();page().objects=page().objects.filter(o=>o.id!==state.selectedId);state.selectedId=null;renderAll();markDirty()}
function duplicateSelected(){const o=objById(state.selectedId);if(!o)return;snapshot();const c=deep(o);c.id=uid();if('x'in c)c.x+=30;if('y'in c)c.y+=30;if(c.points)c.points=c.points.map(p=>({x:p.x+30,y:p.y+30}));page().objects.push(c);state.selectedId=c.id;renderAll();markDirty()}

function svgEl(tag,attrs={}){const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));return e}
function applySelectable(el,o){el.dataset.id=o.id;el.classList.add('selectable');el.style.cursor=state.tool==='select'?'move':'default';if(o.id===state.selectedId){el.setAttribute('filter','url(#none)');el.style.filter='drop-shadow(0 0 4px rgba(109,124,255,.95))'}el.addEventListener('pointerdown',e=>{if(state.tool!=='select')return;e.stopPropagation();selectObject(o.id,e)})}
function renderObject(o){
  let e;
  if(o.type==='path'){e=svgEl('polyline',{points:o.points.map(p=>`${p.x},${p.y}`).join(' '),fill:'none',stroke:o.color,'stroke-width':o.width,'stroke-linecap':'round','stroke-linejoin':'round',opacity:o.opacity??1});applySelectable(e,o);refs.content.append(e);return}
  if(o.type==='line'){e=svgEl('line',{x1:o.x1,y1:o.y1,x2:o.x2,y2:o.y2,stroke:o.color,'stroke-width':o.width,'stroke-linecap':'round'});applySelectable(e,o);refs.content.append(e);return}
  if(o.type==='rect'){e=svgEl('rect',{x:o.x,y:o.y,width:o.w,height:o.h,rx:o.radius||0,fill:o.fill||'none',stroke:o.color,'stroke-width':o.width});applySelectable(e,o);refs.content.append(e);return}
  if(o.type==='ellipse'){e=svgEl('ellipse',{cx:o.x+o.w/2,cy:o.y+o.h/2,rx:Math.abs(o.w/2),ry:Math.abs(o.h/2),fill:o.fill||'none',stroke:o.color,'stroke-width':o.width});applySelectable(e,o);refs.content.append(e);return}
  if(o.type==='text'){
    const d=document.createElement('div');d.className='dom-object dom-text'+(o.id===state.selectedId?' selected':'');d.dataset.id=o.id;d.style.left=`${o.x/16}%`;d.style.top=`${o.y/9}%`;d.style.width=`${o.w/16}%`;d.style.fontSize=`${o.size||36}px`;d.style.color=o.color||'#111';d.style.fontWeight=o.bold?'700':'400';d.style.fontStyle=o.italic?'italic':'normal';d.style.textAlign=o.align||'left';d.textContent=o.text;d.addEventListener('pointerdown',e=>{if(state.tool!=='select')return;e.stopPropagation();selectObject(o.id,e)});d.addEventListener('dblclick',()=>editText(o.id));refs.dom.append(d);return
  }
  if(o.type==='image'){
    const d=document.createElement('img');d.className='dom-object dom-image'+(o.id===state.selectedId?' selected':'');d.dataset.id=o.id;d.src=o.src;d.draggable=false;d.style.left=`${o.x/16}%`;d.style.top=`${o.y/9}%`;d.style.width=`${o.w/16}%`;d.style.height=`${o.h/9}%`;d.style.transform=`rotate(${o.rotate||0}deg)`;d.addEventListener('pointerdown',e=>{if(state.tool!=='select')return;e.stopPropagation();selectObject(o.id,e)});refs.dom.append(d);return
  }
  if(o.type==='widget') renderWidget(o);
}
function renderWidget(o){
  const d=document.createElement('div');d.className='dom-object widget'+(o.id===state.selectedId?' selected':'');d.dataset.id=o.id;d.style.left=`${o.x/16}%`;d.style.top=`${o.y/9}%`;d.style.width=`${o.w/16}%`;d.style.minHeight=`${o.h/9}%`;d.addEventListener('pointerdown',e=>{if(state.tool==='select'){e.stopPropagation();selectObject(o.id,e)}});
  if(o.kind==='timer') d.innerHTML=`<div style="font-weight:800;font-size:15px">Timer</div><div data-timer-display style="font-size:46px;font-weight:900;text-align:center;margin:8px 0">${formatSeconds(o.seconds??300)}</div><div style="display:flex;gap:6px"><button data-action="timer-start">Start</button><button data-action="timer-reset">Reset</button></div>`;
  if(o.kind==='clock') d.innerHTML=`<div style="font-weight:800">Klok</div><div data-clock style="font-size:42px;font-weight:900;text-align:center;padding:14px 0">--:--:--</div>`;
  if(o.kind==='dice') d.innerHTML=`<div style="font-weight:800">Dobbelsteen</div><div data-dice style="font-size:64px;text-align:center">⚄</div><button data-action="dice-roll">Gooien</button>`;
  if(o.kind==='traffic') d.innerHTML=`<div style="font-weight:800;margin-bottom:8px">Stoplicht</div><div data-traffic style="width:60px;margin:auto;background:#222;border-radius:18px;padding:8px;display:grid;gap:7px"><i data-c="red" style="height:42px;border-radius:50%;background:#ef4444"></i><i data-c="amber" style="height:42px;border-radius:50%;background:#6b5a25"></i><i data-c="green" style="height:42px;border-radius:50%;background:#245c3b"></i></div><div style="display:flex;gap:4px;margin-top:8px"><button data-action="traffic-red">Rood</button><button data-action="traffic-amber">Oranje</button><button data-action="traffic-green">Groen</button></div>`;
  if(o.kind==='score') d.innerHTML=`<div style="font-weight:800">Scorebord</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:center;margin-top:10px"><div>Team A<div data-score-a style="font-size:40px;font-weight:900">${o.a||0}</div><button data-action="score-a">+1</button></div><div>Team B<div data-score-b style="font-size:40px;font-weight:900">${o.b||0}</div><button data-action="score-b">+1</button></div></div>`;
  if(o.kind==='random') d.innerHTML=`<div style="font-weight:800">Naamkiezer</div><div data-random-result style="font-size:26px;font-weight:900;text-align:center;padding:15px 4px">Klik op kiezen</div><button data-action="random-pick">Kiezen</button>`;
  if(o.kind==='calculator') d.innerHTML=`<div style="font-weight:800">Rekenmachine</div><input data-calc-input style="width:100%;margin:8px 0;padding:8px" placeholder="12*(4+2)"><button data-action="calculate">Bereken</button><div data-calc-result style="font-size:24px;font-weight:900;margin-top:8px"></div>`;
  d.addEventListener('click',widgetClick);refs.dom.append(d)
}
function renderAll(){
  refs.content.innerHTML='';refs.interaction.innerHTML='';refs.dom.innerHTML='';page().objects.forEach(renderObject);refs.title.value=state.title;refs.pageCounter.textContent=`${state.pageIndex+1} / ${state.pages.length}`;refs.zoomLabel.textContent=`${Math.round(state.zoom*100)}%`;refs.stageScaler.style.transform=`scale(${state.zoom})`;applyBackground();renderPanel();renderInspector();startLiveWidgets()
}
function applyBackground(){refs.board.className='board';refs.board.classList.add('background-'+(page().background||'blank'))}

function setTool(t){state.tool=t;$$('.tool-btn').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));refs.board.style.cursor=t==='select'?'default':t==='text'?'text':t==='pan'?'grab':'crosshair';if(t!=='select')state.selectedId=null;renderAll()}
function selectObject(id,e){state.selectedId=id;renderAll();const o=objById(id);if(!o)return;const start=boardPoint(e),original=deep(o);gesture={kind:'move',id,start,original,moved:false};refs.board.setPointerCapture?.(e.pointerId)}

function onPointerDown(e){
  if(e.button!==0)return;const p=boardPoint(e);
  if(state.tool==='select'){if(e.target===refs.board||e.target===refs.svg||e.target===refs.content){state.selectedId=null;renderAll()}return}
  if(state.tool==='laser'){refs.laser.classList.remove('hidden');moveLaser(e);gesture={kind:'laser'};return}
  if(state.tool==='pan'){gesture={kind:'pan',sx:e.clientX,sy:e.clientY};return}
  if(state.tool==='text'){const text=prompt('Tekst invoeren:','Nieuwe tekst');if(text)addObj({type:'text',x:p.x,y:p.y,w:360,h:80,text,size:38,color:state.stroke});setTool('select');return}
  snapshot();
  if(state.tool==='pen'||state.tool==='highlighter'){
    const o={id:uid(),type:'path',points:[p],color:state.stroke,width:state.tool==='highlighter'?Math.max(12,state.strokeWidth*4):state.strokeWidth,opacity:state.tool==='highlighter'?.32:1};page().objects.push(o);gesture={kind:'draw',id:o.id};
  } else if(['line','rectangle','ellipse'].includes(state.tool)){
    const type=state.tool==='rectangle'?'rect':state.tool;const o= type==='line'?{id:uid(),type:'line',x1:p.x,y1:p.y,x2:p.x,y2:p.y,color:state.stroke,width:state.strokeWidth}:{id:uid(),type,x:p.x,y:p.y,w:1,h:1,color:state.stroke,width:state.strokeWidth,fill:state.fill?state.fillColor:'none'};page().objects.push(o);gesture={kind:'shape',id:o.id,start:p};
  } else if(state.tool==='eraser'){eraseAt(p);gesture={kind:'erase'};}
  renderAll();markDirty()
}
function onPointerMove(e){
  if(!gesture)return;const p=boardPoint(e);
  if(gesture.kind==='draw'){const o=objById(gesture.id);if(o){o.points.push(p);renderAll()}}
  if(gesture.kind==='shape'){const o=objById(gesture.id);if(!o)return;if(o.type==='line'){o.x2=p.x;o.y2=p.y}else{o.x=Math.min(gesture.start.x,p.x);o.y=Math.min(gesture.start.y,p.y);o.w=Math.abs(p.x-gesture.start.x);o.h=Math.abs(p.y-gesture.start.y)}renderAll()}
  if(gesture.kind==='erase'){eraseAt(p);renderAll()}
  if(gesture.kind==='laser')moveLaser(e);
  if(gesture.kind==='move'){
    const o=objById(gesture.id),dx=p.x-gesture.start.x,dy=p.y-gesture.start.y;if(!o)return;gesture.moved=true;
    if(o.type==='path')o.points=gesture.original.points.map(q=>({x:q.x+dx,y:q.y+dy}));
    else if(o.type==='line'){o.x1=gesture.original.x1+dx;o.y1=gesture.original.y1+dy;o.x2=gesture.original.x2+dx;o.y2=gesture.original.y2+dy}
    else {o.x=gesture.original.x+dx;o.y=gesture.original.y+dy}renderAll()
  }
}
function onPointerUp(e){if(!gesture)return;if(gesture.kind==='move'&&gesture.moved){state.history.push(JSON.stringify({pages:state.pages.map((p,i)=>i===state.pageIndex?{...p,objects:p.objects.map(o=>o.id===gesture.id?gesture.original:o)}:p),pageIndex:state.pageIndex,title:state.title}));markDirty()}if(gesture.kind==='laser')refs.laser.classList.add('hidden');gesture=null}
function moveLaser(e){const r=refs.board.getBoundingClientRect();refs.laser.style.left=`${e.clientX-r.left}px`;refs.laser.style.top=`${e.clientY-r.top}px`}
function eraseAt(p){const objs=page().objects;for(let i=objs.length-1;i>=0;i--){const o=objs[i],b=bounds(o);if(p.x>=b.x-18&&p.x<=b.x+b.w+18&&p.y>=b.y-18&&p.y<=b.y+b.h+18){objs.splice(i,1);return}}}
function bounds(o){if(o.type==='path'){const xs=o.points.map(p=>p.x),ys=o.points.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}}if(o.type==='line')return{x:Math.min(o.x1,o.x2),y:Math.min(o.y1,o.y2),w:Math.abs(o.x2-o.x1),h:Math.abs(o.y2-o.y1)};return{x:o.x||0,y:o.y||0,w:o.w||1,h:o.h||1}}

function renderPanel(){
  const p=state.panel;refs.panelTitle.textContent={pages:"Pagina's",library:'Mediabibliotheek',tools:'Lesgereedschap',widgets:'Widgets',connect:'Connect',notes:'Notities'}[p]||p;
  refs.panelSubtitle.textContent={pages:'Beheer de opbouw van je les',library:'Voeg content toe aan je bord',tools:'Interactieve onderwijsfuncties',widgets:'Handige live-elementen',connect:'Verbind apparaten in de klas',notes:'Privé notities voor deze pagina'}[p]||'';
  if(p==='pages'){
    refs.panelContent.innerHTML=`<button class="panel-primary" data-add-page>+ Nieuwe pagina</button><div class="page-list">${state.pages.map((pg,i)=>`<button class="page-thumb ${i===state.pageIndex?'active':''}" data-page="${i}"><span class="page-preview"></span><span class="page-meta"><b>Pagina ${i+1}</b><span>${pg.objects.length} objecten</span></span><span class="page-actions"><span class="mini-btn" data-dup-page="${i}">⧉</span><span class="mini-btn" data-del-page="${i}">×</span></span></button>`).join('')}</div>`;
  } else if(p==='library'){
    refs.panelContent.innerHTML=`<input class="search-box" placeholder="Zoek in media…"><div class="section-label">Toevoegen</div><div class="card-grid">${card('🖼','Afbeelding','Upload een afbeelding','image')}${card('T','Tekst','Voeg een tekstvak toe','text')}${card('▦','Vormen','Rechthoek of cirkel','shapes')}${card('🔗','Weblink','Linkkaart op het bord','link')}</div><div class="section-label">Sjablonen</div><div class="card-grid">${card('🧠','Mindmap','Start een mindmap','mindmap')}${card('📝','Exit ticket','Snelle reflectie','exit')}${card('📊','Lesdoelen','Doelen en voortgang','goals')}${card('❓','Quizkaart','Vraag met antwoord','quiz')}</div>`;
  } else if(p==='tools'){
    refs.panelContent.innerHTML=`<div class="card-grid">${card('📏','Liniaal','Meet en teken lijnen','ruler')}${card('◒','Gradenboog','Hoeken uitleggen','protractor')}${card('✥','Passer','Cirkels construeren','compass')}${card('🧮','Rekenmachine','Rekenhulp','calculator')}${card('🧩','Breuken','Breukencirkels','fractions')}${card('🕒','Klok','Analoge/digitale klok','clock')}${card('🗺','Topografie','Kaart-placeholder','map')}${card('⚛','Periodiek systeem','Onderwijskaart','periodic')}</div>`;
  } else if(p==='widgets'){
    refs.panelContent.innerHTML=`<div class="card-grid">${card('⏱','Timer','Aftellen in de klas','timer')}${card('🕘','Live klok','Actuele tijd','clock')}${card('🎲','Dobbelsteen','Willekeurig 1 t/m 6','dice')}${card('🚦','Stoplicht','Klassenmanagement','traffic')}${card('🏆','Scorebord','Team A tegen B','score')}${card('🎯','Naamkiezer','Willekeurige leerling','random')}${card('🧮','Rekenmachine','Snelle sommen','calculator')}${card('🗒','Sticky note','Korte notitie','sticky')}</div>`;
  } else if(p==='connect'){
    refs.panelContent.innerHTML=`<div style="text-align:center;padding:18px 6px"><div style="font-size:52px">⌁</div><h3>Klas verbinden</h3><p class="muted">Deze demo bevat de complete UI-flow voor een klassessie. Een echte multi-device sessie heeft een backend/realtime dienst nodig.</p><div style="font-size:28px;font-weight:900;letter-spacing:.14em;margin:16px">${Math.random().toString().slice(2,8)}</div><button class="panel-primary" data-connect>Nieuwe sessiecode</button><div class="section-label">Functies</div><p class="muted">Scherm delen • antwoorden verzamelen • content sturen • snelle poll • deelnemerslijst</p></div>`;
  } else if(p==='notes'){
    refs.panelContent.innerHTML=`<textarea id="notesArea" class="notes-area" placeholder="Notities voor jezelf…">${escapeHtml(page().notes||'')}</textarea><p class="muted">Notities verschijnen niet op het presentatiebord.</p>`;
  }
}
function card(icon,title,desc,action){return `<button class="media-card" data-action-card="${action}"><span class="card-icon">${icon}</span><span class="card-title">${title}</span><span class="card-desc">${desc}</span></button>`}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

function panelClick(e){
  const pageBtn=e.target.closest('[data-page]');if(pageBtn&&!e.target.closest('[data-dup-page],[data-del-page]')){state.pageIndex=+pageBtn.dataset.page;state.selectedId=null;renderAll();return}
  if(e.target.closest('[data-add-page]')){snapshot();state.pages.splice(state.pageIndex+1,0,defaultPage());state.pageIndex++;renderAll();markDirty();return}
  const dup=e.target.closest('[data-dup-page]');if(dup){e.stopPropagation();snapshot();const p=deep(state.pages[+dup.dataset.dupPage]);p.id=uid();state.pages.splice(+dup.dataset.dupPage+1,0,p);state.pageIndex=+dup.dataset.dupPage+1;renderAll();markDirty();return}
  const del=e.target.closest('[data-del-page]');if(del){e.stopPropagation();if(state.pages.length===1){toast('Er moet minimaal één pagina blijven');return}snapshot();state.pages.splice(+del.dataset.delPage,1);state.pageIndex=clamp(state.pageIndex,0,state.pages.length-1);renderAll();markDirty();return}
  const cardEl=e.target.closest('[data-action-card]');if(cardEl)runCard(cardEl.dataset.actionCard);
  if(e.target.closest('[data-connect]')){renderPanel();toast('Nieuwe sessiecode gemaakt')}
}
function runCard(a){
  if(a==='image'){refs.imageInput.click();return}if(a==='text'){setTool('text');return}if(a==='shapes'){setTool('rectangle');return}
  if(['timer','clock','dice','traffic','score','random','calculator'].includes(a)){addObj({type:'widget',kind:a,x:520,y:270,w:420,h:250,seconds:300});return}
  if(a==='sticky'){addObj({type:'text',x:560,y:300,w:360,h:180,text:'Notitie…',size:34,color:'#7c5c00'});return}
  if(a==='mindmap'){snapshot();[['Hoofdonderwerp',650,370],['Idee 1',330,210],['Idee 2',980,210],['Idee 3',330,600],['Idee 4',980,600]].forEach(([t,x,y],i)=>page().objects.push({id:uid(),type:'text',x,y,w:280,h:70,text:t,size:i?30:38,color:'#111'}));markDirty();renderAll();return}
  if(a==='exit'){addObj({type:'text',x:300,y:140,w:1000,h:400,text:'EXIT TICKET\n\n1. Wat heb je vandaag geleerd?\n2. Wat vond je nog lastig?\n3. Welke vraag heb je nog?',size:40,color:'#111'});return}
  if(a==='goals'){addObj({type:'text',x:300,y:150,w:1000,h:380,text:'LESDOELEN\n\n□ Ik kan …\n□ Ik begrijp …\n□ Ik kan uitleggen waarom …',size:42,color:'#111'});return}
  if(a==='quiz'){addObj({type:'text',x:300,y:180,w:1000,h:300,text:'VRAAG\n\nWat is het juiste antwoord?\n\nA. …   B. …   C. …   D. …',size:42,color:'#111'});return}
  if(a==='link'){const u=prompt('Weblink:','https://');if(u)addObj({type:'text',x:420,y:350,w:760,h:100,text:'🔗 '+u,size:30,color:'#1d4ed8'});return}
  if(a==='ruler')addObj({type:'rect',x:350,y:650,w:900,h:90,color:'#c08b22',width:5,fill:'#fde68a'});
  else if(a==='protractor')addObj({type:'ellipse',x:520,y:430,w:560,h:280,color:'#0f766e',width:5,fill:'#ccfbf1'});
  else if(a==='compass')addObj({type:'text',x:620,y:300,w:360,h:180,text:'✥\nPasser',size:54,color:'#334155'});
  else if(a==='fractions')addObj({type:'text',x:520,y:280,w:560,h:260,text:'◕  1/2     ◔  1/4\n◴  3/4     ○  1',size:60,color:'#111'});
  else if(a==='map')addObj({type:'text',x:420,y:250,w:760,h:300,text:'🗺️\nInteractieve kaart',size:54,color:'#111'});
  else if(a==='periodic')addObj({type:'text',x:330,y:180,w:940,h:500,text:'⚛ PERIODIEK SYSTEEM\n\nH   He\nLi Be      B C N O F Ne\nNa Mg      Al Si P S Cl Ar',size:42,color:'#111'});
}

function renderInspector(){
  const o=objById(state.selectedId);refs.inspector.classList.toggle('open',!!o);if(!o)return;
  refs.inspectorContent.innerHTML=`<div class="setting-row"><label>Type</label><b>${o.type}</b></div><div class="setting-row"><label>Kleur</label><input id="inspColor" type="color" value="${o.color&&o.color.startsWith('#')?o.color:'#111111'}"></div><div class="setting-row"><label>Laag</label><span><button class="mini-btn" data-layer="up">↑</button> <button class="mini-btn" data-layer="down">↓</button></span></div><div class="setting-row"><label>Acties</label><span><button class="mini-btn" data-duplicate>⧉</button> <button class="mini-btn" data-delete>×</button></span></div>`
}

function editText(id){const o=objById(id);if(!o)return;const t=prompt('Tekst bewerken:',o.text);if(t!==null)updateObj(id,{text:t},true)}
function changeLayer(dir){const i=page().objects.findIndex(o=>o.id===state.selectedId);if(i<0)return;const ni=clamp(i+(dir==='up'?1:-1),0,page().objects.length-1);if(ni===i)return;snapshot();const [o]=page().objects.splice(i,1);page().objects.splice(ni,0,o);renderAll();markDirty()}

function widgetClick(e){
  const action=e.target.dataset.action;if(!action)return;e.stopPropagation();const root=e.currentTarget,o=objById(root.dataset.id);if(!o)return;
  if(action==='dice-roll'){const n=1+Math.floor(Math.random()*6);root.querySelector('[data-dice]').textContent=['⚀','⚁','⚂','⚃','⚄','⚅'][n-1]}
  if(action==='score-a'){o.a=(o.a||0)+1;markDirty();renderAll()}if(action==='score-b'){o.b=(o.b||0)+1;markDirty();renderAll()}
  if(action==='random-pick'){const names=['Alex','Sam','Noa','Milan','Sara','Luca','Yara','Finn','Nora','Daan'];root.querySelector('[data-random-result]').textContent=names[Math.floor(Math.random()*names.length)]}
  if(action==='calculate'){const input=root.querySelector('[data-calc-input]').value;try{if(!/^[0-9+\-*/().%\s]+$/.test(input))throw 0;root.querySelector('[data-calc-result]').textContent=Function(`"use strict";return (${input})`)()}catch{root.querySelector('[data-calc-result]').textContent='Ongeldige som'}}
  if(action.startsWith('traffic-')){const c=action.split('-')[1];root.querySelectorAll('[data-c]').forEach(i=>{const active=i.dataset.c===c;i.style.background=active?({red:'#ef4444',amber:'#f59e0b',green:'#22c55e'}[i.dataset.c]):'#454545'})}
  if(action==='timer-start'){o.running=!o.running;o.startedAt=Date.now();o.baseSeconds=o.seconds??300;markDirty();startLiveWidgets()}
  if(action==='timer-reset'){o.running=false;o.seconds=300;markDirty();renderAll()}
}
function formatSeconds(s){s=Math.max(0,Math.floor(s));return`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
let liveTicker=null;function startLiveWidgets(){clearInterval(liveTicker);liveTicker=setInterval(()=>{
  document.querySelectorAll('[data-clock]').forEach(n=>n.textContent=new Date().toLocaleTimeString('nl-NL'));
  document.querySelectorAll('[data-timer-display]').forEach(n=>{const root=n.closest('[data-id]'),o=root&&objById(root.dataset.id);if(!o)return;let s=o.seconds??300;if(o.running){s=Math.max(0,(o.baseSeconds??s)-Math.floor((Date.now()-o.startedAt)/1000));if(s===0)o.running=false}n.textContent=formatSeconds(s)})
},250)}

function setPanel(name){state.panel=name;refs.panel.classList.add('open');$$('.rail-btn').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));renderPanel()}
function setZoom(z){state.zoom=clamp(z,.35,2);refs.stageScaler.style.transform=`scale(${state.zoom})`;refs.zoomLabel.textContent=`${Math.round(state.zoom*100)}%`}
function fit(){state.zoom=1;setZoom(1)}
function changePage(d){state.pageIndex=clamp(state.pageIndex+d,0,state.pages.length-1);state.selectedId=null;renderAll()}
function chooseBackground(){openModal('Achtergrond',`<div class="card-grid">${['blank','grid','lines','dots','cream','dark'].map(x=>`<button class="media-card" data-bg="${x}"><span class="card-icon">▦</span><span class="card-title">${x}</span></button>`).join('')}</div>`)}
function openModal(title,html){refs.modalTitle.textContent=title;refs.modalBody.innerHTML=html;refs.modal.showModal()}
function closeModal(){refs.modal.close()}
function settings(){openModal('Instellingen',`<div class="setting-row"><label>Raster magnetisch</label><input id="snapSetting" type="checkbox" ${state.gridSnap?'checked':''}></div><div class="setting-row"><label>Automatisch opslaan</label><b>Actief</b></div><div class="setting-row"><label>Opslag</label><span>Dit apparaat</span></div><div class="section-label">Document</div><div class="modal-actions"><button class="soft-btn" data-export-json>Exporteer project</button><button class="soft-btn" data-import-json>Importeer project</button><button class="soft-btn" data-export-png>PNG van pagina</button></div>`)}
function share(){openModal('Delen',`<p class="muted">Voor een echte deel-link en realtime samenwerking is een backend/accountlaag nodig. In deze statische versie kun je het projectbestand exporteren en delen.</p><div class="modal-actions"><button class="primary-btn" data-export-json>Project exporteren</button></div>`)}
function exportJSON(){const blob=new Blob([JSON.stringify({version:1,title:state.title,pages:state.pages},null,2)],{type:'application/json'});download(blob,(state.title||'presentatie')+'.json')}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function importJSON(file){const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.pages?.length)throw 0;snapshot();state.title=d.title||'Geïmporteerde les';state.pages=d.pages;state.pageIndex=0;renderAll();markDirty();toast('Project geïmporteerd')}catch{toast('Dit projectbestand is niet geldig')}};r.readAsText(file)}
function exportPNG(){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="100%" height="100%" fill="white"/>${page().objects.filter(o=>['path','line','rect','ellipse'].includes(o.type)).map(o=>{if(o.type==='path')return`<polyline points="${o.points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="${o.color}" stroke-width="${o.width}" stroke-linecap="round" opacity="${o.opacity??1}"/>`;if(o.type==='line')return`<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="${o.color}" stroke-width="${o.width}"/>`;if(o.type==='rect')return`<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="${o.fill||'none'}" stroke="${o.color}" stroke-width="${o.width}"/>`;return`<ellipse cx="${o.x+o.w/2}" cy="${o.y+o.h/2}" rx="${Math.abs(o.w/2)}" ry="${Math.abs(o.h/2)}" fill="${o.fill||'none'}" stroke="${o.color}" stroke-width="${o.width}"/>`}).join('')}</svg>`;
  const img=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));img.onload=()=>{const c=document.createElement('canvas');c.width=1600;c.height=900;const x=c.getContext('2d');x.drawImage(img,0,0);URL.revokeObjectURL(url);c.toBlob(b=>download(b,`pagina-${state.pageIndex+1}.png`))};img.src=url
}
function togglePresent(){state.presentation=!state.presentation;refs.app.classList.toggle('presentation-mode',state.presentation);if(state.presentation)document.documentElement.requestFullscreen?.().catch(()=>{});else if(document.fullscreenElement)document.exitFullscreen?.()}

refs.board.addEventListener('pointerdown',onPointerDown);window.addEventListener('pointermove',onPointerMove);window.addEventListener('pointerup',onPointerUp);
refs.panelContent.addEventListener('click',panelClick);refs.panelContent.addEventListener('input',e=>{if(e.target.id==='notesArea'){page().notes=e.target.value;markDirty()}});
$$('.tool-btn').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));$$('.rail-btn').forEach(b=>b.addEventListener('click',()=>setPanel(b.dataset.panel)));
$('#closePanelBtn').onclick=()=>refs.panel.classList.remove('open');$('#undoBtn').onclick=undo;$('#redoBtn').onclick=redo;$('#deleteSelectionBtn').onclick=removeSelected;
refs.color.oninput=e=>{state.stroke=e.target.value};refs.width.oninput=e=>{state.strokeWidth=+e.target.value;refs.widthValue.textContent=state.strokeWidth+' px'};refs.fillColor.oninput=e=>state.fillColor=e.target.value;$('#fillToggle').onclick=e=>{state.fill=!state.fill;e.currentTarget.textContent='Vulling: '+(state.fill?'aan':'uit')};
refs.title.addEventListener('input',e=>{state.title=e.target.value;markDirty()});$('#prevPageBtn').onclick=()=>changePage(-1);$('#nextPageBtn').onclick=()=>changePage(1);$('#zoomInBtn').onclick=()=>setZoom(state.zoom+.1);$('#zoomOutBtn').onclick=()=>setZoom(state.zoom-.1);$('#fitBtn').onclick=fit;$('#backgroundBtn').onclick=chooseBackground;$('#settingsBtn').onclick=settings;$('#shareBtn').onclick=share;$('#presentBtn').onclick=togglePresent;$('#fullscreenBtn').onclick=()=>document.documentElement.requestFullscreen?.();
$('#modalClose').onclick=closeModal;refs.modal.addEventListener('click',e=>{if(e.target===refs.modal)closeModal();const bg=e.target.closest('[data-bg]');if(bg){snapshot();page().background=bg.dataset.bg;closeModal();renderAll();markDirty()}if(e.target.closest('[data-export-json]'))exportJSON();if(e.target.closest('[data-import-json]'))refs.importInput.click();if(e.target.closest('[data-export-png]'))exportPNG();if(e.target.id==='snapSetting')state.gridSnap=e.target.checked});
refs.inspectorContent.addEventListener('click',e=>{if(e.target.closest('[data-delete]'))removeSelected();if(e.target.closest('[data-duplicate]'))duplicateSelected();const l=e.target.closest('[data-layer]');if(l)changeLayer(l.dataset.layer)});refs.inspectorContent.addEventListener('input',e=>{if(e.target.id==='inspColor'&&state.selectedId)updateObj(state.selectedId,{color:e.target.value},true)});
refs.imageInput.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>addObj({type:'image',src:r.result,x:360,y:180,w:880,h:500,rotate:0});r.readAsDataURL(f);e.target.value=''};refs.importInput.onchange=e=>{const f=e.target.files[0];if(f)importJSON(f);e.target.value=''};
window.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateSelected();return}if(e.key==='Delete'||e.key==='Backspace'){removeSelected();return}if(e.key==='Escape'){if(state.presentation)togglePresent();else{state.selectedId=null;renderAll()}return}if(e.key==='ArrowRight'&&state.presentation)changePage(1);if(e.key==='ArrowLeft'&&state.presentation)changePage(-1);
  const keys={v:'select',p:'pen',h:'highlighter',e:'eraser',l:'line',r:'rectangle',o:'ellipse',t:'text'};if(keys[e.key.toLowerCase()])setTool(keys[e.key.toLowerCase()]);
});

loadLocal();refs.title.value=state.title;renderAll();startLiveWidgets();
})();
