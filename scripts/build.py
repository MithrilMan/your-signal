"""Build the dependency-free Your Signal extension ZIP."""
import json
from pathlib import Path
import shutil
import zipfile


def main():
    root = Path(__file__).resolve().parents[1]
    shutil.copyfile(root / 'shared/rubric.json', root / 'extension/rubric.json')

    release = root / 'release'
    release.mkdir(exist_ok=True)
    stage = release / 'extension'
    if stage.exists():
        shutil.rmtree(stage)
    shutil.copytree(root / 'extension', stage, ignore=shutil.ignore_patterns('__pycache__', '.DS_Store'))

    manifest = json.loads((stage / 'manifest.json').read_text(encoding='utf-8'))
    required_files = [
        'core.js', 'content.js', manifest['background']['service_worker'],
        'options.html', 'popup.html', 'icons/128.png'
    ]
    for file in required_files:
        if not (stage / file).is_file():
            raise SystemExit('Missing extension file: ' + file)

    path = release / 'your-signal-extension.zip'
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(stage.rglob('*')):
            if file.is_file():
                relative = file.relative_to(stage).as_posix()
                entry = zipfile.ZipInfo(relative, date_time=(1980, 1, 1, 0, 0, 0))
                entry.compress_type = zipfile.ZIP_DEFLATED
                entry.external_attr = 0o644 << 16
                archive.writestr(entry, file.read_bytes())
    print('Created', path.relative_to(root))
    print('Load release/extension in Chrome/Edge, or unzip the ZIP first.')


if __name__ == '__main__':
    main()
