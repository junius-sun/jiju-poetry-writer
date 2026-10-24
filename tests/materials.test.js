import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { CreativeMaterials, classifyFile, decodeTextFile, inspectDocxZip, LIMITS } from '../src/input/materials.js';
import { CreativeInput } from '../src/input/creative-input.js';

const file = (name, size = 100) => ({ name, size, lastModified: 1 });
test('识别三种输入所需格式，拒绝空文件、伪格式和超限大小', () => {
  assert.deepEqual(classifyFile(file('春夜.TXT'), 'document'), { kind: 'document', extension: 'txt' });
  assert.equal(classifyFile(file('风景.WEBP'), 'image').kind, 'image');
  for (const item of [file('old.doc'), file('script.svg'), file('empty.txt', 0), file('huge.pdf', LIMITS.fileBytes + 1)]) {
    assert.throws(() => classifyFile(item));
  }
  assert.throws(() => classifyFile(file('image.png'), 'document'));
});
test('中文文本解码保留 UTF-8、UTF-16 和 GB18030，拒绝二进制伪文本', () => {
  assert.equal(decodeTextFile(new TextEncoder().encode('春风\r\n明月')), '春风\n明月');
  const utf16 = Buffer.from('\uFEFF春夜', 'utf16le');
  assert.equal(decodeTextFile(utf16), '春夜');
  const swapped = Buffer.from(utf16); swapped.swap16();
  assert.equal(decodeTextFile(swapped), '春夜');
  assert.equal(decodeTextFile(Uint8Array.from([0xc3, 0xf7, 0xd4, 0xc2])), '明月');
  assert.throws(() => decodeTextFile(Uint8Array.from([65, 0, 66])));
});
test('TXT、文档与图片可混合保存；保留正文、理解方式和说明，图片二进制单独读取', () => {
  const model = new CreativeMaterials(); model.instructions = ' 春夜江边，留一些希望 ';
  model.reserve('doc', file('故事.docx'), 'document');
  model.settle('doc', { status: 'ready', text: '风雨之后，仍有归舟。' });
  const image = file('山水.png'); model.reserve('image', image, 'image');
  model.settle('image', { status: 'ready', mime: 'image/png', width: 800, height: 600, purpose: 'both', note: '取暮色' });
  const context = model.commit();
  assert.equal(context.instructions, '春夜江边，留一些希望');
  assert.equal(context.documents[0].text, '风雨之后，仍有归舟。');
  assert.equal(context.images[0].purpose, 'both');
  assert.equal(context.images[0].note, '取暮色');
  assert.equal(JSON.stringify(context).includes('lastModified'), false);
  assert.equal(model.getImageFiles()[0].file, image);
  context.documents[0].text = 'changed';
  assert.equal(model.getContext().documents[0].text, '风雨之后，仍有归舟。');
});
test('读取中、失败、空正文和超长文本不能冒充已保存素材', () => {
  const model = new CreativeMaterials(); assert.throws(() => model.commit());
  model.reserve('doc', file('故事.md'), 'document');
  assert.throws(() => model.commit(), /读取/);
  model.settle('doc', { status: 'error' }); assert.throws(() => model.commit(), /失败/);
  model.settle('doc', { status: 'ready', text: ' ' }); assert.throws(() => model.commit(), /正文为空/);
  model.settle('doc', { text: '月'.repeat(LIMITS.textChars + 1) }); assert.throws(() => model.commit(), /30000/);
  model.settle('doc', { text: '月' }); model.instructions = '风'.repeat(LIMITS.instructionChars + 1);
  assert.throws(() => model.commit(), /4000/);
});
test('移除或清空正在读取的附件后，晚到的读取结果不会使它重新出现', () => {
  const model = new CreativeMaterials();
  model.reserve('first', file('one.txt'), 'document'); model.remove('first');
  assert.equal(model.settle('first', { status: 'ready', text: '晚到' }), false);
  model.reserve('second', file('two.txt'), 'document'); model.clear();
  assert.equal(model.settle('second', { status: 'ready', text: '晚到' }), false);
  assert.equal(model.items.size, 0); assert.equal(model.getContext(), null);
});
test('变更附件会使已保存上下文失效；重复文件、数量和总大小有上限', () => {
  const model = new CreativeMaterials(); model.instructions = '山水'; model.commit();
  model.reserve('one', file('one.png'), 'image'); assert.equal(model.getContext(), null);
  assert.throws(() => model.reserve('duplicate', file('one.png'), 'image'), /已经/);
  for (let n = 2; n <= LIMITS.items; n++) model.reserve(String(n), file(`${n}.png`), 'image');
  assert.throws(() => model.reserve('extra', file('extra.png'), 'image'), /最多/);
  const big = new CreativeMaterials();
  for (let n = 0; n < 3; n++) big.reserve(String(n), file(`${n}.png`, LIMITS.fileBytes), 'image');
  assert.throws(() => big.reserve('extra', file('extra.png'), 'image'), /总大小/);
});
test('DOCX 只选正文和注释 XML，拒绝非 Word ZIP、破损和过大的展开正文', () => {
  const valid = zipSync({ 'word/document.xml': strToU8('<document>正文</document>'), 'word/footnotes.xml': strToU8('<notes/>'),
    'word/media/image.png': new Uint8Array([1, 2, 3]) });
  assert.deepEqual([...inspectDocxZip(valid)], ['word/document.xml', 'word/footnotes.xml']);
  assert.throws(() => inspectDocxZip(zipSync({ 'not-word.txt': strToU8('text') })), /Word/);
  assert.throws(() => inspectDocxZip(valid.subarray(0, 30)), /损坏/);
  const malformed = valid.slice(); const view = new DataView(malformed.buffer);
  for (let offset = 0; offset < malformed.length - 46; offset++) {
    if (view.getUint32(offset, true) === 0x02014b50) { view.setUint32(offset + 24, LIMITS.xmlBytes + 1, true); break; }
  }
  assert.throws(() => inspectDocxZip(malformed), /正文过大/);
});

function controller() {
  const input = Object.create(CreativeInput.prototype);
  Object.assign(input, { model: new CreativeMaterials(), sequence: 0, importGeneration: 0,
    dirty() { this.model.invalidate(); }, renderItems() {}, refresh() {},
    message(text, error) { this.lastMessage = { text, error }; } });
  return input;
}
test('清空期间会取消整批排队文件，不会让后续文件重新进入素材', async () => {
  const input = controller(); let finish;
  const slow = { ...file('slow.txt'), arrayBuffer: () => new Promise(resolve => { finish = resolve; }) };
  let secondRead = false;
  const next = { ...file('next.txt'), arrayBuffer: async () => { secondRead = true; return new TextEncoder().encode('后续').buffer; } };
  const work = input.addFiles([slow, next], 'document');
  input.importGeneration++; input.model.clear(); finish(new TextEncoder().encode('晚到').buffer);
  await work;
  assert.equal(input.model.items.size, 0); assert.equal(secondRead, false);
});
test('已有可用素材时，拒绝文件的错误提示也不会被导入完成覆盖', async () => {
  const input = controller(); input.model.reserve('ready', file('ready.txt'), 'document');
  input.model.settle('ready', { status: 'ready', text: '有效素材' });
  await input.addFiles([file('unsupported.exe')], 'document');
  assert.equal(input.lastMessage.error, true); assert.match(input.lastMessage.text, /支持/);
});
test('超长正文在进入页面预览前被拒绝，避免把巨大文件渲染到编辑器', async () => {
  const input = controller();
  const bytes = new TextEncoder().encode('月'.repeat(LIMITS.previewChars + 1));
  await input.addFiles([{ ...file('large.txt', bytes.length), arrayBuffer: async () => bytes.buffer }], 'document');
  assert.equal(input.model.items.get('material-1').status, 'error');
  assert.match(input.lastMessage.text, /20 万字/);
});
