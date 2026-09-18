# Your Signal privacy policy

Effective date: 18 September 2026

Your Signal is an open-source browser extension maintained through the [MithrilMan/your-signal](https://github.com/MithrilMan/your-signal) repository. This policy describes the extension's behavior. Questions may be filed in the repository; sensitive security matters should use [private vulnerability reporting](https://github.com/MithrilMan/your-signal/security/advisories/new).

## Data the extension processes

When enabled on a supported X timeline, Your Signal reads:

- the text of eligible posts already visible in the page;
- whether a post contains a link or media;
- an internal post identifier used only to distinguish page items;
- interest topics and filtering preferences that you entered;
- local counters, numeric evaluation results, and interface preferences.

It does not read private messages, X passwords, cookies, or image and video contents. Post text from protected profiles may be processed when it is visible in your timeline.

## Why and where data is processed

When you configure a Jev key and enable filtering, the extension sends eligible post text, link/media flags, and your interest topics directly to the TypeSafe Jev API. TypeSafe returns numeric signals. Your weights, threshold, and final display decision remain in the extension.

Your Signal does not operate an intermediary service and does not collect analytics, advertising identifiers, or crash telemetry. It does not sell personal data or use data for advertising, credit decisions, or unrelated profiling.

TypeSafe is a separate provider. Its processing, location, retention, and legal terms are described in the [TypeSafe privacy policy](https://typesafe.ai/legal/privacy-policy) and applicable service agreement. Network requests necessarily expose ordinary connection metadata, such as your IP address, to TypeSafe.

TypeSafe currently states that its services are hosted in the United States, that it retains personal data for as long as reasonably necessary for its stated purposes, and that it does not train or fine-tune models on API input. Review its current policy before enabling the extension.

## Data stored by the extension

Chrome local storage contains preferences, saved profiles, overlay position, daily counters, and the last connection error. Your Jev API key is kept in Chrome session storage by default and disappears when the browser session ends. If you explicitly choose **Remember the key on this device**, it is stored in Chrome local extension storage. Chrome storage is not an encrypted keychain and the key is never included in preference exports.

Chrome session storage also holds a cache of hashes and numeric results. The cache contains no post text, is limited to 500 entries, and entries expire logically after 24 hours.

## Control and deletion

You can pause filtering at any time. **Remove** deletes the Jev key, clears cached evaluations, pauses the filter, and revokes the optional TypeSafe host permission. Uninstalling the extension removes its Chrome storage according to browser behavior. You can clear the numeric cache or export non-secret preferences from the Privacy & Data screen.

## Browser permissions

Your Signal requests access only to X pages needed for its single purpose, local extension storage, and the optional `https://api.typesafe.ai/*` host permission that you grant while connecting. The extension does not run in incognito mode.

Your Signal's use and transfer of information comply with the Chrome Web Store User Data Policy, including the Limited Use requirements. Data is used only to provide the user-facing filtering feature described in the listing and interface.

## Children

Your Signal is not directed to people under 18. TypeSafe's published policy states that its services are not directed to children under 18.

## Changes

Material policy changes will be documented in the repository and shipped with a new extension version. The version installed in your browser remains governed by the policy bundled with that release.

Your Signal is not affiliated with, endorsed by, or sponsored by X Corp. or TypeSafe.
