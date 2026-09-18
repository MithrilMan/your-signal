(() => {
  const C=globalThis.OYA,A=globalThis.OYA_X;
  let state,quickProfiles=[],activeQuickProfile='',revision='',generation=0,route='',timer,active=0,lastError='';
  const records=new Map(),queue=new Set(),revealedPosts=new Map(),hiddenContainers=new WeakMap(),adContainers=new Map(),adsByContainer=new WeakMap();
  const MAX_RECORDS=350,MAX_REVEALS=350;
  const asset=path=>chrome.runtime.getURL?.(path)||'';
  const systemThemeQuery=matchMedia('(prefers-color-scheme: dark)');
  const markUrl=asset('assets/signal-mark.svg');
  const paperUrl=asset('assets/paper-grain-surface-768x768.webp');
  const uiFont='"Your Signal UI", "Segoe UI", Arial, sans-serif';
  if(chrome.runtime.getURL&&typeof FontFace==='function'){
    const font=new FontFace('Your Signal UI',`url("${asset('assets/fonts/instrument-sans-latin.woff2')}")`,{weight:'400 700'});
    document.fonts.add(font);font.load().catch(()=>{});
  }
  const annotationStyles=`
    :host{all:initial;display:block;position:absolute;inset:0 auto 0 0;width:32px;color:var(--oya-post-ink,#f3f0ed);font:14px/1.4 ${uiFont};color-scheme:light}
    :host([data-collapsed]){position:relative;inset:auto;z-index:2;width:100%;min-height:88px;overflow:visible}
    *{box-sizing:border-box}button{font:inherit;cursor:pointer}button:focus-visible{outline:3px solid #8c9ff1;outline-offset:2px}
    .rail{position:absolute;z-index:5;inset:0 auto 0 0;width:32px;border-right:1px solid #8b889224;display:flex;justify-content:center;align-items:flex-start;padding-top:10px}
    .score{position:relative;display:grid;place-items:center;padding:0;width:32px;min-height:60px;background:transparent;border:0;color:inherit;font:600 13px/1 ${uiFont}}
    .score::before{content:"";position:absolute;left:0;top:0;width:4px;height:60px;border-radius:0 4px 4px 0;background:#a3a0ae}
    .highlight::before{background:#f78174}.low::before{background:#a5b79b}.uncertain::before{background:#e2bd69}
    .score:hover{background:#8c88921a}.score:focus-visible{outline-offset:-3px;border-radius:3px}
    .summary{position:relative;z-index:3;margin-left:32px;min-height:88px;padding:14px 18px 14px 28px;display:flex;align-items:center;gap:22px;background:#f3ede2 url("${paperUrl}") center/480px;border-radius:5px;color:#2d293b;transform-origin:50% 0;backface-visibility:hidden;transition:background-position .45s cubic-bezier(.2,.8,.2,1),border-radius .25s ease}
    .summary::after{content:"";position:absolute;right:0;top:0;width:28px;height:28px;background:#9aa9d5;clip-path:polygon(0 0,100% 0,100% 100%);opacity:.65;border-top-right-radius:5px;pointer-events:none}
    :host([data-peeking]) .summary{background-position:center 22px;border-radius:5px 5px 2px 2px;clip-path:polygon(1.5% 0,98.5% 0,100% 100%,0 100%);transform:perspective(900px) translateY(-6px) rotateX(-6deg) scaleX(.986);box-shadow:0 7px 0 #75638eb8,0 19px 28px #17101f59}
    :host([data-peeking]:not([data-peek-closing]):not([data-peek-stable])) .summary{animation:oya-flap-lift .62s cubic-bezier(.18,.88,.2,1.12) both}
    :host([data-peek-closing]) .summary{animation:oya-flap-settle .36s cubic-bezier(.55,0,.78,.2) both}
    .peek-frame{position:absolute;z-index:2;left:38px;right:7px;top:83px;height:calc(max(0px,var(--oya-peek-height,88px) - 89px));border:1px solid #a498c8c2;border-top:0;border-radius:0 0 10px 10px;background:linear-gradient(145deg,#9d8bcf38,#b9c4ef24 58%,#8d7ead30);box-shadow:inset 5px 0 0 #8d79b252,inset -5px 0 0 #9aa9d53d,inset 0 -5px 0 #8d79b247,0 13px 26px #160f1f33;opacity:0;overflow:hidden;pointer-events:none;transform-origin:50% 0}
    .peek-frame::before{content:"";position:absolute;left:-35%;top:0;width:32%;height:2px;background:linear-gradient(90deg,transparent,#d8ddff,#fff,transparent);filter:drop-shadow(0 0 6px #aeb8ff);opacity:0}
    :host([data-peeking]) .peek-frame{opacity:1}:host([data-peeking]:not([data-peek-closing]):not([data-peek-stable])) .peek-frame{animation:oya-tray-open .64s .06s cubic-bezier(.18,.9,.2,1.08) both}:host([data-peek-closing]) .peek-frame{animation:oya-tray-close .3s cubic-bezier(.55,0,.78,.2) both}:host([data-peeking]:not([data-peek-closing]):not([data-peek-stable])) .peek-frame::before{animation:oya-aperture-trace .78s .1s cubic-bezier(.2,.8,.2,1) both}
    .mark{width:104px;flex:none;display:grid;place-items:center;border-right:1px solid #756d7038;padding-right:20px}.mark img{display:block;width:64px;height:58px;object-fit:contain}
    .copy{flex:1;min-width:0}.label{font-size:16px;font-weight:650;line-height:1.35}.subtitle{margin-top:3px;font-size:13px;color:#6c6874}
    .reveal{flex:none;min-height:40px;border:1px solid #d8d1c8;border-radius:8px;background:#fffaf3;color:#302c3e;padding:8px 14px;font-size:13px;font-weight:600;box-shadow:0 3px 9px #40342a12}
    .reveal:hover{background:#fff}.reveal:active{box-shadow:none}
    .summary-actions{display:flex;align-items:center;gap:8px;flex:none}.peek{position:relative;isolation:isolate;display:flex;align-items:center;gap:8px;min-height:40px;padding:8px 13px;border:1px solid #806b8b;border-radius:999px;background:#4d3e58;color:#fff;font-size:13px;font-weight:700;box-shadow:0 5px 13px #3e30402e;overflow:visible;transition:transform .22s cubic-bezier(.2,.8,.2,1),box-shadow .22s ease,background .22s ease}
    .peek::before{content:"";position:absolute;z-index:-1;width:26px;height:26px;left:7px;top:6px;border:1px solid #b8c2f1;border-radius:50%;box-shadow:0 0 0 7px #9aa9d529,0 0 0 14px #9aa9d514;opacity:0;transform:scale(.35);transition:transform .45s cubic-bezier(.2,.9,.2,1),opacity .3s ease}.peek:hover,.peek:focus-visible{transform:translateY(-2px);background:#5a4867;box-shadow:0 9px 20px #3e30403d}.peek:hover::before,.peek:focus-visible::before,.peek[aria-expanded=true]::before{transform:scale(1.35);opacity:.72}.peek[aria-pressed=true]{background:#6a5478;border-color:#6a5478}
    .peek-eye{position:relative;width:18px;height:12px;flex:none;border:1.8px solid currentColor;border-radius:70% 25% 70% 25%;transform:rotate(45deg);transition:transform .32s cubic-bezier(.2,.8,.2,1)}.peek-eye::after{content:"";position:absolute;width:5px;height:5px;left:4.7px;top:1.7px;border-radius:50%;background:currentColor}.peek:hover .peek-eye,.peek:focus-visible .peek-eye,.peek[aria-expanded=true] .peek-eye{transform:rotate(45deg) scale(1.12)}
    :host([data-peeking]:not([data-peek-closing]):not([data-peek-stable])) .peek::before{animation:oya-signal-pulse .62s cubic-bezier(.16,.82,.3,1) both}:host([data-peeking]:not([data-peek-closing]):not([data-peek-stable])) .peek-eye{animation:oya-eye-open .5s cubic-bezier(.16,.82,.3,1.16) both}
    .details{position:fixed;inset:auto;margin:0;width:300px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;padding:20px;border:1px solid #d4ccbf;border-radius:12px;background:#f8f2e8 url("${paperUrl}") center/480px;color:#302c3e;box-shadow:0 12px 36px #09071140;font:14px/1.5 ${uiFont}}
    .details::backdrop{background:transparent}.detail-heading{margin:0 30px 4px 0;font-weight:650;font-size:16px}.detail-status{color:#6c6470;margin:0 0 14px;font-size:13px}.row{display:flex;justify-content:space-between;gap:16px;padding:5px 0;border-bottom:1px solid #53465318}.value{font-variant-numeric:tabular-nums;font-weight:600}
    .note{margin:14px 0 0;font-size:12px;color:#625b68;line-height:1.55}.provenance{margin-top:8px;font-size:11px;color:#706773;overflow-wrap:anywhere}.details .reveal{margin-top:16px;width:100%}
    .close{position:absolute;right:9px;top:9px;width:32px;height:32px;padding:0;border:0;border-radius:50%;background:transparent;color:#655b6b;font-size:23px;line-height:1}.close:hover{background:#ded4c5}
    @media(max-width:620px){.summary{padding:10px 12px;gap:8px}.mark{display:none}.copy{min-width:70px}.summary-actions{gap:6px}.label{font-size:14px}.subtitle{font-size:11px}.reveal,.peek{min-height:36px;padding:7px 8px;font-size:11px}.peek{gap:6px}.peek-eye{width:15px;height:10px}.peek-eye::after{width:4px;height:4px;left:4px;top:1.2px}}
    @media(max-width:350px){.subtitle{display:none}}
    @keyframes oya-flap-lift{0%{transform:perspective(900px) translateY(0) rotateX(0) scaleX(1);clip-path:polygon(0 0,100% 0,100% 100%,0 100%);box-shadow:0 0 0 #75638e00,0 3px 8px #17101f00}18%{transform:perspective(900px) translateY(-1px) rotateX(1.5deg) scaleX(.998)}48%{transform:perspective(900px) translateY(-12px) rotateX(-12deg) scaleX(.979);clip-path:polygon(2% 0,98% 0,100% 100%,0 100%);box-shadow:0 10px 0 #75638ec7,0 26px 34px #17101f66}74%{transform:perspective(900px) translateY(-4px) rotateX(-4deg) scaleX(.989);box-shadow:0 5px 0 #75638ea0,0 15px 22px #17101f4a}100%{transform:perspective(900px) translateY(-6px) rotateX(-6deg) scaleX(.986);clip-path:polygon(1.5% 0,98.5% 0,100% 100%,0 100%);box-shadow:0 7px 0 #75638eb8,0 19px 28px #17101f59}}
    @keyframes oya-flap-settle{0%{transform:perspective(900px) translateY(-6px) rotateX(-6deg) scaleX(.986);clip-path:polygon(1.5% 0,98.5% 0,100% 100%,0 100%);box-shadow:0 7px 0 #75638eb8,0 19px 28px #17101f59}38%{transform:perspective(900px) translateY(-9px) rotateX(-9deg) scaleX(.982);box-shadow:0 9px 0 #75638ec0,0 23px 31px #17101f62}100%{transform:perspective(900px) translateY(0) rotateX(0) scaleX(1);clip-path:polygon(0 0,100% 0,100% 100%,0 100%);box-shadow:0 0 0 #75638e00,0 3px 8px #17101f00}}
    @keyframes oya-tray-open{0%{opacity:0;transform:translateY(-14px) scaleY(.45)}58%{opacity:1;transform:translateY(3px) scaleY(1.025)}100%{opacity:1;transform:translateY(0) scaleY(1)}}
    @keyframes oya-tray-close{from{opacity:1;transform:translateY(0) scaleY(1)}to{opacity:0;transform:translateY(-10px) scaleY(.55)}}
    @keyframes oya-signal-pulse{0%{opacity:0;transform:scale(.25)}42%{opacity:.9;transform:scale(1.72)}100%{opacity:.72;transform:scale(1.35)}}
    @keyframes oya-eye-open{0%{transform:rotate(45deg) scaleY(.12)}52%{transform:rotate(45deg) scale(1.28)}100%{transform:rotate(45deg) scale(1.12)}}
    @keyframes oya-aperture-trace{0%{transform:translateX(0);opacity:0}18%{opacity:.95}100%{transform:translateX(420%);opacity:0}}
    @media(prefers-reduced-motion:reduce){.summary,.peek-frame,.peek,.peek::before,.peek-eye{transition:none;animation:none!important}.peek:hover,.peek:focus-visible{transform:none}.peek-frame::before{animation:none!important}}
    :host([data-theme=dark]){color-scheme:dark}
    :host([data-theme=dark]) .summary{color:#f3edf5;background-color:#29262f;background-image:linear-gradient(#29262fe8,#29262fe8),url("${paperUrl}");background-position:center;background-size:auto,480px;background-blend-mode:normal,soft-light}
    :host([data-theme=dark]) .summary::after{background:#8798d4;opacity:.8}
    :host([data-theme=dark]) .subtitle,:host([data-theme=dark]) .detail-status,:host([data-theme=dark]) .note,:host([data-theme=dark]) .provenance{color:#bcb3c2}
    :host([data-theme=dark]) .reveal{border-color:#625a68;background:#37323c;color:#f7f0f8;box-shadow:0 3px 12px #0005}
    :host([data-theme=dark]) .reveal:hover{background:#433c49}
    :host([data-theme=dark]) .peek{border-color:#a28eb4;background:#6d587a;color:#fff}
    :host([data-theme=dark]) .peek:hover,:host([data-theme=dark]) .peek:focus-visible{background:#7b6489}
    :host([data-theme=dark]) .details{border-color:#5d5662;background-color:#28252d;background-image:linear-gradient(#28252de8,#28252de8),url("${paperUrl}");background-position:center;background-size:auto,480px;background-blend-mode:normal,soft-light;color:#f3edf5;box-shadow:0 14px 40px #0009}
    :host([data-theme=dark]) .row{border-bottom-color:#ffffff16}
    :host([data-theme=dark]) .close{color:#d5cbd9}:host([data-theme=dark]) .close:hover{background:#ffffff12}
    :host([data-theme=dark]) .peek-frame{border-color:#817393;background:linear-gradient(145deg,#6e5c8a55,#4e587855 58%,#66587552);box-shadow:inset 5px 0 0 #8d79b252,inset -5px 0 0 #9aa9d53d,inset 0 -5px 0 #8d79b247,0 15px 32px #0008}
    @media(forced-colors:active){.rail{border-color:CanvasText}.score::before{background:Highlight}.summary,.details{border:1px solid CanvasText}.reveal{border-color:ButtonText}}
  `;
  async function send(type,extra={}){
    const r=await chrome.runtime.sendMessage({type,...extra});
    if(!r?.ok)throw new Error(r?.error||'Extension unavailable.');return r.data;
  }
  function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
  const chip=document.createElement('div');
  chip.id='oya-control';
  const chipShadow=chip.attachShadow({mode:'closed'});
  const chipStyle=el('style');chipStyle.textContent=`
    :host{all:initial;position:fixed;top:16px;left:16px;z-index:2147483000;color-scheme:light}:host([hidden]){display:none}
    *{box-sizing:border-box}button{font:12px/1.4 ${uiFont};cursor:pointer}button:focus-visible{outline:3px solid #98aaf0;outline-offset:2px}
    .control{display:flex;align-items:stretch;max-width:calc(100vw - 24px);border:1px solid #49454f;border-radius:24px;background:#212126;box-shadow:0 3px 14px #0002;touch-action:none;user-select:none}
    .main{display:flex;align-items:center;gap:8px;min-height:40px;min-width:0;border:0;border-radius:24px 0 0 24px;background:transparent;color:#f3eff0;padding:7px 11px;cursor:grab}
    .main:hover,.position:hover{background:#2b2932}.main img{width:24px;height:24px;flex:none;object-fit:contain}.brand{font-weight:600;white-space:nowrap}.status{color:#d3cfd7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dot{width:7px;height:7px;flex:none;border-radius:50%;background:#afc599}.paused .dot{background:#e7bf68}.error .dot{background:#f78174}
    .position{display:grid;place-items:center;flex:none;width:30px;min-height:40px;border:0;border-left:1px solid #49454f;border-radius:0 24px 24px 0;background:transparent;color:#d0c6d6;padding:0 7px 0 5px;cursor:grab}.grip{width:12px;height:18px;background:radial-gradient(circle,#b9adbf 1.3px,transparent 1.5px) 0 0/6px 6px}
    :host([data-dragging]) .main,:host([data-dragging]) .position{cursor:grabbing}:host([data-position-error]) .position{color:#efbd64;border-left-color:#c39952}
    .quick-menu,.position-menu{position:fixed;inset:auto;margin:0;width:300px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;padding:20px;border:1px solid #d4ccbf;border-radius:12px;background:#f8f2e8 url("${paperUrl}") center/480px;color:#302c3e;box-shadow:0 12px 36px #09071140;font:14px/1.45 ${uiFont}}
    .quick-menu::backdrop,.position-menu::backdrop{background:transparent}.quick-menu h2,.position-menu h2{font-size:16px;margin:0 24px 7px 0}.position-menu p{margin:0 0 14px;color:#655b6b;font-size:12px}.corners{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .quick-menu{width:340px}.quick-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.quick-head h2{margin:0}.quick-toggle{min-height:34px;padding:7px 12px;border:1px solid #b78b82;border-radius:18px;background:#f4c8b9;color:#493840;font-weight:650}.quick-toggle[aria-checked=true]{border-color:#829376;background:#d9e2ce}.quick-field{display:grid;gap:7px;margin-top:14px}.quick-field>span{font-size:12px;font-weight:650}.quick-field select,.quick-field textarea{width:100%;padding:8px 10px;border:1px solid #c9bdb3;border-radius:7px;background:#fffcf6;color:#342d3b;font:13px/1.4 ${uiFont}}.quick-field select{min-height:40px}.quick-field textarea{min-height:66px;resize:vertical}.field-note{display:flex;justify-content:space-between;gap:12px;color:#716977;font-size:10px}.tune-details{margin-top:14px;border:1px solid #d4cabd;border-radius:8px;background:#ffffff70}.tune-details>summary{cursor:pointer;padding:10px 12px;font-size:12px;font-weight:650}.tune-body{padding:0 12px 12px}.tune-body .quick-field{margin-top:8px}.quick-weights{display:grid;gap:8px;margin-top:12px}.quick-weight{display:grid;grid-template-columns:78px 1fr 32px;align-items:center;gap:8px;font-size:11px}.quick-weight input{width:100%;accent-color:#766081}.quick-weight output{text-align:right;font-weight:650;font-variant-numeric:tabular-nums}.threshold-line{display:grid;grid-template-columns:1fr 42px;gap:10px;align-items:center}.threshold-line input{width:100%;accent-color:#766081}.threshold-line output{text-align:center;font-weight:700;font-variant-numeric:tabular-nums}.behavior-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.behavior-grid button{min-height:37px;padding:7px;border:1px solid #c9bdb3;border-radius:7px;background:#fffcf6;color:#403546}.behavior-grid button[aria-pressed=true]{border-color:#766081;background:#e9dfeb;font-weight:650}.ad-toggle{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:42px;margin-top:14px;padding:8px 11px;border:1px solid #c9bdb3;border-radius:7px;background:#fffcf6;color:#403546;font-weight:650}.ad-toggle::after{content:"Off";min-width:38px;padding:3px 7px;border-radius:12px;background:#eee5d8;color:#655b6b;font-size:10px}.ad-toggle[aria-checked=true]{border-color:#829376;background:#eef3e8}.ad-toggle[aria-checked=true]::after{content:"On";background:#cfddc5;color:#3d5635}.quick-actions{display:flex;gap:8px;margin-top:16px}.quick-actions button{min-height:39px;padding:8px 11px;border:1px solid #c9bdb3;border-radius:7px;background:#fffcf6;color:#403546;font-weight:600}.quick-actions .advanced{flex:1}.quick-status{min-height:17px;margin:10px 0 0;color:#655b6b;font-size:11px}.quick-status.error{color:#9b493e}
    .corner,.reset{min-height:42px;border:1px solid #d4cabd;border-radius:7px;background:#fffcf6;color:#403546;padding:9px 10px;text-align:left}.corner{display:flex;gap:8px;align-items:center}.corner[aria-pressed=true]{border-color:#84718e;background:#e9dfeb}.corner:hover,.reset:hover{background:#eee5d8}
    .corner-icon{position:relative;width:20px;height:16px;flex:none;border:1px solid #96889c;border-radius:2px}.corner-icon::after{content:"";position:absolute;top:2px;left:2px;width:6px;height:4px;background:#67536f;border-radius:1px}.top-right .corner-icon::after,.bottom-right .corner-icon::after{left:auto;right:2px}.bottom-left .corner-icon::after,.bottom-right .corner-icon::after{top:auto;bottom:2px}
    .reset,.show-hidden{display:block;width:100%;margin-top:10px;text-align:center}.show-hidden{min-height:42px;margin:0 0 18px;border:1px solid #ac94af;border-radius:7px;background:#e8dce9;color:#403546;font-weight:600}.show-hidden[hidden]{display:none}.position-menu .keys{font-size:11px;margin-top:14px;line-height:1.6}.position-menu .save-status{margin-bottom:0;font-size:11px;min-height:16px}.close{position:absolute;right:9px;top:9px;width:30px;height:30px;border:0;border-radius:50%;background:transparent;color:#655b6b;font-size:23px;padding:0}.close:hover{background:#ded4c5}
    .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
    :host([data-theme=dark]){color-scheme:dark}
    :host([data-theme=dark]) .quick-menu,:host([data-theme=dark]) .position-menu{border-color:#5d5662;background-color:#28252d;background-image:linear-gradient(#28252de8,#28252de8),url("${paperUrl}");background-position:center;background-size:auto,480px;background-blend-mode:normal,soft-light;color:#f3edf5;box-shadow:0 14px 40px #0009}
    :host([data-theme=dark]) .quick-menu p,:host([data-theme=dark]) .position-menu p,:host([data-theme=dark]) .field-note{color:#bcb3c2}
    :host([data-theme=dark]) .quick-field select,:host([data-theme=dark]) .quick-field textarea{border-color:#635b68;background:#343039;color:#f4eef6}
    :host([data-theme=dark]) .tune-details{border-color:#5d5662;background:#ffffff08}
    :host([data-theme=dark]) .quick-toggle{border-color:#8e6d66;background:#6a4642;color:#fff0eb}
    :host([data-theme=dark]) .quick-toggle[aria-checked=true]{border-color:#74856d;background:#3d523c;color:#eef7ea}
    :host([data-theme=dark]) .behavior-grid button,:host([data-theme=dark]) .ad-toggle,:host([data-theme=dark]) .quick-actions button,:host([data-theme=dark]) .corner,:host([data-theme=dark]) .reset{border-color:#635b68;background:#343039;color:#f3edf5}
    :host([data-theme=dark]) .behavior-grid button[aria-pressed=true],:host([data-theme=dark]) .corner[aria-pressed=true]{border-color:#a38caf;background:#51445a}
    :host([data-theme=dark]) .ad-toggle[aria-checked=true]{border-color:#74856d;background:#354534}
    :host([data-theme=dark]) .show-hidden{border-color:#917c99;background:#4c3f53;color:#f3edf5}
    :host([data-theme=dark]) .close{color:#d5cbd9}:host([data-theme=dark]) .close:hover{background:#ffffff12}
    @media(forced-colors:active){.control,.quick-menu,.position-menu,.corner,.reset,.quick-toggle,.ad-toggle,.behavior-grid button,.quick-actions button,.tune-details{border-color:CanvasText}.grip{background:ButtonText}.corner[aria-pressed=true],.behavior-grid button[aria-pressed=true],.ad-toggle[aria-checked=true]{outline:2px solid Highlight}}
  `;
  const control=el('div','','control'),chipButton=el('button','','main'),positionButton=el('button','','position');
  chipButton.type='button';
  positionButton.type='button';positionButton.title='Drag to move, or open control options';positionButton.setAttribute('aria-label','Your Signal control options and position');positionButton.setAttribute('aria-expanded','false');positionButton.setAttribute('aria-controls','signal-position');positionButton.setAttribute('aria-describedby','position-keys');positionButton.append(el('span','','grip'));
  const quickMenu=el('div','','quick-menu');quickMenu.id='signal-quick';quickMenu.popover='auto';quickMenu.setAttribute('role','group');quickMenu.setAttribute('aria-labelledby','quick-heading');
  const quickHead=el('div','','quick-head'),quickHeading=el('h2','Tune this feed');quickHeading.id='quick-heading';
  const quickToggle=el('button','','quick-toggle');quickToggle.type='button';quickToggle.setAttribute('role','switch');
  quickHead.append(quickHeading,quickToggle);
  const profileField=el('label','','quick-field'),profileLabel=el('span','Apply a profile'),profileSelect=el('select');profileSelect.setAttribute('aria-label','Apply a profile');profileField.append(profileLabel,profileSelect);
  const themeField=el('label','','quick-field'),themeLabel=el('span','Appearance'),themeSelect=el('select');themeSelect.setAttribute('aria-label','Appearance');themeSelect.append(option('system','System'),option('light','Light'),option('dark','Dark'));themeField.append(themeLabel,themeSelect);
  const tuneDetails=el('details','','tune-details'),tuneSummary=el('summary','Fine tune target & signals'),tuneBody=el('div','','tune-body');
  const interestsField=el('label','','quick-field'),interestsLabel=el('span','Target interests'),quickInterests=el('textarea'),interestsNote=el('span','','field-note'),interestsCount=el('span','0 / 400');
  quickInterests.rows=3;quickInterests.maxLength=400;quickInterests.placeholder='Software, science, thoughtful design…';quickInterests.setAttribute('aria-describedby','quick-interest-note');interestsNote.id='quick-interest-note';interestsNote.append(el('span','Changing this re-evaluates posts.'),interestsCount);interestsField.append(interestsLabel,quickInterests,interestsNote);
  const weightLabels={relevance:'Relevance',substance:'Substance',actionable:'Utility',promotion:'Less promotion',bait:'Less bait'},quickWeights=el('div','','quick-weights'),weightInputs={};quickWeights.setAttribute('role','group');quickWeights.setAttribute('aria-label','Preference weights');
  for(const key of C.KEYS){const row=el('label','','quick-weight'),label=el('span',weightLabels[key]),input=el('input'),output=el('output');input.type='range';input.min='0';input.max='100';input.step='5';input.dataset.weight=key;input.setAttribute('aria-label',weightLabels[key]);output.htmlFor=input.id=`quick-weight-${key}`;row.append(label,input,output);quickWeights.append(row);weightInputs[key]={input,output};}
  const marginField=el('label','','quick-field'),marginLabel=el('span','Uncertainty guard'),marginLine=el('div','','threshold-line'),marginInput=el('input'),marginOutput=el('output'),marginNote=el('span','Higher leaves more ambiguous posts unchanged.','field-note');marginInput.type='range';marginInput.min='0';marginInput.max='100';marginInput.step='5';marginInput.setAttribute('aria-label','Uncertainty guard');marginLine.append(marginInput,marginOutput);marginField.append(marginLabel,marginLine,marginNote);
  tuneBody.append(interestsField,quickWeights,marginField);tuneDetails.append(tuneSummary,tuneBody);
  const thresholdField=el('label','','quick-field'),thresholdLabel=el('span','Feed threshold'),thresholdLine=el('div','','threshold-line'),thresholdInput=el('input'),thresholdOutput=el('output');thresholdInput.type='range';thresholdInput.min='0';thresholdInput.max='100';thresholdInput.step='1';thresholdInput.setAttribute('aria-label','Feed threshold');thresholdLine.append(thresholdInput,thresholdOutput);thresholdField.append(thresholdLabel,thresholdLine);
  const behaviorField=el('div','','quick-field'),behaviorLabel=el('span','Posts below threshold'),behaviorGrid=el('div','','behavior-grid');behaviorGrid.setAttribute('role','group');behaviorGrid.setAttribute('aria-label','Post treatment');
  for(const [value,label] of [['dim','Dim'],['collapse','Collapse'],['hide','Hide'],['label','Label only']]){const button=el('button',label);button.type='button';button.dataset.behavior=value;button.setAttribute('aria-pressed','false');behaviorGrid.append(button);}
  behaviorField.append(behaviorLabel,behaviorGrid);
  const quickAdToggle=el('button','Hide X ads','ad-toggle');quickAdToggle.type='button';quickAdToggle.setAttribute('role','switch');quickAdToggle.setAttribute('aria-checked','false');
  const quickShowHidden=el('button','','show-hidden');quickShowHidden.type='button';quickShowHidden.hidden=true;
  const quickActions=el('div','','quick-actions'),advancedSettings=el('button','Connection & privacy','advanced'),quickClose=el('button','Close');advancedSettings.type=quickClose.type='button';quickActions.append(advancedSettings,quickClose);
  const quickStatus=el('p','Changes apply to this feed immediately.','quick-status');quickStatus.setAttribute('role','status');
  quickMenu.append(quickHead,profileField,themeField,tuneDetails,thresholdField,behaviorField,quickAdToggle,quickShowHidden,quickActions,quickStatus);
  const positionMenu=el('div','','position-menu');positionMenu.id='signal-position';positionMenu.popover='auto';positionMenu.setAttribute('role','group');positionMenu.setAttribute('aria-labelledby','position-heading');
  const positionHeading=el('h2','Control position');positionHeading.id='position-heading';
  const positionClose=el('button','×','close');positionClose.type='button';positionClose.setAttribute('aria-label','Close control position');
  const cornerGrid=el('div','','corners'),positionStatus=el('p','Saved on this device.','save-status'),positionAnnouncer=el('span','','sr-only');positionAnnouncer.setAttribute('role','status');
  const keys=el('p','Drag the control to move it. On the grip, use arrow keys to move, Shift for larger steps, or Home to reset.','keys');keys.id='position-keys';
  const BOTTOM_RIGHT_INSET=150;
  let overlayPosition=C.overlayPosition(),drag=null,suppressPositionClick=false,positionTimer,positionPending=0,positionRevision=0,positionSaveQueue=Promise.resolve(),quickSaveQueue=Promise.resolve(),quickSaveRevision=0;
  const corners=[['top-left','Top left'],['top-right','Top right'],['bottom-left','Bottom left'],['bottom-right','Bottom right']];
  for(const [preset,label] of corners){
    const button=el('button','',`corner ${preset}`);button.type='button';button.dataset.preset=preset;button.setAttribute('aria-pressed',String(overlayPosition.preset===preset));
    const icon=el('span','','corner-icon');icon.setAttribute('aria-hidden','true');button.append(icon,el('span',label));
    button.addEventListener('click',()=>choosePosition({preset},`Control moved to ${label.toLowerCase()}.`));cornerGrid.append(button);
  }
  const resetPosition=el('button','Reset to top left','reset');resetPosition.type='button';resetPosition.addEventListener('click',()=>choosePosition({preset:'top-left'},'Control reset to top left.'));
  const showHidden=el('button','','show-hidden');showHidden.type='button';showHidden.hidden=true;
  function revealHidden(menu,focusTarget){
    const hidden=[...records].filter(([article])=>article.isConnected&&article.classList.contains('oya-hide'));
    for(const [article,record] of hidden){rememberReveal(record);render(article,record);}
    updateChip();menu.hidePopover();focusTarget.focus({preventScroll:true});positionAnnouncer.textContent=`${hidden.length} hidden posts shown.`;
  }
  showHidden.addEventListener('click',()=>revealHidden(positionMenu,positionButton));
  quickShowHidden.addEventListener('click',()=>revealHidden(quickMenu,chipButton));
  positionMenu.append(positionHeading,positionClose,el('p','Make room for your feed.'),showHidden,cornerGrid,resetPosition,keys,positionStatus);
  control.append(chipButton,positionButton);chipShadow.append(chipStyle,control,quickMenu,positionMenu,positionAnnouncer);
  function resolvedTheme(){return state?.theme==='dark'||(state?.theme==='system'&&systemThemeQuery.matches)?'dark':'light';}
  function applyAppearance(){
    const theme=resolvedTheme();chip.dataset.theme=theme;
    for(const record of records.values())if(record.host)record.host.dataset.theme=theme;
  }
  systemThemeQuery.addEventListener('change',()=>{if(state?.theme==='system')applyAppearance();});
  function positionBounds(){
    const rect=control.getBoundingClientRect(),x=Math.min(16,Math.max(0,(innerWidth-rect.width)/2)),y=Math.min(16,Math.max(0,(innerHeight-rect.height)/2));
    return {x,y,width:Math.max(0,innerWidth-rect.width-2*x),height:Math.max(0,innerHeight-rect.height-2*y)};
  }
  function placeMenu(menu){
    if(!menu.matches(':popover-open'))return;
    const rect=control.getBoundingClientRect(),height=menu.offsetHeight;
    menu.style.left=`${Math.max(12,Math.min(rect.left,innerWidth-menu.offsetWidth-12))}px`;
    menu.style.top=`${Math.max(12,Math.min(rect.bottom+8+height<=innerHeight-12?rect.bottom+8:rect.top-height-8,innerHeight-height-12))}px`;
  }
  function placeControl(){
    if(chip.hidden||!chip.isConnected)return;
    const bounds=positionBounds(),custom=overlayPosition.preset==='custom',right=overlayPosition.preset.endsWith('right'),bottom=overlayPosition.preset.startsWith('bottom');
    const left=bounds.x+(custom?overlayPosition.x:right?1:0)*bounds.width;
    const top=custom?bounds.y+overlayPosition.y*bounds.height:overlayPosition.preset==='bottom-right'?Math.max(bounds.y,innerHeight-control.getBoundingClientRect().height-BOTTOM_RIGHT_INSET):bounds.y+(bottom?1:0)*bounds.height;
    chip.style.left=`${left}px`;chip.style.top=`${top}px`;
    for(const button of cornerGrid.children)button.setAttribute('aria-pressed',String(button.dataset.preset===overlayPosition.preset));
    placeMenu(quickMenu);placeMenu(positionMenu);
  }
  function receivePosition(position){
    if(drag||positionPending||positionTimer)return;
    try{overlayPosition=C.overlayPosition(position);}catch{overlayPosition=C.overlayPosition();}
    placeControl();
  }
  function persistPosition(){
    clearTimeout(positionTimer);positionTimer=null;
    const position=C.overlayPosition(overlayPosition),revision=++positionRevision;positionPending++;
    positionStatus.textContent='Saving position…';
    // Serialize writes so quick keyboard moves cannot restore an older position.
    positionSaveQueue=positionSaveQueue.then(()=>send('SAVE_OVERLAY_POSITION',{position})).then(()=>{
      if(revision===positionRevision){positionStatus.textContent='Saved on this device.';chip.removeAttribute('data-position-error');positionAnnouncer.textContent='Control position saved on this device.';}
    }).catch(()=>{
      if(revision===positionRevision){const text='Position not saved. Choose a position to retry.';positionStatus.textContent=text;positionAnnouncer.textContent=text;chip.setAttribute('data-position-error','');}
    }).finally(()=>{positionPending--;});
  }
  function choosePosition(position,announcement){
    overlayPosition=C.overlayPosition(position);placeControl();persistPosition();positionAnnouncer.textContent=announcement;
  }
  function moveControl(left,top){
    const bounds=positionBounds();
    overlayPosition=C.overlayPosition({preset:'custom',x:bounds.width?(left-bounds.x)/bounds.width:0,y:bounds.height?(top-bounds.y)/bounds.height:0});placeControl();
  }
  function option(value,label){const item=el('option',label);item.value=value;return item;}
  function updateQuickControls(){
    if(!state)return;
    quickToggle.textContent=state.enabled?'Filter on':'Paused';quickToggle.setAttribute('aria-checked',String(state.enabled));
    quickInterests.value=state.interests;interestsCount.textContent=`${state.interests.length} / 400`;
    for(const key of C.KEYS){weightInputs[key].input.value=String(state.weights[key]);weightInputs[key].output.value=String(state.weights[key]);weightInputs[key].output.textContent=String(state.weights[key]);}
    marginInput.value=String(Math.round(state.minimumMargin*100));marginOutput.value=marginInput.value;marginOutput.textContent=marginInput.value;
    thresholdInput.value=String(state.threshold);thresholdOutput.value=String(Math.round(state.threshold));thresholdOutput.textContent=String(Math.round(state.threshold));
    for(const button of behaviorGrid.children)button.setAttribute('aria-pressed',String(button.dataset.behavior===state.behavior));
    quickAdToggle.setAttribute('aria-checked',String(state.hideAds));
    themeSelect.value=state.theme;
    const profileSignature=JSON.stringify(quickProfiles);
    if(profileSelect.dataset.signature!==profileSignature){
      profileSelect.replaceChildren(option('','Apply a profile…'));
      const presets=el('optgroup');presets.label='Built-in profiles';
      for(const [key,preset] of Object.entries(C.PRESETS))presets.append(option(`preset:${key}`,preset.name));
      profileSelect.append(presets);
      if(quickProfiles.length){const saved=el('optgroup');saved.label='Your profiles';for(const profile of quickProfiles)saved.append(option(`saved:${profile.id}`,profile.name));profileSelect.append(saved);}
      profileSelect.dataset.signature=profileSignature;
    }
    profileSelect.value=[...profileSelect.options].some(item=>item.value===activeQuickProfile)?activeQuickProfile:'';
  }
  function quickBusy(busy){for(const element of [quickToggle,profileSelect,themeSelect,quickInterests,...C.KEYS.map(key=>weightInputs[key].input),marginInput,thresholdInput,...behaviorGrid.children,quickAdToggle])element.disabled=busy;}
  function saveQuick(extra,success){
    const current=++quickSaveRevision,focusTarget=chipShadow.activeElement;quickBusy(true);quickStatus.classList.remove('error');quickStatus.textContent='Saving…';
    quickSaveQueue=quickSaveQueue.catch(()=>{}).then(()=>send('SAVE_QUICK_SETTINGS',extra)).then(next=>{
      apply(next);if(current===quickSaveRevision)quickStatus.textContent=success;
    }).catch(error=>{if(current===quickSaveRevision){updateQuickControls();quickStatus.textContent=error.message;quickStatus.classList.add('error');}}).finally(()=>{if(current===quickSaveRevision){quickBusy(false);if(quickMenu.matches(':popover-open')&&focusTarget?.isConnected)focusTarget.focus({preventScroll:true});}});
  }
  chipButton.setAttribute('aria-expanded','false');chipButton.setAttribute('aria-controls',quickMenu.id);
  chipButton.addEventListener('click',()=>{
    if(quickMenu.matches(':popover-open')){quickMenu.hidePopover();chipButton.setAttribute('aria-expanded','false');return;}
    updateQuickControls();quickMenu.showPopover();chipButton.setAttribute('aria-expanded','true');placeMenu(quickMenu);quickToggle.focus({preventScroll:true});
  });
  quickToggle.addEventListener('click',()=>saveQuick({patch:{enabled:!state.enabled}},state.enabled?'Filter paused.':'Filter active.'));
  profileSelect.addEventListener('change',()=>{if(profileSelect.value)saveQuick({profile:profileSelect.value},'Profile applied.');});
  themeSelect.addEventListener('change',()=>saveQuick({patch:{theme:themeSelect.value}},`${themeSelect.selectedOptions[0].textContent} appearance active.`));
  quickInterests.addEventListener('input',()=>interestsCount.textContent=`${quickInterests.value.length} / 400`);
  quickInterests.addEventListener('change',()=>saveQuick({patch:{interests:quickInterests.value}},'Target interests updated.'));
  for(const key of C.KEYS){const {input,output}=weightInputs[key];input.addEventListener('input',()=>{output.value=input.value;output.textContent=input.value;});input.addEventListener('change',()=>saveQuick({patch:{weights:{[key]:Number(input.value)}}},`${weightLabels[key]} updated.`));}
  marginInput.addEventListener('input',()=>{marginOutput.value=marginInput.value;marginOutput.textContent=marginInput.value;});
  marginInput.addEventListener('change',()=>saveQuick({patch:{minimumMargin:Number(marginInput.value)/100}},'Uncertainty guard updated.'));
  thresholdInput.addEventListener('input',()=>{thresholdOutput.value=thresholdInput.value;thresholdOutput.textContent=thresholdInput.value;});
  thresholdInput.addEventListener('change',()=>saveQuick({patch:{threshold:Number(thresholdInput.value)}},'Threshold updated.'));
  for(const button of behaviorGrid.children)button.addEventListener('click',()=>saveQuick({patch:{behavior:button.dataset.behavior}},`${button.textContent} treatment active.`));
  quickAdToggle.addEventListener('click',()=>saveQuick({patch:{hideAds:!state.hideAds}},state.hideAds?'X ads are visible.':'X ads are hidden locally.'));
  advancedSettings.addEventListener('click',()=>{quickMenu.hidePopover();send('OPEN_OPTIONS',{panel:'connection'}).catch(error=>{quickStatus.textContent=error.message;quickStatus.classList.add('error');});});
  quickClose.addEventListener('click',()=>{quickMenu.hidePopover();chipButton.focus({preventScroll:true});});
  tuneDetails.addEventListener('toggle',()=>placeMenu(quickMenu));
  quickMenu.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();quickMenu.hidePopover();chipButton.focus({preventScroll:true});}},true);
  quickMenu.addEventListener('toggle',()=>chipButton.setAttribute('aria-expanded',String(quickMenu.matches(':popover-open'))));
  positionButton.addEventListener('click',()=>{
    if(positionMenu.matches(':popover-open')){positionMenu.hidePopover();return;}
    positionMenu.showPopover();positionButton.setAttribute('aria-expanded','true');placeMenu(positionMenu);
    (cornerGrid.querySelector('[aria-pressed="true"]')||cornerGrid.firstElementChild).focus({preventScroll:true});
  });
  positionClose.addEventListener('click',()=>{positionMenu.hidePopover();positionButton.focus({preventScroll:true});});
  positionMenu.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();positionMenu.hidePopover();positionButton.focus({preventScroll:true});}});
  positionMenu.addEventListener('toggle',()=>positionButton.setAttribute('aria-expanded',String(positionMenu.matches(':popover-open'))));
  positionButton.addEventListener('keydown',event=>{
    if(event.key==='Home'){event.preventDefault();choosePosition({preset:'top-left'},'Control reset to top left.');return;}
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(!delta)return;
    event.preventDefault();const rect=control.getBoundingClientRect(),step=event.shiftKey?40:10;
    moveControl(rect.left+delta[0]*step,rect.top+delta[1]*step);clearTimeout(positionTimer);positionTimer=setTimeout(persistPosition,250);
    positionAnnouncer.textContent='Control moved. Use the arrow keys to continue, or Home to reset.';
  });
  control.addEventListener('pointerdown',event=>{
    if(event.button!==0||!event.isPrimary)return;
    const target=event.target.closest('button');if(!target)return;
    const rect=control.getBoundingClientRect();
    drag={pointerId:event.pointerId,target,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top,position:{...overlayPosition},moved:false};
    target.setPointerCapture(event.pointerId);target.focus({preventScroll:true});
  });
  control.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moved&&Math.hypot(dx,dy)<5)return;
    if(!drag.moved){drag.moved=true;quickMenu.hidePopover();positionMenu.hidePopover();chip.setAttribute('data-dragging','');}
    event.preventDefault();moveControl(drag.left+dx,drag.top+dy);
  });
  function endDrag(event,cancelled=false){
    if(!drag||event.pointerId!==drag.pointerId)return;
    const ended=drag;drag=null;chip.removeAttribute('data-dragging');
    if(cancelled){overlayPosition=ended.position;placeControl();}
    else if(ended.moved){persistPosition();positionAnnouncer.textContent='Control moved.';}
    if(ended.moved){suppressPositionClick=true;setTimeout(()=>{suppressPositionClick=false;},0);}
    if(ended.target.hasPointerCapture(event.pointerId))ended.target.releasePointerCapture(event.pointerId);
  }
  control.addEventListener('pointerup',event=>endDrag(event));
  control.addEventListener('pointercancel',event=>endDrag(event,true));
  control.addEventListener('lostpointercapture',event=>endDrag(event,true));
  control.addEventListener('click',event=>{if(suppressPositionClick){event.preventDefault();event.stopImmediatePropagation();suppressPositionClick=false;}},true);
  window.addEventListener('resize',placeControl);
  new ResizeObserver(placeControl).observe(control);
  function isActive(){return state?.enabled&&C.routeAllowed(location.pathname,state)&&document.visibilityState==='visible';}
  function clearVisual(article,record){
    if(record?.peekTimer)clearTimeout(record.peekTimer);
    if(record?.peekFrame)cancelAnimationFrame(record.peekFrame);
    record?.peekResize?.disconnect();
    record?.peekAbort?.abort();
    article.classList.remove('oya-dim','oya-collapse','oya-highlight','oya-annotated','oya-hide','oya-peek','oya-peek-closing','oya-peek-stable','oya-peek-measuring');
    article.style.removeProperty('--oya-post-padding');article.style.removeProperty('--oya-peek-height');
    if(record?.hiddenContainer){record.hiddenContainer.classList.remove('oya-hide-cell');hiddenContainers.delete(record.hiddenContainer);record.hiddenContainer=null;}
    const cell=hideContainer(article);if(cell&&!hiddenContainers.has(cell))cell.classList.remove('oya-hide-cell');
    if(record?.host)record.host.remove();
    for(const host of article.querySelectorAll(':scope > [data-oya-host]'))host.remove();
    if(record){record.host=null;record.scoreButton=null;record.rendered=false;record.peeking=false;record.peekLocked=false;record.peekPhase=null;record.peekAbort=null;record.peekTimer=null;record.peekFrame=null;record.peekResize=null;record.peekTransitionEnd=null;}
  }
  function hideContainer(article){
    const cell=article.closest('[data-testid="cellInnerDiv"]');
    if(!cell)return null;
    // Only hide a wrapper chain owned entirely by this post, never adjacent X UI.
    for(let node=article;node!==cell;node=node.parentElement){
      if(!node.parentElement||[...node.parentElement.children].some(child=>child!==node))return null;
    }
    return cell;
  }
  function clearAd(article){
    article.classList.remove('oya-ad-hide');
    const cell=adContainers.get(article)||hideContainer(article);
    if(cell){cell.classList.remove('oya-ad-hide-cell');adsByContainer.delete(cell);}
    adContainers.delete(article);
  }
  function hideAd(article){
    const current=adContainers.get(article);
    article.classList.add('oya-ad-hide');
    const cell=hideContainer(article);
    if(current&&current!==cell){current.classList.remove('oya-ad-hide-cell');adsByContainer.delete(current);}
    if(cell){cell.classList.add('oya-ad-hide-cell');adContainers.set(article,cell);adsByContainer.set(cell,article);}
    else adContainers.set(article,null);
  }
  function rememberReveal(record){
    // Keep an explicit choice across X virtualizing a post, but never carry it to edited text.
    revealedPosts.delete(record.post.id);revealedPosts.set(record.post.id,record.post.text);
    if(revealedPosts.size>MAX_REVEALS)revealedPosts.delete(revealedPosts.keys().next().value);
    record.revealed=true;
  }
  function treatmentChanged(article,record){
    if(!record?.result||!state?.enabled||!C.routeAllowed(location.pathname,state))return false;
    const decision=C.decision(record.result.metrics,state);
    const low=!record.revealed&&decision.action==='low';
    const collapsed=low&&state.behavior==='collapse';
    return article.classList.contains('oya-collapse')!==collapsed||
      (collapsed&&record.peekPhase==='open'&&!article.classList.contains('oya-peek'))||
      (collapsed&&['closing','reopening'].includes(record.peekPhase)&&!article.classList.contains('oya-peek-closing'))||
      (collapsed&&!!record.peekStable!==article.classList.contains('oya-peek-stable'))||
      article.classList.contains('oya-dim')!==(low&&state.behavior==='dim')||
      article.classList.contains('oya-hide')!==(low&&state.behavior==='hide')||
      !!record.hiddenContainer&&!record.hiddenContainer.classList.contains('oya-hide-cell')||
      article.classList.contains('oya-highlight')!==(!record.revealed&&decision.action==='highlight')||
      article.classList.contains('oya-annotated')!==!!record.host;
  }
  function restoreTreatment(article,record){
    if(!record?.host||record.host.parentNode!==article||!record.result||!state?.enabled||!C.routeAllowed(location.pathname,state))return false;
    const decision=C.decision(record.result.metrics,state),low=!record.revealed&&decision.action==='low';
    if(low&&state.behavior==='hide')return false;
    article.classList.toggle('oya-dim',low&&state.behavior==='dim');
    article.classList.toggle('oya-collapse',low&&state.behavior==='collapse');
    article.classList.toggle('oya-peek',low&&state.behavior==='collapse'&&record.peekPhase==='open');
    article.classList.toggle('oya-peek-closing',low&&state.behavior==='collapse'&&['closing','reopening'].includes(record.peekPhase));
    article.classList.toggle('oya-peek-stable',low&&state.behavior==='collapse'&&record.peekPhase==='open'&&!!record.peekStable);
    article.classList.toggle('oya-highlight',!record.revealed&&decision.action==='highlight');
    article.classList.remove('oya-hide');article.classList.add('oya-annotated');
    return true;
  }
  function render(article,record){
    clearVisual(article,record);
    if(!record.result||!state?.enabled||!C.routeAllowed(location.pathname,state))return;
    const decision=C.decision(record.result.metrics,state);
    record.rendered=true;
    if(!record.revealed){
      if(decision.action==='low'&&state.behavior==='hide'){
        article.classList.add('oya-hide');record.hiddenContainer=hideContainer(article);
        if(record.hiddenContainer){record.hiddenContainer.classList.add('oya-hide-cell');hiddenContainers.set(record.hiddenContainer,{article,record});}
        return;
      }
      if(decision.action==='low'&&state.behavior!=='label')article.classList.add(state.behavior==='collapse'?'oya-collapse':'oya-dim');
      if(decision.action==='highlight')article.classList.add('oya-highlight');
    }
    if(!state.showBadges&&!(decision.action==='low'&&state.behavior==='collapse'&&!record.revealed))return;
    const collapsed=decision.action==='low'&&state.behavior==='collapse'&&!record.revealed;
    const host=el('div');host.setAttribute('data-oya-host','');host.dataset.theme=resolvedTheme();record.host=host;
    host.style.setProperty('--oya-post-ink',getComputedStyle(article.querySelector('[data-testid="tweetText"]')||article).color);
    if(collapsed)host.setAttribute('data-collapsed','');
    else article.style.setProperty('--oya-post-padding',getComputedStyle(article).paddingLeft);
    article.classList.add('oya-annotated');
    const shadow=host.attachShadow({mode:'closed'}),style=el('style');
    style.textContent=annotationStyles;
    const status=record.revealed?'Shown by you':decision.action==='uncertain'?'Uncertain · left visible':decision.action==='low'?'Below your threshold':decision.action==='highlight'?'Close to your interests':'Your personal signal';
    const rail=el('div','','rail'),pill=el('button',decision.action==='uncertain'?'?':String(decision.score),`score ${decision.action}`);pill.type='button';
    pill.setAttribute('aria-label',`Your Signal: ${decision.score} out of 100. ${status}. Show evaluation criteria`);
    const detail=el('div','','details');detail.id='signal-details';detail.popover='auto';detail.setAttribute('role','group');detail.setAttribute('aria-labelledby','signal-heading');
    const heading=el('h2',`${decision.score} / 100 · your signal`,'detail-heading');heading.id='signal-heading';
    const close=el('button','×','close');close.type='button';close.setAttribute('aria-label','Close evaluation criteria');
    close.addEventListener('click',()=>{detail.hidePopover();pill.focus({preventScroll:true});});
    detail.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();detail.hidePopover();pill.focus({preventScroll:true});}});
    detail.append(heading,close,el('p',status,'detail-status'));
    for(const k of C.KEYS){const row=el('div','','row');row.append(el('span',C.LABELS[k]),el('span',Math.round((['promotion','bait'].includes(k)?1-record.result.metrics[k]:record.result.metrics[k])*100)+'/100','value'));detail.append(row);}
    detail.append(el('p','Scores reflect your preferences, not the truth of a post.','note'));
    detail.append(el('p',`Heuristic margin ${Math.round(decision.margin*100)}/100 · ${record.result.model} · Text only${record.post.truncated?', incomplete text':''}.`,'provenance'));
    pill.setAttribute('aria-expanded','false');pill.setAttribute('aria-controls',detail.id);
    pill.addEventListener('click',()=>{
      if(detail.matches(':popover-open')){detail.hidePopover();return;}
      const bounds=pill.getBoundingClientRect();detail.showPopover();pill.setAttribute('aria-expanded','true');
      detail.style.left=`${Math.max(12,Math.min(bounds.right,innerWidth-detail.offsetWidth-12))}px`;
      detail.style.top=`${Math.max(12,Math.min(bounds.top,innerHeight-detail.offsetHeight-12))}px`;
      close.focus({preventScroll:true});
    });
    detail.addEventListener('toggle',()=>pill.setAttribute('aria-expanded',String(detail.matches(':popover-open'))));
    const revealButton=()=>{
      const reveal=el('button','Show anyway','reveal');reveal.type='button';
      reveal.addEventListener('click',()=>{
        rememberReveal(record);render(article,record);
        // Rendering replaces the initiating button; leave keyboard focus at this post.
        const focusTarget=record.scoreButton||article.querySelector('a[href],button,[tabindex="0"]');
        focusTarget?.focus({preventScroll:true});
      });return reveal;
    };
    rail.append(pill);record.scoreButton=pill;shadow.append(style,rail);
    if(collapsed){
      const summary=el('div','','summary'),mark=el('div','','mark'),logo=el('img');logo.src=markUrl;logo.alt='';mark.append(logo);
      const copy=el('div','','copy'),subtitle=el('div',`Hidden by Your Signal · score ${decision.score}`,'subtitle');copy.append(el('div','Below your threshold','label'),subtitle);
      const actions=el('div','','summary-actions'),peek=el('button','','peek'),eye=el('span','','peek-eye'),peekLabel=el('span','Peek','peek-label');peek.type='button';eye.setAttribute('aria-hidden','true');peek.append(eye,peekLabel);
      peek.setAttribute('aria-label','Peek at this collapsed post. Hover or focus for a temporary preview; press to keep it open.');peek.setAttribute('aria-expanded','false');peek.setAttribute('aria-pressed','false');
      const peekAbort=new AbortController(),peekEvents={signal:peekAbort.signal};record.peekAbort=peekAbort;
      const measurePeekHeight=()=>{
        article.classList.add('oya-peek-measuring');const height=Math.max(88,article.scrollHeight+Math.max(0,article.offsetHeight-article.clientHeight));article.classList.remove('oya-peek-measuring');record.peekFullHeight=height;return height;
      };
      const clearClosingWait=()=>{
        if(record.peekTimer)clearTimeout(record.peekTimer);record.peekTimer=null;
        if(record.peekTransitionEnd)article.removeEventListener('transitionend',record.peekTransitionEnd);record.peekTransitionEnd=null;
      };
      const resetPeek=()=>{
        clearClosingWait();record.peekResize?.disconnect();record.peekResize=null;
        article.classList.remove('oya-peek','oya-peek-closing','oya-peek-stable','oya-peek-measuring');article.style.removeProperty('--oya-peek-height');host.removeAttribute('data-peeking');host.removeAttribute('data-peek-closing');host.removeAttribute('data-peek-stable');
        peek.setAttribute('aria-expanded','false');peek.setAttribute('aria-pressed','false');peekLabel.textContent='Peek';subtitle.textContent=`Hidden by Your Signal · score ${decision.score}`;
        record.peeking=false;record.peekLocked=false;record.peekStable=false;record.peekPhase=null;record.peekFrame=null;record.peekFullHeight=null;
      };
      const peekAnimations=()=>{
        const names=new Set(['oya-peek-fold','oya-flap-settle','oya-tray-close']);
        return [...new Set([...article.getAnimations({subtree:true}),...(shadow.getAnimations?.()||[])])].filter(animation=>animation.transitionProperty==='max-height'||names.has(animation.animationName));
      };
      const showOpenCopy=()=>{
        peek.setAttribute('aria-expanded','true');peekLabel.textContent=record.peekLocked?'Pinned':'Peek';subtitle.textContent=record.peekLocked?'Peek pinned · click again or press Esc to fold':`A quick glance · score ${decision.score}`;
      };
      const armClosingWait=()=>{
        record.peekTransitionEnd=event=>{if(event.target===article&&event.propertyName==='max-height'&&record.peekPhase==='closing')resetPeek();};
        article.addEventListener('transitionend',record.peekTransitionEnd,peekEvents);
        record.peekTimer=setTimeout(()=>{if(record.peekPhase==='closing')resetPeek();},520);
      };
      const finishReopen=()=>{
        if(record.peekPhase!=='reopening')return;
        clearClosingWait();article.classList.remove('oya-peek-closing');article.classList.add('oya-peek','oya-peek-stable');article.style.setProperty('--oya-peek-height',`${record.peekFullHeight||Math.max(88,article.scrollHeight)}px`);
        host.removeAttribute('data-peek-closing');host.setAttribute('data-peeking','');host.setAttribute('data-peek-stable','');record.peeking=true;record.peekStable=true;record.peekPhase='open';showOpenCopy();
      };
      const reverseClosing=()=>{
        clearClosingWait();const animations=peekAnimations(),reversed=[];
        for(const animation of animations){try{animation.reverse();reversed.push(animation);}catch{}}
        record.peeking=true;record.peekPhase='reopening';showOpenCopy();
        if(!reversed.length){finishReopen();return;}
        Promise.allSettled(reversed.map(animation=>animation.finished)).then(finishReopen);
        record.peekTimer=setTimeout(finishReopen,460);
      };
      const beginPeek=()=>{
        if(record.revealed||!article.isConnected||!article.classList.contains('oya-collapse'))return;
        if(record.peekPhase==='closing'){reverseClosing();return;}
        if(record.peekPhase==='reopening'){showOpenCopy();return;}
        clearClosingWait();if(record.peekFrame)cancelAnimationFrame(record.peekFrame);
        if(record.peeking&&article.classList.contains('oya-peek')){
          showOpenCopy();return;
        }
        article.classList.remove('oya-peek-closing','oya-peek-stable');article.style.setProperty('--oya-peek-height','88px');article.classList.add('oya-peek');host.setAttribute('data-peeking','');host.removeAttribute('data-peek-closing');host.removeAttribute('data-peek-stable');
        record.peeking=true;record.peekStable=false;record.peekPhase='open';showOpenCopy();
        if(!record.peekResize){
          record.peekResize=new ResizeObserver(()=>{
            if(!record.peeking)return;const fullHeight=measurePeekHeight(),current=parseFloat(article.style.getPropertyValue('--oya-peek-height'))||0;
            if(Math.abs(fullHeight-current)>1)article.style.setProperty('--oya-peek-height',`${fullHeight}px`);
          });
          for(const child of article.children)if(child!==host)record.peekResize.observe(child,{box:'border-box'});
        }
        record.peekFrame=requestAnimationFrame(()=>{record.peekFrame=null;if(record.peeking)article.style.setProperty('--oya-peek-height',`${measurePeekHeight()}px`);});
      };
      const endPeek=(immediate=false)=>{
        clearClosingWait();if(record.peekFrame)cancelAnimationFrame(record.peekFrame);record.peekFrame=null;
        record.peekLocked=false;peek.setAttribute('aria-pressed','false');
        if(!record.peeking&&!article.classList.contains('oya-peek-closing')){resetPeek();return;}
        if(immediate||matchMedia('(prefers-reduced-motion: reduce)').matches){resetPeek();return;}
        if(record.peekPhase==='reopening'){
          const animations=peekAnimations();for(const animation of animations){try{animation.reverse();}catch{}}
          record.peeking=false;record.peekPhase='closing';peek.setAttribute('aria-expanded','false');peekLabel.textContent='Peek';subtitle.textContent='Putting this one back under the rug';armClosingWait();return;
        }
        const currentHeight=Math.max(88,article.getBoundingClientRect().height);article.style.setProperty('--oya-peek-height',`${currentHeight}px`);article.classList.remove('oya-peek');article.classList.add('oya-peek-closing');host.setAttribute('data-peek-closing','');record.peekPhase='closing';
        article.classList.remove('oya-peek-stable');host.removeAttribute('data-peek-stable');record.peekStable=false;peek.setAttribute('aria-expanded','false');peekLabel.textContent='Peek';subtitle.textContent='Putting this one back under the rug';record.peeking=false;
        record.peekFrame=requestAnimationFrame(()=>{record.peekFrame=null;article.style.setProperty('--oya-peek-height','88px');});
        armClosingWait();
      };
      peek.addEventListener('pointerenter',beginPeek,peekEvents);
      peek.addEventListener('focus',beginPeek,peekEvents);
      peek.addEventListener('click',()=>{
        if(record.peekLocked){endPeek();return;}
        record.peekLocked=true;peek.setAttribute('aria-pressed','true');beginPeek();
      },peekEvents);
      peek.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();endPeek();}},peekEvents);
      article.addEventListener('keydown',event=>{if(event.key==='Escape'&&record.peekLocked){event.preventDefault();event.stopPropagation();peek.focus({preventScroll:true});endPeek();}},peekEvents);
      article.addEventListener('pointerleave',()=>{if(!record.peekLocked)endPeek();},peekEvents);
      article.addEventListener('focusout',()=>setTimeout(()=>{if(record.peekAbort===peekAbort&&!record.peekLocked&&!article.contains(document.activeElement)&&!shadow.activeElement)endPeek();},0),peekEvents);
      const peekFrame=el('div','','peek-frame');peekFrame.setAttribute('aria-hidden','true');actions.append(peek,revealButton());summary.append(mark,copy,actions);shadow.append(peekFrame,summary);
    }else if(decision.action==='low'&&!record.revealed){
      detail.append(revealButton());
    }
    // Keep interactions inside the annotation from activating an X post navigation handler.
    shadow.addEventListener('click',event=>event.stopPropagation());
    shadow.append(detail);article.prepend(host);
  }
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){const record=records.get(entry.target);if(record){record.near=entry.isIntersecting;if(entry.isIntersecting)enqueue(entry.target,record);}}
  },{rootMargin:'250px 0px'});
  function enqueue(article,record){
    if(isActive()&&record.near&&!record.result&&!record.pending&&Date.now()>(record.retryAfter||0))queue.add(article);
    schedule();
  }
  function schedule(){if(!timer)timer=setTimeout(()=>{timer=null;drain();},180);}
  function drain(){
    if(!isActive()){queue.clear();return;}
    for(const article of queue){
      if(active>=3)break;
      queue.delete(article);
      const record=records.get(article);
      if(!record||!record.near||record.pending||record.result||!article.isConnected)continue;
      record.pending=true;active++;
      const g=generation,sig=record.sig;
      send('EVALUATE',{post:record.post}).then(result=>{
        if(g!==generation||records.get(article)!==record||record.sig!==sig||!article.isConnected)return;
        record.result=result;lastError='';render(article,record);
      }).catch(error=>{
        record.retryAfter=Date.now()+60000;lastError=error.message;
      }).finally(()=>{record.pending=false;active--;updateChip();schedule();});
    }
  }
  function updateChip(){
    const allowed=state&&C.routeAllowed(location.pathname,state);
    chip.hidden=!allowed;
    if(!allowed){if(quickMenu.matches(':popover-open'))quickMenu.hidePopover();if(positionMenu.matches(':popover-open'))positionMenu.hidePopover();}
    const hiddenCount=[...records].filter(([article])=>article.isConnected&&article.classList.contains('oya-hide')).length;
    const adCount=[...adContainers].filter(([article])=>article.isConnected&&article.classList.contains('oya-ad-hide')).length;
    const text=lastError?'Check connection':!state?.enabled?'Paused':active?'Reading text…':hiddenCount?`${hiddenCount} hidden`:adCount?`${adCount} ads hidden`:'Filter on';
    const logo=el('img');logo.src=markUrl;logo.alt='';
    chipButton.className=`main${lastError?' error':!state?.enabled?' paused':''}`;
    chipButton.replaceChildren(logo,el('span','YOUR SIGNAL','brand'),el('span','·'),el('span',text,'status'),el('span','','dot'));
    chipButton.title=lastError?`Feed unchanged · ${lastError}`:'Tune this feed. Scores reflect your preferences, not the truth of a post.';
    chipButton.setAttribute('aria-label',`Your Signal · ${text}. Open quick controls`);
    for(const button of [showHidden,quickShowHidden]){button.hidden=!hiddenCount;button.textContent=`Show hidden posts (${hiddenCount})`;}
    positionButton.setAttribute('aria-label',`Your Signal control options and position${hiddenCount?`. Show ${hiddenCount} hidden posts`:''}`);
    placeControl();
  }
  function scan(){
    if(!state)return;
    const newRoute=location.pathname;
    if(newRoute!==route){route=newRoute;generation++;queue.clear();for(const [a,r] of records)clearVisual(a,r);for(const article of [...adContainers.keys()])clearAd(article);}
    for(const [a,r] of records)if(!a.isConnected){clearVisual(a,r);observer.unobserve(a);records.delete(a);queue.delete(a);}
    for(const article of [...adContainers.keys()])if(!article.isConnected)clearAd(article);
    if(!C.routeAllowed(route,state)){for(const article of [...adContainers.keys()])clearAd(article);updateChip();return;}
    for(const article of A.articles()){
      if(state.enabled&&state.hideAds&&A.isAd(article)){
        const prior=records.get(article);
        if(prior){clearVisual(article,prior);observer.unobserve(article);records.delete(article);queue.delete(article);}
        hideAd(article);continue;
      }
      clearAd(article);
      const post=A.extract(article);
      if(!post){const prior=records.get(article);if(prior){clearVisual(article,prior);observer.unobserve(article);records.delete(article);}continue;}
      const sig=JSON.stringify(post);let record=records.get(article);
      if(!record||record.sig!==sig){
        clearVisual(article,record);
        record={post,sig,result:null,pending:false,near:false,revealed:revealedPosts.get(post.id)===post.text};records.set(article,record);observer.unobserve(article);observer.observe(article);
      }else if(record.result&&(!record.rendered||(record.host&&record.host.parentNode!==article))&&state.enabled)render(article,record);
      if(record.near)enqueue(article,record);
    }
    // Bound references even when the host application retains an unusually long DOM.
    if(records.size>MAX_RECORDS){
      for(const [a,r] of records){if(records.size<=MAX_RECORDS)break;if(!r.near&&!r.pending){clearVisual(a,r);observer.unobserve(a);records.delete(a);queue.delete(a);}}
    }
    updateChip();
  }
  function apply(next){
    const evaluationChanged=next.evaluationRevision!==revision;
    state=C.settings(next.settings);quickProfiles=Array.isArray(next.quickProfiles)?next.quickProfiles.filter(profile=>profile&&typeof profile.id==='string'&&typeof profile.name==='string').slice(0,20):quickProfiles;activeQuickProfile=typeof next.activeProfile==='string'?next.activeProfile:'';revision=next.evaluationRevision;applyAppearance();
    receivePosition(next.overlayPosition);
    if(evaluationChanged){generation++;queue.clear();for(const r of records.values()){r.result=null;r.retryAfter=0;}}
    for(const [a,r] of records)render(a,r);
    updateQuickControls();scan();
  }
  chrome.runtime.onMessage.addListener(message=>{
    if(message.type==='OYA_SETTINGS')apply(message);
    else if(message.type==='OYA_OVERLAY_POSITION')receivePosition(message.overlayPosition);
  });
  send('GET_PUBLIC').then(next=>{
    document.documentElement.append(chip);apply(next);
    let scheduled=false;
    new MutationObserver(mutations=>{
      // React may replace the article's class attribute while retaining the post.
      // Restore its treatment in this microtask, before a collapsed post can paint.
      for(const mutation of mutations)if(mutation.type==='attributes'){
        const adArticle=adsByContainer.get(mutation.target)||(adContainers.has(mutation.target)?mutation.target:null);
        if(adArticle&&state?.enabled&&state?.hideAds&&A.isAd(adArticle)&&( !adArticle.classList.contains('oya-ad-hide') || (adContainers.get(adArticle)&&!adContainers.get(adArticle).classList.contains('oya-ad-hide-cell')) ))hideAd(adArticle);
        const owner=hiddenContainers.get(mutation.target),article=owner?.article||mutation.target,record=owner?.record||records.get(article);
        if(treatmentChanged(article,record)&&!restoreTreatment(article,record))render(article,record);
      }
      const contentMutations=mutations.filter(m=>m.type!=='attributes');
      if(!contentMutations.length)return;
      for(const [article,record] of records)if(article.classList.contains('oya-hide')&&(!article.isConnected||hideContainer(article)!==record.hiddenContainer)){
        if(article.isConnected)render(article,record);else clearVisual(article,record);
      }
      // Ignore our own badge insertion/removal; never listen to page-to-extension messages.
      if(contentMutations.every(m=>m.type==='childList'&&[...m.addedNodes,...m.removedNodes].length>0&&[...m.addedNodes,...m.removedNodes].every(n=>n.nodeType===1&&n.hasAttribute?.('data-oya-host'))))return;
      if(!scheduled){scheduled=true;setTimeout(()=>{scheduled=false;scan();},240);}
    }).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('visibilitychange',scan);
    window.addEventListener('popstate',scan);
    setInterval(scan,1500); // SPA navigation fallback; extraction limited to rendered articles.
  }).catch(()=>{});
})();
