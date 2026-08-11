import { POETRY_DATABASE } from '../src/data/poetry_db.js';
import fs from 'fs';

const db = POETRY_DATABASE;
console.log('单条结构样例:', JSON.stringify(db[0]));
console.log('总条数(句):', db.length);

// 按 author+title 视为"一首"
const poems = new Map(); // key -> {author,title,dynasty,lines:[]}
for (const e of db) {
  const key = e.author + '||' + e.title + '||' + (e.dynasty || '');
  let p = poems.get(key);
  if (!p) { p = { author: e.author, title: e.title, dynasty: e.dynasty || '未标注', lines: [] }; poems.set(key, p); }
  p.lines.push(e.content);
}
const poemList = [...poems.values()];
console.log('去重诗数(author+title):', poemList.length);

// 朝代分布（按诗数 / 按句数）
const dynPoem = {}, dynLine = {};
for (const p of poemList) { dynPoem[p.dynasty] = (dynPoem[p.dynasty] || 0) + 1; }
for (const e of db) { const d = e.dynasty || '未标注'; dynLine[d] = (dynLine[d] || 0) + 1; }
console.log('\n=== 朝代分布(诗数 / 句数) ===');
const dynOrder = Object.keys(dynPoem).sort((a, b) => dynPoem[b] - dynPoem[a]);
for (const d of dynOrder) console.log(`  ${d}: ${dynPoem[d]} 首 / ${dynLine[d]} 句`);

// 诗人分布 Top 25（按诗数）
const poetPoem = {}, poetLine = {};
for (const p of poemList) { poetPoem[p.author] = (poetPoem[p.author] || 0) + 1; }
for (const e of db) { poetLine[e.author] = (poetLine[e.author] || 0) + 1; }
console.log('\n=== 诗人 Top 25(诗数 / 句数) ===');
const poetOrder = Object.keys(poetPoem).sort((a, b) => poetPoem[b] - poetPoem[a]);
for (const a of poetOrder.slice(0, 25)) console.log(`  ${a}: ${poetPoem[a]} 首 / ${poetLine[a]} 句`);
console.log('  诗人总数(去重):', poetOrder.length);

// 诗长度分布（完整度）
const lenHist = {};
for (const p of poemList) { const n = p.lines.length; lenHist[n] = (lenHist[n] || 0) + 1; }
console.log('\n=== 诗长度分布(句数 -> 诗数) ===');
const lens = Object.keys(lenHist).map(Number).sort((a, b) => a - b);
for (const n of lens) console.log(`  ${n} 句: ${lenHist[n]} 首`);
const complete = poemList.filter(p => p.lines.length === 4 || p.lines.length === 8).length;
const fragment = poemList.filter(p => p.lines.length < 4).length;
console.log('  完整(4或8句):', complete, `(${(complete / poemList.length * 100).toFixed(1)}%)`);
console.log('  残篇(<4句):', fragment, `(${(fragment / poemList.length * 100).toFixed(1)}%)`);

// 重复检测：同一 author+title 出现多次（注入重复）
const dupKeys = poemList.filter(p => p.lines.length > 0 && p.title.length === 0);
console.log('\n空标题诗数:', dupKeys.length);

// 值得关注：宋诗名家是否在库
console.log('\n=== 关键宋诗名家命中 ===');
for (const name of ['苏轼', '陆游', '李清照', '辛弃疾', '王安石', '杨万里', '黄庭坚', '范成大']) {
  const hit = poetPoem[name] || 0;
  console.log(`  ${name}: ${hit} 首`);
}

// 内存估算
const mb = JSON.stringify(db).length / 1024 / 1024;
console.log('\n数据库 JSON 体积约:', mb.toFixed(1), 'MB');
