/**
 * 修复脚本 (scripts/repair_corpus.js)
 *
 * 问题根因：首版 build_full_corpus 在「繁体原文 + 简体字典」错位下，
 *   coreMissing 过滤把约 70% 的诗句整句丢弃，导致《秋兴八首》等名篇只剩 1~2 句。
 *   fix_corpus_simplified 只转化了幸存句，无法恢复已丢句。
 *
 * 本脚本：用「正确的」简体流水线(poet.tang 原文先 toSimplified 再逐句标注)，
 *   重新抓取《全唐诗》全部文件，把所有「现有库里没有」的合法 5/7 言句补回，
 *   不再因核心字未收录而丢弃(整诗完整性优先)。现有条目原样保留。
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
    for (const ch of chars) if (!(ch in pingRhymeOf)) pingRhymeOf[ch] = name;
  }
}
function toneCode(ch) { const t = tune[ch]; if (t === '平') return '1'; if (t === '仄') return '0'; if (t === '多') return (ch in pingRhymeOf) ? '1' : '0'; return '1'; }
function endTone(ch) { const t = tune[ch]; if (t === '平') return '平'; if (t === '仄') return '仄'; if (t === '多') return (ch in pingRhymeOf) ? '平' : '仄'; return '平'; }
function rhymeGroup(ch) { if (ch in pingRhymeOf) return pingRhymeOf[ch]; const t = tune[ch]; if (t === '仄' || t === '多') return '仄声'; return '平水韵通用'; }
const TAG_MAP = {
  '月': ['月', '蟾', '桂', '夜光', '冰轮'], '风': ['风', '吹', '飘', '飒'], '花': ['花', '桃', '杏', '红', '芳', '华', '梅', '莲'],
  '酒': ['酒', '饮', '醉', '樽', '杯', '酌'], '山': ['山', '峰', '岩', '岳', '岭', '翠'], '水': ['水', '江', '河', '海', '泉', '溪', '川', '浪'],
  '舟': ['舟', '船', '帆', '桨', '舸'], '鸟': ['鸟', '燕', '鸿', '雁', '猿', '莺', '鸥'], '雪': ['雪', '霜', '寒', '冰'],
  '秋': ['秋', '枫', '萧', '落'], '春': ['春', '绿', '柳', '草', '枝'], '夜': ['夜', '暮', '昏', '烛'],
  '思乡': ['乡', '归', '愁', '思', '故', '家'], '边塞': ['塞', '城', '关', '沙', '胡', '马', '剑', '旗', '戎'],
  '友情': ['友', '别', '送', '逢', '故人', '相忆']
};
function extractTags(text) { const tags = []; for (const [tag, kws] of Object.entries(TAG_MAP)) if (kws.some(kw => text.includes(kw))) tags.push(tag); return tags.length > 0 ? tags : ['感怀']; }

function fetchText(url, attempt = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      if (res.statusCode === 404) { resolve(null); return; }
      if (res.statusCode >= 300 && res.headers.location) { return fetchText(res.headers.location, attempt).then(resolve).catch(reject); }
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    });
    req.on('error', e => { if (attempt < 4) setTimeout(() => fetchText(url, attempt + 1).then(resolve).catch(reject), 600); else reject(e); });
  });
}
const BASE = 'https://cdn.jsdelivr.net/gh/chinese-poetry/chinese-poetry@master/';
function tangUrl(i) { return BASE + encodeURI('全唐诗') + '/poet.tang.' + i + '.json'; }
async function pool(items, worker, concurrency) {
  const r = []; let idx = 0;
  async function next() { while (idx < items.length) { const c = items[idx++]; r.push(await worker(c)); } }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return r;
}
function log(...a) { console.log(...a); fs.appendFileSync(path.join(__dirname, '_tmp_repair.log'), a.join(' ') + '\n'); }

async function main() {
  fs.writeFileSync(path.join(__dirname, '_tmp_repair.log'), '');
  const existing = POETRY_DATABASE;
  const seen = new Set(existing.map(e => e.content));
  let idc = 0; for (const e of existing) { const m = /(\d+)$/.exec(e.id || ''); if (m) idc = Math.max(idc, parseInt(m[1], 10)); }
  log('▶ 现有库:', existing.length, '条');

  // 并发探测存在的最高文件索引(0~90000, step 1000)
  const idxs = []; for (let i = 0; i <= 90000; i += 1000) idxs.push(i);
  log('▶ 并发探测文件范围...');
  const existIdx = (await pool(idxs, async i => { const t = await fetchText(tangUrl(i)); return (t && t.trim().startsWith('[')) ? i : -1; }, 6)).filter(x => x >= 0);
  const maxIdx = existIdx.length ? Math.max(...existIdx) : -1;
  log('▶ 命中文件索引数:', existIdx.length, '| 最大:', maxIdx);

  const newLines = [];
  let added = 0, skipped = 0, dropped = 0, files = 0;
  await pool(existIdx, async i => {
    const txt = await fetchText(tangUrl(i));
    if (txt == null) return;
    let poems; try { poems = JSON.parse(txt); } catch (e) { log('  解析失败', i, e.message); return; }
    for (const poem of poems) {
      const title = toSimplified((poem.title || poem.rhythmic || '').trim());
      if (!title || title === '无题' || title === '诗' || title === '词') continue;
      const author = poem.author || '未知';
      const paras = poem.paragraphs || poem.stanzas || [];
      for (const p of paras) {
        if (typeof p !== 'string') continue;
        const sentences = p.split(/[，。！？；：、]/).map(s => toSimplified(s.trim())).filter(Boolean);
        for (const s of sentences) {
          if ([...s].some(c => c.codePointAt(0) > 0xFFFF)) { dropped++; continue; }
          const cpLen = Array.from(s).length;
          if ((cpLen === 5 || cpLen === 7) && /^[\u4e00-\u9fa5]+$/.test(s)) {
            if (seen.has(s)) { skipped++; continue; }
            seen.add(s);
            const endChar = s[s.length - 1];
            idc++;
            newLines.push({
              id: `full_唐_${idc}`, content: s, length: cpLen, author, dynasty: '唐', title,
              ping_ze_pattern: Array.from(s).map(toneCode).join(''), end_tone: endTone(endChar),
              rhyme_group: endTone(endChar) === '平' ? rhymeGroup(endChar) : '仄声', tags: extractTags(s)
            });
            added++;
          }
        }
      }
    }
    files++;
    if (files % 10 === 0) log('  已处理', files, '文件 | 新增', added, '跳过', skipped, '丢弃', dropped);
  }, 6);
  log('▶ 下载处理完成: 新增', added, '跳过', skipped, '丢弃', dropped);

  const all = existing.concat(newLines);
  log('🎉 合并:', existing.length, '+', newLines.length, '=', all.length);
  const outPath = path.join(__dirname, '../src/data/poetry_db.js');
  const banner = [
    '/**', ' * 古诗集句工程 - 全量数据库',
    ' * 由 scripts/repair_corpus.js 修复：用正确简体流水线重抓《全唐诗》，补回被 coreMissing 误删的诗句(整诗完整)。',
    ` * 共收录 ${all.length} 条规范名句。`, ' */', '', 'export const POETRY_DATABASE = '
  ].join('\n');
  fs.writeFileSync(outPath, banner + JSON.stringify(all, null, 2) + ';\n', 'utf-8');
  log('✅ 已写回', outPath, '(', all.length, '条 )');
  const qx = all.filter(e => e.author === '杜甫' && e.title.includes('秋兴八首'));
  log('杜甫《秋兴八首》现句数:', qx.length, '(应为 64)');
}
main().catch(e => { log('致命错误:', e.stack || e); process.exit(1); });
