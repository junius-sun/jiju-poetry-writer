/**
 * 合并后的朝代标签归一化 + 名校对
 * - 修正 merge_gushiwen 中 normalizeDynasty 的小瑕疵：五代→五、两汉→汉、金朝→金 等
 * - 校对关键宋诗/古体名家是否已并入
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { POETRY_DATABASE } from '../src/data/poetry_db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIX = { '五': '五代', '两汉': '汉', '金朝': '金', '近': '近现代', '现': '现代', '未知': '未标注' };

let changed = 0;
for (const e of POETRY_DATABASE) {
  if (e.dynasty in FIX) { e.dynasty = FIX[e.dynasty]; changed++; }
}
console.log('朝代标签修正条数:', changed);

// 名校对
const masters = ['苏轼', '陆游', '李清照', '辛弃疾', '黄庭坚', '杨万里', '范成大', '王安石', '陶渊明', '曹操', '李白', '杜甫'];
const poemCount = {};
for (const e of POETRY_DATABASE) poemCount[e.author] = (poemCount[e.author] || 0) + 1;
console.log('=== 名校对(句数) ===');
for (const m of masters) console.log(`  ${m}: ${poemCount[m] || 0} 句`);

const outPath = path.join(__dirname, '../src/data/poetry_db.js');
const banner = [
  '/**',
  ' * 古诗集句工程 - 全量数据库',
  ' * 由 scripts/build_full_corpus.js 构建：现有精选 + 开源《全唐诗》全量五/七言句。',
  ' * 由 scripts/fix_corpus_simplified.js 繁->简归一化并重标平仄/韵部/意象。',
  ' * 由 scripts/merge_gushiwen.js 并入古诗文网(gushiwen.cn) dump 的宋/汉/魏晋/元/明/清等朝代五七言句(已去重)。',
  ` * 共收录 ${POETRY_DATABASE.length} 条规范名句。`,
  ' */',
  '',
  'export const POETRY_DATABASE = '
].join('\n');
fs.writeFileSync(outPath, banner + JSON.stringify(POETRY_DATABASE, null, 2) + ';\n', 'utf-8');
console.log(`✅ 已写回 ${outPath} (${POETRY_DATABASE.length} 条)`);
