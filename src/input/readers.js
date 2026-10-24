import { LIMITS, decodeTextFile, inspectDocxZip } from './materials.js';
const vendor = new URL('../../vendor/importers/', import.meta.url);
const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export function docxXmlToText(xml) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('Word 正文格式损坏。');
  const paragraphs = [...document.getElementsByTagNameNS(wordNamespace, 'p')];
  return paragraphs.map(paragraph => {
    let text = '';
    const walk = node => {
      if (node !== paragraph && node.namespaceURI === wordNamespace && node.localName === 'p') return;
      if (node.namespaceURI === wordNamespace) {
        if (node.localName === 't') { text += node.textContent; return; }
        if (node.localName === 'tab') { text += '\t'; return; }
        if (['br', 'cr'].includes(node.localName)) { text += '\n'; return; }
        if (node.localName === 'del') return;
      }
      for (const child of node.children || []) walk(child);
    };
    walk(paragraph); return text;
  }).join('\n\n').trim();
}

export async function readDocument(file, extension) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (['txt', 'md', 'markdown'].includes(extension)) return decodeTextFile(bytes);
  if (extension === 'docx') {
    const selected = inspectDocxZip(bytes);
    const { unzipSync } = await import(new URL('fflate.js', vendor).href);
    const entries = unzipSync(bytes, { filter: entry => selected.has(entry.name) });
    let text = docxXmlToText(new TextDecoder('utf-8', { fatal: true }).decode(entries['word/document.xml']));
    for (const name of ['word/footnotes.xml', 'word/endnotes.xml']) {
      if (entries[name]) {
        const note = docxXmlToText(new TextDecoder().decode(entries[name]));
        if (note) text += '\n\n【文档注释】\n' + note;
      }
    }
    return text;
  }
  if (extension === 'pdf') {
    if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes('%PDF-')) throw new Error('文件不是有效的 PDF。');
    const pdfjs = await import(new URL('pdfjs/pdf.min.js', vendor).href);
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs/pdf.worker.min.js', vendor).href;
    const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false,
      cMapUrl: new URL('pdfjs/cmaps/', vendor).href, cMapPacked: true,
      standardFontDataUrl: new URL('pdfjs/standard_fonts/', vendor).href });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > LIMITS.pdfPages) throw new Error('PDF 最多支持 50 页，请先截取需要的部分。');
      const pages = [];
      let size = 0;
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n), content = await page.getTextContent();
        const text = content.items.map(item => (item.str || '') + (item.hasEOL ? '\n' : ' ')).join('').trim();
        size += text.length;
        if (size > 200000) throw new Error('PDF 正文过长，请先截取需要的部分。');
        pages.push(`【第 ${n} 页】\n${text}`); page.cleanup();
      }
      if (!pages.some(page => page.replace(/【第 \d+ 页】/g, '').trim())) {
        throw new Error('这是扫描件或没有可提取的文字。可将页面作为图片导入，待连接视觉模型后识别。');
      }
      return pages.join('\n\n');
    } catch (error) {
      if (error.name === 'PasswordException') throw new Error('PDF 已加密，请先解密后导入。');
      if (error.name === 'InvalidPDFException') throw new Error('PDF 文件损坏，无法提取正文。');
      throw error;
    } finally { await task.destroy(); }
  }
  throw new Error('暂不支持这个文档格式。');
}

export async function readImage(file) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (start, end) => String.fromCharCode(...bytes.subarray(start, end));
  let mime;
  if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG' && bytes[4] === 13 && bytes[5] === 10) mime = 'image/png';
  else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) mime = 'image/jpeg';
  else if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') mime = 'image/webp';
  else throw new Error('图片内容与支持的格式不符，请选择有效的 JPG、PNG 或 WebP。');
  const url = URL.createObjectURL(new Blob([file], { type: mime }));
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (image.naturalWidth * image.naturalHeight > 40000000) throw new Error('图片分辨率过大，请选择不超过 4000 万像素的图片。');
    return { url, mime, width: image.naturalWidth, height: image.naturalHeight };
  } catch (error) {
    URL.revokeObjectURL(url);
    if (error.name === 'EncodingError') throw new Error('图片损坏，无法生成预览，请更换图片。');
    throw error;
  }
}
