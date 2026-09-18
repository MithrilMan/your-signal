"""Native MV3 smoke test in an isolated, offline Chromium profile.

Run: .venv/Scripts/python.exe tests/extension_smoke.py
Requires Playwright and Chromium. CHROMIUM_PATH overrides the local executable.
Chrome runtime/storage APIs and content-script injection are real. The X document
is an offline fixture; no real key, personal data, or TypeSafe request is used.
Native optional-host permission prompts and live provider calls are not tested.
"""

import json
import os
from pathlib import Path
import shutil
from tempfile import TemporaryDirectory

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'
FAKE_KEY = 'offline-fixture-key-not-a-real-credential'
MANIFEST = json.loads((ROOT / 'extension' / 'manifest.json').read_text(encoding='utf-8'))
X_URL = 'https://x.com/home'
X_HTML = '''<!doctype html><html lang="en"><head>
<meta charset="utf-8"><link rel="icon" href="data:,">
<title>Offline X extension fixture</title></head><body>
<main><article data-testid="tweet">
<a href="/demo/status/101"><time>12:01</time></a>
<div data-testid="tweetText">An offline example of reproducible caching.</div>
</article></main></body></html>'''


def send(page, message):
    response = page.evaluate('message => chrome.runtime.sendMessage(message)', message)
    assert response.get('ok'), response
    return response['data']


def assert_key_storage(page, *, persistent):
    stored = page.evaluate('''async () => ({
        local: await chrome.storage.local.get('jevKey'),
        session: await chrome.storage.session.get('jevKey')
    })''')
    selected, other = ('local', 'session') if persistent else ('session', 'local')
    assert stored[selected] == {'jevKey': FAKE_KEY}, stored
    assert stored[other] == {}, stored


def wait_settings(page, expected):
    for _ in range(200):
        state=send(page, {'type':'UI_STATE'})
        if all(state['settings'].get(key)==value for key,value in expected.items()):
            return state
        page.wait_for_timeout(50)
    raise AssertionError({'expected':expected,'actual':state['settings']})


def set_range(page, selector, value):
    """Exercise the actual slider input through keyboard interaction."""
    slider=page.locator(selector)
    minimum=int(slider.get_attribute('min') or 0)
    maximum=int(slider.get_attribute('max') or 100)
    step=int(slider.get_attribute('step') or 1)
    slider.focus()
    if value-minimum <= maximum-value:
        slider.press('Home')
        for _ in range((value-minimum)//step):
            slider.press('ArrowRight')
    else:
        slider.press('End')
        for _ in range((maximum-value)//step):
            slider.press('ArrowLeft')
    assert slider.input_value()==str(value)


def wait_popup(popup):
    popup.wait_for_function("() => document.querySelector('#popup-interests').value.length > 0")
    popup.evaluate('() => document.fonts.ready.then(() => true)')


def assert_popup_preferences(popup, expected):
    assert popup.locator('#popup-interests').input_value()==expected['interests']
    assert popup.locator('#popup-threshold').input_value()==str(expected['threshold'])
    assert popup.locator('#popup-threshold-value').inner_text()==str(expected['threshold'])
    assert popup.locator('[name="popup-behavior"]:checked').input_value()==expected['behavior']
    for name,value in expected['weights'].items():
        assert popup.locator('#popup-weight-'+name).input_value()==str(value)
        assert popup.locator('#popup-value-'+name).inner_text()==str(value)


def exercise_popup_profiles(popup, options):
    expected={
        'interests':'Distributed systems, readable interfaces',
        'weights':{'relevance':15,'substance':25,'actionable':35,'promotion':45,'bait':55},
        'threshold':67,
        'behavior':'collapse',
    }
    popup.locator('#popup-interests').fill(expected['interests'])
    for name,value in expected['weights'].items():
        set_range(popup,'#popup-weight-'+name,value)
    set_range(popup,'#popup-threshold',expected['threshold'])
    popup.locator('[name="popup-behavior"][value="collapse"]').check()
    wait_settings(popup,expected)
    assert_popup_preferences(popup,expected)
    assert popup.locator('#popup-preset').input_value()=='custom'

    # The profile form saves through its real UI and actual MV3 worker.
    popup.locator('#popup-new-profile').click()
    assert popup.locator('#popup-profile-name').evaluate('element=>element===document.activeElement')
    popup.locator('#popup-profile-name').fill('Focused research')
    popup.locator('#popup-profile-form button[type="submit"]').click()
    popup.wait_for_function("() => document.querySelector('#popup-profile-form').hidden")
    state=send(popup,{'type':'UI_STATE'})
    assert len(state['customProfiles'])==1,state
    profile=state['customProfiles'][0]
    assert profile['name']=='Focused research',profile
    assert set(profile['settings'])=={'interests','weights','threshold','highlightThreshold','minimumMargin','behavior'},profile
    assert FAKE_KEY not in json.dumps(profile),profile
    for key,value in expected.items():
        assert profile['settings'][key]==value,profile
    profile_id=profile['id']
    popup.reload()
    wait_popup(popup)
    assert_popup_preferences(popup,expected)
    assert popup.locator('#popup-preset').input_value()=='saved:'+profile_id
    assert popup.locator(f'#popup-preset option[value="saved:{profile_id}"]').inner_text()=='Focused research'

    # Apply a built-in profile, then recover every custom preference from storage.
    popup.locator('#popup-preset').select_option('focus')
    wait_settings(popup,{'threshold':68})
    assert popup.locator('#popup-weight-relevance').input_value()=='100'
    popup.locator('#popup-preset').select_option('saved:'+profile_id)
    wait_settings(popup,expected)
    assert_popup_preferences(popup,expected)

    # Editing an active saved profile and saving its name updates rather than duplicates.
    popup.reload()
    wait_popup(popup)
    expected['weights']['relevance']=20
    expected['behavior']='hide'
    set_range(popup,'#popup-weight-relevance',20)
    popup.locator('[name="popup-behavior"][value="hide"]').check()
    popup.locator('#popup-new-profile').click()
    assert popup.locator('#popup-profile-name').input_value()=='Focused research'
    popup.locator('#popup-profile-form button[type="submit"]').click()
    popup.wait_for_function("() => document.querySelector('#popup-profile-form').hidden")
    state=send(popup,{'type':'UI_STATE'})
    assert len(state['customProfiles'])==1,state
    assert state['customProfiles'][0]['id']==profile_id,state
    assert state['customProfiles'][0]['settings']['weights']['relevance']==20,state
    assert state['customProfiles'][0]['settings']['behavior']=='hide',state
    assert state['settings']['enabled'] is False,state
    assert_key_storage(options,persistent=False)
    popup.reload()
    wait_popup(popup)
    assert_popup_preferences(popup,expected)

    # Dashboard discovers the same profile and can apply/delete it independently.
    options.goto(options.url.split('#')[0]+'#algorithm')
    options.reload()
    options.wait_for_selector('.sample-post')
    assert options.locator('#saved-profiles').is_visible()
    assert options.locator('#saved-profile').input_value()==profile_id
    assert options.locator('#interests').input_value()==expected['interests']
    assert options.locator('#threshold').input_value()==str(expected['threshold'])
    assert options.locator('[name="behavior"]:checked').input_value()==expected['behavior']
    assert options.locator('#preview-posts .sample-post').count()==2
    assert 'Demo account · promotion' not in options.locator('#preview-posts').inner_text()
    recover=options.get_by_role('button',name='Show hidden demo posts (1)',exact=True)
    assert recover.count()==1
    recover.press('Enter')
    assert options.locator('#preview-posts .sample-post').count()==3
    assert 'Demo account · promotion' in options.locator('#preview-posts').inner_text()
    assert recover.count()==0
    for name,value in expected['weights'].items():
        assert options.locator('#weight-'+name).input_value()==str(value)
    options.locator('[data-preset="builder"]').click()
    wait_settings(options,{'threshold':58})
    options.locator('#saved-profile').select_option(profile_id)
    wait_settings(options,expected)
    options.locator('#delete-profile').click()
    options.wait_for_function("() => document.querySelector('#saved-profiles').hidden")
    state=send(options,{'type':'UI_STATE'})
    assert state['customProfiles']==[],state
    for key,value in expected.items():
        assert state['settings'][key]==value,state
    popup.reload()
    wait_popup(popup)
    assert_popup_preferences(popup,expected)
    assert popup.locator('#popup-preset').input_value()=='custom'
    assert popup.locator('#popup-preset [data-saved-profiles]').count()==0

    # No timeline is open, so toggling validates persistence without provider calls.
    popup.locator('#popup-toggle').click()
    wait_settings(popup,{'enabled':True})
    popup.reload()
    wait_popup(popup)
    assert popup.locator('#popup-toggle').get_attribute('aria-checked')=='true'
    popup.locator('#popup-toggle').click()
    wait_settings(popup,{'enabled':False})
    assert popup.locator('#popup-toggle').get_attribute('aria-checked')=='false'
    assert popup.locator('#popup-message').inner_text()==''
    assert popup.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert popup.evaluate('document.documentElement.scrollHeight <= innerHeight')
    assert popup.locator('#popup-open').bounding_box()['y']+popup.locator('#popup-open').bounding_box()['height']<=600
    return expected


def content_evaluate(cdp, context_id, expression):
    result = cdp.send('Runtime.evaluate', {
        'expression': expression,
        'contextId': context_id,
        'awaitPromise': True,
        'returnByValue': True,
    })
    assert 'exceptionDetails' not in result, result
    return result['result'].get('value')


def main():
    OUT.mkdir(exist_ok=True)
    extension = (ROOT / 'extension').resolve()
    with sync_playwright() as playwright, TemporaryDirectory(
        prefix='mv3-profile-', dir=OUT
    ) as profile:
        executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or playwright.chromium.executable_path
        if not Path(executable).is_file():
            raise RuntimeError('Chromium not found; install Playwright Chromium or set CHROMIUM_PATH.')
        # Restrict temporary profile cleanup to this workspace's test artifacts.
        assert Path(profile).resolve().is_relative_to(OUT.resolve())
        context = playwright.chromium.launch_persistent_context(
            profile,
            executable_path=str(executable),
            headless=True,
            args=[
                f'--disable-extensions-except={extension}',
                f'--load-extension={extension}',
                '--disable-background-networking',
                '--disable-component-update',
                '--no-first-run',
            ],
        )
        try:
            # Offline mode also protects service-worker fetches, which page routes
            # alone do not reliably intercept. Only the document fixture is served.
            context.set_offline(True)
            blocked_requests = []

            def route_request(route):
                if route.request.url == X_URL:
                    route.fulfill(status=200, content_type='text/html', body=X_HTML)
                elif route.request.url.startswith(('http://', 'https://')):
                    blocked_requests.append(route.request.url)
                    route.abort()
                else:
                    route.continue_()

            context.route('**/*', route_request)
            worker = (context.service_workers or [None])[0]
            if worker is None:
                worker = context.wait_for_event('serviceworker', timeout=15000)
            extension_id = worker.url.split('/')[2]
            origin = f'chrome-extension://{extension_id}'
            assert worker.url == origin + '/' + MANIFEST['background']['service_worker'], worker.url
            assert worker.evaluate('chrome.runtime.getManifest().manifest_version') == 3

            options = context.new_page()
            errors = []
            options.on('pageerror', lambda error: errors.append(str(error)))
            options.goto(origin + '/options.html')
            options.wait_for_selector('.sample-post')
            options.wait_for_function("() => document.querySelector('#interests').value.length > 0")
            state = send(options, {'type': 'UI_STATE'})
            assert state['hasJevKey'] is False, state
            assert state['settings']['enabled'] is False, state
            assert state['settings']['theme'] == 'system', state
            assert options.locator('#theme').input_value() == 'system'
            options.locator('#theme').select_option('dark')
            wait_settings(options, {'theme': 'dark'})
            assert options.locator('html').get_attribute('data-theme') == 'dark'
            state = send(options, {'type': 'UI_STATE'})
            assert state['settings']['theme'] == 'dark', state
            options.screenshot(path=str(OUT/'native-options-dark.png'),full_page=True)
            options.set_viewport_size({'width':390,'height':844})
            assert options.evaluate('document.documentElement.scrollWidth <= innerWidth')
            options.screenshot(path=str(OUT/'native-options-dark-mobile.png'),full_page=True)
            options.set_viewport_size({'width':1280,'height':720})
            assert options.locator('#preview-banner').is_hidden()
            assert options.evaluate('chrome.runtime.id') == extension_id
            options.locator('[data-panel="privacy"]').click()
            assert options.locator('#hide-ads').is_checked() is False
            options.locator('#hide-ads').check()
            wait_settings(options, {'hideAds': True})
            options.locator('#hide-ads').uncheck()
            wait_settings(options, {'hideAds': False})
            assert send(options, {'type': 'UI_STATE'})['settings']['theme'] == 'dark'
            options.locator('[data-panel="algorithm"]').click()

            settings = {**state['settings'], 'enabled': False}
            send(options, {
                'type': 'UI_SAVE', 'settings': settings,
                'jevKey': FAKE_KEY, 'rememberKey': False,
            })
            state = send(options, {'type': 'UI_STATE'})
            assert state['hasJevKey'] is True, state
            assert state['settings']['theme'] == 'dark', state
            assert state['rememberKey'] is False, state
            assert_key_storage(options, persistent=False)
            options.reload()
            options.wait_for_selector('.sample-post')
            assert options.locator('#theme').input_value() == 'dark'
            options.locator('[data-panel="connection"]').click()
            assert not options.locator('#remember-key').is_checked()
            assert options.locator('#jev-key').input_value() == ''

            # Changing persistence with an empty replacement field moves the
            # existing key between the actual Chrome storage areas.
            for persistent in (True, False):
                send(options, {
                    'type': 'UI_SAVE', 'settings': settings,
                    'jevKey': '', 'rememberKey': persistent,
                })
                assert_key_storage(options, persistent=persistent)
                state = send(options, {'type': 'UI_STATE'})
                assert state['rememberKey'] is persistent, state
                assert state['settings']['theme'] == 'dark', state

            public = send(options, {'type': 'GET_PUBLIC'})
            assert set(public) == {'settings', 'overlayPosition', 'quickProfiles', 'activeProfile', 'evaluationRevision'}, public
            assert public['overlayPosition']=={'preset':'top-left'},public
            assert public['quickProfiles']==[],public
            assert FAKE_KEY not in json.dumps(public), public

            popup = context.new_page()
            popup.set_viewport_size({'width': 400, 'height': 600})
            popup.on('pageerror', lambda error: errors.append(str(error)))
            popup.goto(origin + '/popup.html')
            wait_popup(popup)
            assert popup.locator('#popup-theme').input_value() == 'dark', {
                'select': popup.locator('#popup-theme').input_value(),
                'dataset': popup.locator('html').get_attribute('data-theme'),
                'stored': send(options, {'type': 'UI_STATE'})['settings']['theme'],
            }
            assert popup.locator('html').get_attribute('data-theme') == 'dark'
            assert popup.locator('#popup-toggle').get_attribute('aria-checked') == 'false'
            assert popup.locator('#popup-message').inner_text() == ''
            assert popup.locator('#popup-weights input[type="range"]').count()==5
            exercise_popup_profiles(popup,options)
            public=send(options,{'type':'GET_PUBLIC'})
            assert set(public)=={'settings','overlayPosition','quickProfiles','activeProfile','evaluationRevision'},public
            assert public['overlayPosition']=={'preset':'top-left'},public
            assert public['quickProfiles']==[],public
            assert FAKE_KEY not in json.dumps(public),public
            popup.screenshot(path=str(OUT/'native-popup.png'),full_page=True)

            # Navigate a real tab to an intercepted X document. Chrome injects
            # the manifest's content script into its real isolated world.
            x_page = context.new_page()
            x_page.on('pageerror', lambda error: errors.append(str(error)))
            cdp = context.new_cdp_session(x_page)
            execution_contexts = {}
            cdp.on('Runtime.executionContextCreated',
                   lambda event: execution_contexts.__setitem__(
                       event['context']['id'], event['context']))
            cdp.on('Runtime.executionContextDestroyed',
                   lambda event: execution_contexts.pop(event['executionContextId'], None))
            cdp.on('Runtime.executionContextsCleared', lambda event: execution_contexts.clear())
            cdp.send('Runtime.enable')
            x_page.goto(X_URL)
            x_page.wait_for_selector('#oya-control')
            content_context = None
            for candidate in list(execution_contexts.values()):
                if candidate.get('auxData', {}).get('isDefault'):
                    continue
                matches = content_evaluate(cdp, candidate['id'],
                    'globalThis.chrome?.runtime?.id === ' + json.dumps(extension_id))
                if matches:
                    content_context = candidate['id']
                    break
            assert content_context is not None, execution_contexts
            response = content_evaluate(cdp, content_context,
                "chrome.runtime.sendMessage({type:'GET_PUBLIC'})")
            assert response['ok'], response
            assert response['data'] == public, response
            assert FAKE_KEY not in json.dumps(response), response
            quick = content_evaluate(cdp, content_context,
                "chrome.runtime.sendMessage({type:'SAVE_QUICK_SETTINGS',patch:{interests:'Distributed systems, humane interfaces',weights:{relevance:45},threshold:63,minimumMargin:.55,behavior:'label',hideAds:true}})")
            assert quick['ok'], quick
            assert quick['data']['settings']['interests'] == 'Distributed systems, humane interfaces', quick
            assert quick['data']['settings']['weights']['relevance'] == 45, quick
            assert quick['data']['settings']['threshold'] == 63, quick
            assert quick['data']['settings']['minimumMargin'] == .55, quick
            assert quick['data']['settings']['behavior'] == 'label', quick
            assert quick['data']['settings']['hideAds'] is True, quick
            assert quick['data']['settings']['enabled'] is False, quick
            assert FAKE_KEY not in json.dumps(quick), quick
            rejected_quick = content_evaluate(cdp, content_context,
                "chrome.runtime.sendMessage({type:'SAVE_QUICK_SETTINGS',patch:{searchEnabled:true}})")
            assert rejected_quick['ok'] is False, rejected_quick
            denied = content_evaluate(cdp, content_context,
                "chrome.runtime.sendMessage({type:'UI_STATE'})")
            assert denied['ok'] is False, denied
            assert 'restricted to settings' in denied['error'], denied
            storage = content_evaluate(cdp, content_context, '''(async () => {
                try { await chrome.storage.local.get('jevKey'); return 'accessible'; }
                catch { return 'blocked'; }
            })()''')
            assert storage == 'blocked', storage
            assert x_page.locator('article.oya-dim,article.oya-collapse,article.oya-highlight').count() == 0

            # Keep evaluation paused on X while checking that removing a key
            # disables an active BYOK configuration and clears both key stores.
            x_page.close()
            settings = {**send(options,{'type':'UI_STATE'})['settings'], 'enabled': True}
            send(options, {'type': 'UI_SAVE', 'settings': settings})
            assert send(options, {'type': 'UI_STATE'})['settings']['enabled'] is True
            send(options, {'type': 'UI_FORGET_KEY'})
            state = send(options, {'type': 'UI_STATE'})
            assert state['hasJevKey'] is False, state
            assert state['settings']['enabled'] is False, state
            assert options.evaluate('''async () => ({
                local: await chrome.storage.local.get('jevKey'),
                session: await chrome.storage.session.get('jevKey')
            })''') == {'local': {}, 'session': {}}
            popup.reload()
            wait_popup(popup)
            assert popup.locator('#popup-toggle').get_attribute('aria-checked') == 'false'
            assert not errors, errors
            assert not blocked_requests, blocked_requests
            print('Native MV3 smoke: PASS (worker, options, popup, runtime messaging, '
                  'session key, persistence migration, target/weights/Hide treatment, custom profile lifecycle, '
                  'popup/dashboard agreement, public state, content injection, '
                  'untrusted sender/storage isolation, key removal pauses BYOK)')
            print('Not covered: native optional-host permission prompt and live TypeSafe calls.')
        finally:
            context.close()


if __name__ == '__main__':
    main()
