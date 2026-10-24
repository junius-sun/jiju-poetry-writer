"""Package official OFL fonts into common-text and Unicode-range WOFF2 files.

Source TTFs live in .local/font-sources; no OS font installation is needed.
Run with fonttools and brotli installed, from the project root.
"""
import json
from collections import Counter
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FAMILIES = {
    'mashanzheng': 'MaShanZheng-Regular', 'longcang': 'LongCang-Regular',
    'zhimangxing': 'ZhiMangXing-Regular', 'liujianmaocao': 'LiuJianMaoCao-Regular',
}
counts = Counter(ord(c) for c in (ROOT/'src/data/poetry.compact.json').read_text(encoding='utf-8') if '\u3400' <= c <= '\u9fff')
common = {code for code, _ in counts.most_common(1000)} | set(range(0x3000, 0x3040)) | set(range(0x20, 0x100))
out = ROOT/'assets/fonts'
manifest = {}
for key, stem in FAMILIES.items():
    source = ROOT/'.local/font-sources'/f'{stem}.ttf'
    base = TTFont(source)
    codes = set(base.getBestCmap())
    base.close()
    groups = [('common', codes & common)]
    remaining = codes-common
    for block in sorted({c//4096 for c in remaining}):
        groups.append((f'{block:02x}', {c for c in remaining if c//4096 == block}))
    manifest[key] = []
    for suffix, chars in groups:
        if not chars:
            continue
        font = TTFont(source)
        options = subset.Options()
        options.flavor = 'woff2'
        worker = subset.Subsetter(options=options)
        worker.populate(unicodes=chars)
        worker.subset(font)
        font.flavor = 'woff2'
        filename = f'{stem}-{suffix}.woff2'
        font.save(out/filename)
        font.close()
        manifest[key].append({'file': filename, 'range': ','.join(f'U+{c:X}' for c in sorted(chars))})
    print(key, len(manifest[key]), 'parts', flush=True)
(ROOT/'src/ui/card-font-manifest.js').write_text('export const FONT_PARTS = '+json.dumps(manifest, ensure_ascii=False, separators=(',', ':'))+';\n', encoding='utf-8')
