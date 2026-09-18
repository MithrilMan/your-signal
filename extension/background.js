import './core.js';
const C=globalThis.OYA;
const JEV='https://api.typesafe.ai';
let rubric,cache=new Map(),cacheEpoch=0,pending=new Map(),active=0,waiters=[],serial=Promise.resolve();

const ready=(async()=>{
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  await chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  rubric=await (await fetch(chrome.runtime.getURL('rubric.json'))).json();
  const saved=await chrome.storage.session.get('evaluationCache');
  cache=new Map((saved.evaluationCache||[]).filter(([,value])=>value.expires>Date.now()));
})();

function exclusive(fn){const promise=serial.then(fn);serial=promise.catch(()=>{});return promise;}
async function config(){return C.settings((await chrome.storage.local.get('settings')).settings);}
async function savedProfiles(){return C.profiles((await chrome.storage.local.get('customProfiles')).customProfiles);}
async function savedOverlayPosition(){
  const {overlayPosition}=await chrome.storage.local.get('overlayPosition');
  try{return C.overlayPosition(overlayPosition);}catch{return C.overlayPosition();}
}
async function secrets(){
  const local=await chrome.storage.local.get(['jevKey','identityRevision']);
  const session=await chrome.storage.session.get('jevKey');
  return {...local,jevKey:session.jevKey||local.jevKey||'',rememberKey:!!local.jevKey};
}
async function publicState(){
  const [settings,secret,overlayPosition,profiles]=await Promise.all([config(),secrets(),savedOverlayPosition(),savedProfiles()]);
  return {
    settings,
    overlayPosition,
    quickProfiles:profiles.map(({id,name})=>({id,name})),
    activeProfile:C.profileSelection(settings,profiles),
    evaluationRevision:await C.hash([settings.interests,secret.identityRevision||'',rubric.version])
  };
}
async function broadcast(){
  const state=await publicState();
  const tabs=await chrome.tabs.query({url:['https://x.com/*','https://www.x.com/*']});
  await Promise.all(tabs.map(tab=>chrome.tabs.sendMessage(tab.id,{type:'OYA_SETTINGS',...state}).catch(()=>{})));
}
async function fetchJSON(url,{method='GET',token,body,timeout=26000}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetch(url,{method,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal,
      headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},
      ...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok){
      const descriptions={
        401:'TypeSafe denied access: check your API key and account permissions.',
        403:'TypeSafe denied access: check your API key and account permissions.',
        429:'TypeSafe temporarily limited the request. Try again shortly.',
        529:'TypeSafe is temporarily overloaded. Try again shortly.'
      };
      const error=new Error(descriptions[response.status]||`TypeSafe returned error ${response.status}.`);
      error.status=response.status;error.retryAfter=response.headers.get('retry-after');throw error;
    }
    return await response.json();
  }finally{clearTimeout(timer);}
}
async function permission(){
  if(!await chrome.permissions.contains({origins:[JEV+'/*']}))throw new Error('Authorize the TypeSafe connection in settings first.');
}
function today(){return new Date().toISOString().slice(0,10);}
async function statsDelta(delta,limit){return exclusive(async()=>{
  let {stats}=await chrome.storage.local.get('stats');
  if(!stats||stats.day!==today())stats={day:today(),attempted:0,evaluated:0,cacheHits:0,tokens:0,errors:0};
  if(limit&&stats.attempted>=limit)throw new Error('Local daily limit reached. The feed remains visible.');
  for(const [key,value] of Object.entries(delta))stats[key]=(stats[key]||0)+value;
  await chrome.storage.local.set({stats});return stats;
});}
async function withSlot(fn){
  if(active<3)active++;
  else{if(waiters.length>=30)throw new Error('Queue full: the post remains visible.');await new Promise(resolve=>waiters.push(resolve));}
  try{return await fn();}finally{const next=waiters.shift();if(next)next();else active--;}
}
async function remember(key,result){
  cache.delete(key);cache.set(key,{result,expires:Date.now()+86400000});
  while(cache.size>500)cache.delete(cache.keys().next().value);
  await chrome.storage.session.set({evaluationCache:[...cache]});
}
async function clearCache(){cacheEpoch++;cache.clear();await chrome.storage.session.remove('evaluationCache');}
async function evaluationConfig(expected,identityRevision){
  const current=await config(),secret=await secrets();
  if(!current.enabled||current.interests!==expected.interests||secret.identityRevision!==identityRevision)throw new Error('Configuration changed; the post was not modified.');
  return current;
}
async function evaluate(post){
  post=C.cleanPost(post);
  const settings=await config(),secret=await secrets();
  if(!settings.enabled)throw new Error('Filter paused.');
  if(!secret.jevKey)throw new Error('Enter your Jev key in settings.');
  const payload=C.request(post,settings.interests,rubric);
  const key=await C.hash([payload,rubric.version,secret.identityRevision||'']);
  const cached=cache.get(key);
  if(cached&&cached.expires>Date.now()){await statsDelta({cacheHits:1});return {...cached.result,cached:true,input_tokens:0};}
  if(pending.has(key))return pending.get(key);
  const epoch=cacheEpoch;
  const promise=withSlot(async()=>{
    await evaluationConfig(settings,secret.identityRevision);
    const started=performance.now();
    try{
      let body;
      for(let attempt=0;attempt<2;attempt++){
        const current=await evaluationConfig(settings,secret.identityRevision);
        await permission();
        await statsDelta({attempted:1},current.dailyLimit);
        try{body=await fetchJSON(JEV+'/v1/systemone',{method:'POST',token:secret.jevKey,body:payload,timeout:9000});break;}
        catch(error){
          if(![429,529].includes(error.status)||attempt===1)throw error;
          const delay=Math.min(3000,Math.max(500,Number(error.retryAfter||1)*1000));
          await new Promise(resolve=>setTimeout(resolve,Number.isFinite(delay)?delay:1000));
        }
      }
      const result={...C.parseJev(body),cached:false,latency_ms:Math.round(performance.now()-started)};
      if(epoch===cacheEpoch)await remember(key,result);
      await statsDelta({evaluated:1,tokens:result.input_tokens});
      await chrome.storage.local.remove('lastError');
      return result;
    }catch(error){
      await statsDelta({errors:1});
      const message=error.name==='AbortError'?'Request timed out. The feed remains visible.':error.message||'Connection failed.';
      await chrome.storage.local.set({lastError:message});throw new Error(message);
    }
  });
  pending.set(key,promise);
  try{return await promise;}finally{pending.delete(key);}
}
async function save(message,customProfiles){
  const settings=C.settings(message.settings),newKey=typeof message.jevKey==='string'?message.jevKey.trim():'';
  if(newKey&&(newKey.length<8||newKey.length>512))throw new Error('The Jev key does not appear to be valid.');
  if(newKey||typeof message.rememberKey==='boolean'){
    const key=newKey||(await secrets()).jevKey;
    if(key){
      const persistent=message.rememberKey!==false;
      await (persistent?chrome.storage.local:chrome.storage.session).set({jevKey:key});
      await (persistent?chrome.storage.session:chrome.storage.local).remove('jevKey');
    }
  }
  if(newKey){await chrome.storage.local.set({identityRevision:crypto.randomUUID()});await clearCache();}
  await chrome.storage.local.set({settings,...(customProfiles?{customProfiles}:{})});
  await broadcast();return publicState();
}
async function saveProfile(message){
  const profiles=await savedProfiles(),current=await config();
  const name=typeof message.name==='string'?message.name.trim():'';
  if(!name||name.length>40)throw new Error('Use a profile name between 1 and 40 characters.');
  const index=message.id===undefined?-1:profiles.findIndex(profile=>profile.id===message.id);
  if(message.id!==undefined&&index===-1)throw new Error('Saved profile not found.');
  if(index===-1&&profiles.length>=20)throw new Error('You can save up to 20 profiles. Delete one before adding another.');
  if(message.settings!==undefined&&(!message.settings||typeof message.settings!=='object'||Array.isArray(message.settings)))throw new Error('Invalid profile settings.');
  const incoming=message.settings||{};
  const preferences=C.profileSettings({...current,...incoming,weights:{...current.weights,...incoming.weights}});
  const profile={id:index===-1?crypto.randomUUID():profiles[index].id,name,settings:preferences};
  if(index===-1)profiles.push(profile);else profiles[index]=profile;
  const state=await save({settings:{...current,...preferences}},profiles);
  return {profile,settings:state.settings,customProfiles:profiles};
}
async function saveQuickSettings(message){
  const hasPatch=Object.hasOwn(message,'patch'),hasProfile=Object.hasOwn(message,'profile');
  if(hasPatch===hasProfile)throw new Error('Choose one quick setting action.');
  const current=await config();let next;
  if(hasPatch){
    const patch=message.patch;
    if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new Error('Invalid quick settings.');
    const keys=Object.keys(patch),allowed=new Set(['enabled','interests','weights','threshold','minimumMargin','behavior','hideAds','theme']);
    if(!keys.length||keys.some(key=>!allowed.has(key)))throw new Error('Invalid quick settings.');
    if(Object.hasOwn(patch,'enabled')&&typeof patch.enabled!=='boolean')throw new Error('Invalid filter state.');
    if(Object.hasOwn(patch,'hideAds')&&typeof patch.hideAds!=='boolean')throw new Error('Invalid ad setting.');
    if(Object.hasOwn(patch,'theme')&&!['system','light','dark'].includes(patch.theme))throw new Error('Invalid appearance setting.');
    if(Object.hasOwn(patch,'interests')&&(typeof patch.interests!=='string'||patch.interests.length>400))throw new Error('Invalid target interests.');
    if(Object.hasOwn(patch,'weights')){
      const weights=patch.weights;
      if(!weights||typeof weights!=='object'||Array.isArray(weights))throw new Error('Invalid preference weights.');
      const weightKeys=Object.keys(weights);
      if(!weightKeys.length||weightKeys.some(key=>!C.KEYS.includes(key)))throw new Error('Invalid preference weights.');
      if(weightKeys.some(key=>typeof weights[key]!=='number'||!Number.isFinite(weights[key])||weights[key]<0||weights[key]>100))throw new Error('Invalid preference weight.');
    }
    if(Object.hasOwn(patch,'threshold')&&(typeof patch.threshold!=='number'||!Number.isFinite(patch.threshold)||patch.threshold<0||patch.threshold>100))throw new Error('Invalid feed threshold.');
    if(Object.hasOwn(patch,'minimumMargin')&&(typeof patch.minimumMargin!=='number'||!Number.isFinite(patch.minimumMargin)||patch.minimumMargin<0||patch.minimumMargin>1))throw new Error('Invalid uncertainty guard.');
    if(Object.hasOwn(patch,'behavior')&&!['dim','collapse','hide','label'].includes(patch.behavior))throw new Error('Invalid post treatment.');
    next=C.settings({...current,...patch,...(patch.weights?{weights:{...current.weights,...patch.weights}}:{})});
  }else{
    if(typeof message.profile!=='string')throw new Error('Invalid profile selection.');
    if(message.profile.startsWith('preset:')){
      const preset=C.PRESETS[message.profile.slice(7)];
      if(!preset)throw new Error('Preset profile not found.');
      next=C.settings({...current,...preset});
    }else if(message.profile.startsWith('saved:')){
      const id=message.profile.slice(6),profile=(await savedProfiles()).find(item=>item.id===id);
      if(!profile)throw new Error('Saved profile not found.');
      next=C.settings({...current,...profile.settings});
    }else throw new Error('Invalid profile selection.');
  }
  if(next.enabled){
    if(!(await secrets()).jevKey)throw new Error('Connect a Jev key in advanced settings first.');
  }
  return save({settings:next});
}
async function deleteProfile(message){
  const profiles=await savedProfiles(),index=profiles.findIndex(profile=>profile.id===message.id);
  if(index===-1)throw new Error('Saved profile not found.');
  profiles.splice(index,1);await chrome.storage.local.set({customProfiles:profiles});await broadcast();return {customProfiles:profiles};
}
async function handle(message,sender){
  await ready;
  if(sender.id!==chrome.runtime.id)throw new Error('Unauthorized sender.');
  const url=new URL(sender.url||'about:blank');
  const privileged=url.protocol==='chrome-extension:'&&url.hostname===chrome.runtime.id&&['/options.html','/popup.html'].includes(url.pathname);
  const content=sender.frameId===0&&sender.tab&&url.protocol==='https:'&&['x.com','www.x.com'].includes(url.hostname);
  if(!privileged&&!content)throw new Error('Unauthorized context.');
  if(message.type==='GET_PUBLIC')return publicState();
  if(message.type==='OPEN_OPTIONS'){
    if(message.panel===undefined){await chrome.runtime.openOptionsPage();return {ok:true};}
    if(!['connection','privacy'].includes(message.panel))throw new Error('Unknown settings section.');
    await chrome.tabs.create({url:chrome.runtime.getURL(`options.html#${message.panel}`)});return {ok:true};
  }
  if(message.type==='SAVE_OVERLAY_POSITION'){
    if(content&&!C.routeAllowed(url.pathname,await config()))throw new Error('The control is unavailable on this page.');
    if(message.position===undefined)throw new Error('Missing control position.');
    const overlayPosition=C.overlayPosition(message.position);
    return exclusive(async()=>{
      await chrome.storage.local.set({overlayPosition});
      const tabs=await chrome.tabs.query({url:['https://x.com/*','https://www.x.com/*']});
      await Promise.all(tabs.map(tab=>chrome.tabs.sendMessage(tab.id,{type:'OYA_OVERLAY_POSITION',overlayPosition}).catch(()=>{})));
      return {overlayPosition};
    });
  }
  if(message.type==='SAVE_QUICK_SETTINGS'){
    if(!content||!C.routeAllowed(url.pathname,await config()))throw new Error('Quick controls are unavailable on this page.');
    return exclusive(()=>saveQuickSettings(message));
  }
  if(message.type==='EVALUATE'){
    if(!content||!C.routeAllowed(url.pathname,await config()))throw new Error('This page is not analyzed.');
    return evaluate(message.post);
  }
  if(!privileged)throw new Error('This action is restricted to settings.');
  switch(message.type){
    case 'UI_STATE':{
      const [state,secret,data,customProfiles]=await Promise.all([publicState(),secrets(),chrome.storage.local.get(['stats','lastError']),savedProfiles()]);
      return {...state,customProfiles,hasJevKey:!!secret.jevKey,rememberKey:secret.rememberKey,stats:data.stats?.day===today()?data.stats:null,lastError:data.lastError||'',model:rubric.model};
    }
    case 'UI_SAVE':return exclusive(()=>save(message));
    case 'UI_SAVE_PROFILE':return exclusive(()=>saveProfile(message));
    case 'UI_DELETE_PROFILE':return exclusive(()=>deleteProfile(message));
    case 'UI_FORGET_KEY':{
      await chrome.storage.local.remove('jevKey');await chrome.storage.session.remove('jevKey');
      const settings=await config();settings.enabled=false;
      await chrome.storage.local.set({settings,identityRevision:crypto.randomUUID()});
      await chrome.permissions.remove({origins:[JEV+'/*']});
      await clearCache();await chrome.storage.local.remove('lastError');await broadcast();return {ok:true};
    }
    case 'UI_TEST':{
      await permission();const key=(await secrets()).jevKey;
      if(!key)throw new Error('Enter and save a Jev key.');
      await fetchJSON(JEV+'/v1/models',{token:key,timeout:12000});
      await chrome.storage.local.remove('lastError');return {ok:true};
    }
    case 'UI_CLEAR_CACHE':await clearCache();return {ok:true};
    default:throw new Error('Unknown operation.');
  }
}

chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  handle(message||{},sender).then(data=>reply({ok:true,data})).catch(error=>reply({ok:false,error:error.message||'Operation failed.'}));
  return true;
});
chrome.runtime.onInstalled.addListener(()=>{ready.then(async()=>{
  const {settings}=await chrome.storage.local.get('settings');
  const firstInstall=!settings;
  await chrome.storage.local.set({settings:C.settings(settings)});
  if(firstInstall)await chrome.runtime.openOptionsPage();
}).catch(()=>{});});
