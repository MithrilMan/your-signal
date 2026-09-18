/* Shared, dependency-free logic. Loaded in isolated extension contexts only. */
(() => {
  const KEYS = ['relevance', 'substance', 'actionable', 'promotion', 'bait'];
  const LABELS = {relevance:'Relevance', substance:'Substance', actionable:'Practical value', promotion:'Less promotion', bait:'Less engagement bait'};
  const DEFAULTS = {
    enabled:false,
    interests:'Software development, artificial intelligence, product design',
    weights:{relevance:85,substance:80,actionable:55,promotion:55,bait:80},
    threshold:58, highlightThreshold:78, minimumMargin:0.35, behavior:'dim',
    dailyLimit:1000, searchEnabled:false, showBadges:true, theme:'system'
  };
  const PRESETS = {
    builder:{name:'Builder mode',interests:DEFAULTS.interests,weights:DEFAULTS.weights,threshold:58},
    curious:{name:'Curiosity',interests:'Science, technology, art, books, culture, creative ideas',weights:{relevance:55,substance:65,actionable:20,promotion:35,bait:65},threshold:48},
    focus:{name:'Deep focus',interests:'Programming, software architecture, technical tutorials, reproducible benchmarks',weights:{relevance:100,substance:100,actionable:85,promotion:75,bait:95},threshold:68}
  };
  const PROFILE_KEYS = ['interests','weights','threshold','highlightThreshold','minimumMargin','behavior'];
  function clamp(x, min, max, fallback=min) { return typeof x === 'number' && Number.isFinite(x) ? Math.min(max,Math.max(min,x)) : fallback; }
  function overlayPosition(raw={preset:'top-left'}) {
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||!['top-left','top-right','bottom-left','bottom-right','custom'].includes(raw.preset))throw new Error('Invalid control position.');
    if(raw.preset!=='custom')return {preset:raw.preset};
    if(typeof raw.x!=='number'||!Number.isFinite(raw.x)||typeof raw.y!=='number'||!Number.isFinite(raw.y))throw new Error('Invalid control coordinates.');
    return {preset:'custom',x:clamp(raw.x,0,1),y:clamp(raw.y,0,1)};
  }
  function settings(raw={}) {
    const d=structuredClone(DEFAULTS);
    for(const k of ['enabled','searchEnabled','showBadges']) if(typeof raw[k]==='boolean')d[k]=raw[k];
    if(['dim','collapse','hide','label'].includes(raw.behavior))d.behavior=raw.behavior;
    if(['system','light','dark'].includes(raw.theme))d.theme=raw.theme;
    if(typeof raw.interests==='string')d.interests=raw.interests.slice(0,400).trim();
    d.threshold=clamp(raw.threshold,0,100,d.threshold);
    d.highlightThreshold=clamp(raw.highlightThreshold,0,100,d.highlightThreshold);
    d.minimumMargin=clamp(raw.minimumMargin,0,1,d.minimumMargin);
    d.dailyLimit=Math.round(clamp(raw.dailyLimit,10,10000,d.dailyLimit));
    for(const k of KEYS)d.weights[k]=clamp(raw.weights?.[k],0,100,d.weights[k]);
    return d;
  }
  function profileSettings(raw={}) {
    const input=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    const clean=settings(Object.fromEntries(PROFILE_KEYS.filter(k=>Object.hasOwn(input,k)).map(k=>[k,input[k]])));
    return Object.fromEntries(PROFILE_KEYS.map(k=>[k,clean[k]]));
  }
  function profiles(raw) {
    if(!Array.isArray(raw))return [];
    const result=[],seen=new Set();
    for(const profile of raw){
      if(!profile||typeof profile!=='object'||typeof profile.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(profile.id)||seen.has(profile.id))continue;
      const name=typeof profile.name==='string'?profile.name.trim():'';
      if(!name||name.length>40||!profile.settings||typeof profile.settings!=='object'||Array.isArray(profile.settings))continue;
      result.push({id:profile.id,name,settings:profileSettings(profile.settings)});seen.add(profile.id);
      if(result.length===20)break;
    }
    return result;
  }
  function profileSelection(rawSettings,rawProfiles=[]) {
    const current=settings(rawSettings),saved=profiles(rawProfiles).find(profile=>JSON.stringify(profile.settings)===JSON.stringify(profileSettings(current)));
    if(saved)return `saved:${saved.id}`;
    const preset=Object.entries(PRESETS).find(([,candidate])=>candidate.interests===current.interests&&candidate.threshold===current.threshold&&JSON.stringify(candidate.weights)===JSON.stringify(current.weights));
    return preset?`preset:${preset[0]}`:'';
  }
  function validMetrics(m) {
    if(!m || typeof m!=='object')throw new Error('Incomplete response from Jev.');
    const clean={};
    for(const k of KEYS) {
      if(typeof m[k]!=='number'||!Number.isFinite(m[k])||m[k]<0||m[k]>1)throw new Error('Invalid Jev probability.');
      clean[k]=m[k];
    }
    return clean;
  }
  function decision(metrics, config) {
    const m=validMetrics(metrics), s=settings(config);
    let sum=0,margin=0,total=0;
    for(const k of KEYS) {
      const w=s.weights[k], value=['promotion','bait'].includes(k)?1-m[k]:m[k];
      sum+=value*w; margin+=Math.abs(2*m[k]-1)*w; total+=w;
    }
    if(!total)return {score:50,margin:0,action:'uncertain'};
    const score=Math.round(sum/total*100), certainty=margin/total;
    // A heuristic decision margin, NOT calibrated accuracy or probability of truth.
    const action=certainty<s.minimumMargin?'uncertain':score<s.threshold?'low':score>=s.highlightThreshold?'highlight':'normal';
    return {score,margin:certainty,action};
  }
  function cleanPost(p) {
    if(!p || typeof p.text!=='string' || p.text.trim().length<3 || p.text.length>6000 || typeof p.id!=='string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(p.id))throw new Error('Invalid post.');
    return {id:p.id,text:p.text,has_link:p.has_link===true,has_media:p.has_media===true,truncated:p.truncated===true};
  }
  function questions(rubric) {
    return Object.fromEntries(KEYS.map(k=>[k,{...rubric.questions[k],instructions:rubric.preamble+rubric.questions[k].instructions}]));
  }
  function request(post,interests,rubric) {
    const {id,...data}=cleanPost(post);
    return {model:rubric.model,state:{post:data,reader_interests:interests.slice(0,400)},questions:questions(rubric)};
  }
  function parseJev(body) {
    if(!body || typeof body.model!=='string')throw new Error('Missing model in the Jev response.');
    const m={};
    for(const k of KEYS) {
      if(body.answers?.[k]?.type!=='noul')throw new Error('Unexpected Jev response type.');
      m[k]=body.answers[k].noul;
    }
    return {metrics:validMetrics(m),model:body.model,input_tokens:Number.isInteger(body.usage?.input_tokens)&&body.usage.input_tokens>=0?body.usage.input_tokens:0};
  }
  async function hash(value) {
    const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)));
    return Array.from(new Uint8Array(d),x=>x.toString(16).padStart(2,'0')).join('');
  }
  function routeAllowed(path,s) {return path==='/home'||path==='/home/'||(s.searchEnabled===true&&path==='/search');}
  globalThis.OYA = Object.freeze({KEYS,LABELS,DEFAULTS,PRESETS,settings,profileSettings,profiles,profileSelection,overlayPosition,decision,cleanPost,questions,request,parseJev,validMetrics,hash,routeAllowed});
})();
