import { CreativeMaterials, IMAGE_PURPOSES, LIMITS } from './materials.js';
import { readDocument, readImage } from './readers.js';
import { escapeHtml } from '../data/source_helpers.js';

export class CreativeInput {
  constructor(root) {
    this.root = root; this.model = new CreativeMaterials(); this.sequence = 0; this.importGeneration = 0;
    this.list = root.querySelector('#material-list');
    this.status = root.querySelector('#material-status');
    this.commitButton = root.querySelector('#btn-save-materials');
    this.instructions = root.querySelector('#creative-intent-input');
    this.bind(); this.refresh();
  }
  message(text, error = false) {
    this.status.textContent = text;
    this.status.classList.toggle('is-error', error);
  }
  dirty() {
    this.model.invalidate();
    document.dispatchEvent(new CustomEvent('poetry:context-changed', { detail: { context: null } }));
    this.message('内容有更新，保存后作为创作素材。'); this.refresh();
  }
  bind() {
    this.root.querySelectorAll('[data-material-mode]').forEach(button => {
      button.addEventListener('click', () => {
        for (const tab of this.root.querySelectorAll('[data-material-mode]')) {
          const selected = tab === button; tab.classList.toggle('active', selected);
          tab.setAttribute('aria-pressed', String(selected));
        }
        for (const panel of this.root.querySelectorAll('[data-material-panel]')) {
          panel.hidden = panel.dataset.materialPanel !== button.dataset.materialMode;
        }
        this.root.querySelector('#creative-intent-input').placeholder = button.dataset.materialMode === 'text'
          ? '例如：写春夜江边的孤独，清冷一点，但结尾留一些希望。'
          : '可以补充：想从素材中写什么、希望什么情绪、需要避开什么。';
      });
    });
    this.instructions.addEventListener('input', () => {
      this.model.instructions = this.instructions.value;
      this.root.querySelector('#intent-char-count').textContent = `${this.instructions.value.length} / ${LIMITS.instructionChars}`;
      this.dirty();
    });
    for (const [id, inputId, kind] of [['document-drop', 'material-file-input', 'document'], ['image-drop', 'material-image-input', 'image']]) {
      const drop = this.root.querySelector(`#${id}`), input = this.root.querySelector(`#${inputId}`);
      drop.addEventListener('click', () => input.click());
      input.addEventListener('change', () => { const files = [...input.files]; input.value = ''; void this.addFiles(files, kind); });
      drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('drag-over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
      drop.addEventListener('drop', event => { event.preventDefault(); drop.classList.remove('drag-over'); void this.addFiles([...event.dataTransfer.files], kind); });
    }
    this.root.querySelector('#btn-clear-materials').addEventListener('click', () => {
      this.importGeneration++;
      for (const item of this.model.clear()) if (item.url) URL.revokeObjectURL(item.url);
      this.instructions.value = ''; this.root.querySelector('#intent-char-count').textContent = '0 / 4000';
      this.renderItems(); this.dirty(); this.message('素材已清空。');
    });
    this.commitButton.addEventListener('click', () => {
      try {
        this.commit();
      } catch (error) { this.message(error.message, true); }
    });
    window.addEventListener('pagehide', event => {
      if (event.persisted) return;
      for (const item of this.model.items.values()) if (item.url) URL.revokeObjectURL(item.url);
    });
  }
  async addFiles(files, kind) {
    const generation = this.importGeneration;
    let lastError = '';
    for (const file of files) {
      if (generation !== this.importGeneration) return;
      let item;
      try {
        item = this.model.reserve(`material-${++this.sequence}`, file, kind);
        this.dirty(); this.renderItems();
        const result = item.kind === 'document'
          ? { text: await readDocument(file, item.extension) }
          : await readImage(file);
        if (item.kind === 'document' && !result.text.trim()) throw new Error('文档中没有可提取的正文。');
        if (item.kind === 'document' && result.text.length > LIMITS.previewChars) throw new Error('文档超过 20 万字，请先截取需要的部分再导入。');
        if (!this.model.settle(item.id, { ...result, status: 'ready' }) && result.url) URL.revokeObjectURL(result.url);
      } catch (error) {
        if (item) this.model.settle(item.id, { status: 'error', error: error.message || '读取失败，请更换文件。' });
        lastError = error.message || '读取失败，请更换文件。';
        this.message(lastError, true);
      }
      this.renderItems(); this.refresh();
    }
    if (generation !== this.importGeneration) return;
    if (lastError) this.message(lastError, true);
    else if ([...this.model.items.values()].some(item => item.status === 'ready') && ![...this.model.items.values()].some(item => item.status === 'error')) {
      this.message('导入完成。可检查正文、补充说明，再保存为创作素材。');
    }
  }
  renderItems() {
    this.list.innerHTML = [...this.model.items.values()].map(item => {
      const name = escapeHtml(item.name), id = item.id;
      const detail = item.status === 'reading' ? '<p class="attachment-reading">正在读取…</p>'
        : item.status === 'error' ? `<p class="attachment-error">${escapeHtml(item.error)}</p>`
        : item.kind === 'document'
          ? `<details class="document-preview"><summary>检查并编辑正文 <span data-doc-count="${id}">${item.text.length} 字</span></summary><label class="sr-only" for="text-${id}">${name}的正文</label><textarea id="text-${id}" data-document="${id}" spellcheck="false">${escapeHtml(item.text)}</textarea><p>只提取正文，不保留排版；请检查阅读顺序与缺字。</p></details>`
          : `<div class="image-material"><img src="${item.url}" alt="${name}的导入预览"><div class="image-material-controls"><label for="purpose-${id}">希望如何理解这张图</label><select id="purpose-${id}" data-purpose="${id}">${Object.entries(IMAGE_PURPOSES).map(([value, label]) => `<option value="${value}" ${item.purpose === value ? 'selected' : ''}>${label}</option>`).join('')}</select><label for="note-${id}">图片补充说明</label><input id="note-${id}" data-note="${id}" maxlength="500" placeholder="如：取远山和暮色，不要写人物" value="${escapeHtml(item.note)}"><span>${item.width} × ${item.height} · 原图素材，AI 理解见下方</span></div></div>`;
      return `<article class="material-attachment"><div class="attachment-heading"><span class="attachment-kind" aria-hidden="true">${item.kind === 'document' ? '文' : '图'}</span><div><h4>${name}</h4><p>${(item.file.size / 1024).toFixed(1)} KB · ${item.status === 'ready' ? '已导入' : item.status === 'error' ? '读取失败' : '读取中'}</p></div><button class="attachment-remove" data-remove="${id}" aria-label="移除${name}">×</button></div>${detail}</article>`;
    }).join('');
    this.list.hidden = !this.model.items.size;
    this.list.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
      const item = this.model.remove(button.dataset.remove); if (item?.url) URL.revokeObjectURL(item.url);
      this.renderItems(); this.dirty();
    }));
    this.list.querySelectorAll('[data-document]').forEach(input => input.addEventListener('input', () => {
      const item = this.model.items.get(input.dataset.document); if (!item) return;
      item.text = input.value;
      this.list.querySelector(`[data-doc-count="${item.id}"]`).textContent = `${item.text.length} 字`;
      this.dirty();
    }));
    this.list.querySelectorAll('[data-purpose]').forEach(input => input.addEventListener('change', () => {
      this.model.items.get(input.dataset.purpose).purpose = input.value; this.dirty();
    }));
    this.list.querySelectorAll('[data-note]').forEach(input => input.addEventListener('input', () => {
      this.model.items.get(input.dataset.note).note = input.value; this.dirty();
    }));
  }
  refresh() {
    const all = [...this.model.items.values()];
    this.root.querySelector('#material-count').textContent = `${all.length} / ${LIMITS.items} 个附件`;
    this.root.querySelector('#material-state').textContent = this.model.snapshot ? '素材已就绪' : '待整理';
    this.commitButton.disabled = all.some(item => item.status === 'reading') || (!all.length && !this.model.instructions.trim());
    this.root.querySelector('#btn-clear-materials').disabled = !all.length && !this.model.instructions;
  }
  getContext() { return this.model.getContext(); }
  hasDraft() { return Boolean(this.model.instructions.trim() || this.model.items.size); }
  commit() {
    const context = this.model.commit();
    document.dispatchEvent(new CustomEvent('poetry:context-changed', { detail: { context } }));
    this.message(window.poetryAI?.configured ? '素材已保存，可让 AI 推荐诗句。' : '素材已保存，可手动选句。');
    this.refresh(); return context;
  }
  getImageFiles() { return this.model.getImageFiles(); }
}

if (typeof document !== 'undefined') {
  const root = document.querySelector('#creative-materials');
  if (root) window.creativeInput = new CreativeInput(root);
}
