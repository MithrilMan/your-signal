# Verification report

Verified on 18 September 2026 against version 0.2.0.

- Node unit and worker tests: 51 passed.
- Evaluation metrics tests: 6 passed.
- Evaluation dataset dry run: 10 synthetic examples validated; no network calls.
- Browser UI smoke: passed for settings, direct BYOK connection, privacy controls, responsive layout, and popup save recovery.
- Native Manifest V3 smoke: passed for the worker, extension pages, storage boundaries, session and remembered keys, custom profiles, and key removal.
- Synthetic X injection smoke: passed for scores, ad hiding, collapse, Peek transitions, local controls, recovery, route exclusions, and request isolation.
- Store screenshot capture: 3 synthetic 1280×800 assets generated without account data or live posts.
- Packaging: two consecutive builds from the public checkout produced the same SHA-256, `BA4112D57EDA76BB3395EF06C28D78ADE6EF27CBAB395419416A299EA376DD1C`.

Offline fixtures do not establish live inference quality, compatibility with every X experiment, provider availability, platform authorization, or store approval. Run the live procedure in [BYOK_TEST.md](BYOK_TEST.md) before a release and record the exact result with the release tag.
