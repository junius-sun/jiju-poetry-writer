import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { encodeCorpus, decodeCorpus } from '../src/data/corpus_codec.js';
import { loadBrowserCorpus } from '../src/data/load_corpus.js';

const records = [
  { id: '001', content: '甲乙丙丁戊', length: 5, author: '作者', title: '篇名', dynasty: '唐',
    ping_ze_pattern: '00110', end_tone: '仄', rhyme_group: '仄声', tags: ['月', '风'] },
  { id: '002', content: '辛壬癸子丑', length: 5, author: '作者', title: '篇名', dynasty: '唐',
    ping_ze_pattern: '00011', end_tone: '平', rhyme_group: '上平一东', tags: ['风', '月', '月'] },
  { id: '七言', content: '辰巳午未申酉戌', length: 7, author: '作者二', title: '篇名二', dynasty: '宋',
    ping_ze_pattern: '0000000', end_tone: '仄', rhyme_group: '仄声', tags: [] }
];
const packed = encodeCorpus(records);
const json = JSON.stringify(packed);
const baseUrl = new URL('https://example.com/jiju-poetry-writer/src/data/poetry_db.js');

test('紧凑编码无损保留所有字段、ID、前导零、顺序和标签顺序', () => {
  assert.deepEqual(decodeCorpus(JSON.parse(json)), records);
  assert.equal(packed.sources.length, 2);
  const restored = decodeCorpus(packed);
  restored[0].tags.push('新增');
  assert.deepEqual(decodeCorpus(packed), records);
});

test('拒绝有损编码及损坏格式、引用和数值', () => {
  assert.throws(() => encodeCorpus([{ ...records[0], extra: 1 }]));
  assert.throws(() => encodeCorpus([{ ...records[0], end_tone: '平' }]));
  assert.throws(() => decodeCorpus({ ...packed, version: 99 }));
  assert.throws(() => decodeCorpus({ ...packed, count: 20 }));
  for (const value of [-1, 999, 1.5]) {
    const bad = JSON.parse(json);
    bad.rows[0][2] = value;
    assert.throws(() => decodeCorpus(bad));
  }
  const badPattern = JSON.parse(json);
  badPattern.rows[0][3] = 32;
  assert.throws(() => decodeCorpus(badPattern));
});

test('浏览器优先解压 gzip，路径保留 GitHub Pages 子目录并附带版本', async () => {
  const urls = [];
  const fetcher = async url => { urls.push(String(url)); return new Response(gzipSync(json)); };
  assert.deepEqual(await loadBrowserCorpus(baseUrl, { fetcher, version: 'abc' }), records);
  assert.deepEqual(urls, ['https://example.com/jiju-poetry-writer/src/data/poetry.compact.json.gz?v=abc']);
});

test('服务器已自动解压时不二次解压', async () => {
  let requests = 0;
  assert.deepEqual(await loadBrowserCorpus(baseUrl, {
    fetcher: async () => { requests++; return new Response(json); }
  }), records);
  assert.equal(requests, 1);
});

test('缺少原生解压支持时只加载 JSON 回退', async () => {
  const urls = [];
  assert.deepEqual(await loadBrowserCorpus(baseUrl, {
    Decompressor: null,
    fetcher: async url => { urls.push(String(url)); return new Response(json); }
  }), records);
  assert.equal(urls.length, 1);
  assert.ok(urls[0].endsWith('poetry.compact.json'));
});

test('gzip 404、损坏或格式无效时均回退；双重失败抛出可见错误', async () => {
  for (const response of [() => new Response('', { status: 404 }),
    () => new Response(new Uint8Array([0x1f, 0x8b, 0])), () => new Response('{}')]) {
    let requests = 0;
    assert.deepEqual(await loadBrowserCorpus(baseUrl, {
      fetcher: async () => ++requests === 1 ? response() : new Response(json)
    }), records);
    assert.equal(requests, 2);
  }
  await assert.rejects(loadBrowserCorpus(baseUrl, {
    fetcher: async () => new Response('', { status: 404 })
  }), /语料加载失败/);
});

test('生成的完整语料 JSON 与 gzip 解压结果及元数据完全一致', async () => {
  const base = new URL('../src/data/', import.meta.url);
  const [plain, compressed, meta] = await Promise.all([
    readFile(new URL('poetry.compact.json', base)),
    readFile(new URL('poetry.compact.json.gz', base)),
    readFile(new URL('corpus.meta.json', base), 'utf8')
  ]);
  const metadata = JSON.parse(meta);
  const decompressed = await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  assert.deepEqual(Buffer.from(decompressed), plain);
  assert.equal(createHash('sha256').update(plain).digest('hex'), metadata.sha256);
  assert.equal(plain.length, metadata.jsonBytes);
  assert.equal(compressed.length, metadata.gzipBytes);
  const data = JSON.parse(plain);
  assert.equal(data.rows.length, metadata.count);
  assert.ok(metadata.count > 500000);
});
