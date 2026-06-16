import json, os
from pathlib import Path

base = os.getcwd().replace('\\', '/').lower()
d = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8-sig'))
fb = d.get('files', {})

def rel(f):
    f2 = f.replace('\\', '/')
    return f2[len(base):].lstrip('/') if f2.lower().startswith(base) else f2

def keep(f):
    r = rel(f).lower()
    # Exclude graphify's own scratch output (recursive noise) and build caches
    bad = ('graphify-out/', 'node_modules/', '__pycache__/', '/.gradle/', '/build/')
    return not any(b in ('/' + r) or r.startswith(b) for b in bad)

cats = {}
for cat in ('document', 'paper', 'image', 'video'):
    cats[cat] = [f for f in fb.get(cat, []) if keep(f)]

for cat, files in cats.items():
    print(f'{cat}: {len(files)} kept (of {len(fb.get(cat, []))})')

# Build chunks: docs+papers grouped (~12/chunk), images batched (~12/chunk)
def chunk(lst, n):
    return [lst[i:i+n] for i in range(0, len(lst), n)]

text_files = cats['document'] + cats['paper']
text_chunks = chunk(text_files, 12)
image_chunks = chunk(cats['image'], 12)

plan = {
    'text_chunks': [[rel(f) for f in c] for c in text_chunks],
    'image_chunks': [[rel(f) for f in c] for c in image_chunks],
    'videos': [rel(f) for f in cats['video']],
}
Path('graphify-out/.graphify_plan.json').write_text(json.dumps(plan, indent=2, ensure_ascii=False), encoding='utf-8')
print()
print(f'text_chunks: {len(text_chunks)} | image_chunks: {len(image_chunks)} | videos: {len(cats["video"])}')
print('total semantic subagents needed:', len(text_chunks) + len(image_chunks))
