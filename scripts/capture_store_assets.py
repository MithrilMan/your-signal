"""Capture Chrome Web Store screenshots using synthetic, offline content."""

from pathlib import Path
import json
import mimetypes
import os
import shutil

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
EXTENSION = ROOT / "extension"
OUTPUT = ROOT / "store-assets" / "screenshots"
VIEWPORT = {"width": 1280, "height": 800}


def source(name: str) -> str:
    return (EXTENSION / name).read_text(encoding="utf-8")


def preview_route(route) -> None:
    relative = route.request.url.removeprefix("https://preview.local/").split("?", 1)[0]
    file = (EXTENSION / relative).resolve()
    if not file.is_relative_to(EXTENSION.resolve()) or not file.is_file():
        route.fulfill(status=404, body="Not found")
        return
    route.fulfill(
        status=200,
        body=file.read_bytes(),
        content_type=mimetypes.guess_type(file.name)[0] or "application/octet-stream",
    )


def synthetic_x() -> str:
    return """<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Synthetic X preview</title>
    <style>
      body{background:#080b09;color:#edf2eb;font:16px system-ui;margin:0}
      header{height:68px;border-bottom:1px solid #29312b;display:flex;align-items:center;padding:0 42px;color:#c9d8c2}
      main{width:720px;margin:0 auto;border-inline:1px solid #29312b;min-height:732px}
      nav{padding:19px 22px;border-bottom:1px solid #29312b;font-weight:650}
      article{padding:21px 22px 20px 52px;border-bottom:1px solid #29312b;min-height:150px;display:flex;flex-direction:column;gap:10px;position:relative}
      article::before{content:'';position:absolute;left:18px;top:22px;width:22px;height:22px;border-radius:50%;background:linear-gradient(145deg,#7890d3,#e7846d)}
      a{color:#91a08d;text-decoration:none;font-size:11px}[data-testid=tweetText]{line-height:1.65}.person{font-weight:650;font-size:14px}.meta{color:#91a08d;font-size:12px}
    </style></head><body><header>Offline product preview · synthetic posts · simulated Jev signals</header><main><nav>For you</nav>
      <article data-testid="tweet"><div class="person">Demo account · Software</div><a href="/demo/status/201"><time>12:01</time></a><div data-testid="tweetText">A reproducible caching benchmark with the method, measurements, and code for comparing p95 latency.</div><div class="meta">24 replies · 81 reposts · 640 likes</div></article>
      <article data-testid="tweet"><div class="person">Demo account · Promotion</div><a href="/demo/status/202"><time>12:02</time></a><div data-testid="tweetText">Comment AI, like this post, and follow me to unlock the secret list of tools that changes everything!</div><div class="meta">920 replies · 1.4K reposts · 8K likes</div></article>
      <article data-testid="tweet"><div class="person">Demo account · Design</div><a href="/demo/status/203"><time>12:03</time></a><div data-testid="tweetText">A small accessibility study: five keyboard navigation problems, the fixes, and before-and-after results.</div><div class="meta">18 replies · 43 reposts · 510 likes</div></article>
    </main></body></html>"""


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    defaults = json.loads(json.dumps({
        "enabled": True,
        "interests": "Software development, artificial intelligence, product design",
        "weights": {"relevance": 85, "substance": 80, "actionable": 55, "promotion": 55, "bait": 80},
        "threshold": 58,
        "highlightThreshold": 78,
        "minimumMargin": 0.35,
        "behavior": "collapse",
        "showBadges": True,
        "searchEnabled": False,
        "hideAds": False,
        "dailyLimit": 250,
        "theme": "system",
    }))
    fixture = f"""
      globalThis.fixtureSettings={json.dumps(defaults)};
      globalThis.chrome={{
        runtime:{{
          id:'offline-store-preview',
          getURL:path=>'https://preview.local/'+path,
          onMessage:{{addListener(listener){{globalThis.fixtureListener=listener;}}}},
          async sendMessage(message){{
            if(message.type==='UI_STATE')return{{ok:true,data:{{settings:structuredClone(fixtureSettings),hasJevKey:true,rememberKey:false,model:'jev-1.13.0',stats:{{evaluated:42,cacheHits:17,inputTokens:18420}},customProfiles:[],lastError:''}}}};
            if(message.type==='GET_PUBLIC')return{{ok:true,data:{{settings:structuredClone(fixtureSettings),evaluationRevision:'store-preview',overlayPosition:{{preset:'top-left',x:0,y:0}},quickProfiles:[],activeProfile:''}}}};
            if(message.type==='EVALUATE'){{
              const low=message.post.text.toLowerCase().includes('comment ai');
              return{{ok:true,data:{{model:'jev-1.13.0',metrics:{{relevance:low?.10:.95,substance:low?.10:.94,actionable:low?.10:.88,promotion:low?.92:.04,bait:low?.94:.05}},input_tokens:420,cached:false}}}};
            }}
            if(message.type==='UI_SAVE'){{fixtureSettings={{...fixtureSettings,...message.settings}};return{{ok:true,data:{{settings:structuredClone(fixtureSettings)}}}};}}
            if(message.type==='SAVE_QUICK_SETTINGS'){{fixtureSettings={{...fixtureSettings,...message.settings}};return{{ok:true,data:{{settings:structuredClone(fixtureSettings),evaluationRevision:'store-preview',overlayPosition:{{preset:'top-left',x:0,y:0}},quickProfiles:[],activeProfile:''}}}};}}
            if(message.type==='SAVE_OVERLAY_POSITION'||message.type==='OPEN_OPTIONS'||message.type==='UI_TEST')return{{ok:true,data:{{}}}};
            return{{ok:false,error:'Unsupported offline fixture request: '+message.type}};
          }}
        }},
        permissions:{{async request(){{return true;}},async remove(){{return true;}}}}
      }};
    """

    with sync_playwright() as playwright:
        executable = os.getenv("CHROMIUM_PATH") or shutil.which("chromium")
        browser = playwright.chromium.launch(
            **({"executable_path": executable} if executable else {}),
            headless=True,
            args=["--no-sandbox"],
        )
        context = browser.new_context(viewport=VIEWPORT, color_scheme="light")
        context.route("https://preview.local/**", preview_route)
        context.add_init_script(fixture)

        options = context.new_page()
        options.goto("https://preview.local/options.html")
        options.wait_for_selector(".sample-post")
        options.evaluate("document.fonts.ready")
        options.screenshot(path=OUTPUT / "your-signal-dashboard-1280x800.png")
        options.locator('[data-panel="connection"]').click()
        options.wait_for_selector("#connection-panel:not([hidden])")
        options.screenshot(path=OUTPUT / "your-signal-connection-1280x800.png")

        feed = context.new_page()
        feed.route("https://x.com/home", lambda route: route.fulfill(status=200, body=synthetic_x(), content_type="text/html"))
        feed.goto("https://x.com/home")
        feed.add_style_tag(content=source("content.css"))
        for script in ("core.js", "adapters/x.js", "content.js"):
            feed.add_script_tag(content=source(script))
        feed.wait_for_selector("article.oya-highlight")
        feed.wait_for_selector("article.oya-collapse")
        feed.evaluate("document.fonts.ready")
        feed.screenshot(path=OUTPUT / "your-signal-x-feed-1280x800.png")

        context.close()
        browser.close()

    print(f"Created 3 synthetic screenshots in {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
