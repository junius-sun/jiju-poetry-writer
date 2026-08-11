/**
 * scripts/split_db.js
 *
 * 将 156MB 单文件 poetry_db.js 拆分为多个分片（GitHub 单文件 100MB 限制）：
 *   1. 读当前 POETRY_DATABASE（697,920 条）
 *   2. 按 N 片切分（保持原顺序），每片写为 src/data/poetry_part{i}.js：
 *      export const POETRY_PART_{i} = [...];
 *   3. 重写 src/data/poetry_db.js 为聚合模块：
 *      import 各分片 + export const POETRY_DATABASE = [...PART1, ...PART2, ...];
 *   4. 对外接口不变，app.js / engine / scripts 无需改动。
 *
 * 用法：node --max-old-space-size=4096 scripts/split_db.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { POETRY_DATABASE } from '../src/data/poetry_db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../src/data');

const N = 6;
const total = POETRY_DATABASE.length;
const per = Math.ceil(total / N);
console.log(`▶ 拆分 ${total} 条 → ${N} 片，每片约 ${per} 条`);

// 1) 写分片文件（紧凑 JSON，保留顺序）
for (let i = 0; i < N; i++) {
  const part = POETRY_DATABASE.slice(i * per, Math.min(total, (i + 1) * per));
  const name = `poetry_part${i + 1}.js`;
  const content = `export const POETRY_PART_${i + 1} = ${JSON.stringify(part)};\n`;
  fs.writeFileSync(path.join(DATA_DIR, name), content, 'utf-8');
  const mb = (Buffer.byteLength(content) / 1024 / 1024).toFixed(1);
  console.log(`  ✅ ${name}  ${part.length} 条  ${mb} MB`);
}

// 2) 重写聚合模块
const imports = [];
const spreads = [];
for (let i = 1; i <= N; i++) {
  imports.push(`import { POETRY_PART_${i} } from './poetry_part${i}.js';`);
  spreads.push(`...POETRY_PART_${i}`);
}
const banner = [
  '/**',
  ' * 古诗集句工程 - 全量数据库（聚合模块）',
  ' * 由 scripts/split_db.js 将单文件拆分为 6 个分片（GitHub 单文件 ≤100MB 限制）。',
  ' * 构建: build_full_corpus.js(全唐诗) + inject_song_and_gushi.js(宋诗/曹操) + inject_school_textbook_poems.js(教材名篇)',
  ' *        + repair_corpus.js(简体流水线修复) + merge_gushiwen.js(古诗文网全量并入)',
  ' * 清理: fix_corpus_simplified.js / fix_dynasty_labels.js / normalize_full.js(全字段繁转简+去重+剥乱码)',
  ` * 共收录 ${total} 条规范五/七言句。`,
  ' */',
  '',
  ...imports,
  '',
  'export const POETRY_DATABASE = [',
  '  ' + spreads.join(',\n  '),
  '];',
  ''
].join('\n');
fs.writeFileSync(path.join(DATA_DIR, 'poetry_db.js'), banner, 'utf-8');
console.log(`✅ 聚合模块已写回 poetry_db.js（${imports.length} 个 import，对外接口 POETRY_DATABASE 不变）`);
