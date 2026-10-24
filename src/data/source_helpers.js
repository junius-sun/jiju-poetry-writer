/** 出处标识优先使用完整原文指纹；旧记录按朝代、作者、篇名分组。 */
export function poemSourceKey(item) {
  return item.source?.id || JSON.stringify([item.dynasty || '', item.author, item.title]);
}

export function groupPoemLines(records) {
  const groups = new Map();
  for (const item of records) {
    const key = poemSourceKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  for (const lines of groups.values()) {
    lines.sort((a, b) => (a.source_line ?? Number.MAX_SAFE_INTEGER) - (b.source_line ?? Number.MAX_SAFE_INTEGER));
  }
  return groups;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

export function sourceStatusText(item) {
  const labels = { matched: '上游原文及署名匹配', 'text-matched': '原文匹配，署名待核',
    unverified: '仅有旧库出处，原文待核', conflict: '出处存在冲突，待核', ambiguous: '匹配多个原文，主出处待核' };
  return labels[item.source?.status] || '旧库出处，尚未核对原文';
}

export function qualityText(item) {
  const flags = new Set(item.quality_flags || []);
  const notes = [];
  if (flags.has('TONE_UNKNOWN')) notes.push('古音有缺字');
  if (flags.has('TONE_AMBIGUOUS')) notes.push('含古音多读字，需结合语境核对');
  if (flags.has('AUTHOR_UNKNOWN')) notes.push('作者未详');
  return notes.join('；');
}

export function sourceDetailHtml(item) {
  const source = item.source;
  const genre = { poem: '诗', ci: '词', qu: '曲', prose: '古文', fu: '赋', unknown: '文体未分类' }[source?.genre] || '文体未分类';
  const safeLink = reference => reference?.url?.startsWith('https://github.com/')
    ? `<a href="${escapeHtml(reference.url)}" target="_blank" rel="noopener noreferrer">查看数据原文</a>` : '';
  return `<details class="source-details"><summary>${source?.status === 'matched' ? '核对出处' : escapeHtml(sourceStatusText(item))}</summary>
    <div>${escapeHtml(sourceStatusText(item))}</div>
    <div>${escapeHtml(genre)} · ${escapeHtml(source?.dataset || '旧库')} ${safeLink(source)}</div>
    ${source?.record_id ? `<div>文献编号：${escapeHtml(source.record_id)}${item.source_line != null ? ` · 原文第 ${item.source_line + 1} 个标点分句` : ''}</div>` : ''}
    ${qualityText(item) ? `<div>${escapeHtml(qualityText(item))}</div>` : ''}
  </details>`;
}

export function formatPoemWithSources(lines, title, author) {
  return `《${title}》\n[${author}]\n\n` + lines.map(line => {
    const primary = `${line.content} （【${line.dynasty}】${line.author}《${line.title}》）`;
    const proof = `${sourceStatusText(line)}${line.source?.url ? `：${line.source.url}` : ''}`;
    return [primary, proof, qualityText(line)].filter(Boolean).join('\n');
  }).join('\n\n');
}
