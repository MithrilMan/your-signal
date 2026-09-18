# Your Signal live demo edit

## Outputs

- `../your-signal-demo-social.mp4` — 76-second social cut, 1600×860, H.264/AAC.
- `../your-signal-demo-thumbnail-1280x688.jpg` — representative frame for social previews.

## Source

- Screen recording: `C:\Users\redan\Videos\Screen Recordings\Screen Recording 2026-09-18 185259.mp4`
- Music: `Your Signal Theme`, generated with Eleven Music v2.5 on 2026-09-18.
- Local music source: `your-signal-theme.m4a`. It is intentionally excluded from the public repository; the rendered product demo is the distributable media artifact.

The source screen recording's audio stream is digital silence and is not used in the outputs.

## Edit decisions

- No artificial camera movement, zoom, pan, or Ken Burns effect.
- The social cut uses hard cuts only to remove idle stretches while preserving real product interaction.
- The soundtrack mirrors the product story: diffuse noise resolves into a confident groove, gains weight when filtering activates, and clears for the closing frame.
- Music is reduced by 8.5 dB to approximately -21 LUFS in the final video, with soft fades at the beginning and end.

## Music rights

The music was generated on an ElevenLabs Creator plan. ElevenLabs' current model-specific terms permit online commercial media use for Creator-plan output and do not require attribution. Streaming-platform distribution of the standalone music has separate restrictions.

- https://elevenlabs.io/eleven-music-model-specific-terms
- https://elevenlabs.io/docs/overview/capabilities/music

## Rebuild

Run `build-live-demo.ps1` from this directory or from the repository root. The script requires FFmpeg, the screen recording, and a local copy of the selected music source. By default it looks for `your-signal-theme.m4a` beside the script; pass another path with `-MusicTrack` when needed.
