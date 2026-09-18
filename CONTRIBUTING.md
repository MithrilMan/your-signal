# Contributing

Thanks for helping improve Your Signal. Open an issue before a large behavioral change so the purpose and privacy impact are clear.

## Development rules

- Keep the extension dependency-free unless a dependency solves a measured problem.
- Do not add telemetry, remote code, generic network access, or post-text logging.
- Keep `shared/rubric.json` as the evaluation source of truth and rebuild after changing it.
- Treat post text and interest topics as untrusted data, never as instructions.
- Add regression coverage for user-visible bugs, message authorization, provider failures, pausing, DOM recycling, and privacy boundaries.
- Use synthetic fixtures. Never commit real API keys or private post text.
- A new supported site or route needs a clear purpose, minimal permissions, and dedicated tests.

Run the checks documented in the [README](README.md) before submitting a pull request. Semantic rubric changes need a new rubric version and measured results on a holdout corpus.

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).
