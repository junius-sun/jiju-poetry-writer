/** 以固定原文快照核对出处；不根据现代读音或单个篇名字眼猜测古音、文体。 */
import fs from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import OpenCC from 'opencc-js';
import { POETRY_DATABASE } from '../src/data/poetry_db.js';
import { writeSingleSourceCorpus } from './lib/write_single_source_corpus.js';
import { normalizeTitle, normalizeDynasty, classifyGenre, splitOriginalText, sourceId,
  buildToneIndex, reviewTones, improveTags, PROSE_REFERENCE } from './lib/corpus_quality.js';

const simplify = OpenCC.Converter({ from: 'tw', to: 'cn' });
const cache = new URL('./_tmp_sources/', import.meta.url);
const manifestPath = new URL('snapshot-manifest.json', cache);
if (!fs.existsSync(manifestPath)) throw new Error('请先运行 npm run fetch:sources 下载固定原文快照。');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const existingTexts = new Set(POETRY_DATABASE.map(item => item.content));
const references = new Map(), workTexts = new Map();
let upstreamPoems = 0;
for (const file of [...manifest.files].sort((a, b) => (a.kind === 'tang' ? 0 : 1) - (b.kind === 'tang' ? 0 : 1))) {
  const repository = manifest.repositories[file.kind];
  const snapshot = fs.readFileSync(new URL(file.cacheFile, cache));
  if (file.sha256 && createHash('sha256').update(snapshot).digest('hex') !== file.sha256) {
    throw new Error(`原文快照校验失败: ${file.cacheFile}，请重新取得固定版本原文。`);
  }
  const poems = JSON.parse(snapshot.toString('utf8'));
  for (const poem of poems) {
    upstreamPoems++;
    const dataset = file.kind === 'anthology' ? '古诗文原文合集 / haitangshishe'
      : file.path.includes('song.') ? '全宋诗 / chinese-poetry'
        : file.path.includes('caocao') ? '曹操诗集 / chinese-poetry' : '全唐诗 / chinese-poetry';
    const source = {
      id: sourceId(poem.author || `unattributed:${repository.repo}:${file.path}:${poem.id}`, poem.text),
      dataset, record_id: poem.id, author: poem.author, title: poem.title,
      dynasty: normalizeDynasty(poem.dynasty), genre: classifyGenre(poem.author, poem.title, dataset),
      status: poem.author ? 'matched' : 'text-matched',
      url: `https://github.com/${repository.repo}/blob/${repository.commit}/${encodeURI(file.path)}`
    };
    const parts = splitOriginalText(poem.text);
    if (!workTexts.has(source.id)) workTexts.set(source.id, new Set(parts));
    parts.forEach((content, source_line) => {
      if (!existingTexts.has(content)) return;
      if (!references.has(content)) references.set(content, []);
      const list = references.get(content);
      // 同一完整原文在两个合集重复出现时，只保留一个可追溯出处。
      if (!list.some(reference => reference.source.id === source.id)) list.push({ source, source_line });
    });
  }
}
console.log(`已建立 ${upstreamPoems} 篇原文的匹配索引，覆盖 ${references.size} 个现有句子。`);
const tune = JSON.parse(fs.readFileSync(new URL('./_assets/Word_Tune.json', import.meta.url), 'utf8'));
const rhyme = JSON.parse(fs.readFileSync(new URL('./_assets/Pingshui_Rhyme.json', import.meta.url), 'utf8'));
const toneIndex = buildToneIndex(tune, rhyme, simplify);
const report = { inputCount: POETRY_DATABASE.length, runInputCount: POETRY_DATABASE.length, upstreamPoems, outputCount: 0,
  sourceStatuses: {}, genres: {}, correctedAuthors: 0, correctedTitles: 0,
  correctedToneLines: 0, correctedTags: 0, multiSourceLines: 0, qualityFlags: {}, quarantined: 0,
  repositories: manifest.repositories, quarantineSources: [], examples: [] };
const out = [], quarantine = [], changes = [];
const previousChanges = new Map(readArchive('corpus-changes.json.gz').map(entry => [entry.id, entry]));
const unknownAuthor = author => ['佚名', '未知', '不详', '无名氏', ''].includes(author);
const sameOldSource = (a, b) => a && b && a.author === b.author && normalizeTitle(a.title) === normalizeTitle(b.title) && a.dynasty === b.dynasty;
const legacySources = new Map();

for (const [index, original] of POETRY_DATABASE.entries()) {
  const candidates = references.get(original.content) || [];
  const titled = candidates.filter(reference => normalizeTitle(reference.source.title) === normalizeTitle(original.title));
  let preferred = titled.filter(reference => reference.source.author === original.author);
  let author = original.author;
  if (unknownAuthor(author)) {
    const knownAuthors = new Set(titled.map(reference => reference.source.author).filter(Boolean));
    if (knownAuthors.size === 1) {
      author = [...knownAuthors][0];
      preferred = titled.filter(reference => reference.source.author === author);
    }
  }
  if (!preferred.length) {
    const sameAuthor = candidates.filter(reference => reference.source.author === author && !unknownAuthor(author));
    if (sameAuthor.length === 1) preferred = sameAuthor;
  }
  // 同名同作者的多首作品，只有相邻旧记录能唯一支持时才指定原诗。
  const scored = preferred.map(reference => ({ reference, score: [-2, -1, 1, 2].reduce((score, delta) => {
    const neighbor = POETRY_DATABASE[index + delta];
    return score + (sameOldSource(original, neighbor) && workTexts.get(reference.source.id)?.has(neighbor.content) ? 1 : 0);
  }, 0) })).sort((a, b) => b.score - a.score);
  const ambiguous = scored.length > 1 && scored[0].score === scored[1].score;
  const selected = scored[0]?.reference || titled.find(reference => !reference.source.author) || null;
  let source, source_line = null, title = original.title, dynasty = original.dynasty;
  const flags = new Set();
  if (selected && !ambiguous) {
    source = selected.source;
    source_line = selected.source_line;
    if (source.author) { title = source.title; dynasty = source.dynasty || dynasty; }
  } else {
    const conflict = !unknownAuthor(author) && !preferred.length && titled.some(reference => reference.source.author && reference.source.author !== author);
    const status = ambiguous ? 'ambiguous' : conflict ? 'conflict' : 'unverified';
    const key = JSON.stringify([dynasty, author, title, status]);
    if (!legacySources.has(key)) legacySources.set(key, {
      id: 'legacy:' + createHash('sha256').update(JSON.stringify([dynasty, author, title])).digest('hex').slice(0, 24),
      dataset: '旧语料记录', record_id: '', author, title, dynasty, status,
      genre: classifyGenre(author, title, '旧库'), url: selected?.source.url || ''
    });
    source = legacySources.get(key);
    if (ambiguous) flags.add('SOURCE_AMBIGUOUS');
    if (conflict) flags.add('SOURCE_CONFLICT');
  }
  if (source.status !== 'matched') flags.add('SOURCE_UNVERIFIED');
  if (unknownAuthor(author)) flags.add('AUTHOR_UNKNOWN');
  const genre = classifyGenre(author, title, source.dataset);
  const excludedGenre = ['prose', 'fu'].includes(genre) ? genre : ['prose', 'fu'].includes(source.genre) ? source.genre : null;
  if (excludedGenre) {
    const recovered = { ...original };
    for (const [field, change] of Object.entries(previousChanges.get(original.id)?.changed || {})) recovered[field] = change.before;
    for (const field of ['source', 'source_line', 'other_sources', 'quality_flags']) delete recovered[field];
    quarantine.push({ record: recovered, reason: '确认文体为古文或赋，不作为近体诗集句候选', genre: excludedGenre,
      evidence: source.url || PROSE_REFERENCE });
    continue;
  }
  const tones = reviewTones(original, toneIndex);
  for (const flag of tones.flags) flags.add(flag);
  const other_sources = candidates.filter(reference => !selected || ambiguous || reference.source.id !== selected.source.id);
  const item = { ...original, author, title, dynasty,
    ping_ze_pattern: tones.ping_ze_pattern, end_tone: tones.end_tone, rhyme_group: tones.rhyme_group,
    tags: improveTags(original), source, source_line, other_sources, quality_flags: [...flags].sort() };
  const changed = {};
  for (const field of ['author', 'title', 'dynasty', 'ping_ze_pattern', 'end_tone', 'rhyme_group', 'tags']) {
    if (JSON.stringify(original[field]) !== JSON.stringify(item[field])) changed[field] = { before: original[field], after: item[field] };
  }
  if (changed.author) report.correctedAuthors++;
  if (changed.title) report.correctedTitles++;
  if (changed.ping_ze_pattern || changed.end_tone || changed.rhyme_group) report.correctedToneLines++;
  if (changed.tags) report.correctedTags++;
  if (Object.keys(changed).length) changes.push({ id: item.id, content: item.content, changed, evidence: source.url || '本地平仄及平水韵字典简繁对应' });
  if (other_sources.length) report.multiSourceLines++;
  report.sourceStatuses[source.status] = (report.sourceStatuses[source.status] || 0) + 1;
  report.genres[source.genre] = (report.genres[source.genre] || 0) + 1;
  for (const flag of flags) report.qualityFlags[flag] = (report.qualityFlags[flag] || 0) + 1;
  if ((changed.author || changed.title) && report.examples.length < 20) report.examples.push(changes.at(-1));
  out.push(item);
}
report.outputCount = out.length;
// 重跑时保留此前隔离条目和最初字段值，不能把清理历史覆盖为零。
function readArchive(name) {
  const path = new URL('../reports/' + name, import.meta.url);
  if (!fs.existsSync(path)) return [];
  return JSON.parse(gunzipSync(fs.readFileSync(path)).toString('utf8'));
}
const quarantineById = new Map(readArchive('corpus-quarantine.json.gz').map(entry => [entry.record.id, entry]));
for (const entry of quarantine) if (!quarantineById.has(entry.record.id)) quarantineById.set(entry.record.id, entry);
const allQuarantine = [...quarantineById.values()];
const changesById = new Map(readArchive('corpus-changes.json.gz').map(entry => [entry.id, entry]));
for (const entry of changes) {
  const previous = changesById.get(entry.id);
  if (!previous) { changesById.set(entry.id, entry); continue; }
  for (const [field, change] of Object.entries(entry.changed)) {
    previous.changed[field] = { before: previous.changed[field]?.before ?? change.before, after: change.after };
    if (JSON.stringify(previous.changed[field].before) === JSON.stringify(change.after)) delete previous.changed[field];
  }
  previous.evidence = entry.evidence;
  if (!Object.keys(previous.changed).length) changesById.delete(entry.id);
}
const allChanges = [...changesById.values()];
report.inputCount = report.outputCount + allQuarantine.length;
report.quarantined = allQuarantine.length;
report.correctedAuthors = allChanges.filter(entry => entry.changed.author).length;
report.correctedTitles = allChanges.filter(entry => entry.changed.title).length;
report.correctedToneLines = allChanges.filter(entry => entry.changed.ping_ze_pattern || entry.changed.end_tone || entry.changed.rhyme_group).length;
report.correctedTags = allChanges.filter(entry => entry.changed.tags).length;
const groupedQuarantine = new Map();
for (const entry of allQuarantine) {
  const key = JSON.stringify([entry.record.author, entry.record.title]);
  if (!groupedQuarantine.has(key)) groupedQuarantine.set(key, { author: entry.record.author, title: entry.record.title, genre: entry.genre, count: 0, evidence: entry.evidence });
  groupedQuarantine.get(key).count++;
}
report.quarantineSources = [...groupedQuarantine.values()];
report.examples = allChanges.filter(entry => entry.changed.author || entry.changed.title).slice(0, 20);
report.dictionaries = ['Word_Tune.json', 'Pingshui_Rhyme.json'].map(name => ({
  file: `scripts/_assets/${name}`,
  sha256: createHash('sha256').update(fs.readFileSync(new URL('./_assets/' + name, import.meta.url))).digest('hex')
}));
const stats = { count: out.length, sourceGroups: new Set(out.map(item => item.source.id)).size,
  authors: new Set(out.map(item => item.author)).size, lengths: {}, dynasties: {} };
for (const item of out) {
  stats.lengths[item.length] = (stats.lengths[item.length] || 0) + 1;
  stats.dynasties[item.dynasty] = (stats.dynasties[item.dynasty] || 0) + 1;
}
fs.mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
// 先保留隔离条目与字段变更，再无损写入新语料。
fs.writeFileSync(new URL('../reports/corpus-quarantine.json.gz', import.meta.url), gzipSync(JSON.stringify(allQuarantine), { level: 9 }));
fs.writeFileSync(new URL('../reports/corpus-changes.json.gz', import.meta.url), gzipSync(JSON.stringify(allChanges), { level: 9 }));
fs.writeFileSync(new URL('../reports/corpus-quality.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(new URL('../reports/corpus-stats.json', import.meta.url), JSON.stringify(stats, null, 2) + '\n');
fs.writeFileSync(new URL('../reports/corpus-quality.md', import.meta.url), `**语料与出处核对报告**

这是出处核对的中间结果；最终运行库再经过单一出处筛选，当前数量与可恢复档案见 [单一出处报告](corpus-single-source.md)。附加出处仅留在离线档案，不参与运行选句。

核对使用固定版本的 ${upstreamPoems.toLocaleString('en-US')} 篇公开原文。结果是程序与上游数据的匹配，不等同于专家文献校勘或语境读音确认。

| 项目 | 记录数 |
|---|---:|
| 原始语料 | ${report.inputCount} |
| 筛选前核对语料 | ${report.outputCount} |
| 确认古文／赋并隔离 | ${report.quarantined}（${report.quarantineSources.length} 个来源） |
| 原文及署名匹配 | ${report.sourceStatuses.matched || 0} |
| 补正作者记录 | ${report.correctedAuthors} |
| 补正篇名记录 | ${report.correctedTitles} |
| 补正声调／韵部记录 | ${report.correctedToneLines} |
| 收紧意象标签 | ${report.correctedTags} |
| 档案中含同句其他原文记录 | ${report.multiSourceLines} |

处理规则：不同作者、朝代和可确认的原文标识分别分组；按原文分句位置排序，页面只称“收录句”。已确认的古文／赋移出运行库，原始条目和依据保存在 [隔离档案](corpus-quarantine.json.gz)。字段最初值、修正后值及依据保存在 [变更档案](corpus-changes.json.gz)，重跑不覆盖此前历史。

仍需核对：${report.sourceStatuses['text-matched'] || 0} 条只匹配文本、${report.sourceStatuses.ambiguous || 0} 条有多种原文／版本匹配、${report.sourceStatuses.unverified || 0} 条只有旧库出处，${report.sourceStatuses.conflict || 0} 条有署名冲突。后者不作为严格候选；未知作者不猜署名。

古音：${report.qualityFlags.TONE_UNKNOWN || 0} 条有字典缺字，不作为严格候选；${report.qualityFlags.TONE_AMBIGUOUS || 0} 条含多读字，保留既有读音标注并提示结合语境核对。这些统计可能重叠，不能相加作为错误条目总数。补字和单义声调修正来自本地字典的简繁对应；字典文件校验值见 [机器报告](corpus-quality.json)。

证据版本：[chinese-poetry 原文库](https://github.com/${manifest.repositories.tang.repo}/tree/${manifest.repositories.tang.commit})；[haitangshishe 原文合集](https://github.com/${manifest.repositories.anthology.repo}/tree/${manifest.repositories.anthology.commit})。保留原文数据，不发布上游译文、赏析或作者小传。元曲、词及文体未分类的片段仍可检索，不能将五／七字切句自动视为近体诗原作。

验证：逐条压缩还原比较、压缩文件 SHA-256、格律／选句／通关回归测试和真实语料冒烟测试。截图见 [出处核对界面](source-quality-preview.png)。
`);
writeSingleSourceCorpus(out);
console.log(JSON.stringify({ ...report, quarantineSources: report.quarantineSources.length, examples: report.examples.length }, null, 2));
