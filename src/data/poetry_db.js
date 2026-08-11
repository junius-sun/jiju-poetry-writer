/**
 * 古诗集句工程 - 全量数据库（聚合模块）
 * 由 scripts/split_db.js 将单文件拆分为 6 个分片（GitHub 单文件 ≤100MB 限制）。
 * 构建: build_full_corpus.js(全唐诗) + inject_song_and_gushi.js(宋诗/曹操) + inject_school_textbook_poems.js(教材名篇)
 *        + repair_corpus.js(简体流水线修复) + merge_gushiwen.js(古诗文网全量并入)
 * 清理: fix_corpus_simplified.js / fix_dynasty_labels.js / normalize_full.js(全字段繁转简+去重+剥乱码)
 * 共收录 697920 条规范五/七言句。
 */

import { POETRY_PART_1 } from './poetry_part1.js';
import { POETRY_PART_2 } from './poetry_part2.js';
import { POETRY_PART_3 } from './poetry_part3.js';
import { POETRY_PART_4 } from './poetry_part4.js';
import { POETRY_PART_5 } from './poetry_part5.js';
import { POETRY_PART_6 } from './poetry_part6.js';

export const POETRY_DATABASE = [
  ...POETRY_PART_1,
  ...POETRY_PART_2,
  ...POETRY_PART_3,
  ...POETRY_PART_4,
  ...POETRY_PART_5,
  ...POETRY_PART_6
];
