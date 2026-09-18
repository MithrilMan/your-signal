param(
    [string]$SourceVideo = 'C:\Users\redan\Videos\Screen Recordings\Screen Recording 2026-09-18 185259.mp4',
    [string]$MusicTrack
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($MusicTrack)) {
    $MusicTrack = Join-Path $PSScriptRoot 'your-signal-theme.m4a'
}

$artifactRoot = Split-Path -Parent $PSScriptRoot
$socialOutput = Join-Path $artifactRoot 'your-signal-demo-social.mp4'
$thumbnailOutput = Join-Path $artifactRoot 'your-signal-demo-thumbnail-1280x688.jpg'

if (-not (Test-Path -LiteralPath $SourceVideo)) {
    throw "Source video not found: $SourceVideo"
}

if (-not (Test-Path -LiteralPath $MusicTrack)) {
    throw "Music track not found: $MusicTrack"
}

# Keep the actual interaction intact, but remove long stretches where the UI is
# unchanged. Hard cuts avoid artificial camera motion and keep the demo honest.
$socialFilter = @'
[0:v]trim=start=0.8:end=5.9,setpts=PTS-STARTPTS[v0];
[0:v]trim=start=6.1:end=12.0,setpts=PTS-STARTPTS[v1];
[0:v]trim=start=12.0:end=24.5,setpts=PTS-STARTPTS[v2];
[0:v]trim=start=35.2:end=52.5,setpts=PTS-STARTPTS[v3];
[0:v]trim=start=55.0:end=66.5,setpts=PTS-STARTPTS[v4];
[0:v]trim=start=69.5:end=84.0,setpts=PTS-STARTPTS[v5];
[0:v]trim=start=99.0:end=108.2,setpts=PTS-STARTPTS[v6];
[v0][v1][v2][v3][v4][v5][v6]concat=n=7:v=1:a=0,scale=1600:860:flags=lanczos,setsar=1,fps=30[v];
[1:a]atrim=start=0:end=76.0,asetpts=PTS-STARTPTS,volume=-8.5dB,afade=t=in:st=0:d=0.8,afade=t=out:st=74.2:d=1.8[a]
'@

& ffmpeg -hide_banner -y `
    -i $SourceVideo `
    -i $MusicTrack `
    -filter_complex $socialFilter `
    -map '[v]' -map '[a]' `
    -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p `
    -c:a aac -b:a 160k `
    -movflags '+faststart' -shortest `
    $socialOutput

if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed while building the social cut (exit code $LASTEXITCODE)."
}

& ffmpeg -hide_banner -loglevel error -y `
    -ss 49 -i $SourceVideo `
    -frames:v 1 -vf 'scale=1280:688:flags=lanczos' `
    -q:v 2 $thumbnailOutput

if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed while building the thumbnail (exit code $LASTEXITCODE)."
}

Get-Item -LiteralPath $socialOutput, $thumbnailOutput |
    Select-Object FullName, Length, LastWriteTime
