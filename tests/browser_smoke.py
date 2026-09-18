"""Offline Chromium tests. No X or Jev network calls and no user data.
The DOM fixture replaces location.pathname with fixturePath only to simulate SPA routes.
Chrome runtime APIs are stubs; this is NOT a native MV3 end-to-end test.
Run: python tests/browser_smoke.py
Requires playwright plus an installed Chromium (CHROMIUM_PATH can override it).
"""
from pathlib import Path
import os,shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)

def source(name):return (ROOT/'extension'/name).read_text(encoding='utf-8')

def no_modules(html):
    import re
    return re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>|<link rel="stylesheet"[^>]*>','',html)

def click_shadow_button(page, cdp, name):
    """Use Chromium's accessible control, including controls in closed roots."""
    controls=cdp.send('Accessibility.getFullAXTree')['nodes']
    matching=[node for node in controls if not node.get('ignored') and
              node.get('role',{}).get('value')=='button' and
              name in node.get('name',{}).get('value','')]
    assert len(matching)==1,[(node.get('name'),node.get('role')) for node in matching]
    # CDP gives the accessibility node and box-model command different key names.
    node_id=matching[0]['back'+'endDOMNodeId']
    box=cdp.send('DOM.getBoxModel',{'back'+'endNodeId':node_id})['model']['border']
    page.mouse.click(sum(box[0::2])/4,sum(box[1::2])/4)

with sync_playwright() as p:
    executable=os.getenv('CHROMIUM_PATH') or shutil.which('chromium')
    browser=p.chromium.launch(**({'executable_path':executable} if executable else {}),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1100})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(no_modules(source('options.html')))
    page.add_style_tag(content=source('ui.css'))
    page.add_script_tag(content=source('core.js'))
    page.add_script_tag(type='module',content=source('ui.js').replace("import './core.js';",''))
    page.wait_for_selector('.sample-post')
    assert page.locator('.sample-post').count()==3
    page.screenshot(path=str(OUT/'dashboard.png'),full_page=True)
    page.locator('[data-preset="focus"]').click()
    assert page.locator('#threshold').input_value()=='68'
    # Hide removes only the low-scored demo row, with no placeholder gap, and
    # keeps an explicit recovery action instead of revealing on hover/focus.
    samples=page.locator('#preview-posts .sample-text').all_text_contents()
    preview_height=page.locator('#preview-posts').bounding_box()['height']
    page.locator('[name="behavior"][value="hide"]').check()
    assert page.locator('#preview-posts .sample-post').count()==2
    assert page.locator('#preview-posts .sample-text').all_text_contents()==[samples[0],samples[2]]
    assert samples[1] not in page.locator('#preview-posts').inner_text()
    visible=page.locator('#preview-posts .sample-post')
    first,second=visible.nth(0).bounding_box(),visible.nth(1).bounding_box()
    assert second['y']-(first['y']+first['height'])<=1
    assert page.locator('#preview-posts').bounding_box()['height']<preview_height
    recover=page.get_by_role('button',name='Show hidden demo posts (1)',exact=True)
    assert recover.count()==1
    recover.hover();recover.focus()
    assert page.locator('#preview-posts .sample-post').count()==2
    recover.press('Enter')
    assert page.locator('#preview-posts .sample-text').all_text_contents()==samples
    assert recover.count()==0
    assert page.locator('#preview-posts .sample-post').nth(1).evaluate('element=>element===document.activeElement')
    page.locator('[name="behavior"][value="dim"]').check()
    page.locator('[data-panel="connection"]').click()
    page.screenshot(path=str(OUT/'connection.png'),full_page=True)
    assert page.locator('#jev-key').is_visible()
    page.locator('[data-panel="privacy"]').click()
    assert page.locator('#privacy-panel').is_visible()
    page.set_viewport_size({'width':390,'height':844})
    page.locator('#menu-toggle').click()
    assert page.locator('#menu-toggle').get_attribute('aria-expanded')=='true'
    page.locator('[data-panel="algorithm"]').click()
    assert page.locator('#menu-toggle').get_attribute('aria-expanded')=='false'
    assert page.locator('#menu-toggle').evaluate('element=>element===document.activeElement')
    page.locator('#menu-toggle').click()
    page.keyboard.press('Escape')
    assert page.locator('#menu-toggle').get_attribute('aria-expanded')=='false'
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(OUT/'mobile.png'),full_page=True)
    assert not errors,errors
    page.close()
    print('UI smoke: PASS (dashboard, presets, Hide preview/recovery, connection, privacy, responsive layout)')

    # Exercise the extension-only BYOK controls.
    # The runtime fixture records every request and never contacts TypeSafe.
    page=browser.new_page(viewport={'width':1440,'height':1100})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    requests=[]
    page.route('**/*',lambda route: (requests.append(route.request.url),route.abort()))
    page.set_content(no_modules(source('options.html')))
    page.add_style_tag(content=source('ui.css'))
    page.add_script_tag(content=source('core.js'))
    page.add_script_tag(content='''
      globalThis.fixtureMessages=[];
      globalThis.fixturePermissions=[];
      globalThis.fixtureState={
        settings:{...structuredClone(OYA.DEFAULTS)},
        hasJevKey:true,rememberKey:false,
        model:'fixture-not-live-jev',stats:null,lastError:''
      };
      globalThis.chrome={
        runtime:{id:'offline-extension-fixture',async sendMessage(message){
          fixtureMessages.push(structuredClone(message));
          if(message.type==='UI_STATE')return{ok:true,data:structuredClone(fixtureState)};
          if(message.type==='UI_SAVE'){
            fixtureState.settings=OYA.settings(message.settings);
            if(typeof message.rememberKey==='boolean')fixtureState.rememberKey=message.rememberKey;
            return{ok:true,data:{settings:structuredClone(fixtureState.settings)}};
          }
          if(message.type==='UI_TEST')return{ok:true,data:{}};
          return{ok:false,error:'Unexpected request in offline BYOK fixture: '+message.type};
        }},
        permissions:{async request(permission){
          fixturePermissions.push(structuredClone(permission));return true;
        }}
      };
    ''')
    page.add_script_tag(type='module',content=source('ui.js').replace("import './core.js';",''))
    page.wait_for_selector('.sample-post')
    assert page.evaluate("fixtureMessages.map(message=>message.type)")==['UI_STATE']
    page.locator('[data-panel="connection"]').click()
    assert not page.locator('#remember-key').is_checked()
    assert page.locator('#jev-key').input_value()==''
    page.locator('#remember-key').check()
    page.locator('#connect').click()
    page.wait_for_function("fixtureMessages.some(message=>message.type==='UI_SAVE')")
    page.wait_for_function("!document.querySelector('#connect').disabled")
    saved=page.evaluate("fixtureMessages.find(message=>message.type==='UI_SAVE')")
    assert saved['jevKey']==''
    assert saved['rememberKey'] is True
    assert page.locator('#remember-key').is_checked()
    assert 'error' not in (page.locator('#toast').get_attribute('class') or '').split()
    page.locator('#test-connection').click()
    page.wait_for_function("fixtureMessages.some(message=>message.type==='UI_TEST')")
    page.wait_for_function("!document.querySelector('#test-connection').disabled")
    assert page.evaluate('fixturePermissions')==[{'origins':['https://api.typesafe.ai/*']}]*2
    assert not requests,requests
    assert not errors,errors
    page.close()
    print('BYOK UI: PASS (direct permission, session default, saved key persistence, connection test)')

    page=browser.new_page(viewport={'width':1050,'height':1000})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content('''<!doctype html><html lang="en"><head><style>body{background:#090c0a;color:#e6eee3;font:16px system-ui;margin:0}header{padding:25px 30px;border-bottom:1px solid #28302a;color:#bed49c;font-size:14px}main{margin:0 auto;width:610px}article{padding:20px 17px;border:1px solid #28302a;min-height:155px;display:flex;flex-direction:column;gap:12px}a{color:#85947b;text-decoration:none;font-size:11px}[data-testid=tweetText]{line-height:1.8}.person{font-weight:600;font-size:14px}nav{padding:16px;color:#cadfb7;border-bottom:1px solid #28302a}</style></head><body><header>X DOM fixture · synthetic text · simulated Jev responses</header><main><nav>Your timeline / Own Your Algorithm</nav><article data-testid="tweet" id="good"><div class="person">Demo account · Software</div><a href="/demo/status/101"><time>12:01</time></a><div data-testid="tweetText">A reproducible caching benchmark: here are the method, examples, and code for measuring p95 latency.</div></article><article data-testid="tweet" id="bad"><div class="person">Demo account · Promotion</div><a href="/demo/status/102"><time>12:02</time></a><div data-testid="tweetText">Comment AI, like this post, and follow me to get the secret list of tools that will change everything!</div></article><article data-testid="tweet" id="media"><div class="person">Demo account · Image only</div><a href="/demo/status/103"><time>12:03</time></a><div data-testid="tweetPhoto">[Image not analyzed]</div></article></main></body></html>''')
    page.add_style_tag(content=source('content.css'))
    page.add_script_tag(content=source('core.js'))
    page.add_script_tag(content='''globalThis.fixturePath='/home';globalThis.fixtureCount=0;globalThis.fixtureSettings={...OYA.DEFAULTS,enabled:true};globalThis.chrome={runtime:{onMessage:{addListener(fn){this.listener=fn;}},async sendMessage(m){if(m.type==='GET_PUBLIC')return{ok:true,data:{settings:fixtureSettings,evaluationRevision:'fixture'}};if(m.type==='OPEN_OPTIONS')return{ok:true,data:{}};if(m.type==='EVALUATE'){fixtureCount++;await new Promise(r=>setTimeout(r,50));const low=m.post.text.toLowerCase().includes('comment');return{ok:true,data:{model:'fixture-not-live-jev',metrics:{relevance:low?.1:.95,substance:low?.1:.95,actionable:low?.1:.95,promotion:low?.9:.05,bait:low?.9:.05},input_tokens:500,cached:false}};}}}};''')
    page.add_script_tag(content=source('adapters/x.js'))
    page.add_script_tag(content=source('content.js').replace('location.pathname','globalThis.fixturePath'))
    cdp=page.context.new_cdp_session(page)
    page.wait_for_selector('#good.oya-highlight')
    page.wait_for_selector('#bad.oya-dim')
    assert page.locator('#media [data-oya-host]').count()==0
    assert page.evaluate('fixtureCount')==2
    page.screenshot(path=str(OUT/'x-fixture.png'),full_page=True)
    # Pausing restores the feed and does not evaluate newly inserted posts.
    page.evaluate("fixtureSettings={...fixtureSettings,enabled:false};chrome.runtime.onMessage.listener({type:'OYA_SETTINGS',settings:fixtureSettings,evaluationRevision:'fixture'})")
    assert page.locator('article.oya-dim,article.oya-highlight,article.oya-collapse').count()==0
    assert page.locator('article [data-oya-host]').count()==0
    page.evaluate('''document.querySelector('main').insertAdjacentHTML('beforeend',
      '<article data-testid="tweet" id="paused"><a href="/demo/status/105"><time>12:05</time></a><div data-testid="tweetText">Caching examples with reproducible benchmarks and measurements.</div></article>')''')
    page.wait_for_timeout(500)
    assert page.evaluate('fixtureCount')==2
    page.evaluate("fixtureSettings={...fixtureSettings,enabled:true};chrome.runtime.onMessage.listener({type:'OYA_SETTINGS',settings:fixtureSettings,evaluationRevision:'fixture'})")
    page.wait_for_selector('#good.oya-highlight')
    page.wait_for_selector('#bad.oya-dim')
    page.wait_for_selector('#paused.oya-highlight')
    assert page.evaluate('fixtureCount')==3
    # Dimmed posts expose their reveal action in the score's details popover.
    click_shadow_button(page,cdp,'Below your threshold. Show evaluation criteria')
    assert page.locator('#bad.oya-dim').count()==1
    click_shadow_button(page,cdp,'Show anyway')
    page.wait_for_function("!document.querySelector('#bad').classList.contains('oya-dim')")
    before=page.evaluate('fixtureCount')
    page.evaluate("fixtureSettings={...fixtureSettings,weights:{...fixtureSettings.weights,bait:0}};chrome.runtime.onMessage.listener({type:'OYA_SETTINGS',settings:fixtureSettings,evaluationRevision:'fixture'})")
    page.wait_for_timeout(400)
    assert page.evaluate('fixtureCount')==before
    # Recycled DOM node must not keep the previous post's evaluation.
    page.evaluate("document.querySelector('#good a').href='/demo/status/104';document.querySelector('#good [data-testid=tweetText]').textContent='Comment and like this post to get the secret content.'")
    page.wait_for_selector('#good.oya-dim')
    assert page.evaluate('fixtureCount')==before+1
    # Collapsed posts retain their reveal control even when badges are disabled.
    page.evaluate("fixtureSettings={...fixtureSettings,behavior:'collapse',showBadges:false};chrome.runtime.onMessage.listener({type:'OYA_SETTINGS',settings:fixtureSettings,evaluationRevision:'fixture'})")
    page.wait_for_selector('#good.oya-collapse')
    assert page.locator('#good [data-testid="tweetText"]').is_hidden()
    assert page.locator('#good [data-oya-host]').is_visible()
    assert page.locator('#bad.oya-collapse').count()==0
    # Hover, focus, and X replacing an article's class must never reveal it.
    page.locator('#good').hover()
    assert page.locator('#good [data-testid="tweetText"]').is_hidden()
    click_shadow_button(page,cdp,'Below your threshold. Show evaluation criteria')
    page.keyboard.press('Tab')
    page.keyboard.press('Escape')
    assert page.locator('#good [data-testid="tweetText"]').is_hidden()
    page.evaluate("document.querySelector('#good').className='host-recycled-class'")
    page.wait_for_selector('#good.oya-collapse')
    assert page.locator('#good [data-testid="tweetText"]').is_hidden()
    click_shadow_button(page,cdp,'Show anyway')
    page.wait_for_function("!document.querySelector('#good').classList.contains('oya-collapse')")
    assert page.locator('#good [data-testid="tweetText"]').is_visible()
    assert page.evaluate('fixtureCount')==before+1
    # Leaving Home restores all modified nodes and does not evaluate message content.
    page.evaluate("fixturePath='/messages'")
    page.wait_for_timeout(1800)
    assert page.locator('article.oya-dim,article.oya-highlight,article.oya-collapse').count()==0
    assert page.evaluate('fixtureCount')==before+1
    assert not errors,errors
    print('X DOM fixture: PASS (highlight, dim, media skip, pause/resume, manual reveal, local weights, node reuse, collapse, DM route exclusion)')
    # Popup rendering with a stubbed runtime, not a native extension context.
    popup=browser.new_page(viewport={'width':400,'height':600})
    popup_errors=[];popup.on('pageerror',lambda e:popup_errors.append(str(e)))
    popup.set_content(no_modules(source('popup.html')))
    popup.add_style_tag(content=source('ui.css')+source('popup.css'))
    popup.add_script_tag(content=source('core.js'))
    popup.add_script_tag(content="globalThis.chrome={runtime:{async sendMessage(m){return{ok:true,data:{settings:OYA.DEFAULTS,hasJevKey:false}}}}};")
    popup.add_script_tag(type='module',content=source('popup.js').replace("import './core.js';",''))
    popup.wait_for_function("document.querySelector('#popup-interests').value.length>0")
    assert popup.locator('#popup-threshold-value').inner_text()=='58'
    assert popup.locator('#popup-weights input[type="range"]').count()==5
    assert popup.locator('[name="popup-behavior"]').count()==4
    assert popup.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert popup.locator('#popup-open').is_visible()
    assert not popup_errors,popup_errors
    popup.screenshot(path=str(OUT/'popup.png'),full_page=True)
    print('Popup render: PASS')

    # A failed save must roll back an optimistic toggle; retry must clear the
    # stale error. Deferred fixture replies make the pending state deterministic.
    failure_popup=browser.new_page(viewport={'width':400,'height':600})
    failure_errors=[];failure_popup.on('pageerror',lambda e:failure_errors.append(str(e)))
    failure_popup.set_content(no_modules(source('popup.html')))
    failure_popup.add_style_tag(content=source('ui.css')+source('popup.css'))
    failure_popup.add_script_tag(content=source('core.js'))
    failure_popup.add_script_tag(content='''
      globalThis.fixtureState={settings:{...structuredClone(OYA.DEFAULTS)},
        hasJevKey:true,customProfiles:[],stats:null,lastError:''};
      globalThis.fixtureSaves=[];
      globalThis.fixtureCompleteSave=null;
      globalThis.chrome={runtime:{async sendMessage(message){
        if(message.type==='UI_STATE')return{ok:true,data:structuredClone(fixtureState)};
        if(message.type==='UI_SAVE'){
          fixtureSaves.push(structuredClone(message));
          return new Promise(resolve=>{
            globalThis.fixtureCompleteSave=success=>{
              if(success){
                fixtureState.settings=OYA.settings(message.settings);
                resolve({ok:true,data:{settings:structuredClone(fixtureState.settings)}});
              }else resolve({ok:false,error:'Fixture storage write failed.'});
              globalThis.fixtureCompleteSave=null;
            };
          });
        }
        return{ok:false,error:'Unexpected popup fixture request: '+message.type};
      }}};
    ''')
    failure_popup.add_script_tag(type='module',content=source('popup.js').replace("import './core.js';",''))
    failure_popup.wait_for_function("() => document.querySelector('#popup-interests').value.length>0")
    toggle=failure_popup.locator('#popup-toggle')
    toggle.click()
    failure_popup.wait_for_function('() => fixtureSaves.length===1 && typeof fixtureCompleteSave===\'function\'')
    assert toggle.is_disabled()
    assert failure_popup.evaluate('fixtureSaves[0].settings.enabled') is True
    failure_popup.evaluate('fixtureCompleteSave(false)')
    failure_popup.wait_for_function("() => !document.querySelector('#popup-toggle').disabled")
    assert toggle.get_attribute('aria-checked')=='false'
    assert failure_popup.locator('#popup-status').inner_text()=='Filter paused'
    assert failure_popup.locator('.toggle-word').inner_text()=='OFF'
    assert failure_popup.evaluate('fixtureState.settings.enabled') is False
    assert failure_popup.locator('#popup-message').is_visible()
    assert failure_popup.locator('#popup-message').inner_text()=='Fixture storage write failed.'
    assert failure_popup.locator('#popup-save-state').inner_text()=='Not saved · try again'
    toggle.click()
    failure_popup.wait_for_function('() => fixtureSaves.length===2 && typeof fixtureCompleteSave===\'function\'')
    assert toggle.is_disabled()
    assert failure_popup.evaluate('fixtureSaves[1].settings.enabled') is True
    failure_popup.evaluate('fixtureCompleteSave(true)')
    failure_popup.wait_for_function("() => !document.querySelector('#popup-toggle').disabled")
    assert toggle.get_attribute('aria-checked')=='true'
    assert failure_popup.locator('#popup-status').inner_text()=='Filter on'
    assert failure_popup.locator('.toggle-word').inner_text()=='ON'
    assert failure_popup.evaluate('fixtureState.settings.enabled') is True
    assert failure_popup.locator('#popup-message').is_hidden()
    assert failure_popup.locator('#popup-message').inner_text()==''
    assert 'error' not in (failure_popup.locator('#popup-message').get_attribute('class') or '').split()
    assert failure_popup.locator('#popup-save-state').inner_text()=='Saved on this device'
    assert not failure_errors,failure_errors
    print('Popup save recovery: PASS (disabled while saving, rollback on failure, retry persists and clears error)')
    browser.close()
