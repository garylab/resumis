"""Refresh built-in preview HTML with the original app's exact Markdown renderer.

Only needed after editing data/resumes/*.md. Normal npm builds use the snapshot.
Run: uv run --with markdown==3.6 python scripts/render-markdown.py
"""
import hashlib
import json
from pathlib import Path
import re

import markdown

if markdown.__version__ != '3.6':
    raise SystemExit('Use markdown==3.6 to match the Python application')

root = Path(__file__).resolve().parent.parent
result = {}
for path in root.joinpath('data/resumes').glob('*.md'):
    content = path.read_text()
    html = markdown.markdown(content)
    html = re.sub(r'(<a\s+[^>]*)(>)', r'\1 rel="noopener noreferrer nofollow" target="_blank"\2', html)
    result[path.stem] = {
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'html': html,
    }
root.joinpath('data/rendered.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
