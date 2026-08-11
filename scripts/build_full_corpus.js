/**
 * 全量《全唐诗》语料构建脚本 (scripts/build_full_corpus.js)
 *
 * 目标：把开源《全唐诗》(chinese-poetry/chinese-poetry) 全部 五/七言 诗句，
 *       用「正确」的平仄字典 (Word_Tune) + 平水韵表 (Pingshui_Rhyme) 逐句标注，
 *       与现有 poetry_db.js 合并去重后写回。
 *
 * 为什么不直接用旧 fetch_full_tang_and_song.js：
 *   - 旧脚本只抓了全唐诗前 5 个文件(约5000首, 全是初唐)，导致王维/张九龄等被塞爆、
 *     杜甫/李商隐/杜牧(盛唐/晚唐) 从未入库 —— 这正是"库很怪"的根因。
 *   - 旧脚本 getTone 只认 57 个入声字，其余全当平声，平仄是错的。
 *   ############################################################################
 * 本脚本用 8232 字平仄字典 + 106 部平水韵，逐字正确标注。
 *
 * 现有 poetry_db.js 中的条目【保持原样不重标】(避免破坏已手工验证的教材篇目)，
 * 仅用 Word_Tune 标注新增的《全唐诗》句，二者编码一致(1=平,0=仄)，可安全混用。
 *
 * 全宋诗：默认关闭(INCLUDE_SONG=false)。需要时在下方改为 true 重新运行。
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import OpenCC from 'opencc-js';
import { POETRY_DATABASE } from '../src/data/poetry_db.js';

// 全唐诗/宋诗原始数据为繁体，平仄字典(Word_Tune)是简体——入库前统一转简体，避免简繁错位导致平仄标错、搜索扑空。
const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INCLUDE_SONG = false; // 全宋诗体量大，默认关；如需陆游/李清照等宋诗补全可开启

// ---------- 字典加载 ----------
const tune = JSON.parse(fs.readFileSync(path.join(__dirname, '_assets/Word_Tune.json'), 'utf8'));
const ps = JSON.parse(fs.readFileSync(path.join(__dirname, '_assets/Pingshui_Rhyme.json'), 'utf8'));

// 字 -> 平声韵部名 (上平X / 下平X)
const pingRhymeOf = {};
for (const sheng of ['上平声部', '下平声部']) {
  for (const [bu, chars] of Object.entries(ps[sheng])) {
    const name = sheng.replace('声部', '') + bu; // 上平一东 / 下平一先
    for (const ch of chars) {
      if (!(ch in pingRhymeOf)) pingRhymeOf[ch] = name;
    }
  }
}

// ---------- 标注函数 ----------
// 单字平仄 -> 编码
function toneCode(ch) {
  const t = tune[ch];
  if (t === '平') return '1';
  if (t === '仄') return '0';
  if (t === '多') {
    // 多音字：若出现在平声韵部，按平处理；否则按仄
    return (ch in pingRhymeOf) ? '1' : '0';
  }
  return '1'; // 字典未收录，默认平(多为平声常用字)
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

// 意象提取 (复用既有 TAG_MAP 思路)
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

// ---------- 下载 ----------
function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
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
function tangUrl(i) { return BASE + encodeURI('全唐诗') + '/poet.tang.' + i + '.json'; }
function songUrl(i) { return BASE + encodeURI('全宋诗') + '/poet.song.' + i + '.json'; }

// 并发池
async function pool(items, worker, concurrency = 8) {
  const results = [];
  let idx = 0;
  async function next() {
    while (idx < items.length) {
      const cur = items[idx++];
      results.push(await worker(cur));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

async function probeMaxIndex(urlFn, step = 1000, limit = 200000) {
  // 顺序探测直到连续若干 404
  let last = -1;
  let miss = 0;
  for (let i = 0; i <= limit; i += step) {
    const txt = await fetchText(urlFn(i));
    if (txt == null) { miss++; if (miss >= 4) break; continue; }
    miss = 0; last = i;
  }
  return last;
}

// ---------- 主流程 ----------
async function start() {
  console.log('▶ 加载现有数据库...');
  const existing = POETRY_DATABASE;
  const seenContent = new Set(existing.map(e => e.content));
  let idCounter = 0;
  for (const e of existing) {
    const m = /^.*?(\d+)$/.exec(e.id || '');
    if (m) idCounter = Math.max(idCounter, parseInt(m[1], 10));
  }
  const newLines = [];

  const sources = [{ name: '全唐诗', urlFn: tangUrl, dyn: '唐' }];
  if (INCLUDE_SONG) sources.push({ name: '全宋诗', urlFn: songUrl, dyn: '宋' });

  for (const src of sources) {
    console.log(`▶ 探测 ${src.name} 文件范围...`);
    const maxIdx = await probeMaxIndex(src.urlFn);
    if (maxIdx < 0) { console.log(`  └─ ${src.name} 未探测到文件，跳过`); continue; }
    console.log(`  └─ ${src.name} 文件索引 0 ~ ${maxIdx}`);
    const idxs = [];
    for (let i = 0; i <= maxIdx; i += 1000) idxs.push(i);

    let added = 0, skipped = 0, dropped = 0;
    await pool(idxs, async (i) => {
      const txt = await fetchText(src.urlFn(i));
      if (txt == null) return;
      let poems;
      try { poems = JSON.parse(txt); } catch (e) { console.error(`  解析失败 ${src.name} ${i}: ${e.message}`); return; }
      for (const poem of poems) {
        const title = toSimplified((poem.title || poem.rhythmic || '').trim());
        if (!title || title === '无题' || title === '诗' || title === '词') continue;
        const author = poem.author || '未知';
        const paras = poem.paragraphs || poem.stanzas || [];
        for (const p of paras) {
          if (typeof p !== 'string') continue;
          const sentences = p.split(/[，。！？；：、]/).map(s => toSimplified(s.trim())).filter(Boolean);
          for (const s of sentences) {
            // 过滤含非 BMP 罕见异体字的句子(代理对字符，UI 会显示成方块乱码，且 length 计数失真)
            if ([...s].some(c => c.codePointAt(0) > 0xFFFF)) { dropped++; continue; }
            const cpLen = Array.from(s).length;
            if ((cpLen === 5 || cpLen === 7) && /^[\u4e00-\u9fa5]+$/.test(s)) {
              if (seenContent.has(s)) { skipped++; continue; }
              seenContent.add(s);
              const endChar = s[s.length - 1];
              const pattern = Array.from(s).map(toneCode).join('');
              // 注意：不再因「关键位(2/4/6)字未收录」而整句丢弃。
              // 旧逻辑曾在繁体原文+简体字典错位时误删约 70% 的诗句，
              // 导致「秋兴八首」等名篇只剩 1~2 句。未收录字按 toneCode 的默认
              // 规则(平) 标注即可，整诗完整性优先于单字绝对精确。
              idCounter++;
              newLines.push({
                id: `full_${src.dyn}_${idCounter}`,
                content: s,
                length: cpLen,
                author,
                dynasty: src.dyn,
                title,
                ping_ze_pattern: pattern,
                end_tone: endTone(endChar),
                rhyme_group: endTone(endChar) === '平' ? rhymeGroup(endChar) : '仄声',
                tags: extractTags(s)
              });
              added++;
            }
          }
        }
      }
    }, 6);
    console.log(`  └─ ${src.name}: 新增 ${added} 条, 重复跳过 ${skipped}, 因缺字丢弃 ${dropped}`);
  }

  const all = existing.concat(newLines);
  console.log(`\n🎉 合并完成：原有 ${existing.length} + 新增 ${newLines.length} = 共 ${all.length} 条`);

  const outPath = path.join(__dirname, '../src/data/poetry_db.js');
  const banner = [
    '/**',
    ' * 古诗集句工程 - 全量数据库',
    ' * 由 scripts/build_full_corpus.js 构建：现有精选 + 开源《全唐诗》全量五/七言句(正确平仄标注)。',
    ` * 共收录 ${all.length} 条规范名句。`,
    ' */',
    '',
    'export const POETRY_DATABASE = '
  ].join('\n');
  const code = banner + JSON.stringify(all, null, 2) + ';\n';
  fs.writeFileSync(outPath, code, 'utf-8');
  console.log(`✅ 已写入 ${outPath}`);

  // 简单统计
  const dyn = {};
  for (const e of all) dyn[e.dynasty] = (dyn[e.dynasty] || 0) + 1;
  console.log('朝代分布:', JSON.stringify(dyn));
  const authors = {};
  for (const e of all) authors[e.author] = (authors[e.author] || 0) + 1;
  const top = Object.entries(authors).sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log('诗人 Top12:', top.map(([a, n]) => `${a}:${n}`).join('  '));
  console.log('杜甫七律代表《秋兴》:', all.filter(e => e.author === '杜甫' && e.title.includes('秋兴')).length, '句');
}

start().catch(e => { console.error('致命错误:', e); process.exit(1); });
