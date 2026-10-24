import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { POETRY_DATABASE as db } from '../src/data/poetry_db.js';
import { encodeCorpus, decodeCorpus } from '../src/data/corpus_codec.js';
import { groupPoemLines, poemSourceKey, sourceDetailHtml, formatPoemWithSources } from '../src/data/source_helpers.js';
import { classifyGenre, sourceId, normalizeDynasty, buildToneIndex, reviewTones, improveTags } from '../scripts/lib/corpus_quality.js';
import { MetricalEngine } from '../src/engine/metrical.js';
import { selectSingleSourceCorpus } from '../scripts/lib/single_source.js';
import { createHash } from 'node:crypto';

const original = { id: 'fixture', content: '甲乙丙丁戊', length: 5, author: '甲作者', dynasty: '唐',
  title: '春望', ping_ze_pattern: '00110', end_tone: '仄', rhyme_group: '仄声', tags: [] };
const source = { id: 'work:fixture', dataset: '公开测试库', record_id: '123', author: '甲作者',
  title: '春望', dynasty: '唐', genre: 'poem', status: 'matched', url: 'https://github.com/example/poems/blob/' + 'a'.repeat(40) + '/poems.json' };
const annotated = { ...original, source, source_line: 0, other_sources: [], quality_flags: [] };

test('同名不同作者、不同朝代以及同作者同名不同作品分别分组', () => {
  const groups = groupPoemLines([original, { ...original, author: '乙作者' }, { ...original, dynasty: '宋' },
    annotated, { ...annotated, source: { ...source, id: 'work:another' } }]);
  assert.equal(groups.size, 5);
  assert.notEqual(poemSourceKey(original), poemSourceKey({ ...original, author: '乙作者' }));
});

test('按原文分句位置排序，不把语料存储顺序当作完整原诗', () => {
  const later = { ...annotated, id: 'later', source_line: 5 };
  assert.deepEqual([...groupPoemLines([later, annotated]).values()][0].map(line => line.id), ['fixture', 'later']);
  assert.equal(sourceId('作者', '甲乙，丙丁。'), sourceId('作者', '甲乙。\n丙丁！'));
  assert.notEqual(sourceId('作者', '甲乙，丙丁。'), sourceId('另一作者', '甲乙，丙丁。'));
});

test('只对确定的作者篇名识别古文与赋，不因篇名含书、记、赋字就删除诗', () => {
  assert.equal(classifyGenre('司马迁', '五帝本纪赞', ''), 'prose');
  assert.equal(classifyGenre('苏轼', '前赤壁赋', ''), 'fu');
  assert.equal(classifyGenre('王勃', '滕王阁序 / 秋日登洪府滕王阁饯别序', ''), 'prose');
  assert.equal(classifyGenre('王安石', '书湖阴先生壁', '全唐诗'), 'poem');
  assert.equal(classifyGenre('白居易', '赋得古原草送别', '全唐诗'), 'poem');
  assert.equal(classifyGenre('陶弘景', '诏问山中何所有赋诗以答', ''), 'unknown');
});

test('朝代归一化保留五代、近现代，并正确处理别名与未知值', () => {
  for (const [value, expected] of [['五代', '五代'], ['五', '五代'], ['近代', '近现代'],
    ['近现代', '近现代'], ['唐代', '唐'], ['隋代', '隋'], ['南宋', '宋'], ['未知', '未标注']]) {
    assert.equal(normalizeDynasty(value), expected);
  }
});

test('字典简繁对应可补字；未知与多读字不猜音，前导零及平仄一致', () => {
  const index = buildToneIndex({ '谿': '平', '著': '仄', '重': '多' }, {}, value => ({ 谿: '溪', 著: '着' })[value] || value);
  const result = reviewTones({ content: '溪着重啼月', ping_ze_pattern: '11110', rhyme_group: '仄声' }, index);
  assert.equal(result.ping_ze_pattern, '10110');
  assert.ok(result.flags.includes('TONE_UNKNOWN'));
  assert.ok(result.flags.includes('TONE_AMBIGUOUS'));
});

test('有未知古音、署名冲突或古文文体的条目不能作为严格候选', () => {
  const engine = new MetricalEngine();
  for (const item of [{ ...annotated, quality_flags: ['TONE_UNKNOWN'] },
    { ...annotated, quality_flags: ['SOURCE_CONFLICT'] },
    { ...annotated, source: { ...source, status:'ambiguous' } },
    { ...annotated, source: { ...source, status:'unverified' } },
    { ...annotated, source: { ...source, genre: 'prose' } }]) {
    assert.equal(engine.isValidQuatrainStarterLine(item, 5), false);
    assert.equal(engine.validatePoem([item], { requireComplete: false }).isValid, false);
  }
});

test('来源完整原文标识用于避免同诗摘多句，也允许同作者同名不同原诗', () => {
  const engine = new MetricalEngine();
  const lines = ['00110', '11001', '11100', '00011'].map((pattern, index) => ({
    ...annotated, id: `line${index}`, content: ['甲乙丙丁戊', '辛壬癸子丑', '辰巳午未申', '酉戌亥天地'][index],
    ping_ze_pattern: pattern, end_tone: pattern.endsWith('1') ? '平' : '仄',
    rhyme_group: pattern.endsWith('1') ? '上平一东' : '仄声', source: { ...source, id: `work:${index}` }
  }));
  assert.equal(engine.validatePoem(lines).isValid, true);
  lines[3].source.id = lines[1].source.id;
  assert.equal(engine.validatePoem(lines).isValid, false);
});

test('v2 无损保存多出处和质量标注，仍支持 v1 和没有附加字段的记录', () => {
  const extra = { ...annotated, other_sources: [{ source: { ...source, id: 'work:other', author: '乙作者' }, source_line: 3 }],
    quality_flags: ['TONE_AMBIGUOUS'] };
  assert.deepEqual(decodeCorpus(encodeCorpus([extra])), [extra]);
  const legacy = encodeCorpus([original]);
  legacy.version = 1;
  delete legacy.sourceDetails; delete legacy.qualityFlagSets;
  assert.deepEqual(decodeCorpus(legacy), [original]);
});

test('出处详情转义元信息且不接受脚本链接，页面与复制文本仅使用主出处', () => {
  const item = { ...annotated, title: '<img src=x onerror=alert(1)>',
    source: { ...source, dataset: '<script>', url: 'javascript:alert(1)' },
    other_sources: [{ source: { ...source, id: 'other', author: '<script>', title: '另一篇' }, source_line: 1 }] };
  const html = sourceDetailHtml(item);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('&lt;script&gt;'));
  const text = formatPoemWithSources([item], '集句', '今人');
  assert.ok(!html.includes('另一篇'));
  assert.ok(!html.includes('另有'));
  assert.ok(!text.includes('另一篇'));
  assert.ok(!text.includes('同句另见'));
  assert.ok(text.includes('上游原文及署名匹配'));
});

test('思乡标签不再由故、思、家单字触发，猿不再误标为鸟', () => {
  assert.deepEqual(improveTags({ content: '故着为本纪书首', tags: ['思乡'] }), []);
  assert.deepEqual(improveTags({ content: '夜深猿啸月', tags: ['鸟', '月'] }), ['月']);
  assert.ok(improveTags({ content: '家书抵万金', tags: [] }).includes('思乡'));
});

test('全库出处均有标识；已匹配记录的作者、句序与固定版本链接可追溯', () => {
  let matched = 0;
  for (const item of db) {
    assert.ok(item.source?.id);
    assert.ok(Array.isArray(item.other_sources));
    assert.ok(Array.isArray(item.quality_flags));
    if (item.source.status === 'matched') {
      matched++;
      assert.equal(item.author, item.source.author);
      assert.equal(item.title, item.source.title);
      assert.ok(Number.isInteger(item.source_line));
      assert.match(item.source.url, /\/blob\/[a-f0-9]{40}\//);
    }
    assert.ok(!['prose', 'fu'].includes(item.source.genre));
  }
  assert.ok(matched > 500000);
  assert.equal(matched, db.length);
  assert.ok(db.every(item => item.other_sources.length === 0));
  assert.equal(new Set(db.map(item => item.content)).size, db.length);
  const spring = db.filter(item => item.title === '春望');
  assert.ok(groupPoemLines(spring).size >= 3);
});

test('单一出处策略保留已核对主记录和 ID，不从后人引用猜署名，重复处理不改变结果', () => {
  const item = { ...annotated, other_sources: [{ source: { ...source, id:'later', author:'后人' }, source_line:2 }] };
  const result = selectSingleSourceCorpus([item]);
  assert.deepEqual(result.records, [annotated]);
  assert.equal(result.stats.removedReferences, 1);
  assert.equal(item.other_sources.length, 1);
  assert.deepEqual(selectSingleSourceCorpus(result.records).records, result.records);
  for (const status of ['ambiguous','conflict','unverified','text-matched']) {
    const pending = { ...item, source:{ ...source,status } };
    const selected = selectSingleSourceCorpus([pending]);
    assert.equal(selected.records.length, 0);
    assert.equal(selected.excluded[0].record, pending);
    assert.equal(selected.excluded[0].reason, status);
  }
});

test('拒绝主出处字段不一致；未来重复导入时，同诗去重，署名冲突单独存档', () => {
  for (const item of [{ ...annotated, source:{...source,author:'另一作者'} },
    {...annotated,source_line:null}, {...annotated,source:{...source,url:'https://example.com/'}},
    {...annotated,quality_flags:['SOURCE_AMBIGUOUS']}]) {
    assert.equal(selectSingleSourceCorpus([item]).records.length, 0);
  }
  const duplicate = { ...annotated, id:'another' };
  const one = selectSingleSourceCorpus([annotated,duplicate]);
  assert.equal(one.records.length, 1);
  assert.deepEqual(one.records, selectSingleSourceCorpus([duplicate,annotated]).records);
  assert.equal(one.stats.duplicateRows, 1);
  const different = { ...duplicate, author:'乙作者',source:{...source,author:'乙作者',id:'different'} };
  const conflict = selectSingleSourceCorpus([annotated,different]);
  assert.equal(conflict.records.length, 0);
  assert.equal(conflict.excluded.length, 2);
});

test('运行语料和单一出处报告一致，完整原库备份保留多出处和待核记录', async () => {
  const report = JSON.parse(await readFile(new URL('../reports/corpus-single-source.json', import.meta.url),'utf8'));
  assert.equal(report.outputCount, db.length);
  const baseline = report.snapshots[0];
  const plain = gunzipSync(await readFile(new URL('../reports/' + baseline.path, import.meta.url)));
  assert.equal(createHash('sha256').update(plain).digest('hex'), baseline.sha256);
  const original = JSON.parse(plain.toString('utf8'));
  assert.equal(original.count, baseline.inputCount);
  assert.ok(original.count > db.length);
  assert.ok(original.rows.some(row => row[6]?.[2]?.length > 0));
  assert.equal(report.metadata.count, db.length);
});

test('隔离古文保留完整记录和依据，已知散文切句不进入运行语料', async () => {
  assert.equal(db.some(item => item.content === '故着为本纪书首'), false);
  assert.equal(db.some(item => item.author === '范仲淹' && item.title === '岳阳楼记'), false);
  const archive = JSON.parse(gunzipSync(await readFile(new URL('../reports/corpus-quarantine.json.gz', import.meta.url))));
  assert.ok(archive.some(entry => entry.record.content === '故着为本纪书首' && entry.evidence.startsWith('https://')));
});
