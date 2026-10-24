import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { encodeCorpus } from '../../src/data/corpus_codec.js';
import { selectSingleSourceCorpus } from './single_source.js';
import { writeCorpus } from './write_corpus.js';

export function writeSingleSourceCorpus(input) {
  const { records, stats } = selectSingleSourceCorpus(input);
  if (!records.length) throw new Error('出处筛选后语料为空，保留原库，未写入。');
  const reports = new URL('../../reports/', import.meta.url);
  fs.mkdirSync(reports, { recursive: true });
  const reportPath = new URL('corpus-single-source.json', reports);
  const previous = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : null;
  let snapshots = previous?.snapshots || [];
  if (stats.excludedCount || stats.simplifiedLines || stats.duplicateRows) {
    // Store complete original rows and alternate references before replacing runtime data.
    const original = Buffer.from(JSON.stringify(encodeCorpus(input)), 'utf8');
    const hash = createHash('sha256').update(original).digest('hex');
    const snapshot = `corpus-source-backups/${hash}.json.gz`;
    fs.mkdirSync(new URL('corpus-source-backups/', reports), { recursive: true });
    const snapshotPath = new URL(snapshot, reports);
    if (!fs.existsSync(snapshotPath)) fs.writeFileSync(snapshotPath, gzipSync(original, { level:9 }), { flag:'wx' });
    if (!snapshots.some(entry => entry.sha256 === hash)) snapshots = [...snapshots, { path:snapshot, sha256:hash, inputCount:stats.inputCount, excludedCount:stats.excludedCount, excludedReasons:stats.excludedReasons, simplifiedLines:stats.simplifiedLines, removedReferences:stats.removedReferences }];
  }
  const metadata = writeCorpus(records);
  const inventory = { count:records.length, sourceGroups:new Set(records.map(item => item.source.id)).size,
    authors:new Set(records.map(item => item.author)).size, lengths:{}, dynasties:{} };
  for (const item of records) {
    inventory.lengths[item.length] = (inventory.lengths[item.length] || 0) + 1;
    inventory.dynasties[item.dynasty] = (inventory.dynasties[item.dynasty] || 0) + 1;
  }
  const report = { ...stats, metadata, inventory, snapshots };
  const baseline = snapshots[0] || stats;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(new URL('corpus-stats.json', reports), JSON.stringify(inventory, null, 2) + '\n');
  fs.writeFileSync(new URL('corpus-single-source.md', reports), `# 单一出处运行库

每句仅有一个已匹配原文及署名的主出处。该主出处是本项目采用的收录依据，不宣称这句话在文学史上只出现在一篇作品中。

| 项目 | 数量 |
|---|---:|
| 首次清理前 | ${baseline.inputCount} |
| 当前运行库 | ${records.length} |
| 首次移出待核／冲突等记录 | ${baseline.excludedCount} |
| 首次移出附加出处的诗句 | ${baseline.simplifiedLines} |
| 首次移出的附加出处引用 | ${baseline.removedReferences} |
| 当前每句附加出处 | 0 |

当前 gzip：${(metadata.gzipBytes / 1e6).toFixed(2)} MB。诗句 ID、作者、篇名、原文标识、句序及古音标记保留。不同原诗仍分别识别，避免仅按同名篇目合并作品。

## 可恢复档案

${snapshots.map(entry => `- [完整原始语料](${entry.path})：${entry.inputCount} 条，原文、附加出处、待核标记全部保留。SHA-256（解压后）：${entry.sha256}。`).join('\n')}

这些档案不由应用或 AI 加载。可用 corpus_codec.js 的 decodeCorpus 解码恢复核对；不要把待核条目不经验证直接回灌运行库。重复执行清理会保留已有档案。

本次移出原因：${JSON.stringify(baseline.excludedReasons || {})}。不同数据库的转载、版本和后人引用都不再并列为运行出处；不从引用记录猜作者。原文匹配是数据核对结果，不等同于人工文献校勘。

重建入口：npm run data:single-source；npm run data:quality 也会经过同一筛选策略。
`);
  console.log(JSON.stringify(stats, null, 2));
  return report;
}
