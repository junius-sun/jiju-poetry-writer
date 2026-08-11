import { POETRY_DATABASE } from '../src/data/poetry_db.js';

const db = POETRY_DATABASE;
const total = db.length;

// ---- 按 author+title+dynasty 视为"一首" ----
const poems = new Map();
for (const e of db) {
  const key = e.author + '||' + e.title + '||' + (e.dynasty || '');
  let p = poems.get(key);
  if (!p) p = { author: e.author, title: e.title, dynasty: e.dynasty || '未标注', lines: [] };
  p.lines.push(e.content);
  poems.set(key, p);
}
const poemList = [...poems.values()];
const poemCount = poemList.length;

// ---- 朝代(按句/按诗) ----
const dynLine = {}, dynPoem = {};
for (const e of db) { const d = e.dynasty || '未标注'; dynLine[d] = (dynLine[d] || 0) + 1; }
for (const p of poemList) { dynPoem[p.dynasty] = (dynPoem[p.dynasty] || 0) + 1; }

// ---- 朝代大分组 ----
const groupOf = d => {
  if (d === '唐' || d === '隋' || d === '五代' || d === '南北朝' || d === '先秦') return '唐及以前古体';
  if (d === '宋') return '宋';
  if (d === '汉' || d === '魏晋' || d === '两汉') return '汉魏古体';
  if (d === '元' || d === '明' || d === '清' || d === '金' || d === '辽' || d === '秦') return '元明清等后起';
  return '其他/未标注';
};
const grpLine = {}, grpPoem = {};
for (const e of db) { const g = groupOf(e.dynasty || '未标注'); grpLine[g] = (grpLine[g] || 0) + 1; }
for (const p of poemList) { const g = groupOf(p.dynasty); grpPoem[g] = (grpPoem[g] || 0) + 1; }

// ---- 诗体(按单句字数) ----
let wuyan = 0, qiyan = 0, otherLen = 0;
for (const e of db) {
  const len = Array.from(e.content || '').length;
  if (len === 5) wuyan++; else if (len === 7) qiyan++; else otherLen++;
}

// ---- 诗体完整度(按诗句数) ----
const lenHist = {};
for (const p of poemList) { const n = p.lines.length; lenHist[n] = (lenHist[n] || 0) + 1; }
const complete = poemList.filter(p => p.lines.length === 4 || p.lines.length === 8).length;
const fragment = poemList.filter(p => p.lines.length < 4).length;
const longPoem = poemList.filter(p => p.lines.length > 8).length;

// ---- 作家 ----
const poetLine = {}, poetPoem = {};
for (const e of db) poetLine[e.author] = (poetLine[e.author] || 0) + 1;
for (const p of poemList) poetPoem[p.author] = (poetPoem[p.author] || 0) + 1;
const poetOrder = Object.keys(poetLine).sort((a, b) => poetLine[b] - poetLine[a]);

// ---- 数据质量: 非纯汉字句(混入标点/字母/数字) ----
let nonCn = 0, hasPunct = 0;
const PUNCT = /[，。！？；：、．·（）()\[\]「」“”"'《》—…—~～｛｝…·０-９0-9a-zA-Z]/;
for (const e of db) {
  const c = e.content || '';
  if (!/^[一-龥]+$/.test(c)) nonCn++;
  if (PUNCT.test(c)) hasPunct++;
}
// 空标题/空作者
const emptyTitle = poemList.filter(p => !p.title || p.title.trim() === '').length;
const emptyAuthor = db.filter(e => !e.author || e.author.trim() === '').length;

const pct = (a, b) => (b ? (a / b * 100).toFixed(1) : '0.0');

console.log('╔══════════════════════════════════════════════╗');
console.log('║          古诗文数据库 · 整体占比分析           ║');
console.log('╚══════════════════════════════════════════════╝');
console.log('\n【一、总量】');
console.log(`  诗句条目:  ${total.toLocaleString()} 条`);
console.log(`  去重诗(作者+题): ${poemCount.toLocaleString()} 首  (平均 ${(total / poemCount).toFixed(1)} 句/首)`);
console.log(`  独立作者: ${poetOrder.length.toLocaleString()} 位`);

console.log('\n【二、朝代分布（按句数 / 占比）】');
for (const d of Object.keys(dynLine).sort((a, b) => dynLine[b] - dynLine[a]))
  console.log(`  ${d.padEnd(4, '　')}: ${dynLine[d].toLocaleString().padStart(8)} 句  (${pct(dynLine[d], total)}%)  诗 ${dynPoem[d].toLocaleString()}`);

console.log('\n【三、朝代大分组（按句数）】');
for (const g of Object.keys(grpLine).sort((a, b) => grpLine[b] - grpLine[a]))
  console.log(`  ${g}: ${grpLine[g].toLocaleString().padStart(8)} 句 (${pct(grpLine[g], total)}%)`);

console.log('\n【四、诗体（按单句字数）】');
console.log(`  五言句: ${wuyan.toLocaleString().padStart(8)} (${pct(wuyan, total)}%)`);
console.log(`  七言句: ${qiyan.toLocaleString().padStart(8)} (${pct(qiyan, total)}%)`);
console.log(`  其他长度: ${otherLen.toLocaleString().padStart(8)} (${pct(otherLen, total)}%)`);

console.log('\n【五、诗完整度（按"首"的句数）】');
console.log(`  完整绝句/律诗(4或8句): ${complete.toLocaleString().padStart(7)} 首 (${pct(complete, poemCount)}%)`);
console.log(`  残篇(<4句, 断句/联句/残句): ${fragment.toLocaleString().padStart(7)} 首 (${pct(fragment, poemCount)}%)`);
console.log(`  长诗(>8句, 乐府/排律/长篇): ${longPoem.toLocaleString().padStart(7)} 首 (${pct(longPoem, poemCount)}%)`);
const buckets = { '1句': 0, '2句': 0, '3句': 0, '4句': 0, '5-8句': 0, '9-20句': 0, '20句以上': 0 };
for (const p of poemList) {
  const n = p.lines.length;
  if (n === 1) buckets['1句']++; else if (n === 2) buckets['2句']++; else if (n === 3) buckets['3句']++;
  else if (n === 4) buckets['4句']++; else if (n <= 8) buckets['5-8句']++; else if (n <= 20) buckets['9-20句']++; else buckets['20句以上']++;
}
console.log('  句数细分:', Object.entries(buckets).map(([k, v]) => `${k}:${v.toLocaleString()}(${pct(v, poemCount)}%)`).join('  '));

console.log('\n【六、作者 Top 20（按句数）】');
for (const a of poetOrder.slice(0, 20))
  console.log(`  ${a.padEnd(4, '　')}: ${poetLine[a].toLocaleString().padStart(8)} 句  (${pct(poetLine[a], total)}%)`);

console.log('\n【七、数据质量警示】');
console.log(`  非纯汉字句(含标点/字母/数字): ${nonCn.toLocaleString()} (${pct(nonCn, total)}%)`);
console.log(`  含标点类符号句: ${hasPunct.toLocaleString()} (${pct(hasPunct, total)}%)`);
console.log(`  空标题诗: ${emptyTitle.toLocaleString()}`);
console.log(`  空作者句: ${emptyAuthor.toLocaleString()}`);
console.log(`  ★ "元明清等后起"中元曲/赋/散文切句约 ${grpLine['元明清等后起'].toLocaleString()} 句，是集句候选里"违和句"主要来源`);

console.log('\n【八、集句可用性估算】');
const coreLines = wuyan + qiyan - nonCn; // 五/七言且无杂质
console.log(`  可用五/七言净句(去杂质): ${coreLines.toLocaleString()} (${pct(coreLines, total)}%)`);
const pct唐 = pct(grpLine['唐及以前古体'] + 0, total);
console.log(`  唐系 + 宋 + 汉魏古体(集句优质核心): ${(grpLine['唐及以前古体']||0)+(grpLine['宋']||0)+(grpLine['汉魏古体']||0)} 句`);
