"""Offline X injection behavior and layout checks with explicit synthetic content.

The fixture stubs extension messages and serves only local assets. No X account,
provider is contacted. Closed shadow roots remain closed in production;
the fixture records their references to exercise native keyboard interactions.
Run with .venv/Scripts/python tests/x_injection_smoke.py.
"""
from pathlib import Path
import mimetypes
import os
import shutil
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results' / 'x-injection'
OUT.mkdir(parents=True, exist_ok=True)

FIXTURE = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;background:#191a1e;color:#eee;font:15px/1.4 Arial,sans-serif}
.fixture-label{position:absolute;top:12px;left:max(16px,calc(50% - 332px));font-size:10px;letter-spacing:.08em;color:#aaa7b0}
main{width:664px;max-width:100%;margin:38px auto 70px}
article{padding:16px;border:1px solid #34343e;border-radius:5px;margin-bottom:12px;min-height:354px}
.post{display:grid;grid-template-columns:44px 1fr;gap:10px 14px}.avatar{border-radius:50%;width:42px;height:42px;display:grid;place-items:center;background:#9e7d91;color:#fff;font-weight:700}
.meta{display:flex;gap:9px;align-items:center;font-size:14px}.name{font-weight:700}.meta span,.meta a{color:#a8a6b5}.meta a{text-decoration:none}.copy{margin-top:12px}.media{margin-top:12px;border:1px solid #d2c8b9;border-radius:7px;min-height:188px;background:#f1eadd;color:#493f5f;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;text-align:center;font-family:Georgia,serif;font-size:30px}.media small{font:12px Arial,sans-serif;color:#716778;letter-spacing:.1em;text-transform:uppercase}.actions{display:flex;justify-content:space-between;margin-top:15px;font-size:12px;color:#b0abbc;grid-column:1/-1}.actions button{border:0;color:inherit;background:none;font:inherit;padding:0}.wide{grid-column:1/-1}.landscape{background:linear-gradient(150deg,#c6af98,#777b93);border:0;color:#faf4ed;min-height:196px}.image-only{min-height:304px}.safety{font-size:12px;color:#a49eae;margin:18px 4px}
@media(max-width:540px){main{margin-top:38px}.media{font-size:22px;min-height:150px}article{padding:12px;min-height:310px}.meta{gap:6px;font-size:12px}.post{grid-template-columns:32px 1fr;gap:10px}.avatar{width:32px;height:32px}}
</style></head><body>
<div class="fixture-label">OFFLINE FIXTURE · SYNTHETIC POSTS · SIMULATED EVALUATIONS</div>
<main>
<article data-testid="tweet" id="good"><div class="post"><div class="avatar">D</div><div><div class="meta"><b class="name">Demo account</b><span>· Software</span><a href="/demo/status/101"><time>2h</time></a></div><div class="copy" data-testid="tweetText">A reproducible caching benchmark: method, examples, and code for measuring p95 latency.</div></div><div class="media wide" data-testid="tweetPhoto"><small>Synthetic media fixture</small>Better tools.<br>Brighter tomorrow.</div><div class="actions"><button>Reply</button><button>Repost</button><button>Like</button><button>Share</button></div></div></article>
  <article data-testid="tweet" id="bad"><div class="post"><div class="avatar">D</div><div><div class="meta"><b class="name">Demo account</b><span>· Promotion</span><a href="/demo/status/102"><time>3h</time></a></div><div class="copy" data-testid="tweetText"><span>Comment AI, like this post,</span><br><span>and follow me for the secret list of tools <img alt="🤖" width="16" height="16" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='16' height='16' fill='%23baa8d1'/%3E%3C/svg%3E"> that will change everything!</span><div>New tools every day.</div></div></div><div class="actions"><button>Reply</button><button>Repost</button><button>Like</button><button>Share</button></div></div></article>
  <div data-testid="cellInnerDiv" id="ad-cell"><article data-testid="tweet" id="ad"><div class="post"><div class="avatar">A</div><div><div class="meta"><span data-testid="User-Name"><b class="name">Demo sponsor</b></span><span>·</span><span class="ad-label">Ad</span><a href="/demo/status/199"><time>4h</time></a></div><div class="copy" data-testid="tweetText">Try this fictional sponsored product today.</div></div><div class="actions"><button>Reply</button><button>Repost</button><button>Like</button><button>Share</button></div></div></article></div>
  <article data-testid="tweet" class="image-only" id="media"><div class="post"><div class="avatar">D</div><div><div class="meta"><b class="name">Demo account</b><span>· Image only</span><a href="/demo/status/103"><time>5h</time></a></div><div class="media landscape" data-testid="tweetPhoto"><small>Synthetic media fixture</small>Image not analyzed<br><small>Post unchanged</small></div></div><div class="actions"><button>Reply</button><button>Repost</button><button>Like</button><button>Share</button></div></div></article>
<p class="safety">Scores reflect your preferences, not the truth of a post.</p>
</main></body></html>'''

RUNTIME = '''
  globalThis.fixtureShadows=new WeakMap();
  const attachShadow=Element.prototype.attachShadow;
  Element.prototype.attachShadow=function(init){const root=attachShadow.call(this,init);fixtureShadows.set(this,root);return root;};
  globalThis.shadow=id=>fixtureShadows.get(document.querySelector(id+' [data-oya-host]'));
  globalThis.fixtureCount=0;globalThis.fixtureMessages=[];globalThis.fixtureRequests=[];
  globalThis.fixturePosition=JSON.parse(localStorage.getItem('fixtureOverlayPosition')||'{"preset":"top-left"}');
  globalThis.fixturePositionSaves=[];globalThis.controlShadow=()=>fixtureShadows.get(document.querySelector('#oya-control'));
  globalThis.fixtureSavedProfiles=[{id:'11111111-1111-4111-8111-111111111111',name:'Evening reading',settings:{...OYA.profileSettings(OYA.DEFAULTS),threshold:64,behavior:'label'}}];
  globalThis.fixtureQuickProfiles=fixtureSavedProfiles.map(({id,name})=>({id,name}));
  globalThis.fixtureSettings={...OYA.DEFAULTS,enabled:true,behavior:'collapse',hideAds:true};
  globalThis.fixtureState=()=>({settings:fixtureSettings,quickProfiles:fixtureQuickProfiles,activeProfile:OYA.profileSelection(fixtureSettings,fixtureSavedProfiles),overlayPosition:fixturePosition,evaluationRevision:'fixture'});
  globalThis.updateSettings=patch=>{fixtureSettings={...fixtureSettings,...patch};chrome.runtime.onMessage.listener({type:'OYA_SETTINGS',...fixtureState()});};
  globalThis.chrome={runtime:{getURL:path=>'https://fixture.yoursignal.invalid/'+path,onMessage:{addListener(fn){this.listener=fn;}},async sendMessage(message){
    fixtureMessages.push(message.type);fixtureRequests.push(structuredClone(message));
    if(message.type==='GET_PUBLIC')return{ok:true,data:fixtureState()};
    if(message.type==='OPEN_OPTIONS')return{ok:true,data:{}};
    if(message.type==='SAVE_QUICK_SETTINGS'){
      if(message.patch)fixtureSettings={...fixtureSettings,...message.patch,...(message.patch.weights?{weights:{...fixtureSettings.weights,...message.patch.weights}}:{})};
      else if(message.profile==='preset:builder')fixtureSettings={...fixtureSettings,...OYA.PRESETS.builder};
      else if(message.profile==='saved:11111111-1111-4111-8111-111111111111')fixtureSettings={...fixtureSettings,...fixtureSavedProfiles[0].settings};
      else return{ok:false,error:'Unknown fixture profile'};
      const next=fixtureState();chrome.runtime.onMessage.listener({type:'OYA_SETTINGS',...next});return{ok:true,data:next};
    }
    if(message.type==='SAVE_OVERLAY_POSITION'){
      if(globalThis.fixtureSaveError)return{ok:false,error:'Synthetic storage failure'};
      fixturePosition=OYA.overlayPosition(message.position);fixturePositionSaves.push(fixturePosition);
      localStorage.setItem('fixtureOverlayPosition',JSON.stringify(fixturePosition));
      chrome.runtime.onMessage.listener({type:'OYA_OVERLAY_POSITION',overlayPosition:fixturePosition});
      return{ok:true,data:{overlayPosition:fixturePosition}};
    }
    if(message.type==='EVALUATE'){
      fixtureCount++;await new Promise(resolve=>setTimeout(resolve,20));
      if(message.post.text.includes('provider failure'))return{ok:false,error:'Synthetic provider failure'};
      const value=message.post.text.includes('uncertain')?.5:message.post.text.toLowerCase().includes('comment')?.1:.95;
      return{ok:true,data:{model:'fixture-not-live-jev',metrics:{relevance:value,substance:value,actionable:value,promotion:1-value,bait:1-value},cached:false}};
    }
    return{ok:false,error:'Unexpected fixture message '+message.type};
  }}};
'''


def source(name):
    return (ROOT / 'extension' / name).read_text(encoding='utf-8')


with sync_playwright() as playwright:
    executable = os.getenv('CHROMIUM_PATH') or shutil.which('chromium')
    browser = playwright.chromium.launch(
        **({'executable_path': executable} if executable else {}), headless=True)
    page = browser.new_page(viewport={'width': 1050, 'height': 900})
    errors, blocked = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))

    def serve(route):
        url = urlparse(route.request.url)
        if url.hostname == 'x.com' and url.path == '/home':
            route.fulfill(status=200, content_type='text/html', body=FIXTURE)
        elif url.hostname == 'fixture.yoursignal.invalid' and url.path.startswith('/assets/'):
            path = (ROOT / 'extension' / url.path.lstrip('/')).resolve()
            assert path.is_relative_to((ROOT / 'extension' / 'assets').resolve())
            route.fulfill(status=200, content_type=mimetypes.guess_type(str(path))[0] or 'application/octet-stream', body=path.read_bytes())
        else:
            blocked.append(route.request.url)
            route.abort()

    page.route('**/*', serve)
    page.goto('https://x.com/home')
    media_before = page.locator('#media').inner_html()
    def inject():
        page.add_style_tag(content=source('content.css'))
        page.add_script_tag(content=source('core.js'))
        page.add_script_tag(content=RUNTIME)
        page.add_script_tag(content=source('adapters/x.js'))
        page.add_script_tag(content=source('content.js'))
    inject()
    page.wait_for_selector('#good.oya-highlight')
    page.wait_for_selector('#bad.oya-collapse')
    page.wait_for_selector('#ad-cell.oya-ad-hide-cell', state='attached')
    page.evaluate('document.fonts.ready')
    assert page.evaluate('fixtureCount') == 2
    assert page.locator('#ad-cell').bounding_box() is None
    assert page.locator('#media').inner_html() == media_before
    assert page.locator('#media').get_attribute('class') == 'image-only'
    assert page.locator('#good [data-oya-host]').bounding_box()['width'] == 32
    assert page.locator('#bad [data-oya-host]').bounding_box()['height'] == 88
    assert page.locator('#bad').bounding_box()['height'] == 90  # Plus fixture borders.
    assert page.evaluate("document.querySelector('#good [data-oya-host]').shadowRoot===null")
    assert page.evaluate("document.fonts.check('14px \"Your Signal UI\"')")
    # Extraction is a semantic DOM operation: layout, visibility and extension
    # treatment must not alter identity, whitespace or image-emoji meaning.
    extraction = page.evaluate("""()=>{
      const article=document.querySelector('#bad').cloneNode(true);
      article.id='adapter-fixture';article.className='';
      const block=article.querySelector('[data-testid=tweetText]');
      block.replaceChildren();
      block.insertAdjacentHTML('beforeend','<span>Comment</span> <span>AI</span><br><br><span>Keep  both spaces.</span><div>A separate block.</div><span>Emoji: </span><img alt="🤖"><span> end.</span>');
      const wrapper=document.createElement('div');wrapper.append(article);document.body.append(wrapper);
      const visible=OYA_X.extract(article);
      article.classList.add('oya-collapse');const collapsed=OYA_X.extract(article);
      article.classList.replace('oya-collapse','oya-hide');const hidden=OYA_X.extract(article);
      article.className='';wrapper.style.display='none';const hiddenAncestor=OYA_X.extract(article);
      wrapper.remove();return {visible,collapsed,hidden,hiddenAncestor};
    }""")
    assert extraction['visible']['text'] == 'Comment AI\n\nKeep  both spaces.\nA separate block.\nEmoji: 🤖 end.'
    assert all(value == extraction['visible'] for value in extraction.values())
    ad_detection = page.evaluate("""()=>{
      const good=document.querySelector('#good'),author=document.querySelector('#ad').cloneNode(true);
      author.id='author-ad';author.querySelector('.ad-label').remove();author.querySelector('[data-testid=User-Name]').textContent='Ad';author.querySelector('[data-testid=tweetText]').textContent='Ad';
      good.insertAdjacentHTML('beforeend','<div data-testid="placementTracking"></div>');
      return {promoted:OYA_X.isAd(document.querySelector('#ad')),placementOnly:OYA_X.isAd(good),authorOrCopy:OYA_X.isAd(author)};
    }""")
    assert ad_detection == {'promoted': True, 'placementOnly': False, 'authorOrCopy': False}
    assert page.locator('#oya-control').bounding_box()['x'] == 16
    assert page.locator('#oya-control').bounding_box()['y'] == 16
    page.screenshot(path=str(OUT / 'x-injection.png'))

    # Daily feed controls stay on X and reuse completed evaluations.
    quick_count = page.evaluate('fixtureCount')
    page.evaluate("controlShadow().querySelector('.main').focus()")
    page.keyboard.press('Enter')
    page.wait_for_function("controlShadow().querySelector('.quick-menu').matches(':popover-open')")
    assert page.evaluate("controlShadow().querySelector('.main').getAttribute('aria-expanded')") == 'true'
    assert page.evaluate("controlShadow().querySelector('.quick-toggle').getAttribute('aria-checked')") == 'true'
    assert page.evaluate("controlShadow().querySelector('.ad-toggle').getAttribute('aria-checked')") == 'true'
    assert page.evaluate("controlShadow().querySelector('[aria-label=\"Apply a profile\"]').textContent.includes('Evening reading')")
    assert page.evaluate("controlShadow().querySelector('[aria-label=\"Apply a profile\"]').value") == 'preset:builder'
    assert page.evaluate("controlShadow().querySelector('[aria-label=Appearance]').value") == 'system'
    page.emulate_media(color_scheme='dark')
    page.wait_for_function("document.querySelector('#oya-control').dataset.theme==='dark'&&document.querySelector('#bad [data-oya-host]').dataset.theme==='dark'")
    page.screenshot(path=str(OUT / 'x-quick-dark.png'))
    page.evaluate("()=>{const select=controlShadow().querySelector('[aria-label=Appearance]');select.value='light';select.dispatchEvent(new Event('change',{bubbles:true}));}")
    page.wait_for_function("fixtureSettings.theme==='light'&&document.querySelector('#oya-control').dataset.theme==='light'")
    page.evaluate("()=>{const select=controlShadow().querySelector('[aria-label=Appearance]');select.value='system';select.dispatchEvent(new Event('change',{bubbles:true}));}")
    page.wait_for_function("fixtureSettings.theme==='system'&&document.querySelector('#oya-control').dataset.theme==='dark'")
    assert page.evaluate("controlShadow().querySelector('[aria-label=\"Feed threshold\"]').value") == '58'
    assert page.evaluate("controlShadow().querySelector('textarea').value") == page.evaluate('fixtureSettings.interests')
    assert page.evaluate("controlShadow().querySelectorAll('.quick-weight input').length") == 5
    assert page.evaluate("controlShadow().querySelector('[aria-label=\"Uncertainty guard\"]').value") == '35'
    page.evaluate("controlShadow().querySelector('[aria-label=\"Uncertainty guard\"]').value='55';controlShadow().querySelector('[aria-label=\"Uncertainty guard\"]').dispatchEvent(new Event('change'))")
    page.wait_for_function("fixtureSettings.minimumMargin===.55")
    assert page.evaluate('fixtureCount') == quick_count
    page.evaluate("controlShadow().querySelector('[aria-label=\"Uncertainty guard\"]').value='35';controlShadow().querySelector('[aria-label=\"Uncertainty guard\"]').dispatchEvent(new Event('change'))")
    page.wait_for_function("fixtureSettings.minimumMargin===.35")
    page.evaluate("controlShadow().querySelector('.ad-toggle').click()")
    page.wait_for_function("fixtureSettings.hideAds===false")
    assert page.locator('#ad-cell').is_visible()
    page.evaluate("controlShadow().querySelector('.ad-toggle').click()")
    page.wait_for_function("fixtureSettings.hideAds===true")
    page.wait_for_selector('#ad-cell.oya-ad-hide-cell', state='attached')
    page.wait_for_timeout(250)
    after_ad_toggle = page.evaluate('fixtureCount')
    assert after_ad_toggle in (quick_count, quick_count + 1)
    quick_count = after_ad_toggle
    page.evaluate("()=>{const details=controlShadow().querySelector('.tune-details');details.open=true;const target=controlShadow().querySelector('textarea');target.value='Distributed systems, humane interfaces';target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));}")
    page.wait_for_function("fixtureSettings.interests==='Distributed systems, humane interfaces'")
    assert page.evaluate("controlShadow().querySelector('.field-note span:last-child').textContent") == '38 / 400'
    page.evaluate("()=>{const input=controlShadow().querySelector('[data-weight=relevance]');input.value='45';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}")
    page.wait_for_function('fixtureSettings.weights.relevance===45')
    assert page.evaluate("controlShadow().querySelector('[data-weight=relevance]+output').textContent") == '45'
    page.evaluate("controlShadow().querySelector('[data-behavior=dim]').click()")
    page.wait_for_function("fixtureSettings.behavior==='dim'")
    page.wait_for_selector('#bad.oya-dim')
    page.evaluate("()=>{const input=controlShadow().querySelector('[aria-label=\"Feed threshold\"]');input.value='65';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}")
    page.wait_for_function('fixtureSettings.threshold===65')
    assert page.evaluate("controlShadow().querySelector('[aria-label=\"Feed threshold\"]+output').textContent") == '65'
    page.evaluate("controlShadow().querySelector('.quick-toggle').click()")
    page.wait_for_function('fixtureSettings.enabled===false')
    assert page.locator('article [data-oya-host]').count() == 0
    page.evaluate("controlShadow().querySelector('.quick-toggle').click()")
    page.wait_for_function('fixtureSettings.enabled===true')
    page.wait_for_selector('#bad.oya-dim')
    page.evaluate("()=>{const select=controlShadow().querySelector('[aria-label=\"Apply a profile\"]');select.value='saved:11111111-1111-4111-8111-111111111111';select.dispatchEvent(new Event('change',{bubbles:true}));}")
    page.wait_for_function("fixtureSettings.threshold===64&&fixtureSettings.behavior==='label'")
    assert page.evaluate("controlShadow().querySelector('[aria-label=\"Apply a profile\"]').value") == 'saved:11111111-1111-4111-8111-111111111111'
    page.screenshot(path=str(OUT / 'x-profile-selected-dark.png'))
    assert page.locator('#bad.oya-dim,#bad.oya-collapse,#bad.oya-hide').count() == 0
    assert page.evaluate('fixtureCount') == quick_count
    page.keyboard.press('Escape')
    assert page.evaluate("!controlShadow().querySelector('.quick-menu').matches(':popover-open')")
    assert page.evaluate("controlShadow().activeElement.classList.contains('main')")
    page.evaluate("controlShadow().querySelector('.main').click()")
    assert page.evaluate("controlShadow().querySelector('[aria-label=\"Apply a profile\"]').value") == 'saved:11111111-1111-4111-8111-111111111111'
    page.evaluate("controlShadow().querySelector('.advanced').click()")
    page.wait_for_function("fixtureMessages.includes('OPEN_OPTIONS')")
    assert page.evaluate("fixtureRequests.findLast(message=>message.type==='OPEN_OPTIONS').panel") == 'connection'
    page.evaluate("updateSettings({enabled:true,threshold:58,behavior:'collapse'})")
    page.wait_for_selector('#bad.oya-collapse')

    # The explicit position menu supports every corner and reset by keyboard.
    page.evaluate("""()=>{for(const [id,bottom] of [['host-chat',12],['host-grok',79]]){const button=document.createElement('button');button.id=id;button.textContent=id;button.style.cssText=`position:fixed;right:16px;bottom:${bottom}px;width:55px;height:55px`;document.body.append(button);}}""")
    page.evaluate("controlShadow().querySelector('.position').focus()")
    page.keyboard.press('Enter')
    page.wait_for_function("controlShadow().querySelector('.position-menu').matches(':popover-open')")
    page.screenshot(path=str(OUT / 'x-control-position.png'))
    for preset in ['top-right', 'bottom-right', 'bottom-left', 'top-left']:
        page.evaluate("preset=>controlShadow().querySelector('[data-preset=\"'+preset+'\"]').focus()", preset)
        page.keyboard.press('Enter')
        page.wait_for_function('preset=>fixturePosition.preset===preset', arg=preset)
        bounds = page.locator('#oya-control').bounding_box()
        assert abs(bounds['x'] - (1050 - bounds['width'] - 16 if preset.endswith('right') else 16)) < 1
        expected_y = 900 - bounds['height'] - (150 if preset == 'bottom-right' else 16) if preset.startswith('bottom') else 16
        assert abs(bounds['y'] - expected_y) < 1
        if preset == 'bottom-right':
            for host_id in ['#host-chat','#host-grok']:
                host = page.locator(host_id).bounding_box()
                assert bounds['x'] + bounds['width'] <= host['x'] or host['x'] + host['width'] <= bounds['x'] or bounds['y'] + bounds['height'] <= host['y'] or host['y'] + host['height'] <= bounds['y']
    page.keyboard.press('Escape')
    assert page.evaluate("controlShadow().activeElement.classList.contains('position')")
    page.locator('#host-chat,#host-grok').evaluate_all('(nodes)=>nodes.forEach(node=>node.remove())')

    # Dragging the main surface saves its relative position, without opening settings.
    options_before_drag = page.evaluate("fixtureMessages.filter(type=>type==='OPEN_OPTIONS').length")
    bounds = page.locator('#oya-control').bounding_box()
    page.mouse.move(bounds['x'] + 65, bounds['y'] + 20)
    page.mouse.down()
    page.mouse.move(650, 290, steps=12)
    page.mouse.up()
    page.wait_for_function("fixturePosition.preset==='custom'")
    assert page.evaluate("fixtureMessages.filter(type=>type==='OPEN_OPTIONS').length") == options_before_drag
    custom_bounds = page.locator('#oya-control').bounding_box()
    persisted_position = page.evaluate('fixturePosition')
    page.reload()
    inject()
    page.wait_for_selector('#bad.oya-collapse')
    page.evaluate('document.fonts.ready')
    assert page.evaluate('fixturePosition') == persisted_position
    restored_bounds = page.locator('#oya-control').bounding_box()
    assert abs(restored_bounds['x'] - custom_bounds['x']) < 1
    assert abs(restored_bounds['y'] - custom_bounds['y']) < 1
    page.set_viewport_size({'width': 320, 'height': 400})
    page.wait_for_function("(()=>{const r=document.querySelector('#oya-control').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})()")
    assert page.evaluate('fixturePosition') == persisted_position
    page.set_viewport_size({'width': 1050, 'height': 900})
    page.evaluate("controlShadow().querySelector('.position').focus()")
    page.keyboard.press('Home')
    page.wait_for_function("fixturePosition.preset==='top-left'")
    page.keyboard.press('ArrowRight')
    page.keyboard.press('Shift+ArrowDown')
    page.wait_for_function("fixturePosition.preset==='custom'")
    bounds = page.locator('#oya-control').bounding_box()
    assert abs(bounds['x'] - 26) < 1 and abs(bounds['y'] - 56) < 1
    page.evaluate('fixtureSaveError=true')
    page.keyboard.press('Home')
    page.wait_for_selector('#oya-control[data-position-error]')
    assert page.evaluate("controlShadow().querySelector('.save-status').textContent") == 'Position not saved. Choose a position to retry.'
    page.evaluate('fixtureSaveError=false')
    page.keyboard.press('Enter')
    page.wait_for_function("controlShadow().querySelector('.position-menu').matches(':popover-open')")
    page.evaluate("controlShadow().querySelector('.reset').focus()")
    page.keyboard.press('Enter')
    page.wait_for_function("fixturePosition.preset==='top-left'&&!document.querySelector('#oya-control').hasAttribute('data-position-error')")
    page.keyboard.press('Escape')

    # Moving/focusing over the replacement, and unrelated React-like mutations,
    # must never reveal the original post or increase its height.
    page.locator('#bad').hover()
    page.evaluate("shadow('#bad').querySelector('.reveal').focus()")
    page.evaluate("document.querySelector('#bad time').textContent='4h'")
    page.wait_for_timeout(1700)
    assert page.locator('#bad [data-testid="tweetText"]').is_hidden()
    assert page.locator('#bad').bounding_box()['height'] == 90
    page.evaluate("document.querySelector('#bad').className='host-react-update'")
    page.wait_for_selector('#bad.oya-collapse')
    assert page.locator('#bad [data-testid="tweetText"]').is_hidden()
    page.evaluate("document.querySelector('#bad [data-oya-host]').remove()")
    page.wait_for_selector('#bad [data-oya-host]')
    assert page.locator('#bad [data-testid="tweetText"]').is_hidden()

    # The score is a real keyboard button. Its popover must not move the post.
    good_before = page.locator('#good').bounding_box()
    page.evaluate("shadow('#good').querySelector('.score').focus()")
    page.keyboard.press('Enter')
    page.wait_for_function("shadow('#good').querySelector('.details').matches(':popover-open')")
    assert page.evaluate("shadow('#good').querySelector('.score').getAttribute('aria-expanded')") == 'true'
    assert page.evaluate("shadow('#good').querySelector('.score').hasAttribute('title')") is False
    assert page.locator('#good').bounding_box() == good_before
    assert page.evaluate("shadow('#good').querySelectorAll('.row').length") == 5
    score_box = page.evaluate("()=>{const r=shadow('#good').querySelector('.score').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}}")
    detail_box = page.evaluate("()=>{const r=shadow('#good').querySelector('.details').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}}")
    assert detail_box['x'] <= score_box['x'] + score_box['width'] + 0.5
    page.mouse.move(score_box['x'] + score_box['width'] / 2, score_box['y'] + score_box['height'] / 2)
    page.mouse.move(detail_box['x'] + 20, detail_box['y'] + 20, steps=8)
    assert page.evaluate("shadow('#good').querySelector('.details').matches(':popover-open')")
    page.evaluate("globalThis.openDetailHost=document.querySelector('#good [data-oya-host]');document.querySelector('#good').className='host-hover-update'")
    page.wait_for_timeout(150)
    assert page.evaluate("document.querySelector('#good [data-oya-host]')===openDetailHost")
    assert page.evaluate("shadow('#good').querySelector('.details').matches(':popover-open')")
    page.screenshot(path=str(OUT / 'x-details.png'))
    page.keyboard.press('Escape')
    page.wait_for_function("!shadow('#good').querySelector('.details').matches(':popover-open')")

    # Peek temporarily unfolds a collapsed post without changing its evaluation
    # or the explicit reveal choice. Pointer travel into the preview keeps it open.
    peek_count = page.evaluate('fixtureCount')
    peek_box = page.evaluate("()=>{const r=shadow('#bad').querySelector('.peek').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}}")
    page.screenshot(path=str(OUT / 'x-peek-motion-00.png'))
    page.mouse.move(peek_box['x'] + peek_box['width'] / 2, peek_box['y'] + peek_box['height'] / 2)
    page.wait_for_selector('#bad.oya-peek')
    page.wait_for_timeout(70)
    page.screenshot(path=str(OUT / 'x-peek-motion-01.png'))
    page.wait_for_timeout(150)
    page.screenshot(path=str(OUT / 'x-peek-motion-02.png'))
    page.wait_for_timeout(170)
    page.screenshot(path=str(OUT / 'x-peek-motion-03.png'))
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / 'x-peek-motion-04.png'))
    page.wait_for_function("shadow('#bad').querySelector('.peek').getAttribute('aria-expanded')==='true'")
    assert page.locator('#bad [data-testid="tweetText"]').is_visible()
    assert page.evaluate("getComputedStyle(document.querySelector('#bad .post')).display") == 'grid'
    assert page.evaluate("shadow('#bad').querySelector('.peek').getAttribute('aria-pressed')") == 'false'
    copy_box = page.locator('#bad [data-testid="tweetText"]').bounding_box()
    page.mouse.move(copy_box['x'] + copy_box['width'] / 2, copy_box['y'] + copy_box['height'] / 2, steps=8)
    page.wait_for_timeout(800)
    assert page.locator('#bad [data-testid="tweetText"]').is_visible()
    assert page.evaluate("(()=>{const post=document.querySelector('#bad');return post.scrollHeight<=post.clientHeight+1})()")
    page.evaluate("globalThis.peekHost=document.querySelector('#bad [data-oya-host]');document.querySelector('#bad').className='x-react-update'")
    page.wait_for_selector('#bad.oya-collapse.oya-peek')
    assert page.evaluate("document.querySelector('#bad [data-oya-host]')===peekHost")
    assert page.evaluate("shadow('#bad').querySelector('.peek').getAttribute('aria-expanded')") == 'true'
    assert page.locator('#bad [data-testid="tweetText"]').is_visible()
    page.screenshot(path=str(OUT / 'x-peek.png'))

    # Closing is a real fold and can be interrupted without snapping back to 88px.
    open_height = page.locator('#bad').bounding_box()['height']
    page.mouse.move(1038, 890)
    page.wait_for_selector('#bad.oya-peek-closing')
    page.wait_for_timeout(70)
    page.screenshot(path=str(OUT / 'x-peek-motion-close-01.png'))
    page.wait_for_timeout(100)
    closing_height = page.locator('#bad').bounding_box()['height']
    assert 88 < closing_height < open_height
    page.screenshot(path=str(OUT / 'x-peek-motion-close-02.png'))
    reentry_box = page.evaluate("()=>{const r=shadow('#bad').querySelector('.peek').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}}")
    page.mouse.move(reentry_box['x'] + reentry_box['width'] / 2, reentry_box['y'] + reentry_box['height'] / 2)
    page.wait_for_function("shadow('#bad').querySelector('.peek').getAttribute('aria-expanded')==='true'")
    page.wait_for_timeout(80)
    assert page.locator('#bad').bounding_box()['height'] >= closing_height - 1
    page.screenshot(path=str(OUT / 'x-peek-motion-reentry-01.png'))
    page.wait_for_timeout(120)
    page.screenshot(path=str(OUT / 'x-peek-motion-reentry-02.png'))
    page.wait_for_selector('#bad.oya-peek.oya-peek-stable')
    assert page.evaluate("shadow('#bad').host.hasAttribute('data-peek-stable')")
    page.screenshot(path=str(OUT / 'x-peek-motion-reentry-03.png'))
    page.mouse.move(1038, 890)
    page.wait_for_function("!document.querySelector('#bad').classList.contains('oya-peek')&&!document.querySelector('#bad').classList.contains('oya-peek-closing')")
    assert page.locator('#bad [data-testid="tweetText"]').is_hidden()
    assert page.evaluate('fixtureCount') == peek_count

    # Keyboard activation pins the temporary preview until Escape.
    page.evaluate("shadow('#bad').querySelector('.peek').focus()")
    page.wait_for_selector('#bad.oya-peek')
    page.keyboard.press('Enter')
    assert page.evaluate("shadow('#bad').querySelector('.peek').getAttribute('aria-pressed')") == 'true'
    page.mouse.move(1038, 890)
    page.wait_for_timeout(450)
    assert page.locator('#bad [data-testid="tweetText"]').is_visible()
    page.evaluate("document.querySelector('#bad .post').style.paddingBottom='180px'")
    page.wait_for_function("(()=>{const post=document.querySelector('#bad');return post.scrollHeight<=post.clientHeight+1})()")
    page.evaluate("document.querySelector('#bad .actions button').focus()")
    page.keyboard.press('Escape')
    page.wait_for_function("!document.querySelector('#bad').classList.contains('oya-peek')&&!document.querySelector('#bad').classList.contains('oya-peek-closing')")
    assert page.locator('#bad [data-testid="tweetText"]').is_hidden()
    assert page.evaluate("shadow('#bad').activeElement.classList.contains('peek')")
    page.evaluate("document.querySelector('#bad .post').style.removeProperty('padding-bottom')")

    # Show anyway is the only action that permanently reveals this post.
    page.evaluate("shadow('#bad').querySelector('.reveal').focus()")
    page.keyboard.press('Enter')
    assert page.locator('#bad [data-testid="tweetText"]').is_visible()
    assert page.evaluate("shadow('#bad').activeElement.classList.contains('score')")
    # Live regression: X uses inline spans, explicit line breaks and image emoji.
    # A reveal must remain stable over DOM callbacks and several periodic scans.
    reveal_count = page.evaluate('fixtureCount')
    reveal_samples = page.evaluate("""async()=>{
      const samples=[];
      for(let i=0;i<8;i++){
        document.querySelector('#bad time').textContent=`${5+i}h`;
        await new Promise(resolve=>setTimeout(resolve,550));
        const post=document.querySelector('#bad');
        samples.push({collapsed:post.classList.contains('oya-collapse'),visible:post.querySelector('[data-testid=tweetText]').getClientRects().length>0,evaluations:fixtureCount});
      }
      return samples;
    }""")
    assert all(sample['visible'] and not sample['collapsed'] and sample['evaluations'] == reveal_count for sample in reveal_samples), reveal_samples
    page.evaluate("document.querySelector('#bad').replaceWith(document.querySelector('#bad').cloneNode(true))")
    page.wait_for_timeout(1900)
    assert page.locator('#bad [data-testid="tweetText"]').is_visible()
    assert page.locator('#bad [data-oya-host]').count() == 1

    # Reusing the same node for edited text must discard the explicit reveal.
    page.evaluate("document.querySelector('#bad [data-testid=tweetText]').textContent='Comment here for another secret list of tools.'")
    page.wait_for_selector('#bad.oya-collapse')
    assert page.locator('#bad [data-testid="tweetText"]').is_hidden()
    page.evaluate("updateSettings({showBadges:false})")
    assert page.locator('#bad [data-oya-host]').is_visible()
    assert page.locator('#good [data-oya-host]').count() == 0
    page.evaluate("shadow('#bad').querySelector('.reveal').focus()")
    page.keyboard.press('Enter')
    assert page.locator('#bad [data-testid="tweetText"]').is_visible()
    assert page.evaluate("document.activeElement.closest('#bad')!==null")

    # Hide consumes no space and has one explicit, global recovery action.
    page.evaluate("updateSettings({behavior:'hide',showBadges:true});document.querySelector('#bad a').href='/demo/status/204';const cell=document.createElement('div');cell.dataset.testid='cellInnerDiv';cell.id='hide-cell';const post=document.querySelector('#bad');post.before(cell);cell.append(post)")
    page.wait_for_selector('#hide-cell.oya-hide-cell', state='attached')
    assert page.locator('#hide-cell').bounding_box() is None
    assert page.locator('#bad').bounding_box() is None
    assert page.locator('#bad [data-oya-host]').count() == 0
    assert page.evaluate("controlShadow().querySelector('.show-hidden').textContent") == 'Show hidden posts (1)'
    page.evaluate("document.querySelector('#hide-cell').className='react-cell-update'")
    page.wait_for_selector('#hide-cell.oya-hide-cell', state='attached')
    page.evaluate("history.pushState({},'', '/messages');window.dispatchEvent(new PopStateEvent('popstate'))")
    assert page.locator('#hide-cell').is_visible()
    assert page.locator('#bad').is_visible()
    page.evaluate("history.pushState({},'', '/home');window.dispatchEvent(new PopStateEvent('popstate'))")
    page.wait_for_selector('#bad.oya-hide', state='attached')
    page.evaluate("document.querySelector('#hide-cell').insertAdjacentHTML('beforeend','<button id=host-action>Native X action</button>')")
    page.wait_for_selector('#host-action')
    assert page.locator('#bad').is_hidden()
    page.locator('#host-action').evaluate('(button)=>button.remove()')
    page.wait_for_selector('#hide-cell.oya-hide-cell', state='attached')
    page.evaluate("globalThis.fixtureDetachedCell=document.querySelector('#hide-cell');fixtureDetachedCell.remove()")
    page.wait_for_function("!fixtureDetachedCell.classList.contains('oya-hide-cell')&&!fixtureDetachedCell.querySelector('#bad').classList.contains('oya-hide')")
    page.evaluate("updateSettings({enabled:false});document.querySelector('#media').before(fixtureDetachedCell)")
    page.wait_for_selector('#bad')
    assert page.locator('#hide-cell').is_visible()
    page.evaluate("updateSettings({enabled:true})")
    page.wait_for_selector('#hide-cell.oya-hide-cell', state='attached')
    page.evaluate("controlShadow().querySelector('.main').focus()")
    page.keyboard.press('Enter')
    page.screenshot(path=str(OUT / 'x-hide.png'))
    page.evaluate("controlShadow().querySelector('.quick-menu .show-hidden').focus()")
    page.keyboard.press('Enter')
    assert page.locator('#bad [data-testid="tweetText"]').is_visible()
    assert page.locator('#hide-cell').is_visible()
    assert page.evaluate("controlShadow().querySelector('.quick-menu .show-hidden').hidden")
    page.evaluate("document.querySelector('#bad').replaceWith(document.querySelector('#bad').cloneNode(true))")
    page.wait_for_timeout(1900)
    assert page.locator('#bad [data-testid="tweetText"]').is_visible()
    page.evaluate("document.querySelector('#bad a').href='/demo/status/205'")
    page.wait_for_selector('#bad.oya-hide', state='attached')
    page.evaluate("updateSettings({enabled:false})")
    assert page.locator('#hide-cell').is_visible()
    assert page.locator('#bad').is_visible()
    page.evaluate("updateSettings({enabled:true})")
    page.wait_for_selector('#bad.oya-hide', state='attached')
    page.evaluate("const old=document.querySelector('#bad');const replacement=old.cloneNode(true);replacement.id='replacement';replacement.querySelector('a').href='/demo/status/206';replacement.querySelector('[data-testid=tweetText]').textContent='A detailed caching benchmark with reproducible examples.';old.replaceWith(replacement)")
    page.wait_for_selector('#replacement.oya-highlight')
    assert page.locator('#hide-cell').is_visible()
    assert page.locator('#replacement').is_visible()
    page.evaluate("document.querySelector('#replacement').id='bad';document.querySelector('#bad [data-testid=tweetText]').textContent='Comment for yet another secret tool list.';updateSettings({behavior:'collapse'})")

    # A different post id must not inherit the old node's reveal state.
    page.evaluate("updateSettings({showBadges:true});document.querySelector('#bad a').href='/demo/status/104'")
    page.wait_for_selector('#bad.oya-collapse')
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert page.locator('#bad [data-oya-host]').bounding_box()['height'] == 88
    page.screenshot(path=str(OUT / 'x-peek-narrow-motion-00.png'))
    page.evaluate("shadow('#bad').querySelector('.peek').focus()")
    page.wait_for_selector('#bad.oya-peek')
    page.wait_for_timeout(90)
    page.screenshot(path=str(OUT / 'x-peek-narrow-motion-01.png'))
    page.wait_for_timeout(180)
    page.screenshot(path=str(OUT / 'x-peek-narrow-motion-02.png'))
    page.wait_for_timeout(430)
    page.screenshot(path=str(OUT / 'x-peek-narrow-motion-03.png'))
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert page.evaluate("getComputedStyle(document.querySelector('#bad .post')).display") == 'grid'
    page.screenshot(path=str(OUT / 'x-peek-narrow.png'))
    page.keyboard.press('Escape')
    page.wait_for_function("!document.querySelector('#bad').classList.contains('oya-peek')&&!document.querySelector('#bad').classList.contains('oya-peek-closing')")
    page.wait_for_timeout(450)
    page.screenshot(path=str(OUT / 'x-injection-narrow.png'))
    page.set_viewport_size({'width': 320, 'height': 844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert page.locator('#bad [data-oya-host]').bounding_box()['height'] == 88
    page.set_viewport_size({'width': 390, 'height': 844})

    # Dimming uses the same margin indicator and explicit reveal in the details.
    page.evaluate("updateSettings({behavior:'dim'})")
    page.wait_for_selector('#bad.oya-dim')
    assert page.locator('#bad [data-oya-host]').bounding_box()['width'] == 32
    page.evaluate("shadow('#bad').querySelector('.score').focus()")
    page.keyboard.press('Enter')
    page.wait_for_function("shadow('#bad').querySelector('.details').matches(':popover-open')")
    page.evaluate("shadow('#bad').querySelector('.reveal').focus()")
    page.keyboard.press('Space')
    assert page.locator('#bad.oya-dim').count() == 0
    page.evaluate("document.body.style.color='rgb(15, 20, 25)';updateSettings({})")
    assert page.evaluate("getComputedStyle(shadow('#good').querySelector('.score')).color") == 'rgb(15, 20, 25)'

    # Uncertain and failed evaluations stay visible, without a misleading score.
    page.evaluate("updateSettings({behavior:'hide'})")
    page.evaluate("document.querySelector('#good [data-testid=tweetText]').textContent='An uncertain example for the synthetic fixture.'")
    page.wait_for_function("shadow('#good')?.querySelector('.score')?.textContent==='?'")
    assert page.locator('#good.oya-collapse,#good.oya-dim').count() == 0
    page.evaluate("document.querySelector('#good [data-testid=tweetText]').textContent='A provider failure example for the synthetic fixture.'")
    page.wait_for_function("fixtureShadows.get(document.querySelector('#oya-control')).textContent.includes('Check connection')")
    assert page.locator('#good [data-testid=tweetText]').is_visible()
    assert page.locator('#good [data-oya-host]').count() == 0

    # Advanced settings remains available from the in-page control; pausing/routes restore X.
    options_before_advanced = page.evaluate("fixtureMessages.filter(type=>type==='OPEN_OPTIONS').length")
    page.evaluate("controlShadow().querySelector('.main').click();controlShadow().querySelector('.advanced').click()")
    page.wait_for_function("count=>fixtureMessages.filter(type=>type==='OPEN_OPTIONS').length===count", arg=options_before_advanced + 1)
    page.evaluate("updateSettings({enabled:false})")
    assert page.locator('article [data-oya-host]').count() == 0
    count = page.evaluate('fixtureCount')
    page.evaluate("history.pushState({},'', '/messages');window.dispatchEvent(new PopStateEvent('popstate'))")
    page.wait_for_timeout(400)
    assert page.locator('#oya-control').is_hidden()
    assert page.evaluate('fixtureCount') == count
    assert not blocked, blocked
    assert not errors, errors
    browser.close()
    print('X injection: PASS (rail, collapse, Peek open/fold/re-entry/pin/Escape, async resize, class churn, Hide/recovery, safe wrapper reuse, pointer/keyboard positioning, persistence, resize bounds, storage recovery, explicit reveal, uncertainty, route privacy, no external requests)')
