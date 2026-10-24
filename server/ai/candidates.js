import { createHash } from 'node:crypto';

/** Recall a bounded, diverse set; the model does the semantic ordering. */
export function selectCandidates(database, engine, lines, length, options, intent, excluded = []) {
  const accepted = engine.createCandidateFilter(lines, length, { ...options, avoidCharOverlap: false });
  const exclude = new Set(excluded);
  const positive = [lines.map(line => line.content).join(' '), intent.theme || '', ...(intent.imagery || []), intent.brief || ''].join(' ').slice(0, 1500);
  const terms = new Set(positive.match(/[\u3400-\u9fff]{2,8}/gu) || []);
  for (const token of [...terms]) for (let i = 0; i < token.length - 1; i++) terms.add(token.slice(i, i + 2));
  const characters = new Set([...positive].filter(char => '山水月风夜舟春秋雪雨乡花竹云江海'.includes(char)));
  const seed = lines.map(line => line.id).join('|') + intent.brief + excluded.join('|');
  const rank = [];
  let order = 0;
  for (const item of database) {
    if (exclude.has(item.id) || !accepted(item)) continue;
    let score = (item.source?.status === 'matched' ? 8 : 0) + (item.source?.genre === 'poem' ? 3 : 0);
    if (item.quality_flags?.includes('TONE_AMBIGUOUS')) score--;
    for (const term of terms) if (item.content.includes(term) || item.tags?.some(tag => tag.includes(term))) score += 15;
    for (const char of characters) if (item.content.includes(char)) score += 3;
    // Fast deterministic tie-break avoids storing or hashing every large source record.
    rank.push({ item, score, order: order++ });
  }
  const shift = parseInt(createHash('sha256').update(seed).digest('hex').slice(0, 8), 16);
  rank.sort((a, b) => b.score - a.score || ((a.order + shift) % (rank.length || 1)) - ((b.order + shift) % (rank.length || 1)));
  const selected = [], authors = new Map(), sources = new Set();
  const add = candidate => {
    const item = candidate.item, source = engine.sourceKey(item);
    if (sources.has(source) || (authors.get(item.author) || 0) >= (options.singleAuthorMode ? 40 : 3) || selected.some(line => line.content === item.content)) return;
    selected.push(item); sources.add(source); authors.set(item.author, (authors.get(item.author) || 0) + 1);
  };
  for (const candidate of rank) { add(candidate); if (selected.length >= 32) break; }
  // Leave room for a turn of scene/emotion beyond the most literal matching images.
  for (let i = 0; i < 16 && selected.length < 40 && rank.length; i++) add(rank[(shift + i * Math.max(1, Math.floor(rank.length / 16))) % rank.length]);
  for (const candidate of rank) { if (selected.length >= 40) break; add(candidate); }
  return selected;
}
