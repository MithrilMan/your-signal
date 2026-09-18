# Architecture

Your Signal is a Manifest V3 browser extension with one direct BYOK data path.

```text
X page
  -> isolated content script extracts eligible visible post text
  -> extension service worker validates route, key, filter state, and request budget
  -> TypeSafe Jev API returns five numeric signals
  -> content script applies local weights, threshold, and reversible presentation
```

## Trust boundaries

The page never receives the Jev key. Extension storage is restricted to trusted extension contexts, and messages are accepted only from the extension UI or the top frame of approved X routes. Provider requests use a fixed HTTPS origin, omit credentials and referrers, reject redirects, and run only after the user grants the optional host permission.

Post text and interest topics are treated as untrusted data. The rubric explicitly tells Jev not to follow instructions contained in either field. The extension does not infer link, image, or video contents and does not claim to verify truth.

## Storage

Preferences, profiles, counters, and UI placement use `chrome.storage.local`. The API key uses `chrome.storage.session` by default; persistent storage is opt-in. Numeric evaluation results and hashes use a bounded session cache. No post text is cached.

Removing the key pauses filtering, clears cached evaluations, changes the evaluation identity, and revokes the optional TypeSafe permission.

## Evaluation and local decisions

`shared/rubric.json` is the source of truth copied into the extension at build time. One Jev request evaluates all five criteria for one post. Weights, thresholds, uncertainty handling, ad detection, and visual treatments remain local.

Changing only weights or thresholds reuses existing numeric signals. Changing interests, the rubric, or the API key invalidates the evaluation identity. Requests are deduplicated in flight, limited to three concurrent evaluations, queued up to 30 items, cached up to 500 entries for 24 hours, and bounded by a configurable UTC daily attempt limit.

## Supported surface

The content script runs only on X. Evaluation is limited to Home and optionally Search. Messages, notifications, profiles, status detail pages, and composer surfaces are excluded. Media-only posts remain unchanged. X is a dynamic third-party interface, so adapter selectors are isolated in `extension/adapters/x.js` and protected by fixture tests.

## Packaging

The extension contains no runtime package dependencies, remote code, or dynamic script loading. `scripts/build.py` copies the versioned rubric, stages the extension, validates required files, and creates one canonical ZIP.
