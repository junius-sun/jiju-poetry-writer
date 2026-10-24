/** 固定版本的公开原文快照，仅保留古诗文原文和文献标识，不收录译文、赏析或小传。 */
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import OpenCC from 'opencc-js';

const simplify = OpenCC.Converter({ from: 'tw', to: 'cn' });
const cache = new URL('./_tmp_sources/', import.meta.url);
await fs.mkdir(cache, { recursive: true });
const repositories = {
  tang: { repo: 'chinese-poetry/chinese-poetry', commit: 'b8594f81a89752241442f2ce267d6f66f96704ee' },
  anthology: { repo: 'muskjobstao/haitangshishe', commit: '90b53bfab67275e8b2e8e94807515b77fc17f2ba' }
};
async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`源数据请求失败 ${response.status}: ${url}`);
  return response.json();
}
const authorCache = new URL(`authors-${repositories.anthology.commit.slice(0, 12)}.json`, cache);
let authorRows;
try { authorRows = JSON.parse(await fs.readFile(authorCache, 'utf8')); }
catch {
  const poetList = await getJson(`https://raw.githubusercontent.com/${repositories.anthology.repo}/${repositories.anthology.commit}/data/aio/LCPoet.json`);
  authorRows = poetList.map(poet => [poet.objectId, simplify(poet.name)]);
  await fs.writeFile(authorCache, JSON.stringify(authorRows));
}
const authors = new Map(authorRows);
const root = `https://github.com/${repositories.tang.repo}/tree/${repositories.tang.commit}/`;
const listing = await fetch(root + encodeURIComponent('全唐诗'));
if (!listing.ok) throw new Error('无法取得全唐诗分片目录。');
const tangFiles = [...new Set((await listing.text()).match(/poet\.tang\.\d+\.json/g) || [])]
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
if (tangFiles.length < 50) throw new Error('全唐诗目录不完整，不继续出处核对。');
const jobs = [
  ...tangFiles.map(name => ({ kind: 'tang', path: `全唐诗/${name}` })),
  { kind: 'tang', path: '全唐诗/poet.song.0.json' },
  { kind: 'tang', path: '曹操诗集/caocao.json' },
  ...Array.from({ length: 8 }, (_, i) => ({ kind: 'anthology', path: `data/aio/LCPoetry${i + 1}.json` }))
];
let cursor = 0;
const files = [];
async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++];
    const repository = repositories[job.kind];
    const name = `${job.kind}-${repository.commit.slice(0, 12)}-${job.path.split('/').at(-1)}`;
    const cacheFile = new URL(name, cache);
    let entries;
    try { entries = JSON.parse(await fs.readFile(cacheFile, 'utf8')); }
    catch {
      const raw = await getJson(`https://raw.githubusercontent.com/${repository.repo}/${repository.commit}/${encodeURI(job.path)}`);
      const list = Array.isArray(raw) ? raw : raw.poems || raw.poetry || [];
      entries = list.map((poem, index) => ({
        id: String(poem.id || poem.poetryId || index),
        author: job.kind === 'anthology' ? authors.get(poem.poet?.objectId) || '' : simplify(poem.author || ''),
        title: simplify(poem.title || poem.name || ''),
        dynasty: job.kind === 'anthology' ? simplify(poem.dynasty || '') : job.path.includes('song.') ? '宋' : job.path.includes('caocao') ? '汉' : '唐',
        text: simplify(Array.isArray(poem.paragraphs) ? poem.paragraphs.join('\n') : poem.content || ''),
        row: index + 1
      }));
      await fs.writeFile(cacheFile, JSON.stringify(entries));
    }
    files.push({ ...job, cacheFile: name, count: entries.length,
      sha256: createHash('sha256').update(await fs.readFile(cacheFile)).digest('hex') });
    console.log(`${files.length}/${jobs.length}: ${job.path} (${entries.length} 篇)`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
files.sort((a, b) => a.path.localeCompare(b.path));
await fs.writeFile(new URL('snapshot-manifest.json', cache), JSON.stringify({ repositories, files }, null, 2));
console.log(`已保存 ${files.reduce((total, file) => total + file.count, 0)} 篇原文快照。`);
