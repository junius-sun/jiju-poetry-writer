/**
 * 修正脚本 (scripts/fix_corpus_simplified.js)
 *
 * 问题：build_full_corpus.js 初版未做繁->简转换，导致《全唐诗》20 万条以繁体入库。
 *   - 平仄字典(Word_Tune)是简体，繁体字查不到 -> 平仄/韵部错标；核心位繁体字直接整句丢弃
 *   - 标题是繁体(秋興八首)，用户用简体"秋兴"搜索扑空
 *   - 意象提取(TAG_MAP 为简体关键词)对繁体内容几乎全部失效 -> 标签几乎全是"感怀"
 *
 * 本脚本本地处理(不重新下载网络数据)：
 *   1. 对每条 content/title 用 opencc 转简体
 *   2. 用简体 Word_Tune + 平水韵表重标 ping_ze_pattern / end_tone / rhyme_group
 *   3. 用简体内容重算 tags
 *   4. 按 content 去重(保留首条，精选条优先)
 *   5. 写回 poetry_db.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenCC from 'opencc-js';
import { POETRY_DATABASE } from '../src/data/poetry_db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

// ---------- 字典加载 ----------
const tune = JSON.parse(fs.readFileSync(path.join(__dirname, '_assets/Word_Tune.json'), 'utf8'));
const ps = JSON.parse(fs.readFileSync(path.join(__dirname, '_assets/Pingshui_Rhyme.json'), 'utf8'));

const pingRhymeOf = {};
for (const sheng of ['上平声部', '下平声部']) {
  for (const [bu, chars] of Object.entries(ps[sheng])) {
    const name = sheng.replace('声部', '') + bu;
    for (const ch of chars) {
      if (!(ch in pingRhymeOf)) pingRhymeOf[ch] = name;
    }
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
console.log('▶ 加载现有数据库...', POETRY_DATABASE.length, '条');
let changed = 0, kept = 0, dedup = 0, droppedNBMP = 0;
const seen = new Set();
const out = [];

for (const e of POETRY_DATABASE) {
  const sContent = toSimplified(e.content || '');
  const sTitle = toSimplified(e.title || '');

  if (seen.has(sContent)) { dedup++; continue; }
  seen.add(sContent);

  // 过滤含非 BMP 罕见异体字的句子(代理对字符，UI 会显示成方块乱码，且 length 计数会失真)
  if ([...sContent].some(c => c.codePointAt(0) > 0xFFFF)) { droppedNBMP++; continue; }

  const endChar = sContent[sContent.length - 1] || '';
  const newItem = {
    id: e.id,
    content: sContent,
    length: Array.from(sContent).length,
    author: e.author,
    dynasty: e.dynasty,
    title: sTitle,
    ping_ze_pattern: Array.from(sContent).map(toneCode).join(''),
    end_tone: endTone(endChar),
    rhyme_group: endTone(endChar) === '平' ? rhymeGroup(endChar) : '仄声',
    tags: extractTags(sContent)
  };
  // 判断是否相比原条有变化(转简体/重标)
  if (newItem.content !== e.content || newItem.title !== e.title ||
      newItem.ping_ze_pattern !== e.ping_ze_pattern ||
      newItem.end_tone !== e.end_tone || newItem.rhyme_group !== e.rhyme_group ||
      JSON.stringify(newItem.tags) !== JSON.stringify(e.tags)) {
    changed++;
  }
  out.push(newItem);
  kept++;
}

console.log(`▶ 去重: ${dedup} 条 | 保留: ${kept} 条 | 非BMP过滤: ${droppedNBMP} 条 | 其中发生变更: ${changed} 条`);

const outPath = path.join(__dirname, '../src/data/poetry_db.js');
const banner = [
  '/**',
  ' * 古诗集句工程 - 全量数据库',
  ' * 由 scripts/build_full_corpus.js 构建：现有精选 + 开源《全唐诗》全量五/七言句(正确平仄标注)。',
  ' * 由 scripts/fix_corpus_simplified.js 繁->简归一化并重标平仄/韵部/意象标签。',
  ` * 共收录 ${out.length} 条规范名句。`,
  ' */',
  '',
  'export const POETRY_DATABASE = '
].join('\n');
fs.writeFileSync(outPath, banner + JSON.stringify(out, null, 2) + ';\n', 'utf-8');
console.log(`✅ 已写回 ${outPath} (${out.length} 条)`);

// 验证关键条目
const qx = out.filter(i => i.author === '杜甫' && i.title.includes('秋兴'));
console.log('杜甫《秋兴八首》句数:', qx.length);
qx.slice(0, 8).forEach(h => console.log('   ', h.author, '《' + h.title + '》', h.content, '|', h.end_tone, h.rhyme_group));
const tagDist = {};
for (const i of out) for (const t of i.tags) tagDist[t] = (tagDist[t] || 0) + 1;
console.log('标签分布(前8):', Object.entries(tagDist).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t, n]) => `${t}:${n}`).join('  '));
