import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../extension/core.js';
const C=globalThis.OYA,id='a'.repeat(32);
const rubric=JSON.parse(await readFile(new URL('../shared/rubric.json',import.meta.url)));
const stores={local:{},session:{}};let handler,calls=[],createdTabs=[],concurrent=0,maxConcurrent=0,providerResponse;
function storage(name){return {
  async setAccessLevel(value){stores[name].accessLevel=value.accessLevel;},
  async get(keys){const names=typeof keys==='string'?[keys]:keys;return Object.fromEntries(names.map(k=>[k,stores[name][k]]));},
  async set(data){Object.assign(stores[name],structuredClone(data));},
  async remove(keys){for(const k of typeof keys==='string'?[keys]:keys)delete stores[name][k];}
};}
globalThis.chrome={runtime:{id,getURL:p=>`chrome-extension://${id}/${p}`,onMessage:{addListener:fn=>handler=fn},onInstalled:{addListener(){}},async openOptionsPage(){}},storage:{local:storage('local'),session:storage('session')},permissions:{async contains(){return true;},async remove(){return true;}},tabs:{async query(){return []},async sendMessage(){},async create(options){createdTabs.push(options);return options;}}};
globalThis.fetch=async(url,options={})=>{
  if(String(url).endsWith('rubric.json'))return new Response(JSON.stringify(rubric));
  calls.push({url:String(url),options});concurrent++;maxConcurrent=Math.max(maxConcurrent,concurrent);
  await new Promise(r=>setTimeout(r,15));concurrent--;
  if(providerResponse)return providerResponse(String(url),options);
  if(String(url).endsWith('/v1/systemone'))return new Response(JSON.stringify({model:'jev-1.13.0',answers:Object.fromEntries(C.KEYS.map(k=>[k,{type:'noul',noul:['promotion','bait'].includes(k)?.1:.9}])),usage:{input_tokens:500}}));
  if(String(url).endsWith('/v1/models'))return new Response(JSON.stringify({models:[]}));
  return new Response(JSON.stringify({status:'ok'}));
};
await import('../extension/background.js');
const privileged={id,url:`chrome-extension://${id}/options.html`};
const content={id,url:'https://x.com/home',frameId:0,tab:{id:1,url:'https://x.com/home'}};
function send(message,sender=privileged){return new Promise(resolve=>handler(message,sender,resolve));}
async function configure(extra={}){
  const settings={...C.DEFAULTS,enabled:true,dailyLimit:100,...extra};
  return send({type:'UI_SAVE',settings,jevKey:'test-provider-key-'+crypto.randomUUID()});
}
test('background trust, key handling, cache, concurrency and budget',async t=>{
  await t.test('storage is restricted to trusted contexts',async()=>{await send({type:'UI_STATE'});assert.equal(stores.local.accessLevel,'TRUSTED_CONTEXTS');assert.equal(stores.session.accessLevel,'TRUSTED_CONTEXTS');});
  await t.test('secrets are never in public or UI state',async()=>{await configure();const publicResult=await send({type:'GET_PUBLIC'},content);const ui=await send({type:'UI_STATE'});assert.equal(ui.ok,true);assert.equal(ui.data.hasJevKey,true);assert.ok(!JSON.stringify(publicResult).includes('test-provider-key'));assert.ok(!('jevKey' in ui.data));assert.equal(stores.local.jevKey.startsWith('test-provider-key'),true);});
  await t.test('a content script cannot change or read private settings',async()=>{for(const type of ['UI_STATE','UI_SAVE','UI_SAVE_PROFILE','UI_DELETE_PROFILE','UI_FORGET_KEY','UI_TEST'])assert.equal((await send({type,settings:C.DEFAULTS},content)).ok,false);});
  await t.test('other extension IDs and origins are rejected',async()=>{assert.equal((await send({type:'GET_PUBLIC'},{...privileged,id:'b'.repeat(32)})).ok,false);assert.equal((await send({type:'UI_STATE'},{id,url:'about:blank'})).ok,false);assert.equal((await send({type:'EVALUATE',post:{id:'1',text:'hello'}},{...content,url:'https://evil.example/'})).ok,false);});
  await t.test('X can persist only the overlay position without changing settings or evaluation identity',async()=>{
    const before=(await send({type:'GET_PUBLIC'},content)).data,secret=stores.local.jevKey,requests=calls.length;
    assert.deepEqual(before.overlayPosition,{preset:'top-left'});
    const result=await send({type:'SAVE_OVERLAY_POSITION',position:{preset:'custom',x:10,y:-1,jevKey:'injected'},settings:{enabled:false},jevKey:'injected'},content);
    assert.equal(result.ok,true);assert.deepEqual(result.data,{overlayPosition:{preset:'custom',x:1,y:0}});
    const after=(await send({type:'GET_PUBLIC'},content)).data;
    assert.deepEqual(after.settings,before.settings);assert.equal(after.evaluationRevision,before.evaluationRevision);assert.equal(stores.local.jevKey,secret);assert.equal(calls.length,requests);
    await send({type:'UI_SAVE',settings:before.settings});
    assert.deepEqual((await send({type:'GET_PUBLIC'},content)).data.overlayPosition,{preset:'custom',x:1,y:0});
    assert.ok(!JSON.stringify(result).includes(secret));
  });
  await t.test('overlay position saves reject invalid payloads and unauthorized content contexts',async()=>{
    const before=structuredClone(stores.local.overlayPosition);
    for(const position of [undefined,null,[],{preset:'other'},{preset:'custom',x:NaN,y:0},{preset:'custom',x:0,y:Infinity},{preset:'custom',x:'0',y:0}])assert.equal((await send({type:'SAVE_OVERLAY_POSITION',position},content)).ok,false);
    for(const sender of [{...content,id:'b'.repeat(32)},{...content,frameId:1},{...content,url:'https://evil.example/home'},{...content,url:'https://x.com/messages'},{...content,url:'https://x.com/search'},{...content,tab:undefined}])assert.equal((await send({type:'SAVE_OVERLAY_POSITION',position:{preset:'bottom-left'}},sender)).ok,false);
    assert.deepEqual(stores.local.overlayPosition,before);
    stores.local.overlayPosition={preset:'custom',x:'invalid',y:0};
    assert.deepEqual((await send({type:'GET_PUBLIC'},content)).data.overlayPosition,{preset:'top-left'});
    await send({type:'SAVE_OVERLAY_POSITION',position:{preset:'top-left'}},content);
  });
  await t.test('X quick controls change only daily feed settings and validate resume in the worker',async()=>{
    await configure();calls=[];const key=stores.local.jevKey,before=(await send({type:'GET_PUBLIC'},content)).data;
    const changed=await send({type:'SAVE_QUICK_SETTINGS',patch:{interests:'Distributed systems, humane interfaces',weights:{relevance:45,bait:60},threshold:71,minimumMargin:.55,behavior:'hide',hideAds:true,theme:'dark'}},content);
    assert.equal(changed.ok,true,changed.error);assert.equal(changed.data.settings.threshold,71);assert.equal(changed.data.settings.minimumMargin,.55);assert.equal(changed.data.settings.behavior,'hide');assert.equal(changed.data.settings.hideAds,true);assert.equal(changed.data.settings.theme,'dark');assert.equal(changed.data.activeProfile,'');
    assert.equal(changed.data.settings.interests,'Distributed systems, humane interfaces');assert.equal(changed.data.settings.weights.relevance,45);assert.equal(changed.data.settings.weights.bait,60);assert.equal(changed.data.settings.weights.substance,before.settings.weights.substance);
    assert.equal(stores.local.jevKey,key);assert.equal(calls.length,0);
    assert.ok(!JSON.stringify(changed).includes(key));
    assert.equal((await send({type:'SAVE_QUICK_SETTINGS',patch:{enabled:false}},content)).data.settings.enabled,false);
    assert.equal((await send({type:'SAVE_QUICK_SETTINGS',patch:{enabled:true}},content)).data.settings.enabled,true);
    const preset=await send({type:'SAVE_QUICK_SETTINGS',profile:'preset:curious'},content);
    assert.equal(preset.ok,true,preset.error);assert.equal(preset.data.settings.interests,C.PRESETS.curious.interests);assert.equal(preset.data.settings.threshold,C.PRESETS.curious.threshold);
    assert.equal(preset.data.activeProfile,'preset:curious');
    assert.equal(calls.length,0);
    for(const message of [
      {type:'SAVE_QUICK_SETTINGS'},
      {type:'SAVE_QUICK_SETTINGS',patch:{},profile:'preset:builder'},
      {type:'SAVE_QUICK_SETTINGS',patch:{}},
      {type:'SAVE_QUICK_SETTINGS',patch:{enabled:'yes'}},
      {type:'SAVE_QUICK_SETTINGS',patch:{hideAds:'yes'}},
      {type:'SAVE_QUICK_SETTINGS',patch:{theme:'midnight'}},
      {type:'SAVE_QUICK_SETTINGS',patch:{interests:42}},
      {type:'SAVE_QUICK_SETTINGS',patch:{interests:'x'.repeat(401)}},
      {type:'SAVE_QUICK_SETTINGS',patch:{weights:{}}},
      {type:'SAVE_QUICK_SETTINGS',patch:{weights:{relevance:101}}},
      {type:'SAVE_QUICK_SETTINGS',patch:{weights:{secret:50}}},
      {type:'SAVE_QUICK_SETTINGS',patch:{threshold:101}},
      {type:'SAVE_QUICK_SETTINGS',patch:{minimumMargin:1.01}},
      {type:'SAVE_QUICK_SETTINGS',patch:{behavior:'remove'}},
      {type:'SAVE_QUICK_SETTINGS',profile:'preset:missing'},
      {type:'SAVE_QUICK_SETTINGS',profile:'saved:'+crypto.randomUUID()}
    ])assert.equal((await send(message,content)).ok,false);
    for(const sender of [{...content,id:'b'.repeat(32)},{...content,frameId:1},{...content,url:'https://evil.example/home'},{...content,url:'https://x.com/messages'},{...content,tab:undefined}])assert.equal((await send({type:'SAVE_QUICK_SETTINGS',patch:{enabled:false}},sender)).ok,false);
    await send({type:'UI_FORGET_KEY'});
    const denied=await send({type:'SAVE_QUICK_SETTINGS',patch:{enabled:true}},content);
    assert.equal(denied.ok,false);assert.match(denied.error,/Jev key/);assert.equal(stores.local.settings.enabled,false);
    await configure();
  });
  await t.test('X can open only the connection or privacy settings sections',async()=>{
    createdTabs=[];
    const connection=await send({type:'OPEN_OPTIONS',panel:'connection'},content);
    assert.equal(connection.ok,true);assert.deepEqual(createdTabs,[{url:`chrome-extension://${id}/options.html#connection`}]);
    assert.equal((await send({type:'OPEN_OPTIONS',panel:'algorithm'},content)).ok,false);
    assert.equal((await send({type:'OPEN_OPTIONS',panel:'secrets'},content)).ok,false);
  });
  await t.test('multiple equivalent requests coalesce and then hit cache',async()=>{calls=[];const m={type:'EVALUATE',post:{id:'10',text:'One original fixture post on software.'}};const a=await Promise.all([send(m,content),send(m,content)]);assert.ok(a.every(r=>r.ok));assert.equal(calls.length,1);const cached=await send(m,content);assert.equal(cached.data.cached,true);assert.equal(calls.length,1);});
  await t.test('provider requests use the fixed host and real contract',async()=>{assert.equal(calls[0].url,'https://api.typesafe.ai/v1/systemone');assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.redirect,'error');const body=JSON.parse(calls[0].options.body);assert.ok(!('id' in body.state.post));assert.equal(body.questions.substance.type,'noul');});
  await t.test('weights are local and do not invalidate evaluations',async()=>{const s=(await send({type:'UI_STATE'})).data.settings;await send({type:'UI_SAVE',settings:{...s,weights:{...s.weights,bait:0}}});const before=calls.length;const r=await send({type:'EVALUATE',post:{id:'10',text:'One original fixture post on software.'}},content);assert.equal(r.data.cached,true);assert.equal(calls.length,before);});
  await t.test('concurrency is bounded to three',async()=>{maxConcurrent=0;const results=await Promise.all(Array.from({length:9},(_,i)=>send({type:'EVALUATE',post:{id:String(20+i),text:`Concurrency fixture ${i} about software.`}},content)));assert.ok(results.every(r=>r.ok));assert.ok(maxConcurrent<=3);});
  await t.test('daily local limit is reserved atomically',async()=>{await configure({dailyLimit:10});stores.local.stats={day:new Date().toISOString().slice(0,10),attempted:0,evaluated:0,cacheHits:0,tokens:0,errors:0};calls=[];const results=await Promise.all(Array.from({length:15},(_,i)=>send({type:'EVALUATE',post:{id:String(70+i),text:`Daily fixture ${i} about software.`}},content)));assert.equal(results.filter(r=>r.ok).length,10);assert.equal(calls.length,10);});
  await t.test('paused filtering and non-home routes never call provider',async()=>{await send({type:'UI_SAVE',settings:{...C.DEFAULTS,enabled:false}});calls=[];assert.equal((await send({type:'EVALUATE',post:{id:'2',text:'Nothing should leave.'}},content)).ok,false);assert.equal((await send({type:'EVALUATE',post:{id:'2',text:'Nothing should leave.'}},{...content,url:'https://x.com/messages'})).ok,false);assert.equal(calls.length,0);});
  await t.test('key can be session-only and explicitly removed',async()=>{await send({type:'UI_SAVE',settings:C.DEFAULTS,jevKey:'session-only-key-123',rememberKey:false});assert.equal(stores.local.jevKey,undefined);assert.equal(stores.session.jevKey,'session-only-key-123');await send({type:'UI_FORGET_KEY'});assert.equal(stores.session.jevKey,undefined);assert.equal((await send({type:'UI_STATE'})).data.hasJevKey,false);});
  await t.test('saved key persistence can change without re-entering the key',async()=>{
    await configure();const key=stores.local.jevKey;
    await send({type:'UI_SAVE',settings:C.DEFAULTS,rememberKey:false});
    assert.equal(stores.local.jevKey,undefined);assert.equal(stores.session.jevKey,key);
    assert.equal((await send({type:'UI_STATE'})).data.rememberKey,false);
    await send({type:'UI_SAVE',settings:C.DEFAULTS,rememberKey:true});
    assert.equal(stores.local.jevKey,key);assert.equal(stores.session.jevKey,undefined);
    assert.equal((await send({type:'UI_STATE'})).data.rememberKey,true);
  });
  await t.test('forgetting an active BYOK key pauses the filter and clears persisted cache',async()=>{
    await configure();stores.session.evaluationCache=[['old',{result:{},expires:Date.now()+10000}]];
    await send({type:'UI_FORGET_KEY'});
    assert.equal(stores.local.settings.enabled,false);assert.equal(stores.session.evaluationCache,undefined);
  });
  await t.test('the connection test calls only TypeSafe',async()=>{
    await configure({enabled:false});calls=[];
    assert.equal((await send({type:'UI_TEST'})).ok,true);
    assert.deepEqual(calls.map(c=>c.url),['https://api.typesafe.ai/v1/models']);
    assert.equal(calls[0].options.headers.Authorization,'Bearer '+stores.local.jevKey);
  });
  await t.test('TypeSafe 403 explains the API key failure',async()=>{
    providerResponse=()=>new Response('{}',{status:403});
    try{const r=await send({type:'UI_TEST'});assert.equal(r.ok,false);assert.match(r.error,/TypeSafe/);assert.doesNotMatch(r.error,/ALLOWED_ORIGINS/);}finally{providerResponse=undefined;}
  });
  await t.test('pausing during provider backoff prevents a new request',async()=>{
    await configure();delete stores.local.stats;calls=[];
    let notify;const attempted=new Promise(r=>notify=r);
    providerResponse=()=>{notify();return new Response('{}',{status:429,headers:{'retry-after':'0.5'}});};
    try{
      const evaluation=send({type:'EVALUATE',post:{id:'retry-pause',text:'Retry pause fixture.'}},content);
      await attempted;await send({type:'UI_SAVE',settings:{...stores.local.settings,enabled:false}});
      assert.equal((await evaluation).ok,false);assert.equal(calls.length,1);
    }finally{providerResponse=undefined;}
  });
  await t.test('provider retries cannot exceed the local daily request limit',async()=>{
    await configure({dailyLimit:10});stores.local.stats={day:new Date().toISOString().slice(0,10),attempted:9};calls=[];
    providerResponse=()=>new Response('{}',{status:529,headers:{'retry-after':'0.5'}});
    try{
      const r=await send({type:'EVALUATE',post:{id:'retry-limit',text:'Retry budget fixture.'}},content);
      assert.equal(r.ok,false);assert.equal(calls.length,1);assert.equal(stores.local.stats.attempted,10);
      assert.match(stores.local.lastError,/Local daily limit/);
    }finally{providerResponse=undefined;}
  });
  await t.test('a missing BYOK key does not consume the request budget',async()=>{
    await send({type:'UI_FORGET_KEY'});delete stores.local.stats;calls=[];
    await send({type:'UI_SAVE',settings:{...C.DEFAULTS,enabled:true}});
    const r=await send({type:'EVALUATE',post:{id:'no-key',text:'Missing key fixture.'}},content);
    assert.equal(r.ok,false);assert.equal(calls.length,0);assert.equal(stores.local.stats,undefined);
  });
  await t.test('forgetting the key does not let an in-flight response repopulate cache',async()=>{
    await configure();
    let notify,finish;const attempted=new Promise(r=>notify=r);
    providerResponse=()=>{notify();return new Promise(r=>finish=r);};
    try{
      const evaluation=send({type:'EVALUATE',post:{id:'forget-pending',text:'Pending key removal fixture.'}},content);
      await attempted;await send({type:'UI_FORGET_KEY'});
      finish(new Response(JSON.stringify({model:rubric.model,answers:Object.fromEntries(C.KEYS.map(k=>[k,{type:'noul',noul:.9}]))})));
      assert.equal((await evaluation).ok,true);
      assert.equal(stores.session.evaluationCache,undefined);assert.equal(stores.local.settings.enabled,false);
    }finally{providerResponse=undefined;}
  });
});

test('custom profiles persist only preferences and remain private to extension UI',async t=>{
  await configure({searchEnabled:true,showBadges:false});
  delete stores.local.customProfiles;
  let profile;
  await t.test('saving applies a sanitized profile and preserves connection settings and credentials',async()=>{
    const original=structuredClone(stores.local.settings),key=stores.local.jevKey;
    calls=[];
    const result=await send({type:'UI_SAVE_PROFILE',name:'  Evening reading  ',jevKey:'injected-key',rememberKey:false,settings:{
      interests:'Art and astronomy',weights:{bait:25},threshold:43,highlightThreshold:90,minimumMargin:.2,behavior:'collapse',
      enabled:false,dailyLimit:10000,searchEnabled:false,showBadges:true,jevKey:'injected-key',untrusted:'injected-value'
    }});
    assert.equal(result.ok,true,result.error);profile=result.data.profile;
    assert.match(profile.id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    assert.equal(profile.name,'Evening reading');assert.equal(profile.settings.weights.bait,25);
    assert.equal(profile.settings.weights.relevance,original.weights.relevance);
    assert.deepEqual(Object.keys(profile.settings),['interests','weights','threshold','highlightThreshold','minimumMargin','behavior']);
    assert.deepEqual(result.data.settings,{...original,...profile.settings});
    assert.deepEqual(stores.local.settings,result.data.settings);
    assert.deepEqual(stores.local.customProfiles,[profile]);
    assert.equal(stores.local.jevKey,key);
    assert.equal(stores.session.jevKey,undefined);assert.equal(calls.length,0);
    assert.equal(JSON.stringify(profile).includes('injected'),false);
    const publicState=(await send({type:'GET_PUBLIC'},content)).data;
    assert.equal(Object.hasOwn(publicState,'customProfiles'),false);
    assert.deepEqual(publicState.quickProfiles,[{id:profile.id,name:profile.name}]);
    assert.equal(Object.hasOwn(publicState.quickProfiles[0],'settings'),false);
    const quickApply=await send({type:'SAVE_QUICK_SETTINGS',profile:'saved:'+profile.id},content);
    assert.equal(quickApply.ok,true,quickApply.error);assert.deepEqual(C.profileSettings(quickApply.data.settings),profile.settings);assert.equal(quickApply.data.activeProfile,'saved:'+profile.id);
  });
  await t.test('saved profiles survive a worker reload and are included in UI state',async()=>{
    await import('../extension/background.js?profile-reload='+crypto.randomUUID());
    const state=await send({type:'UI_STATE'});
    assert.equal(state.ok,true);assert.deepEqual(state.data.customProfiles,[profile]);
    assert.deepEqual(C.profileSettings(state.data.settings),profile.settings);
  });
  await t.test('updating an existing profile retains its identity and applies changed preferences',async()=>{
    const result=await send({type:'UI_SAVE_PROFILE',id:profile.id,name:'Focused reading',settings:{threshold:65}});
    assert.equal(result.ok,true,result.error);assert.equal(result.data.profile.id,profile.id);
    assert.equal(result.data.profile.settings.threshold,65);assert.equal(result.data.profile.settings.interests,profile.settings.interests);
    assert.equal(result.data.customProfiles.length,1);assert.equal(stores.local.settings.threshold,65);
    profile=result.data.profile;
  });
  await t.test('invalid names, identities and settings do not change stored profiles or active settings',async()=>{
    const before=structuredClone({profiles:stores.local.customProfiles,settings:stores.local.settings});
    for(const name of [undefined,null,5,'   ','x'.repeat(41)])assert.equal((await send({type:'UI_SAVE_PROFILE',name})).ok,false);
    for(const invalidId of [null,5,'__proto__','constructor','',crypto.randomUUID()]){
      assert.equal((await send({type:'UI_SAVE_PROFILE',id:invalidId,name:'Rejected'})).ok,false);
      assert.equal((await send({type:'UI_DELETE_PROFILE',id:invalidId})).ok,false);
    }
    for(const settings of [null,[],42,'invalid'])assert.equal((await send({type:'UI_SAVE_PROFILE',name:'Rejected',settings})).ok,false);
    assert.deepEqual({profiles:stores.local.customProfiles,settings:stores.local.settings},before);
  });
  await t.test('deleting a saved profile keeps its currently active preferences',async()=>{
    const active=structuredClone(stores.local.settings);
    const result=await send({type:'UI_DELETE_PROFILE',id:profile.id});
    assert.equal(result.ok,true,result.error);assert.deepEqual(result.data.customProfiles,[]);
    assert.deepEqual(stores.local.settings,active);assert.deepEqual((await send({type:'UI_STATE'})).data.customProfiles,[]);
    assert.deepEqual((await send({type:'GET_PUBLIC'},content)).data.quickProfiles,[]);
    assert.equal((await send({type:'SAVE_QUICK_SETTINGS',profile:'saved:'+profile.id},content)).ok,false);
  });
  await t.test('concurrent saves enforce the profile cap without lost writes and allow updates at capacity',async()=>{
    const results=await Promise.all(Array.from({length:21},(_,i)=>send({type:'UI_SAVE_PROFILE',name:'Profile '+i,settings:{threshold:i}})));
    assert.equal(results.filter(result=>result.ok).length,20);
    assert.equal(stores.local.customProfiles.length,20);assert.equal(new Set(stores.local.customProfiles.map(p=>p.id)).size,20);
    const target=stores.local.customProfiles[0];
    const update=await send({type:'UI_SAVE_PROFILE',id:target.id,name:'Updated at capacity',settings:{behavior:'label'}});
    assert.equal(update.ok,true,update.error);assert.equal(update.data.customProfiles.length,20);
    assert.equal(update.data.profile.settings.behavior,'label');assert.equal(stores.local.settings.behavior,'label');
  });
});
