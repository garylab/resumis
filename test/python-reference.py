"""Render original page templates for the optional port parity check."""
import html
import json
from pathlib import Path
import re
import sys
from urllib.parse import quote

from jinja2 import Environment, FileSystemLoader

root = Path(__file__).resolve().parents[2]
env = Environment(loader=FileSystemLoader(root / 'templates'), autoescape=True)
data = json.load(sys.stdin)

def canonical(value):
    # The configurable footer intentionally replaces the original footer.
    # Its new branding and Markdown behavior are covered by app tests.
    value = re.sub(r'<footer\b[^>]*>.*?</footer>', '', value, flags=re.DOTALL)
    # Fonts are now downloaded at build time and served from /static/fonts.
    value = re.sub(r'<link[^>]*fonts[^>]*>', '', value)
    # Analytics is now optional and configured per request, covered by app tests.
    value = re.sub(r'<!-- Google tag \(gtag\.js\) -->\s*<script\b[^>]*>.*?</script>\s*<script>.*?</script>', '', value, flags=re.DOTALL)
    return re.sub(r'\s+', ' ', html.unescape(value)).strip()

for case in data['cases']:
    context = case['context']
    def url_for(endpoint, **options):
        path = data['routes'].get(endpoint)
        if endpoint == 'static':
            path = '/static/' + options['filename']
        elif endpoint == 'home.template':
            path = '/template/' + quote(options['slug'], safe='')
        elif endpoint == 'home.create_from_template':
            path = '/create/' + quote(options['template_slug'], safe='')
        elif endpoint == 'resume.edit':
            path = '/resume/edit/' + quote(options['name'], safe='')
        if path is None:
            raise ValueError(endpoint)
        return 'https://resumis.example' + path if options.get('_external') else path
    context.update(url_for=url_for, to_slug=lambda name: name.lower().replace(' ', '-'),
                   get_flashed_messages=lambda: [])
    expected = env.get_template(case['template']).render(context)
    if canonical(expected) != canonical(case['actual']):
        import difflib
        delta = '\n'.join(difflib.unified_diff(expected.splitlines(), case['actual'].splitlines()))
        raise AssertionError(f"Rendering differs for {case['label']}:\n{delta}")
print(f"{len(data['cases'])} rendered pages match the original Jinja templates (excluding the customized footer and analytics, and ignoring whitespace/entity spelling).")
