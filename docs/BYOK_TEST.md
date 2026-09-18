# Direct BYOK test

Your Signal connects directly to TypeSafe with the user's Jev API key.

## Offline checks

```bash
npm test
python -m pytest -q eval/tests
python eval/run.py eval/examples.jsonl
python tests/browser_smoke.py
python tests/extension_smoke.py
python tests/x_injection_smoke.py
npm run build
```

The browser tests use synthetic X pages and simulated provider responses. They must not make a live network request.

## Live check

1. Load `extension/` as an unpacked extension in an isolated Chrome profile.
2. Open Connection and confirm **Remember the key** is off by default.
3. Paste a limited Jev test key, accept the text-transfer disclosure, and save.
4. Confirm Chrome asks only for access to `https://api.typesafe.ai/*`.
5. Test the connection, enable filtering, and open X Home.
6. Verify highlights, dim/collapse/hide, score details, Peek, saved profiles, theme switching, and pause/restore.
7. Inspect the Network panel and confirm extension traffic goes only to TypeSafe.
8. Remove the key and verify filtering pauses, cached results disappear, and the optional permission is revoked.

Never commit the live key or screenshots containing private posts.
