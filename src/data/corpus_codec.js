/** 紧凑语料 v2：原字段及可选出处核对信息无损保存；兼容读取 v1。 */
export const CORPUS_FORMAT = 'jiju-corpus';
export const CORPUS_VERSION = 2;

const FIELDS = ['id', 'content', 'length', 'author', 'dynasty', 'title',
  'ping_ze_pattern', 'end_tone', 'rhyme_group', 'tags'];
const QUALITY_FIELDS = ['source', 'source_line', 'other_sources', 'quality_flags'];

function intern(table, lookup, value) {
  const key = JSON.stringify(value);
  if (!lookup.has(key)) {
    lookup.set(key, table.length);
    table.push(value);
  }
  return lookup.get(key);
}

export function encodeCorpus(records) {
  if (!Array.isArray(records)) throw new Error('语料必须是数组。');
  const sources = [], rhymes = [], tagSets = [];
  const sourceIds = new Map(), rhymeIds = new Map(), tagSetIds = new Map();
  const sourceDetails = [], qualityFlagSets = [];
  const detailIds = new Map(), flagSetIds = new Map();
  const sourceDocuments = [], documentIds = new Map();
  const detailId = source => {
    const expectedFields = ['id', 'dataset', 'record_id', 'author', 'title', 'dynasty', 'genre', 'status', 'url'];
    if (!source || Object.keys(source).length !== expectedFields.length || expectedFields.some(field => typeof source[field] !== 'string')) {
      throw new Error('出处详情字段无效，不能无损编码。');
    }
    return intern(sourceDetails, detailIds, [source.id,
      intern(sources, sourceIds, [source.author, source.title, source.dynasty]),
      intern(sourceDocuments, documentIds, [source.dataset, source.url]),
      source.record_id, source.status, source.genre]);
  };
  const rows = records.map((item, index) => {
    const length = Array.from(item.content || '').length;
    const withQuality = QUALITY_FIELDS.some(field => field in item);
    if (Object.keys(item).length !== FIELDS.length + (withQuality ? QUALITY_FIELDS.length : 0) ||
        FIELDS.some(field => !(field in item)) || (withQuality && QUALITY_FIELDS.some(field => !(field in item))) ||
        ![5, 7].includes(length) || item.length !== length ||
        typeof item.ping_ze_pattern !== 'string' || item.ping_ze_pattern.length !== length ||
        !/^[01]+$/.test(item.ping_ze_pattern) ||
        item.end_tone !== (item.ping_ze_pattern.endsWith('1') ? '平' : '仄')) {
      throw new Error(`第 ${index + 1} 条记录不能无损编码，请检查字段、字数及尾字声调。`);
    }
    const row = [
      item.id, item.content,
      intern(sources, sourceIds, [item.author, item.title, item.dynasty]),
      parseInt(item.ping_ze_pattern, 2),
      intern(rhymes, rhymeIds, item.rhyme_group),
      // 按完整数组去重，保留标签原有顺序及重复项。
      intern(tagSets, tagSetIds, item.tags)
    ];
    if (withQuality) row.push([
      detailId(item.source), item.source_line,
      item.other_sources.map(reference => [detailId(reference.source), reference.source_line]),
      intern(qualityFlagSets, flagSetIds, item.quality_flags)
    ]);
    return row;
  });
  return { format: CORPUS_FORMAT, version: CORPUS_VERSION, count: records.length, sources, rhymes, tagSets, sourceDocuments, sourceDetails, qualityFlagSets, rows };
}

export function decodeCorpus(packed) {
  if (!packed || packed.format !== CORPUS_FORMAT || ![1, CORPUS_VERSION].includes(packed.version) ||
      !Array.isArray(packed.rows) || packed.count !== packed.rows.length ||
      !Array.isArray(packed.sources) || !Array.isArray(packed.rhymes) || !Array.isArray(packed.tagSets)) {
    throw new Error('语料格式、版本或记录数量无效。');
  }
  const { sources, rhymes, tagSets } = packed;
  let details = packed.sourceDetails || [];
  const flagSets = packed.qualityFlagSets || [];
  if (sources.some(source => !Array.isArray(source) || source.length !== 3 || source.some(value => typeof value !== 'string')) ||
      rhymes.some(rhyme => typeof rhyme !== 'string') ||
      tagSets.some(tags => !Array.isArray(tags) || tags.some(tag => typeof tag !== 'string'))) {
    throw new Error('语料字典无效。');
  }
  if (packed.sourceDocuments) {
    const documents = packed.sourceDocuments;
    if (!Array.isArray(documents) || documents.some(document => !Array.isArray(document) || document.length !== 2 || document.some(value => typeof value !== 'string')) || !Array.isArray(details)) {
      throw new Error('出处文档字典无效。');
    }
    details = details.map(tuple => {
      if (!Array.isArray(tuple) || tuple.length !== 6 || !Number.isInteger(tuple[1]) || !sources[tuple[1]] ||
          !Number.isInteger(tuple[2]) || !documents[tuple[2]] || [tuple[0], tuple[3], tuple[4], tuple[5]].some(value => typeof value !== 'string')) throw new Error('出处详情引用无效。');
      const [author, title, dynasty] = sources[tuple[1]];
      const [dataset, url] = documents[tuple[2]];
      return { id: tuple[0], author, title, dynasty, dataset, url, record_id: tuple[3], status: tuple[4], genre: tuple[5] };
    });
  }
  if (!Array.isArray(details) || !Array.isArray(flagSets) ||
      details.some(source => !source || typeof source.id !== 'string' || typeof source.status !== 'string') ||
      flagSets.some(flags => !Array.isArray(flags) || flags.some(flag => typeof flag !== 'string'))) {
    throw new Error('出处或质量标注字典无效。');
  }
  const readReference = ([detailId, line]) => {
    if (!Number.isInteger(detailId) || detailId < 0 || detailId >= details.length ||
        (line !== null && (!Number.isInteger(line) || line < 0))) throw new Error('出处引用或句序无效。');
    return { source: { ...details[detailId] }, source_line: line };
  };
  return packed.rows.map((row, index) => {
    if (!Array.isArray(row) || ![6, 7].includes(row.length) || (packed.version === 1 && row.length !== 6)) throw new Error(`第 ${index + 1} 条紧凑记录无效。`);
    const [id, content, sourceId, patternCode, rhymeId, tagSetId] = row;
    const length = typeof content === 'string' ? Array.from(content).length : 0;
    if (typeof id !== 'string' || ![5, 7].includes(length) ||
        !Number.isInteger(sourceId) || sourceId < 0 || sourceId >= sources.length ||
        !Number.isInteger(rhymeId) || rhymeId < 0 || rhymeId >= rhymes.length ||
        !Number.isInteger(tagSetId) || tagSetId < 0 || tagSetId >= tagSets.length ||
        !Number.isInteger(patternCode) || patternCode < 0 || patternCode >= 2 ** length) {
      throw new Error(`第 ${index + 1} 条记录的字段或字典引用无效。`);
    }
    const [author, title, dynasty] = sources[sourceId];
    const item = {
      id, content, length, author, dynasty, title,
      ping_ze_pattern: patternCode.toString(2).padStart(length, '0'),
      end_tone: patternCode % 2 ? '平' : '仄',
      rhyme_group: rhymes[rhymeId],
      tags: tagSets[tagSetId].slice()
    };
    if (row.length === 7) {
      const extra = row[6];
      if (!Array.isArray(extra) || extra.length !== 4 || !Array.isArray(extra[2]) ||
          !Number.isInteger(extra[3]) || extra[3] < 0 || extra[3] >= flagSets.length) throw new Error('质量标注引用无效。');
      Object.assign(item, readReference(extra));
      item.other_sources = extra[2].map(reference => {
        if (!Array.isArray(reference) || reference.length !== 2) throw new Error('同句其他出处引用无效。');
        return readReference(reference);
      });
      item.quality_flags = flagSets[extra[3]].slice();
    }
    return item;
  });
}
