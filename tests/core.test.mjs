import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../extension/core.js';
const C=globalThis.OYA;
const rubric=JSON.parse(await readFile(new URL('../shared/rubric.json',import.meta.url)));
const good={relevance:.95,substance:.95,actionable:.95,promotion:.05,bait:.05};
const bad={relevance:.1,substance:.1,actionable:.1,promotion:.9,bait:.9};

test('profile settings contain only normalized filter preferences',()=>{
  const profile=C.profileSettings({...C.DEFAULTS,interests:'  engineering  ',threshold:150,minimumMargin:-1,weights:{bait:999},jevKey:'secret'});
  assert.deepEqual(Object.keys(profile),['interests','weights','threshold','highlightThreshold','minimumMargin','behavior']);
  assert.equal(profile.interests,'engineering');assert.equal(profile.threshold,100);assert.equal(profile.minimumMargin,0);
  assert.equal(profile.weights.bait,100);assert.equal(profile.weights.relevance,C.DEFAULTS.weights.relevance);
  assert.equal(JSON.stringify(profile).includes('secret'),false);
  assert.deepEqual(C.profileSettings(null),C.profileSettings(C.DEFAULTS));
});

test('stored profiles reject invalid identities and names, deduplicate and strip extra data',()=>{
  const id=crypto.randomUUID(),valid={id,name:'  My profile  ',settings:{...C.DEFAULTS,jevKey:'secret'},jevKey:'secret'};
  const profiles=C.profiles([null,{}, {...valid,id:'__proto__'},{...valid,id:crypto.randomUUID(),name:' '},{...valid,id:crypto.randomUUID(),name:'x'.repeat(41)},{...valid,id:crypto.randomUUID(),settings:[]},valid,{...valid,name:'Duplicate'}]);
  assert.deepEqual(profiles,[{id,name:'My profile',settings:C.profileSettings(C.DEFAULTS)}]);
  assert.deepEqual(C.profiles({}),[]);
  assert.equal(C.profiles(Array.from({length:25},()=>({...valid,id:crypto.randomUUID()}))).length,20);
});
test('default settings are off and follow system appearance',()=>{assert.equal(C.DEFAULTS.enabled,false);assert.equal(C.DEFAULTS.searchEnabled,false);assert.equal(C.DEFAULTS.hideAds,false);assert.equal(C.DEFAULTS.theme,'system');assert.equal(C.settings({theme:'dark'}).theme,'dark');assert.equal(C.settings({theme:'neon'}).theme,'system');});
test('ad removal is a normalized local setting outside saved scoring profiles',()=>{assert.equal(C.settings({hideAds:true}).hideAds,true);assert.equal(Object.hasOwn(C.profileSettings({...C.DEFAULTS,hideAds:true}),'hideAds'),false);});
test('hide is preserved in settings and saved profiles without changing the default',()=>{
  assert.equal(C.settings({behavior:'hide'}).behavior,'hide');assert.equal(C.profileSettings({behavior:'hide'}).behavior,'hide');assert.equal(C.DEFAULTS.behavior,'dim');
});
test('active profile selection survives reloads and ignores global appearance',()=>{
  const id=crypto.randomUUID(),saved={id,name:'Night reading',settings:C.profileSettings({...C.DEFAULTS,threshold:64,behavior:'label'})};
  assert.equal(C.profileSelection({...C.DEFAULTS,theme:'dark'}),'preset:builder');
  assert.equal(C.profileSelection({...C.DEFAULTS,...saved.settings,theme:'light'},[saved]),'saved:'+id);
  assert.equal(C.profileSelection({...C.DEFAULTS,interests:'Something else'},[saved]),'');
});
test('overlay positions whitelist corners and clamp finite custom coordinates',()=>{
  assert.deepEqual(C.overlayPosition(),{preset:'top-left'});
  for(const preset of ['top-left','top-right','bottom-left','bottom-right'])assert.deepEqual(C.overlayPosition({preset,settings:{enabled:true},x:99}),{preset});
  assert.deepEqual(C.overlayPosition({preset:'custom',x:-10,y:8,secret:'discard'}),{preset:'custom',x:0,y:1});
  for(const value of [null,[],42,{preset:'unknown'},{preset:'custom',x:NaN,y:0},{preset:'custom',x:0,y:Infinity},{preset:'custom',x:'0',y:0},{preset:'custom',x:0}])assert.throws(()=>C.overlayPosition(value));
});
test('high quality signals highlight',()=>{assert.equal(C.decision(good,C.DEFAULTS).score,95);assert.equal(C.decision(good,C.DEFAULTS).action,'highlight');});
test('low signals follow threshold',()=>{assert.equal(C.decision(bad,C.DEFAULTS).score,10);assert.equal(C.decision(bad,C.DEFAULTS).action,'low');});
test('ambiguous probabilities abstain',()=>{assert.equal(C.decision(Object.fromEntries(C.KEYS.map(k=>[k,.5])),C.DEFAULTS).action,'uncertain');});
test('zero weights abstain without NaN',()=>{const d=C.decision(good,{weights:Object.fromEntries(C.KEYS.map(k=>[k,0]))});assert.equal(d.action,'uncertain');assert.ok(Number.isFinite(d.score));});
test('changing only weights never changes inference request',()=>{const p={id:'1',text:'An example of caching.'};const a=C.request(p,'software',rubric);C.decision(good,{weights:{relevance:5}});assert.deepEqual(a,C.request(p,'software',rubric));});
test('API request matches the documented Noul shape',()=>{const r=C.request({id:'123',text:'A concrete coding example.'},'software',rubric);assert.equal(r.model,'jev-1.13.0');assert.equal(Object.keys(r.questions).length,5);assert.ok(!('id' in r.state.post));for(const q of Object.values(r.questions)){assert.equal(q.type,'noul');assert.ok(q.instructions.includes('untrusted'));assert.deepEqual(Object.keys(q.criteria),['true','false']);}});
test('response parser rejects missing answers and out-of-range values',()=>{assert.throws(()=>C.parseJev({model:'jev'}));assert.throws(()=>C.validMetrics({...good,bait:1.01}));assert.throws(()=>C.validMetrics({...good,bait:NaN}));assert.throws(()=>C.validMetrics({...good,bait:'0.4'}));});
test('response parser accepts probability field noul',()=>{assert.deepEqual(C.parseJev({model:'jev-1.13.0',answers:Object.fromEntries(C.KEYS.map(k=>[k,{type:'noul',noul:good[k]}])),usage:{input_tokens:512}}).metrics,good);});
test('bounds prevent runaway requests and unbounded settings',()=>{const s=C.settings({interests:'x'.repeat(2000),dailyLimit:999999,threshold:-50,weights:{bait:999}});assert.equal(s.interests.length,400);assert.equal(s.dailyLimit,10000);assert.equal(s.threshold,0);assert.equal(s.weights.bait,100);});
test('messages, notifications, profiles and status views are excluded',()=>{for(const p of ['/messages','/i/chat','/notifications','/person','/person/status/123','/compose/post'])assert.equal(C.routeAllowed(p,{searchEnabled:true}),false);assert.equal(C.routeAllowed('/home',{}),true);assert.equal(C.routeAllowed('/search',{}),false);assert.equal(C.routeAllowed('/search',{searchEnabled:true}),true);});
test('posts are validated and metadata minimized',()=>{assert.throws(()=>C.cleanPost({id:'1',text:'x'.repeat(6001)}));assert.throws(()=>C.cleanPost({id:'../escape',text:'hello'}));assert.deepEqual(Object.keys(C.cleanPost({id:'123',text:'hello',author:'ignore me',cookies:'secret'})),['id','text','has_link','has_media','truncated']);});
test('cache hash is stable and changes with content',async()=>{assert.equal(await C.hash('a'),await C.hash('a'));assert.notEqual(await C.hash('a'),await C.hash('b'));});
test('the deployed rubric matches its source',async()=>{const deployed=await readFile(new URL('../extension/rubric.json',import.meta.url),'utf8');assert.deepEqual(JSON.parse(deployed),rubric);});
