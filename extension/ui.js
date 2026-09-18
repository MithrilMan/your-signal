import './core.js';
const C=globalThis.OYA,$=id=>document.getElementById(id);
const inExtension=!!globalThis.chrome?.runtime?.id;
let state,toastTimer,saveTimer,saving=Promise.resolve(),sampleRevealed=new Set();
const DEMO=[
  {name:'Demo account / builder',handle:'@demo_builder · 12 min',avatar:'B',text:'A reproducible caching benchmark: method, results, and code to try.',code:'cache.get(key) ?? await compute()\n→ measure hit rate and p95 latency',metrics:{relevance:.96,substance:.96,actionable:.94,promotion:.06,bait:.04}},
  {name:'Demo account / promotion',handle:'@demo_launch · 28 min',avatar:'P',text:'Comment “AI”, like, and follow for my secret tool list.',metrics:{relevance:.73,substance:.08,actionable:.12,promotion:.97,bait:.98}},
  {name:'Demo account / design',handle:'@demo_design · 41 min',avatar:'D',text:'Keep the undo action visible. Make exploring an interface feel easier.',metrics:{relevance:.92,substance:.85,actionable:.95,promotion:.04,bait:.05}}
];
function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
async function send(type,extra={}){
  if(!inExtension){
    if(type==='UI_STATE')return {settings:structuredClone(C.DEFAULTS),hasJevKey:false,model:'jev-1.13.0',stats:null,lastError:''};
    if(type==='UI_SAVE')return {settings:C.settings(extra.settings)};
    if(type==='UI_CLEAR_CACHE')return {ok:true};
    throw new Error('This is a local preview. Load the extension in Chrome or Edge to connect services.');
  }
  const r=await chrome.runtime.sendMessage({type,...extra});if(!r?.ok)throw new Error(r?.error||'Operation failed.');return r.data;
}
function toast(message,error=false){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
async function action(button,fn){button.disabled=true;try{await fn();}catch(error){toast(error.message,true);}finally{button.disabled=false;}}
function panel(name){
  for(const n of ['algorithm','connection','privacy'])$(n+'-panel').hidden=n!==name;
  document.querySelectorAll('[data-panel]').forEach(b=>{b.classList.toggle('active',b.dataset.panel===name);if(b.dataset.panel===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  $('page-label').textContent={algorithm:'YOUR FEED',connection:'CONNECTION',privacy:'PRIVACY & DATA'}[name];
  const wasMenuOpen=$('menu-toggle').getAttribute('aria-expanded')==='true';
  $('primary-nav').classList.remove('is-open');$('menu-toggle').setAttribute('aria-expanded','false');
  if(wasMenuOpen)$('menu-toggle').focus();
  history.replaceState(null,'','#'+name);window.scrollTo(0,0);
}
function range(input){input.style.setProperty('--p',((Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min))*100)+'%');}
function applyTheme(theme=state?.settings?.theme||'system'){document.documentElement.dataset.theme=theme;}
function collect(){
  return C.settings({...state.settings,interests:$('interests').value,
    weights:Object.fromEntries(C.KEYS.map(k=>[k,Number($('weight-'+k).value)])),
    threshold:Number($('threshold').value),behavior:document.querySelector('[name=behavior]:checked').value,
    searchEnabled:$('search-enabled').checked,showBadges:$('show-badges').checked,
    dailyLimit:Number($('daily-limit').value),minimumMargin:Number($('minimum-margin').value),theme:$('theme').value});
}
function showEnabled(){
  $('enabled-toggle').setAttribute('aria-checked',String(state.settings.enabled));
  $('enabled-label').textContent=state.settings.enabled?'Filter on':'Filter paused';
}
function fill(){
  const s=state.settings;
  $('theme').value=s.theme;applyTheme(s.theme);
  $('interests').value=s.interests;$('threshold').value=s.threshold;$('daily-limit').value=s.dailyLimit;$('minimum-margin').value=s.minimumMargin;
  $('remember-key').checked=state.rememberKey===true;
  $('search-enabled').checked=s.searchEnabled;$('show-badges').checked=s.showBadges;
  document.querySelector(`[name=behavior][value=${s.behavior}]`).checked=true;
  for(const k of C.KEYS)$('weight-'+k).value=s.weights[k];
  $('model-label').textContent=state.model+' · pinned version';
  $('onboarding').hidden=!!state.hasJevKey;
  $('connection-dot').classList.toggle('connected',state.hasJevKey);
  $('key-status').textContent=state.hasJevKey?'A Jev key is already saved. This field stays empty for security.':'No key saved.';
  $('jev-key').placeholder=state.hasJevKey?'Key saved · paste a new one only to replace it':'Paste your API key';
  $('saved-profiles').hidden=!state.customProfiles?.length;
  const empty=el('option','Choose a saved profile');empty.value='';$('saved-profile').replaceChildren(empty);
  for(const profile of state.customProfiles||[]){const option=el('option',profile.name);option.value=profile.id;$('saved-profile').append(option);}
  showEnabled();refreshValues();
  $('stat-evaluated').textContent=(state.stats?.evaluated||0).toLocaleString('en-US');
  $('stat-cache').textContent=(state.stats?.cacheHits||0).toLocaleString('en-US');
  $('stat-tokens').textContent=(state.stats?.tokens||0).toLocaleString('en-US');
}
function refreshValues(){
  $('interest-count').textContent=$('interests').value.length+' / 400';
  $('threshold-value').textContent=$('threshold').value;$('margin-value').textContent=Number($('minimum-margin').value).toFixed(2);
  for(const k of C.KEYS)$('value-'+k).textContent=$('weight-'+k).value;
  const topics=$('interests').value.split(/[,;\n]/).map(topic=>topic.trim()).filter(Boolean).slice(0,3);
  $('interest-chips').replaceChildren(...topics.map(topic=>el('span',topic,'topic-chip')));
  document.querySelectorAll('input[type=range]').forEach(range);
  for(const b of document.querySelectorAll('[data-preset]')){
    const p=C.PRESETS[b.dataset.preset],selected=JSON.stringify(p.weights)===JSON.stringify(state.settings.weights)&&p.interests===state.settings.interests;
    b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));
  }
  const saved=state.customProfiles?.find(p=>JSON.stringify(C.profileSettings(p.settings))===JSON.stringify(C.profileSettings(state.settings)));
  $('saved-profile').value=saved?.id||'';$('delete-profile').disabled=!saved;
  renderPreview();
}
function renderPreview(){
  const parent=$('preview-posts');parent.replaceChildren();const hidden=[];
  for(const [index,post] of DEMO.entries()){
    const d=C.decision(post.metrics,state.settings),revealed=sampleRevealed.has(index);
    if(d.action==='low'&&!revealed&&state.settings.behavior==='hide'){hidden.push(index);continue;}
    const card=el('article','', 'sample-post');
    card.dataset.sampleIndex=index;
    if(d.action==='highlight')card.classList.add('highlight');
    if(d.action==='low'&&!revealed&&state.settings.behavior!=='label')card.classList.add('low');
    if(d.action==='low'&&!revealed&&state.settings.behavior==='collapse')card.classList.add('collapsed');
    const avatar=el('div','', 'sample-avatar');avatar.setAttribute('aria-hidden','true');
    const copy=el('div','', 'sample-copy');copy.append(el('p',post.name.replace(' / ',' · '),'sample-person'),el('p',post.text,'sample-text'));
    const metrics=el('div','', 'sample-metrics'),score=el('span',d.action==='uncertain'?'?':String(d.score),'score-pill');score.setAttribute('aria-label',d.action==='uncertain'?'Uncertain result':`${d.score} out of 100`);
    const description=revealed?'Shown by you':d.action==='low'?'Below threshold':d.action==='highlight'?'Close to you':d.action==='uncertain'?'Uncertain':'Visible';
    metrics.append(score,el('span',description,'post-treatment'));
    if(d.action==='low'&&!revealed){const reveal=el('button','Show anyway','sample-reveal');reveal.onclick=()=>{sampleRevealed.add(index);renderPreview();const shown=parent.querySelector(`[data-sample-index="${index}"]`);shown.tabIndex=-1;shown.focus({preventScroll:true});};copy.append(reveal);}
    card.append(avatar,copy,metrics);parent.append(card);
  }
  if(hidden.length){const reveal=el('button',`Show hidden demo posts (${hidden.length})`,'sample-hidden-reveal');reveal.onclick=()=>{hidden.forEach(index=>sampleRevealed.add(index));renderPreview();const shown=parent.querySelector(`[data-sample-index="${hidden[0]}"]`);shown.tabIndex=-1;shown.focus({preventScroll:true});};parent.append(reveal);}
}
function queueSave(){
  state.settings=collect();refreshValues();$('save-state').textContent='Saving…';clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{
    const snapshot=structuredClone(state.settings);
    saving=saving.then(()=>send('UI_SAVE',{settings:snapshot})).then(()=>$('save-state').textContent=inExtension?'Saved on this device':'Preview only · not saved').catch(e=>{toast(e.message,true);$('save-state').textContent='Not saved';});
  },450);
}
async function connect(test=false){
  clearTimeout(saveTimer);
  const permissionRequest=inExtension?chrome.permissions.request({origins:['https://api.typesafe.ai/*']}):Promise.resolve(true);
  if(!await permissionRequest)throw new Error('Connection permission was not granted.');
  await saving;
  const next=collect();
  await send('UI_SAVE',{settings:next,jevKey:$('jev-key').value,rememberKey:$('remember-key').checked});
  $('jev-key').value='';state=await send('UI_STATE');fill();
  if(test)await send('UI_TEST');
}
function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function bind(id,fn){$(id).addEventListener('click',()=>action($(id),fn));}
const DESCRIPTIONS={relevance:'Closer to the topics you choose.',substance:'Examples, details, and explanations. It does not verify truth.',actionable:'Techniques, resources, and ideas you can put into practice.',promotion:'Fewer primarily promotional posts.',bait:'Fewer requests for likes and empty curiosity hooks.'};
const WEIGHT_LABELS={relevance:'Relevance',substance:'Substance',actionable:'Utility',promotion:'Promotion',bait:'Bait'};
for(const [index,k] of C.KEYS.entries()){
  const row=el('div','', 'weight-row');row.dataset.criterion=k;
  const label=el('label',WEIGHT_LABELS[k],'weight-title');label.htmlFor='weight-'+k;label.title=DESCRIPTIONS[k];
  const description=el('span',DESCRIPTIONS[k],'weight-description');description.id='description-'+k;
  const value=el('output','');value.id='value-'+k;value.htmlFor='weight-'+k;
  const slider=el('input');slider.id='weight-'+k;slider.type='range';slider.min='0';slider.max='100';slider.step='5';slider.setAttribute('aria-describedby',description.id);slider.title=DESCRIPTIONS[k];slider.addEventListener('input',queueSave);
  row.append(label,slider,value,description);$('weights').append(row);
}
$('menu-toggle').addEventListener('click',()=>{const open=$('menu-toggle').getAttribute('aria-expanded')!=='true';$('menu-toggle').setAttribute('aria-expanded',String(open));$('primary-nav').classList.toggle('is-open',open);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('menu-toggle').getAttribute('aria-expanded')==='true'){$('primary-nav').classList.remove('is-open');$('menu-toggle').setAttribute('aria-expanded','false');$('menu-toggle').focus();}});
document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>panel(b.dataset.panel));
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>panel(b.dataset.go));
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const preset=C.PRESETS[b.dataset.preset];state.settings=C.settings({...state.settings,...preset});sampleRevealed.clear();fill();queueSave();});
$('saved-profile').addEventListener('change',()=>{const profile=state.customProfiles?.find(p=>p.id===$('saved-profile').value);if(profile){state.settings=C.settings({...state.settings,...profile.settings});sampleRevealed.clear();fill();queueSave();}});
bind('delete-profile',async()=>{const id=$('saved-profile').value;if(!id)return;const result=await send('UI_DELETE_PROFILE',{id});state.customProfiles=result.customProfiles;fill();toast('Profile deleted. Your current feed settings are unchanged.');});
for(const id of ['interests','threshold','daily-limit','minimum-margin'])$(id).addEventListener('input',queueSave);
for(const id of ['search-enabled','show-badges'])$(id).addEventListener('change',queueSave);
$('theme').addEventListener('change',()=>{state.settings.theme=$('theme').value;applyTheme();queueSave();});
document.querySelectorAll('[name=behavior]').forEach(x=>x.addEventListener('change',queueSave));
bind('enabled-toggle',async()=>{
  clearTimeout(saveTimer);await saving;
  const next={...collect(),enabled:!state.settings.enabled};
  if(next.enabled&&!state.hasJevKey){panel('connection');throw new Error('Configure your Jev key first.');}
  await send('UI_SAVE',{settings:next});state.settings=next;showEnabled();
});
bind('connect',async()=>{await connect(false);toast('Connection saved. You can test it and enable the filter.');});
bind('test-connection',async()=>{await connect(true);toast('Connection successful.');});
bind('forget-key',async()=>{await send('UI_FORGET_KEY');state=await send('UI_STATE');fill();toast('Key removed from this device.');});
bind('clear-cache',async()=>{await send('UI_CLEAR_CACHE');toast('Session cache cleared.');});
bind('export-settings',async()=>download('your-signal-preferences.json',{version:1,settings:collect()}));
try{
  state=await send('UI_STATE');fill();$('preview-banner').hidden=inExtension;
  if(!inExtension)$('save-state').textContent='No service calls';
  const tab=location.hash.slice(1);panel(['algorithm','connection','privacy'].includes(tab)?tab:'algorithm');
  if(state.lastError)toast(state.lastError,true);
}catch(error){toast(error.message,true);}
