# Chrome Web Store submission copy

## Listing

**Name:** Your Signal

**Short description:** Tune your X timeline with personal, reversible filters powered by your own Jev API key.

**Detailed description:**

Your Signal helps you decide what earns space in your X timeline. Choose your interests and tune five transparent signals: relevance, substance, practical value, promotion, and engagement bait.

Eligible posts can be highlighted, labeled, dimmed, collapsed, or hidden. Every treatment is reversible. The in-page overlay, popup, and saved profiles keep everyday controls close to the feed.

Your Signal uses your own Jev API key. When filtering is enabled, eligible post text and your interest topics go directly from the extension to TypeSafe for numeric evaluation. We operate no intermediary service and collect no analytics. Weights, thresholds, presentation, profiles, and the bounded numeric cache stay in the extension.

Features:

- direct BYOK connection to TypeSafe Jev;
- reversible post treatments and Peek for collapsed posts;
- built-in and saved profiles;
- optional Search support;
- System, Light, and Dark themes;
- no telemetry or remote code;
- open-source MIT code.

Jev inference is remote. Your Signal does not verify factual truth or replace X's ranking system. Your Signal is not affiliated with X Corp. or TypeSafe.

## Single purpose

Your Signal provides personal, reversible filtering and presentation controls for eligible posts in the user's X timeline.

## Permission justifications

- **storage:** Stores user preferences, saved profiles, UI placement, daily counters, the optional remembered Jev key, and a bounded cache of hashes and numeric results. Post text is not cached.
- **https://x.com/* and https://www.x.com/*:** Reads eligible visible post text and applies the user-selected reversible presentation inside supported timelines.
- **Optional https://api.typesafe.ai/*:** Sends eligible post text and interest topics to Jev only after Chrome grants the host permission and the user enables filtering. Removing the key revokes this permission.

The extension requests no broad website access, tab-history permission, cookies, private messages, clipboard data, or incognito access.

## Privacy tab

Declare the following according to the dashboard's current categories:

- website content: eligible X post text and interest topics;
- authentication information: user-provided Jev API key;
- browsing activity: limited to detecting supported X routes required for the filtering feature;
- user activity: local interaction with extension controls, stored only as preferences and counters.

Data is used only for the disclosed filtering feature. It is not sold, used for advertising, used for credit decisions, or transferred except to TypeSafe as necessary to provide Jev evaluation. Affirm compliance with the Chrome Web Store User Data Policy and Limited Use requirements.

**Privacy policy URL:** https://github.com/MithrilMan/your-signal/blob/master/PRIVACY.md

**Homepage/support URL:** https://github.com/MithrilMan/your-signal

## Reviewer instructions

1. Install the submitted package.
2. Open the Connection page.
3. Paste the temporary Jev key supplied only in the private reviewer field.
4. Leave **Remember the key** off, review the text-transfer disclosure, and choose **Save connection**. There is no separate authorization checkbox.
5. Test the connection and enable the filter.
6. Open X Home with the reviewer test profile.
7. Use the Your Signal overlay to apply a profile and switch between Label, Dim, Collapse, and Hide.
8. Remove the key and verify the filter pauses.

Supply a temporary, limited, revocable key through the private reviewer field. Never place it in the repository, listing, screenshot, or ZIP.

## Assets

- extension icon: `extension/icons/128.png`;
- screenshots: PNG or JPEG, 1280×800 or 640×400, using synthetic content only;
- recommended submission mode: deferred publishing.

Before submission, complete the legal and platform checks in [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md).
