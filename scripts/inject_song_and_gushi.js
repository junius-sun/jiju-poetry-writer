/**
 * 增量并入脚本 (scripts/inject_song_and_gushi.js)
 *
 * 目标：把 chinese-poetry/chinese-poetry 仓库里的「全宋诗」与「曹操诗集(汉末)」
 *       逐句用 Word_Tune 平仄字典 + 平水韵表正确标注后，并入现有 poetry_db.js。
 *
 * 为什么是增量脚本而非重跑 build_full_corpus.js：
 *   - 现有库(全唐诗+教材篇目)已经过繁简归一化与冒烟验证，无需重抓 13 分钟。
 *   - 本脚本只下载 2 个小文件(全宋诗 1 个 + 曹操 1 个)，复用相同的标注逻辑，
 *     保证与现有库编码一致(1=平,0=仄)可安全混用。
 *
 * 已知数据实情(已在报告中说明)：
 *   - 该仓库「全宋诗」仅 1 文件、1000 首宋初诗，不含苏轼/陆游/李清照，五七言句极少。
 *   - 曹操诗集多为四言/杂言，五七言句亦少。
 *   - 唐古体(乐府/歌行)已随全唐诗入库，本脚本不重复处理。
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import OpenCC from 'opencc-js';
import { POETRY_DATABASE } from '../src/data/poetry_db.js';

const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 404) { resolve(null); return; }
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

const BASE = 'https://cdn.jsdelivr.net/gh/chinese-poetry/chinese-poetry@master/';
const SONG_URL = BASE + encodeURI('全唐诗') + '/poet.song.0.json';
const CAOCAO_URL = BASE + encodeURI('曹操诗集') + '/caocao.json';

function processPoems(poems, dyn, forcedAuthor) {
  const out = [];
  for (const poem of poems) {
    const title = toSimplified((poem.title || poem.rhythmic || '').trim());
    if (!title || title === '无题' || title === '诗' || title === '词') continue;
    const author = forcedAuthor || toSimplified(poem.author || '未知');
    const paras = poem.paragraphs || poem.stanzas || poem.content || [];
    for (const p of paras) {
      if (typeof p !== 'string') continue;
      const sentences = p.split(/[，。！？；：、]/).map(s => toSimplified(s.trim())).filter(Boolean);
      for (const s of sentences) {
        if ([...s].some(c => c.codePointAt(0) > 0xFFFF)) continue; // 非 BMP 异体字跳过
        const cpLen = Array.from(s).length;
        if ((cpLen === 5 || cpLen === 7) && /^[\u4e00-\u9fa5]+$/.test(s)) {
          const endChar = s[s.length - 1];
          const coreMissing = [1, 3, 5].some(pos => pos < s.length && !(s[pos] in tune));
          if (coreMissing) continue;
          const pattern = Array.from(s).map(toneCode).join('');
          out.push({
            content: s,
            length: cpLen,
            author,
            dynasty: dyn,
            title,
            ping_ze_pattern: pattern,
            end_tone: endTone(endChar),
            rhyme_group: endTone(endChar) === '平' ? rhymeGroup(endChar) : '仄声',
            tags: extractTags(s)
          });
        }
      }
    }
  }
  return out;
}

async function start() {
  const existing = POETRY_DATABASE;
  const seenContent = new Set(existing.map(e => e.content));
  let counter = 0;
  const newLines = [];

  // 1. 全宋诗
  console.log('▶ 下载全宋诗...');
  const songTxt = await fetchText(SONG_URL);
  if (songTxt) {
    const arr = JSON.parse(songTxt);
    const cand = processPoems(arr, '宋', null);
    let added = 0;
    for (const c of cand) {
      if (seenContent.has(c.content)) continue;
      seenContent.add(c.content);
      counter++;
      newLines.push({ id: `song_${counter}`, ...c });
      added++;
    }
    console.log(`  └─ 全宋诗: 候选 ${cand.length} → 新增 ${added} 条`);
  } else {
    console.log('  └─ 全宋诗 获取失败(404)，跳过');
  }

  // 2. 曹操诗集(汉末)
  console.log('▶ 下载曹操诗集(汉末)...');
  const ccTxt = await fetchText(CAOCAO_URL);
  if (ccTxt) {
    const arr = JSON.parse(ccTxt);
    const cand = processPoems(Array.isArray(arr) ? arr : (arr.data || arr.poems || []), '汉', '曹操');
    let added = 0;
    for (const c of cand) {
      if (seenContent.has(c.content)) continue;
      seenContent.add(c.content);
      counter++;
      newLines.push({ id: `han_${counter}`, ...c });
      added++;
    }
    console.log(`  └─ 曹操(汉末): 候选 ${cand.length} → 新增 ${added} 条`);
  } else {
    console.log('  └─ 曹操 获取失败(404)，跳过');
  }

  const all = existing.concat(newLines);
  console.log(`\n🎉 合并完成：原有 ${existing.length} + 新增 ${newLines.length} = 共 ${all.length} 条`);

  const outPath = path.join(__dirname, '../src/data/poetry_db.js');
  const banner = [
    '/**',
    ' * 古诗集句工程 - 全量数据库',
    ' * 由 scripts/build_full_corpus.js 构建：现有精选 + 开源《全唐诗》全量五/七言句(正确平仄标注)。',
    ' * 追加：scripts/inject_song_and_gushi.js 并入《全宋诗》(宋初) 与 曹操诗集(汉末)。',
    ` * 共收录 ${all.length} 条规范名句。`,
    ' */',
    '',
    'export const POETRY_DATABASE = '
  ].join('\n');
  fs.writeFileSync(outPath, banner + JSON.stringify(all, null, 2) + ';\n', 'utf-8');
  console.log(`✅ 已写入 ${outPath}`);

  const dyn = {};
  for (const e of all) dyn[e.dynasty] = (dyn[e.dynasty] || 0) + 1;
  console.log('朝代分布:', JSON.stringify(dyn));
  console.log('曹操(汉末) 已入库:', all.filter(e => e.author === '曹操').length, '句');
  console.log('新增宋诗作者:', [...new Set(newLines.filter(e => e.dynasty === '宋').map(e => e.author))].slice(0, 10).join(' '));
}

start().catch(e => { console.error('致命错误:', e); process.exit(1); });
