/**
 * 全量语料兼容入口，由 npm run build:data 生成。
 * 561809 条记录；加载 gzip 并还原原有字段，旧调用方保持不变。
 */
import { loadCorpus } from './load_corpus.js';
export const POETRY_DATABASE = await loadCorpus(import.meta.url, { version: 'a54423cfa7031d60' });
