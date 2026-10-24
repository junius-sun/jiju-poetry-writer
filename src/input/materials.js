/** Framework-free material model. Drafts and binaries stay in this page. */
export const LIMITS = Object.freeze({ items: 6, fileBytes: 10 * 1024 * 1024, totalBytes: 30 * 1024 * 1024,
  textChars: 30000, previewChars: 200000, instructionChars: 4000, pdfPages: 50, xmlBytes: 4 * 1024 * 1024 });
const documents = new Set(['txt', 'md', 'markdown', 'pdf', 'docx']);
const images = new Set(['png', 'jpg', 'jpeg', 'webp']);
export const IMAGE_PURPOSES = Object.freeze({ scene: '看图取意', text: '识别文字', both: '文字与画面兼顾' });

export function classifyFile(file, mode = 'any') {
  if (!file || !Number.isFinite(file.size) || file.size < 1) throw new Error('文件为空，无法导入。');
  if (file.size > LIMITS.fileBytes) throw new Error('单个文件不能超过 10 MB。');
  const extension = String(file.name || '').split('.').pop().toLowerCase();
  const kind = documents.has(extension) ? 'document' : images.has(extension) ? 'image' : null;
  if (!kind || (mode !== 'any' && mode !== kind)) {
    throw new Error(mode === 'image' ? '请选择 JPG、PNG 或 WebP 图片。' : '支持 TXT、Markdown、PDF、DOCX，以及 JPG、PNG、WebP 图片。');
  }
  return { kind, extension };
}

export function decodeTextFile(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let text;
  if (data[0] === 0xff && data[1] === 0xfe) text = new TextDecoder('utf-16le', { fatal: true }).decode(data);
  else if (data[0] === 0xfe && data[1] === 0xff) text = new TextDecoder('utf-16be', { fatal: true }).decode(data);
  else {
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(data); }
    catch { text = new TextDecoder('gb18030', { fatal: true }).decode(data); }
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text)) throw new Error('这不是可读取的文本文件。');
  return text.replace(/^\uFEFF/u, '').replace(/\r\n?/g, '\n');
}

/** Validate selected DOCX XML expansion sizes before unzip. ZIP64 is intentionally unsupported. */
export function inspectDocxZip(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let end = -1;
  for (let p = data.length - 22; p >= Math.max(0, data.length - 65557); p--) {
    if (view.getUint32(p, true) === 0x06054b50 && p + 22 + view.getUint16(p + 20, true) === data.length) { end = p; break; }
  }
  if (end < 0) throw new Error('DOCX 文件损坏，无法读取。');
  const count = view.getUint16(end + 10, true), offset = view.getUint32(end + 16, true);
  const directorySize = view.getUint32(end + 12, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || count > 2000 || offset + directorySize > end) {
    throw new Error('这个 DOCX 的结构过大或不受支持。');
  }
  const allowed = new Set(['word/document.xml', 'word/footnotes.xml', 'word/endnotes.xml']);
  const selected = new Set();
  let cursor = offset, expanded = 0;
  for (let n = 0; n < count; n++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) throw new Error('DOCX 目录损坏。');
    const nameLength = view.getUint16(cursor + 28, true), extra = view.getUint16(cursor + 30, true), comment = view.getUint16(cursor + 32, true);
    const next = cursor + 46 + nameLength + extra + comment;
    if (next > offset + directorySize) throw new Error('DOCX 目录不完整。');
    const name = new TextDecoder().decode(data.subarray(cursor + 46, cursor + 46 + nameLength));
    if (allowed.has(name)) {
      if (selected.has(name) || view.getUint16(cursor + 8, true) & 1) throw new Error('DOCX 正文重复或已加密。');
      const size = view.getUint32(cursor + 24, true);
      expanded += size;
      if (expanded > LIMITS.xmlBytes) throw new Error('Word 正文过大，请截取需要的部分后导入。');
      selected.add(name);
    }
    cursor = next;
  }
  if (!selected.has('word/document.xml')) throw new Error('文件不是有效的 Word DOCX 文档。');
  return selected;
}

export class CreativeMaterials {
  constructor() { this.instructions = ''; this.items = new Map(); this.snapshot = null; }
  invalidate() { this.snapshot = null; }
  reserve(id, file, mode) {
    const type = classifyFile(file, mode);
    if (this.items.size >= LIMITS.items) throw new Error('每次最多保留 6 个附件，可先移除不需要的素材。');
    if ([...this.items.values()].reduce((sum, item) => sum + item.file.size, file.size) > LIMITS.totalBytes) throw new Error('附件总大小不能超过 30 MB。');
    if ([...this.items.values()].some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) {
      throw new Error('这个文件已经在素材中。');
    }
    const item = { id, file, name: file.name, ...type, status: 'reading', text: '', purpose: 'scene', note: '', url: '' };
    this.items.set(id, item); this.invalidate(); return item;
  }
  settle(id, values) {
    const item = this.items.get(id);
    if (!item) return false; // A removed or cleared import can never reappear after async parsing.
    Object.assign(item, values); this.invalidate(); return true;
  }
  remove(id) { const item = this.items.get(id); this.items.delete(id); this.invalidate(); return item; }
  clear() { const items = [...this.items.values()]; this.items.clear(); this.instructions = ''; this.invalidate(); return items; }
  commit() {
    const all = [...this.items.values()], instructions = this.instructions.trim();
    if (!instructions && !all.length) throw new Error('请先输入创作心意，或导入文件、图片。');
    if (instructions.length > LIMITS.instructionChars) throw new Error('创作说明最多 4000 字。');
    if (all.some(item => item.status === 'reading')) throw new Error('附件仍在读取，请稍候。');
    if (all.some(item => item.status === 'error')) throw new Error('请先移除或替换读取失败的附件。');
    const texts = all.filter(item => item.kind === 'document');
    if (texts.some(item => !item.text.trim())) throw new Error('文档正文为空，请补充文本或移除此附件。');
    const totalText = instructions.length + texts.reduce((sum, item) => sum + item.text.length, 0) + all.reduce((sum, item) => sum + item.note.length, 0);
    if (totalText > LIMITS.textChars) throw new Error('素材文字合计最多 30000 字，请在正文预览中删减后再保存。');
    const context = {
      version: 1, instructions,
      documents: texts.map(item => ({ id: item.id, name: item.name, text: item.text.trim() })),
      images: all.filter(item => item.kind === 'image').map(item => ({ id: item.id, name: item.name, mime: item.mime,
        purpose: item.purpose, note: item.note.trim(), width: item.width, height: item.height }))
    };
    this.snapshot = context;
    return structuredClone(context);
  }
  getContext() { return this.snapshot ? structuredClone(this.snapshot) : null; }
  getImageFiles() { return this.snapshot ? this.snapshot.images.map(image => ({ id: image.id, file: this.items.get(image.id).file })) : []; }
}
