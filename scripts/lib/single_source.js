/** One traceable primary attribution per sentence. Alternate references are archival only. */
export const SOURCE_POLICY = 'verified-single-source-v1';

function rejectionReason(item) {
  const source = item.source;
  if (source?.status !== 'matched') return source?.status || 'missing';
  if (!source.id || !source.record_id || !source.author?.trim() ||
      source.author !== item.author || source.title !== item.title ||
      !Number.isInteger(item.source_line) || item.source_line < 0 ||
      !/^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[a-f0-9]{40}\//.test(source.url || '') ||
      item.quality_flags?.some(flag => ['SOURCE_CONFLICT', 'SOURCE_AMBIGUOUS', 'SOURCE_UNVERIFIED'].includes(flag))) return 'inconsistent-primary';
  return null;
}

export function selectSingleSourceCorpus(records) {
  const groups = new Map(), excluded = [], reasons = {};
  const reject = (record, reason) => {
    excluded.push({ record, reason });
    reasons[reason] = (reasons[reason] || 0) + 1;
  };
  for (const item of records) {
    const reason = rejectionReason(item);
    if (reason) { reject(item, reason); continue; }
    if (!groups.has(item.content)) groups.set(item.content, []);
    groups.get(item.content).push(item);
  }
  const output = [];
  let removedReferences = 0, simplifiedLines = 0, duplicateRows = 0;
  for (const rows of groups.values()) {
    // Do not invent a winner if future imports disagree on the intended author/work.
    const attributions = new Set(rows.map(item => JSON.stringify([item.author, item.title, item.dynasty])));
    if (attributions.size > 1) {
      rows.forEach(item => reject(item, 'conflicting-primary-records'));
      continue;
    }
    const sorted = rows.slice().sort((a, b) => {
      const aKey = `${a.source.id}\0${a.id}`, bKey = `${b.source.id}\0${b.id}`;
      return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
    });
    const primary = sorted[0];
    for (const duplicate of sorted.slice(1)) { reject(duplicate, 'duplicate-sentence'); duplicateRows++; }
    if (primary.other_sources?.length) {
      simplifiedLines++;
      removedReferences += primary.other_sources.length;
    }
    output.push({ ...primary, other_sources: [] });
  }
  return { records: output, excluded, stats: {
    policy: SOURCE_POLICY, inputCount: records.length, outputCount: output.length,
    excludedCount: excluded.length, excludedReasons: reasons, simplifiedLines, removedReferences, duplicateRows
  } };
}
