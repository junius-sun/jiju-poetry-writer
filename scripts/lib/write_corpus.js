/** 无损编码并验证整库，再生成静态托管可直接使用的紧凑 JSON 和 gzip。 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { encodeCorpus, decodeCorpus } from '../../src/data/corpus_codec.js';

export function writeCorpus(POETRY_DATABASE) {
  const directory = new URL('../../src/data/', import.meta.url);
  const packed = encodeCorpus(POETRY_DATABASE);
  const json = Buffer.from(JSON.stringify(packed), 'utf8');
  const gzip = gzipSync(json, { level: 9 });
  const restored = decodeCorpus(JSON.parse(gunzipSync(gzip).toString('utf8')));
  assert.equal(restored.length, POETRY_DATABASE.length);
  for (let index = 0; index < restored.length; index++) {
    assert.deepEqual(restored[index], POETRY_DATABASE[index], `第 ${index + 1} 条记录压缩前后不一致`);
  }
  const hash = createHash('sha256').update(json).digest('hex');
  const metadata = {
    format: packed.format, version: packed.version, count: packed.count,
    sources: packed.sources.length, tagSets: packed.tagSets.length,
    jsonBytes: json.length, gzipBytes: gzip.length, sha256: hash
  };

  // 验证成功后才替换产物；旧预处理脚本写出完整数据库后可再次执行本脚本。
  fs.writeFileSync(new URL('poetry.compact.json', directory), json);
  fs.writeFileSync(new URL('poetry.compact.json.gz', directory), gzip);
  fs.writeFileSync(new URL('corpus.meta.json', directory), JSON.stringify(metadata, null, 2) + '\n');
  fs.writeFileSync(new URL('poetry_db.js', directory), `/**
 * 全量语料兼容入口，由 npm run build:data 生成。
 * ${packed.count} 条记录；加载 gzip 并还原原有字段，旧调用方保持不变。
 */
import { loadCorpus } from './load_corpus.js';
export const POETRY_DATABASE = await loadCorpus(import.meta.url, { version: '${hash.slice(0, 16)}' });
`);
  console.log(`✅ ${packed.count} 条记录逐条无损验证通过。`);
  console.log(`紧凑 JSON: ${(json.length / 1e6).toFixed(2)} MB | gzip: ${(gzip.length / 1e6).toFixed(2)} MB`);
  console.log(`SHA-256: ${hash}`);

  return metadata;
}
