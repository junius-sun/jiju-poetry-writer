/**
 * 合并古诗文网(gushiwen.cn)全量 dump 到诗词库
 * 数据源：muskjobstao/haitangshishe（fork of hujiaweibujidao/poetry），data/aio 合并 JSON
 *
 * 策略：
 *   - 唐诗(全唐诗已全量且权威) → 跳过，不并入
 *   - 其余朝代(宋/汉/魏晋/元/明/清/五代/南北朝…) → 全量并入
 *   - 每首诗：opencc 转简体 → 按标点切句 → 仅取纯汉字 5/7 言句 → 标平仄/韵部/意象
 *   - 去重：以现有库 content 为种子建集合，避免与已有条目(教材名篇/宋初残本/曹操)重复；同时新批内自去重
 *   - 现有 47 万条原样保留，仅追加新条目
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

// ---------- 朝代归一化 ----------
function normalizeDynasty(raw) {
  if (!raw) return '未标注';
  const r = String(raw).trim();
  if (r.includes('唐')) return null; // 跳过唐诗(全唐诗已全量)
  let d = r.replace(/代$/, '');
  const map = {
    '宋': '宋', '北宋': '宋', '南宋': '宋',
    '汉': '汉',
    '魏晋': '魏晋', '晋': '魏晋', '东晋': '魏晋', '西晋': '魏晋',
    '隋': '隋', '南北朝': '南北朝',
    '元': '元', '明': '明', '清': '清', '五代': '五代',
    '金': '金', '辽': '辽', '西夏': '西夏',
    '战国': '战国', '秦': '秦', '先秦': '先秦'
  };
  return map[d] || d;
}

// ---------- 加载古诗文网数据 ----------
function loadGushiwen() {
  const poems = [];
  const roots = [
    path.join(__dirname, '_tmp_gushiwen/data/aio'),
    path.join(__dirname, '_tmp_gushiwen/data/poetry')
  ];
  for (const dir of roots) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!/^LCPoetry\d+\.json$/.test(f)) continue; // 只取诗合并文件，跳过 LCPoet/LCTag/MiniPoetry
      let raw;
      try { raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
      catch (e) { console.error('解析失败', f, e.message); continue; }
      let list = Array.isArray(raw) ? raw : (raw.poetry || raw.poems || (raw.data && raw.data.poetry) || null);
      if (!Array.isArray(list) && raw && typeof raw === 'object') {
        // 可能形如 { poems: [...] } 或单个对象
        const vals = Object.values(raw).filter(v => Array.isArray(v));
        list = vals.length ? vals[0] : (Array.isArray(raw) ? raw : [raw]);
      }
      if (Array.isArray(list)) poems.push(...list);
    }
  }
  return poems;
}

// ---------- 诗人表(objectId -> name) ----------
const poetsRaw = JSON.parse(fs.readFileSync(path.join(__dirname, '_tmp_gushiwen/data/aio/LCPoet.json'), 'utf8'));
const poetMap = {};
for (const x of poetsRaw) if (x.objectId) poetMap[x.objectId] = x.name;
console.log('▶ 诗人表:', poetsRaw.length, '位 | 建 objectId->name 映射');

// ---------- 主流程 ----------
// 只保留合并前的原始条目(丢弃上一轮用错作者写的 gw_ 条目，稍后重并以正确作者追加)
const existing = POETRY_DATABASE.filter(e => !(String(e.id).startsWith('gw_')));
console.log('▶ 合并前原始库:', existing.length, '条 (已丢弃', POETRY_DATABASE.length - existing.length, '条旧 gw_)');

// 去重种子：现有库所有 content（已简体、已 BMP 过滤）
const existingContents = new Set(existing.map(e => e.content));
console.log('▶ 现有 content 去重种子:', existingContents.size);

const poems = loadGushiwen();
console.log('▶ 古诗文网读入诗(篇):', poems.length);

const SPLIT_RE = /[，。！？；：、\n\r\t\s,.!?;:]/;
const newSeen = new Set();
const added = [];
let idCounter = 0;
const stat = { scanned: 0, skippedTang: 0, noContent: 0, droppedLen: 0, droppedNBMP: 0, dedupExisting: 0, dedupSelf: 0, byDynasty: {} };

for (const p of poems) {
  stat.scanned++;
  const dynasty = normalizeDynasty(p.dynasty);
  if (dynasty === null) { stat.skippedTang++; continue; }
  const content = p.content || '';
  // 正确作者解析：poet 是指向 LCPoet 的指针(objectId)，name 在诗人表里；author 字段实为小传，不可直接作作者
  let author = '佚名';
  if (p.poet && p.poet.objectId && poetMap[p.poet.objectId]) author = poetMap[p.poet.objectId];
  if (!content) { stat.noContent++; continue; }
  const sContent = toSimplified(content);
  const sentences = sContent.split(SPLIT_RE).map(s => s.trim()).filter(Boolean);
  const title = toSimplified(p.name || p.title || '');
  for (const s of sentences) {
    const chars = Array.from(s);
    const cpLen = chars.length;
    if (cpLen !== 5 && cpLen !== 7) { stat.droppedLen++; continue; }
    if (!/^[一-龥]+$/.test(s)) { stat.droppedLen++; continue; }
    if (chars.some(c => c.codePointAt(0) > 0xFFFF)) { stat.droppedNBMP++; continue; }
    if (existingContents.has(s)) { stat.dedupExisting++; continue; }
    if (newSeen.has(s)) { stat.dedupSelf++; continue; }
    newSeen.add(s);
    const endChar = chars[cpLen - 1];
    const et = endTone(endChar);
    added.push({
      id: 'gw_' + (++idCounter),
      content: s,
      length: cpLen,
      author,
      dynasty,
      title,
      ping_ze_pattern: chars.map(toneCode).join(''),
      end_tone: et,
      rhyme_group: et === '平' ? rhymeGroup(endChar) : '仄声',
      tags: extractTags(s)
    });
    stat.byDynasty[dynasty] = (stat.byDynasty[dynasty] || 0) + 1;
  }
}

console.log('▶ 处理统计:', JSON.stringify(stat, null, 2));
console.log('▶ 新增条数:', added.length);

// 合并写回：现有原样保留 + 新增追加
const out = existing.concat(added);
const outPath = path.join(__dirname, '../src/data/poetry_db.js');
const banner = [
  '/**',
  ' * 古诗集句工程 - 全量数据库',
  ' * 由 scripts/build_full_corpus.js 构建：现有精选 + 开源《全唐诗》全量五/七言句。',
  ' * 由 scripts/fix_corpus_simplified.js 繁->简归一化并重标平仄/韵部/意象。',
  ` * 由 scripts/merge_gushiwen.js 并入古诗文网(gushiwen.cn) dump 的宋/汉/魏晋/元/明/清等朝代五七言句(已去重)。`,
  ` * 共收录 ${out.length} 条规范名句。`,
  ' */',
  '',
  'export const POETRY_DATABASE = '
].join('\n');
fs.writeFileSync(outPath, banner + JSON.stringify(out, null, 2) + ';\n', 'utf-8');
console.log(`✅ 已写回 ${outPath} (${out.length} 条)`);
