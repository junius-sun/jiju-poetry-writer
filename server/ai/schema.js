import { AiError } from './config.js';
export const stringSchema = { type: 'string' };
const array = items => ({ type: 'array', items });
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
export const schemas = {
  test: () => object({ ok: { type: 'boolean' } }),
  analyze: imageIds => object({ brief: stringSchema, theme: stringSchema, mood: stringSchema, imagery: array(stringSchema), avoid: array(stringSchema),
    imageNotes: { ...array(object({ id: imageIds.length ? { type: 'string', enum: imageIds } : stringSchema,
      observation: stringSchema, extractedText: stringSchema, uncertain: { type: 'boolean' } })), minItems: imageIds.length, maxItems: imageIds.length } }),
  recommend: ids => object({ direction: stringSchema, recommendations: { ...array(object({ id: { type: 'string', enum: ids },
    role: { type: 'string', enum: ['起句', '承接', '转折', '收束'] }, reason: stringSchema, caution: stringSchema })), minItems: 0, maxItems: Math.min(5, ids.length) } }),
  evaluate: () => object({ summary: stringSchema,
    ratings: object(Object.fromEntries(['coherence', 'imagery', 'emotion', 'resonance'].map(key => [key, { type: 'integer', minimum: 0, maximum: 5 }]))),
    strengths: array(stringSchema), issues: array(object({ lineIndex: { type: 'integer', minimum: 0, maximum: 4 }, quote: stringSchema, issue: stringSchema, suggestion: stringSchema })),
    warnings: array(stringSchema) })
};

export function checkSchema(value, schema) {
  const fail = () => { throw new AiError('模型返回的格式不符合约定，请重试或检查配置中的输出模式。', 502); };
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !Object.hasOwn(schema.properties, key))) fail();
    for (const key of schema.required) { if (!Object.hasOwn(value, key)) fail(); checkSchema(value[key], schema.properties[key]); }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length > (schema.maxItems ?? 12) || value.length < (schema.minItems ?? 0)) fail();
    value.forEach(item => checkSchema(item, schema.items));
  } else if (schema.type === 'integer') {
    if (!Number.isInteger(value) || value < schema.minimum || value > schema.maximum) fail();
  } else if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') fail();
  } else if (typeof value !== 'string' || value.length > 2000 || /[\x00-\x08]/.test(value)) fail();
  if (schema.enum && !schema.enum.includes(value)) fail();
  return value;
}

export function boundedText(value, label, maximum, fallback = '') {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > maximum) throw new AiError(`${label}格式无效或过长。`);
  return value.trim();
}

export function validateContext(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AiError('创作素材格式无效。');
  const instructions = boundedText(value.instructions, '创作心意', 4000);
  const documents = value.documents ?? [], images = value.images ?? [];
  if (!Array.isArray(documents) || !Array.isArray(images) || documents.length + images.length > 6) throw new AiError('最多支持 6 个素材附件。');
  const ids = new Set(); let textSize = instructions.length, imageSize = 0;
  const uniqueId = item => {
    const id = boundedText(item?.id, '附件编号', 100);
    if (!id || ids.has(id)) throw new AiError('附件编号重复或缺失。'); ids.add(id); return id;
  };
  const normalizedDocuments = documents.map(item => {
    const id = uniqueId(item), name = boundedText(item.name, '文档名称', 240), text = boundedText(item.text, '文档正文', 30000);
    if (!text) throw new AiError('文档正文不能为空。'); textSize += text.length; return { id, name, text };
  });
  const normalizedImages = images.map(item => {
    const id = uniqueId(item), name = boundedText(item.name, '图片名称', 240), note = boundedText(item.note, '图片说明', 500);
    if (!['scene', 'text', 'both'].includes(item.purpose)) throw new AiError('图片理解方式无效。');
    if (typeof item.dataUrl !== 'string' || item.dataUrl.length > 14 * 1024 * 1024) throw new AiError('图片数据缺失或超过 10 MB。');
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(item.dataUrl);
    if (!match || match[2].length % 4) throw new AiError('只接受 JPG、PNG、WebP 的内嵌图片数据。');
    const bytes = Buffer.from(match[2], 'base64'); imageSize += bytes.length; textSize += note.length;
    const valid = match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
    if (!valid || bytes.length > 10 * 1024 * 1024) throw new AiError('图片内容或大小不符合要求。');
    return { id, name, note, purpose: item.purpose, dataUrl: item.dataUrl };
  });
  if (textSize > 30000 || imageSize > 30 * 1024 * 1024) throw new AiError('素材文字或图片总大小超过上限。');
  return { instructions, documents: normalizedDocuments, images: normalizedImages };
}
