# Self-hosted typography

These unmodified Latin WOFF2 subsets are downloaded from the official Google Fonts service. The extension serves them locally and makes no runtime request to Google Fonts.

| Family | File | CSS weight | License |
| --- | --- | --- | --- |
| Newsreader | `newsreader-latin.woff2` | `400 600` | `newsreader-OFL.txt` |
| Instrument Sans | `instrument-sans-latin.woff2` | `400 700` | `instrumentsans-OFL.txt` |
| IBM Plex Mono | `ibm-plex-mono-400-latin.woff2` | `400` | `ibmplexmono-OFL.txt` |
| IBM Plex Mono | `ibm-plex-mono-500-latin.woff2` | `500` | `ibmplexmono-OFL.txt` |
| Caveat | `caveat-latin.woff2` | `400 600` | `caveat-OFL.txt` |

Newsreader includes optical-size variation. Instrument Sans has an official weight maximum of 700; heavier declarations do not provide another original master. Set `font-style: normal` and `font-display: swap` in each face declaration. Essential controls use Instrument Sans, while Caveat is reserved for decorative annotations.

Official family sources and OFL licenses:

- [Newsreader](https://github.com/google/fonts/tree/main/ofl/newsreader)
- [Instrument Sans](https://github.com/google/fonts/tree/main/ofl/instrumentsans)
- [IBM Plex Mono](https://github.com/google/fonts/tree/main/ofl/ibmplexmono)
- [Caveat](https://github.com/google/fonts/tree/main/ofl/caveat)

The Latin subset supports English UI copy and common Western European characters. User-entered text outside those ranges uses the platform fallback.
