/**
 * 构建后的针对性验证 (scripts/verify_corpus.js)
 * 聚焦用户的核心质疑：杜甫/秋兴八首/李商隐/杜牧 是否补齐，以及整体规模与健全性。
 */
import { POETRY_DATABASE } from '../src/data/poetry_db.js';

const db = POETRY_DATABASE;
console.log('=== 总规模 ===');
console.log('总句数:', db.length);

const byAuthor = {};
for (const e of db) byAuthor[e.author] = (byAuthor[e.author] || 0) + 1;

console.log('\n=== 核心诗人覆盖（用户质疑点）===');
for (const a of ['杜甫', '李白', '王维', '白居易', '李商隐', '杜牧', '苏轼', '陆游', '李清照', '王维']) {
  const n = byAuthor[a] || 0;
  const titles = new Set(db.filter(e => e.author === a).map(e => e.title)).size;
  console.log(`${a}: ${n} 句 / ${titles} 题`);
}

console.log('\n=== 杜甫《秋兴八首》命中 ===');
const qx = db.filter(e => e.author === '杜甫' && e.title.includes('秋兴'));
const qxTitles = [...new Set(qx.map(e => e.title))].sort();
console.log('秋兴相关题:', qxTitles.join(' | '));
console.log('秋兴八首句数:', qx.length, '(八首七律应为 ~56 句)');

console.log('\n=== 杜甫代表七律 ===');
for (const t of ['登高', '蜀相', '客至', '阁夜', '咏怀古迹', '闻官军收河南河北', '登楼', '野望']) {
  const hits = db.filter(e => e.author === '杜甫' && e.title.includes(t));
  console.log(`  《${t}》: ${hits.length} 句`, hits.length ? '✅' : '❌');
}

console.log('\n=== 字段健全性抽查 ===');
let bad = 0, noPattern = 0, badLen = 0;
for (const e of db) {
  if (!/^[01]+$/.test(e.ping_ze_pattern)) noPattern++;
  if (e.ping_ze_pattern.length !== e.length) badLen++;
  if (!['平', '仄'].includes(e.end_tone)) bad++;
}
console.log('ping_ze_pattern 非01:', noPattern, '| 长度与字数不符:', badLen, '| end_tone 异常:', bad);

console.log('\n=== 五/七言分布 ===');
const lenDist = {};
for (const e of db) lenDist[e.length] = (lenDist[e.length] || 0) + 1;
console.log('句长:', JSON.stringify(lenDist));
