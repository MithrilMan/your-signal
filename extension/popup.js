import './core.js';
const C=globalThis.OYA,$=id=>document.getElementById(id);
let state,saving=Promise.resolve(),saveRevision=0,activeProfileId=null;
const LABELS={relevance:'Relevance',substance:'Substance',actionable:'Utility',promotion:'Promotion',bait:'Bait'};
const HELP={relevance:'More of the topics in your target.',substance:'More concrete details; not a truth check.',actionable:'More techniques and ideas you can use.',promotion:'Higher weight means less promotional content.',bait:'Higher weight means less engagement bait.'};
async function send(type,extra={}){const r=await chrome.runtime.sendMessage({type,...extra});if(!r?.ok)throw new Error(r?.error||'Operation failed.');return r.data;}
function message(text,error=false){$('popup-message').textContent=text;$('popup-message').hidden=!text;$('popup-message').classList.toggle('error',error);}
function error(e){message(e.message,true);$('popup-save-state').textContent='Not saved · try again';}
function applyTheme(theme=state?.settings?.theme||'system'){document.documentElement.dataset.theme=theme;}
function equalPreferences(a,b){return JSON.stringify(C.profileSettings(a))===JSON.stringify(C.profileSettings(b));}
function selectProfile(){
  const s=state.settings;
  const saved=(state.customProfiles||[]).find(p=>equalPreferences(p.settings,s));
  const preset=Object.entries(C.PRESETS).find(([,p])=>JSON.stringify(p.weights)===JSON.stringify(s.weights)&&p.interests===s.interests&&p.threshold===s.threshold);
  $('popup-preset').value=saved?'saved:'+saved.id:preset?.[0]||'custom';
}
function refreshValues(){
  const s=state.settings;
  $('popup-toggle').setAttribute('aria-checked',String(s.enabled));
  $('popup-status').textContent=s.enabled?'Filter on':'Filter paused';
  document.querySelector('.toggle-word').textContent=s.enabled?'ON':'OFF';
  $('popup-threshold-value').textContent=s.threshold;
  for(const k of C.KEYS)$('popup-value-'+k).textContent=s.weights[k];
  document.querySelectorAll('input[type=range]').forEach(input=>input.style.setProperty('--p',input.value+'%'));
  selectProfile();
}
function render(){
  const s=state.settings;
  $('popup-theme').value=s.theme;applyTheme(s.theme);
  $('popup-interests').value=s.interests;$('popup-threshold').value=s.threshold;
  for(const k of C.KEYS)$('popup-weight-'+k).value=s.weights[k];
  document.querySelector(`[name=popup-behavior][value=${s.behavior}]`).checked=true;
  $('popup-mode').textContent='Personal key · Jev';
  $('popup-evaluated').textContent=state.stats?.evaluated||0;$('popup-cache').textContent=state.stats?.cacheHits||0;
  $('popup-preset').querySelector('[data-saved-profiles]')?.remove();
  if(state.customProfiles?.length){
    const group=document.createElement('optgroup');group.label='Your profiles';group.dataset.savedProfiles='';
    for(const p of state.customProfiles){const option=document.createElement('option');option.value='saved:'+p.id;option.textContent=p.name;group.append(option);}
    $('popup-preset').append(group);
  }
  refreshValues();
}
function collect(){return C.settings({...state.settings,interests:$('popup-interests').value,weights:Object.fromEntries(C.KEYS.map(k=>[k,Number($('popup-weight-'+k).value)])),threshold:Number($('popup-threshold').value),behavior:document.querySelector('[name=popup-behavior]:checked').value});}
function save(){
  const snapshot=structuredClone(state.settings),revision=++saveRevision;
  $('popup-save-state').textContent='Saving…';
  saving=saving.catch(()=>{}).then(async()=>{
    if(revision!==saveRevision)return;
    await send('UI_SAVE',{settings:snapshot});
    if(revision===saveRevision){$('popup-save-state').textContent='Saved on this device';if($('popup-message').classList.contains('error'))message('');}
  });
  return saving;
}
function changed(){if(!state)return;state.settings=collect();refreshValues();save().catch(error);}
for(const key of C.KEYS){
  const row=document.createElement('div');row.className='weight-row';row.dataset.criterion=key;
  const label=document.createElement('label');label.className='weight-title';label.htmlFor='popup-weight-'+key;label.textContent=LABELS[key];
  const input=document.createElement('input');input.type='range';input.id=label.htmlFor;input.min=0;input.max=100;input.step=5;input.title=HELP[key];input.setAttribute('aria-describedby','popup-help-'+key);input.addEventListener('input',changed);
  const output=document.createElement('output');output.id='popup-value-'+key;output.htmlFor=input.id;
  const help=document.createElement('span');help.id='popup-help-'+key;help.className='sr-only';help.textContent=HELP[key];
  row.append(label,input,output,help);$('popup-weights').append(row);
}
$('popup-toggle').onclick=async()=>{
  if(!state)return;
  const previous=state.settings.enabled;$('popup-toggle').disabled=true;
  try{
    const enabled=!state.settings.enabled;
    if(enabled&&!state.hasJevKey){await saving;await send('OPEN_OPTIONS');window.close();return;}
    state.settings.enabled=enabled;refreshValues();await save();
  }catch(e){state.settings.enabled=previous;refreshValues();error(e);}finally{$('popup-toggle').disabled=false;}
};
$('popup-preset').onchange=()=>{
  if(!state)return;
  const value=$('popup-preset').value;
  const profile=state.customProfiles?.find(p=>'saved:'+p.id===value);
  const preset=profile?.settings||C.PRESETS[value];
  activeProfileId=profile?.id||null;
  if(preset){state.settings=C.settings({...state.settings,...preset});render();save().catch(error);}
};
$('popup-interests').addEventListener('input',changed);
$('popup-threshold').addEventListener('input',changed);
$('popup-theme').addEventListener('change',()=>{state.settings.theme=$('popup-theme').value;applyTheme();refreshValues();save().catch(error);});
document.querySelectorAll('[name=popup-behavior]').forEach(input=>input.addEventListener('change',changed));
function closeProfileForm(){ $('popup-profile-form').hidden=true;$('popup-new-profile').setAttribute('aria-expanded','false');$('popup-new-profile').focus(); }
$('popup-new-profile').onclick=()=>{
  if(!state)return;
  const open=$('popup-profile-form').hidden;
  $('popup-profile-form').hidden=!open;$('popup-new-profile').setAttribute('aria-expanded',String(open));
  if(open){const existing=state.customProfiles?.find(p=>p.id===activeProfileId);$('popup-profile-name').value=existing?.name||'';$('popup-profile-name').focus();}
};
$('popup-cancel-profile').onclick=closeProfileForm;
$('popup-profile-form').onsubmit=async event=>{
  event.preventDefault();const button=event.submitter||event.currentTarget.querySelector('[type=submit]');button.disabled=true;
  try{
    await saving;const name=$('popup-profile-name').value.trim();
    const existing=state.customProfiles?.find(p=>p.id===activeProfileId&&p.name===name);
    const result=await send('UI_SAVE_PROFILE',{name,settings:C.profileSettings(collect()),...(existing?{id:existing.id}:{})});
    state.settings=result.settings;state.customProfiles=result.customProfiles;activeProfileId=result.profile.id;
    render();closeProfileForm();message(`“${result.profile.name}” saved on this device.`);$('popup-save-state').textContent='Saved on this device';
  }catch(e){error(e);}finally{button.disabled=false;}
};
$('popup-open').onclick=async()=>{try{await saving;await send('OPEN_OPTIONS');window.close();}catch(e){error(e);}};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('popup-profile-form').hidden){event.preventDefault();closeProfileForm();}});
try{state=await send('UI_STATE');render();const selected=state.customProfiles?.find(p=>equalPreferences(p.settings,state.settings));activeProfileId=selected?.id||null;if(state.lastError)message(state.lastError,true);}catch(e){error(e);}
