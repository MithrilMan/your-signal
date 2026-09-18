# Verification report

Verified on 18 September 2026 against version 0.2.1.

- Node unit and worker tests: 50 passed.
- Evaluation metrics tests: 6 passed.
- Evaluation dataset dry run: 10 synthetic examples validated; no network calls.
- Browser UI smoke: passed for settings, direct BYOK connection, privacy controls, responsive layout, and popup save recovery.
- Native Manifest V3 smoke: passed for the worker, extension pages, storage boundaries, session and remembered keys, custom profiles, and key removal.
- Synthetic X injection smoke: passed for scores, collapse, Peek transitions, local controls, recovery, route exclusions, and request isolation.
- Store screenshot capture: 3 synthetic 1280×800 assets generated without account data or live posts.
- Packaging: the branch CI artifact and tagged GitHub release produced the same canonical SHA-256, `1281B9D1CF6FE6B2CAFB2CB235FF44FAEC2B4C0AC0DC8E7530BAB16430686201`.

Offline fixtures do not establish live inference quality, compatibility with every X experiment, provider availability, platform authorization, or store approval. Run the live procedure in [BYOK_TEST.md](BYOK_TEST.md) before a release and record the exact result with the release tag.
