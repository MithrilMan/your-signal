# Security policy

## Reporting a vulnerability

Please use [GitHub private vulnerability reporting](https://github.com/MithrilMan/your-signal/security/advisories/new). Do not include API keys, private post text, email addresses, or other personal data in a public issue.

Include the affected version, impact, reproduction steps, and any suggested mitigation. You should receive an acknowledgement within seven days. No bounty is promised.

## Security boundaries

Security-sensitive areas include extension storage, API-key handling, optional host permissions, message-sender validation, fixed provider URLs, X route restrictions, prompt-injection resistance, and avoiding sensitive logs.

Your Signal stores a Jev key in session storage by default. Users may explicitly opt into local persistence; Chrome extension storage is not an encrypted keychain. Removing the key clears the evaluation cache, pauses filtering, and revokes the TypeSafe host permission.

The project uses no remote code, telemetry, or generic network destination. Tests reduce risk but are not a security audit.
