/**
 * scripts/normalize_full.js
 *
 * 全库清理（幂等，可重复运行）：
 *   1. author / title / content 全字段 opencc 繁->简（此前只转了 title/content，author 残留繁体）
 *   2. 剥离下载期 UTF-8 跨块截断产生的 U+FFFD 乱码（修复"前出塞九�� 一"等标题）
 *   3. 繁转简后再次按 content 去重（繁体/简体同义句此时才可能撞车）
 *   4. 用简体字典重标 ping_ze_pattern / end_tone / rhyme_group / tags
 *   5. 输出改为紧凑 JSON（约省一半体积，浏览器加载更快）
 *
 * 用法：node --max-old-space-size=4096 scripts/normalize_full.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenCC from 'opencc-js';
import { POETRY_DATABASE } from '../src/data/poetry_db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

// ---------- 字典 ----------
const tune = JSON.parse(fs.readFileSync(path.join(__dirname, '_assets/Word_Tune.json'), 'utf8'));
const ps = JSON.parse(fs.readFileSync(path.join(__dirname, '_assets/Pingshui_Rhyme.json'), 'utf8'));
const pingRhymeOf = {};
for (const sheng of ['上平声部', '下平声部']) {
  for (const [bu, chars] of Object.entries(ps[sheng])) {
    const name = sheng.replace('声部', '') + bu;
    for (const ch of chars) if (!(ch in pingRhymeOf)) pingRhymeOf[ch] = name;
  }
}
function toneCode(ch) {
  const t = tune[ch];
  if (t === '平') return '1';
  if (t === '仄') return '0';
  if (t === '多') return (ch in pingRhymeOf) ? '1' : '0';
  return '1';
}
function endTone(ch) {
  const t = tune[ch];
  if (t === '平') return '平';
  if (t === '仄') return '仄';
  if (t === '多') return (ch in pingRhymeOf) ? '平' : '仄';
  return '平';
}
function rhymeGroup(ch) {
  if (ch in pingRhymeOf) return pingRhymeOf[ch];
  const t = tune[ch];
  if (t === '仄' || t === '多') return '仄声';
  return '平水韵通用';
}

const TAG_MAP = {
  '月': ['月', '蟾', '桂', '夜光', '冰轮'],
  '风': ['风', '吹', '飘', '飒'],
  '花': ['花', '桃', '杏', '红', '芳', '华', '梅', '莲'],
  '酒': ['酒', '饮', '醉', '樽', '杯', '酌'],
  '山': ['山', '峰', '岩', '岳', '岭', '翠'],
  '水': ['水', '江', '河', '海', '泉', '溪', '川', '浪'],
  '舟': ['舟', '船', '帆', '桨', '舸'],
  '鸟': ['鸟', '燕', '鸿', '雁', '猿', '莺', '鸥'],
  '雪': ['雪', '霜', '寒', '冰'],
  '秋': ['秋', '枫', '萧', '落'],
  '春': ['春', '绿', '柳', '草', '枝'],
  '夜': ['夜', '暮', '昏', '烛'],
  '思乡': ['乡', '归', '愁', '思', '故', '家'],
  '边塞': ['塞', '城', '关', '沙', '胡', '马', '剑', '旗', '戎'],
  '友情': ['友', '别', '送', '逢', '故人', '相忆']
};
function extractTags(text) {
  const tags = [];
  for (const [tag, kws] of Object.entries(TAG_MAP)) {
    if (kws.some(kw => text.includes(kw))) tags.push(tag);
  }
  return tags.length > 0 ? tags : ['感怀'];
}

// ---------- 主流程 ----------
console.log('▶ 加载现有数据库:', POETRY_DATABASE.length, '条');
const seen = new Set();
const out = [];
let dedup = 0, ffStripped = 0, droppedInvalid = 0, changed = 0;
let ffInContent = 0, ffInAuthor = 0;
const authorBefore = new Set(POETRY_DATABASE.map(e => e.author)).size;

for (const e of POETRY_DATABASE) {
  // 1) 繁 -> 简 + 剥乱码
  const author = toSimplified(e.author || '').replace(/\uFFFD/g, '').trim();
  const title = toSimplified(e.title || '').replace(/\uFFFD/g, '').replace(/\s+/g, ' ').trim();
  const content = toSimplified(e.content || '').replace(/\uFFFD/g, '').trim();

  if ((e.content || '').includes('\uFFFD')) ffInContent++;
  if ((e.author || '').includes('\uFFFD')) ffInAuthor++;

  if (content.length === 0) { droppedInvalid++; continue; }
  const cpLen = Array.from(content).length;
  if (cpLen !== 5 && cpLen !== 7) { droppedInvalid++; continue; } // 剥乱码后长度失真的句子丢弃

  // 2) 转简后再去重
  if (seen.has(content)) { dedup++; continue; }
  seen.add(content);

  // 3) 重标
  const endChar = content[content.length - 1] || '';
  const item = {
    id: e.id,
    content,
    length: cpLen,
    author,
    dynasty: e.dynasty,
    title,
    ping_ze_pattern: Array.from(content).map(toneCode).join(''),
    end_tone: endTone(endChar),
    rhyme_group: endTone(endChar) === '平' ? rhymeGroup(endChar) : '仄声',
    tags: extractTags(content)
  };
  if (item.content !== e.content || item.title !== e.title || item.author !== e.author ||
      item.ping_ze_pattern !== e.ping_ze_pattern || item.end_tone !== e.end_tone ||
      item.rhyme_group !== e.rhyme_group || JSON.stringify(item.tags) !== JSON.stringify(e.tags)) {
    changed++;
  }
  out.push(item);
}

console.log(`▶ 结果: 原 ${POETRY_DATABASE.length} -> 保留 ${out.length} | 去重删 ${dedup} | 剥乱码标题/字段 ${ffStripped} 条涉及 | 无效(空/长度失真)删 ${droppedInvalid}`);
console.log(`▶ 变更(转换/重标) ${changed} 条 | content含乱码 ${ffInContent} | author含乱码 ${ffInAuthor}`);

const authorAfter = new Set(out.map(e => e.author)).size;
console.log(`▶ 作者去重: ${authorBefore} -> ${authorAfter} (合并 ${authorBefore - authorAfter})`);

// ---------- 写回(紧凑 JSON) ----------
const outPath = path.join(__dirname, '../src/data/poetry_db.js');
const banner = [
  '/**',
  ' * 古诗集句工程 - 全量数据库',
  ' * 构建: build_full_corpus.js(全唐诗) + inject_song_and_gushi.js(宋诗/曹操) + inject_school_textbook_poems.js(教材名篇)',
  ' *        + repair_corpus.js(简体流水线修复) + merge_gushiwen.js(古诗文网全量并入)',
  ' * 清理: fix_corpus_simplified.js / fix_dynasty_labels.js / normalize_full.js(全字段繁转简+去重+剥乱码)',
  ` * 共收录 ${out.length} 条规范五/七言句。`,
  ' */',
  '',
  'export const POETRY_DATABASE = '
].join('\n');
fs.writeFileSync(outPath, banner + JSON.stringify(out) + ';\n', 'utf-8');
console.log(`✅ 已写回 ${outPath} (${out.length} 条, 紧凑格式)`);

// ---------- 验证 ----------
const qx = out.filter(i => i.author === '杜甫' && i.title.includes('秋兴'));
console.log('\n=== 验证 ===');
console.log('杜甫《秋兴八首》句数:', qx.length);
qx.slice(0, 6).forEach(h => console.log('   ', h.author, '《' + h.title + '》', h.content, '|', h.end_tone, h.rhyme_group));
const fanRe = /[韓劉齊陸貫韋範張楊黃賴錢許鄭馬趙陳國雲詩東風長無時間聲處歸樓邊興雲歸陽門遠龍鳳馬魚鳥]|（|）|，|。/;
let fanLeft = 0; const fanSamples = [];
for (const e of out) {
  const s = e.author + e.title + e.content;
  if (fanRe.test(s)) { fanLeft++; if (fanSamples.length < 5) fanSamples.push([e.author, e.title, e.content]); }
}
console.log('残留繁体特征/杂质条目:', fanLeft);
fanSamples.forEach(x => console.log('   残留样例:', JSON.stringify(x)));
let ffLeft = 0;
for (const e of out) if (((e.title || '') + (e.content || '') + (e.author || '')).includes('\uFFFD')) ffLeft++;
console.log('残留 U+FFFD 乱码条目:', ffLeft);
for (const m of ['韩愈', '刘禹锡', '陆龟蒙', '贯休', '韦应物', '苏轼', '陆游', '李清照', '辛弃疾', '陶渊明']) {
  const c = out.filter(e => e.author === m).length;
  console.log(`   ${m}: ${c} 句`);
}
