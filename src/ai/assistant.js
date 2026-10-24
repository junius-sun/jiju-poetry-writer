import { escapeHtml as esc, sourceDetailHtml, qualityText } from '../data/source_helpers.js';
import { clientTimeoutMs, DEFAULT_MODEL_TIMEOUT_SECONDS } from './protocol.js';

export class LocalServiceError extends Error {
  constructor() { super('本机 AI 服务未连接。请双击项目中的「启动诗境.cmd」，再点击「重新连接」；已保存的密钥无需重填。'); this.name = 'LocalServiceError'; }
}

export async function aiRequest(operation, payload, signal, fetcher = fetch, timeoutMs = clientTimeoutMs(operation)) {
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
  let response;
  try { response = await fetcher(`/api/ai/${operation}`, {
    method: operation === 'status' ? 'GET' : 'POST',
    headers: operation === 'status' ? {} : { 'Content-Type': 'application/json' },
    ...(operation === 'status' ? {} : { body: JSON.stringify(payload ?? {}) }),
    signal: requestSignal
  }); } catch {
    if (requestSignal.aborted) throw requestSignal.reason;
    throw new LocalServiceError();
  }
  let result;
  try { result = await response.json(); } catch {
    if (requestSignal.aborted) throw requestSignal.reason;
    throw new LocalServiceError();
  }
  if (!response.ok) throw new Error(result.error || '请求失败，请检查本地服务和模型配置。');
  return result;
}

export const readImageDataUrl = (file, mime, Reader = FileReader) => new Promise((resolve, reject) => {
  const reader = new Reader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('无法读取图片，请重新导入。'));
  // Use the verified byte format, since the filename and browser file.type may be wrong.
  reader.readAsDataURL(new Blob([file], { type: mime }));
});

export class PoetryAssistant {
  constructor() {
    this.form = document.getElementById('ai-config-form');
    this.configured = false; this.available = false; this.busy = ''; this.revision = 0;
    this.analysis = null; this.excluded = []; this.signature = ''; this.managed = [];
    this.timeoutSeconds = DEFAULT_MODEL_TIMEOUT_SECONDS; this.waitTimer = null; this.pendingStatusId = null;
    this.bind(); this.refresh(); void this.loadStatus();
  }
  el(id) { return document.getElementById(id); }
  message(id, text, error = false) {
    const element = this.el(id); element.textContent = text; element.classList.toggle('is-error', error);
  }
  state() {
    const app = window.app;
    return app ? { lineIds: app.currentPoemLines.map(line => line.id), length: app.currentLength,
      options: { singleAuthorMode: app.isSingleAuthorMode(), targetRhyme: app.getTargetRhyme() } } : null;
  }
  cancel() {
    clearInterval(this.waitTimer); this.waitTimer = null;
    this.revision++; this.controller?.abort(); this.controller = null;
    this.busy = this.busy === 'config' ? 'config' : '';
  }
  clearPoetry() {
    this.recommendations = [];
    this.el('ai-candidate-results').replaceChildren(); this.el('ai-review-result').replaceChildren();
    this.el('ai-selection-notes').hidden = true;
    this.el('ai-swap').hidden = true; this.excluded = [];
    this.message('ai-recommend-status', this.state()?.lineIds.length === 4 ? '四句已完成，可在诗笺下方进行整诗点评。' : this.configured ? `按当前诗体、韵部与心意，为你推荐第 ${(this.state()?.lineIds.length || 0) + 1} 句。` : '请返回创作设定配置模型，也可以切换到本地候选或手动搜索。');
    this.message('ai-review-status', this.state()?.lineIds.length === 4 ? '诗作或创作方向已更新，可重新点评。' : '集满四句后可点评。');
  }
  clearAnalysis() {
    this.analysis = null; this.el('ai-analysis').hidden = true; this.el('ai-brief').value = '';
    this.el('ai-analysis-details').replaceChildren();
    this.message('ai-analysis-status', '素材已更新，保存后可重新理解。');
  }
  bind() {
    this.el('ai-reconnect').addEventListener('click', () => void this.loadStatus());
    window.addEventListener('focus', () => { if (!this.available) void this.loadStatus(); });
    window.addEventListener('online', () => { if (!this.available) void this.loadStatus(); });
    this.el('ai-cancel-current').addEventListener('click', () => {
      const statusId = this.pendingStatusId; this.cancel();
      if (statusId) this.message(statusId, '本次请求已取消，可调整后重新发起。');
      this.refresh();
    });
    this.form.addEventListener('submit', event => { event.preventDefault(); void this.saveConfig(); });
    this.el('ai-test').addEventListener('click', () => void this.run('test', 'ai-config-status', async signal => {
      const result = await this.request('test', {}, signal);
      this.guard(signal);
      this.message('ai-config-status', `${result.message} · ${result.model}`);
      document.querySelector('[data-ai-connection]').textContent = '文字连接已验证';
    }));
    this.el('ai-clear-key').addEventListener('click', () => void this.saveConfig(true));
    this.el('ai-analyze').addEventListener('click', () => void this.recommend(false, { fromSetup: true }));
    this.el('ai-pick-best').addEventListener('click', () => this.pickRecommendation(0));
    this.el('ai-recommend').addEventListener('click', () => void this.recommend(false));
    this.el('ai-swap').addEventListener('click', () => void this.recommend(true));
    this.el('ai-evaluate').addEventListener('click', () => void this.evaluate());
    document.querySelectorAll('[data-ai-cancel]').forEach(button => button.addEventListener('click', () => {
      const statusId = this.pendingStatusId; this.cancel();
      if (statusId) this.message(statusId, '本次请求已取消，可调整后重新发起。');
      this.refresh();
    }));
    this.el('ai-brief').addEventListener('input', () => {
      this.cancel(); this.clearPoetry(); this.refresh();
    });
    document.addEventListener('poetry:context-changed', () => {
      this.cancel(); this.clearAnalysis(); this.clearPoetry(); this.refresh();
    });
    const changed = () => {
      const signature = JSON.stringify(this.state());
      if (signature !== this.signature) {
        this.signature = signature; this.cancel(); this.clearPoetry();
        this.message('ai-analysis-status', this.analysis ? `素材理解已保留 · ${this.analysis.model}。可修改创作方向再推荐。`
          : window.creativeInput?.getContext() ? '素材已保存，可开始推荐。'
          : this.configured ? '可直接推荐，也可先添加素材。' : '先配置 AI，或手动选句。');
      }
      this.refresh();
    };
    document.addEventListener('poetry:updated', changed);
    document.addEventListener('poetry:ready', changed);
  }
  applyStatus(status) {
    this.available = true; this.configured = status.configured; this.managed = status.managedFields || [];
    this.timeoutSeconds = status.timeoutSeconds ?? DEFAULT_MODEL_TIMEOUT_SECONDS;
    for (const name of ['baseUrl', 'model', 'visionModel', 'vision', 'outputMode', 'tokenField', 'timeoutSeconds', 'thinkingMode']) {
      const input = this.form.elements.namedItem(name);
      if (name === 'vision') input.checked = status[name]; else input.value = status[name] ?? (name === 'thinkingMode' ? 'auto' : this.timeoutSeconds);
      input.disabled = this.managed.includes(name);
    }
    const key = this.form.elements.namedItem('apiKey'); key.value = '';
    key.disabled = this.managed.includes('apiKey');
    key.placeholder = status.keyPresent ? '已保存；留空保留，填写可替换' : '暂时可留空';
    this.el('ai-key-note').textContent = this.managed.length
      ? '部分字段由服务端环境变量管理，已锁定。密钥不会回传到浏览器。'
      : '密钥保存在本机服务端，不写入浏览器缓存或代码。留空会保留已存密钥。';
    document.querySelector('[data-ai-connection]').textContent = this.configured ? '模型已配置 · 可测试连接' : 'AI 未配置密钥';
    this.el('ai-model-label').textContent = this.configured ? '文字模型已配置' : '等待接入模型';
    this.el('ai-model-label').title = status.model || '';
    this.clearPoetry(); this.refresh();
  }
  async loadStatus() {
    if (this.connecting || this.busy) return;
    this.connecting = true; this.el('ai-reconnect').disabled = true;
    try {
      const status = await aiRequest('status'); this.applyStatus(status);
      this.message('ai-config-status', status.configured ? '配置已读取，可测试连接。' : '尚未填写密钥。可先保存配置，之后再启用 AI。');
    } catch (error) {
      this.markOffline();
      this.message('ai-config-status', error.message || '无法读取配置，请检查本地服务。', true);
    } finally { this.connecting = false; this.refresh(); }
  }
  markOffline() {
    this.available = false;
    document.querySelector('[data-ai-connection]').textContent = '本机服务未连接 · 点击重新连接';
    for (const input of this.form.elements) if (input.name) input.disabled = this.managed.includes(input.name);
  }
  async saveConfig(clearKey = false) {
    if (!this.available || this.busy) return;
    this.cancel(); this.busy = 'config'; this.refresh();
    this.message('ai-config-status', '正在保存配置…');
    try {
      const payload = clearKey ? { clearKey: true } : {};
      if (!clearKey) {
        for (const name of ['baseUrl', 'model', 'visionModel', 'vision', 'apiKey', 'outputMode', 'tokenField', 'timeoutSeconds', 'thinkingMode']) {
          if (this.managed.includes(name)) continue;
          const input = this.form.elements.namedItem(name);
          payload[name] = name === 'vision' ? input.checked : name === 'timeoutSeconds' ? Number(input.value) : input.value.trim();
        }
      }
      const status = await aiRequest('config', payload);
      this.clearAnalysis(); this.clearPoetry(); this.applyStatus(status);
      this.message('ai-config-status', clearKey ? '本机保存的密钥已移除。' : status.configured ? '配置已保存。点击测试连接确认接口可用。' : '地址和模型已保存，待填写密钥后启用 AI。');
    } catch (error) { if (error instanceof LocalServiceError) this.markOffline(); this.message('ai-config-status', error.message, true); }
    finally { this.form.elements.namedItem('apiKey').value = ''; this.busy = ''; this.refresh(); }
  }
  refresh() {
    const state = this.state(), context = window.creativeInput?.getContext();
    const enabled = this.available && this.configured && !this.busy;
    this.el('ai-reconnect').hidden = this.available;
    this.el('ai-reconnect').disabled = Boolean(this.connecting || this.busy);
    const labels = { test: '测试连接', analyze: '理解素材', recommend: '诗意推荐', evaluate: '成诗点评' };
    this.el('ai-activity').hidden = !labels[this.busy];
    this.el('ai-activity-text').textContent = this.busy ? `${labels[this.busy] || '保存配置'}进行中 · ${Math.floor((Date.now() - this.requestStarted) / 1000)} 秒。完成后自动恢复按钮。` : '';
    this.el('ai-save-config').disabled = !this.available || Boolean(this.busy);
    this.el('ai-test').disabled = !enabled;
    this.el('ai-clear-key').disabled = !enabled || this.managed.includes('apiKey');
    this.el('ai-analyze').disabled = !enabled || !state || state.lineIds.length >= 4;
    this.el('ai-recommend').disabled = !enabled || !state || state.lineIds.length >= 4;
    this.el('ai-pick-best').disabled = !enabled || !this.recommendations?.length;
    this.el('ai-pick-best').parentElement.hidden = !this.recommendations?.length;
    this.el('ai-swap').disabled = this.el('ai-recommend').disabled;
    this.el('ai-evaluate').disabled = !enabled || state?.lineIds.length !== 4;
    const blocked = !this.available ? '请先重新连接本机服务。' : !this.configured ? '请先保存模型配置及密钥。' : this.busy ? '已有 AI 任务进行中，可在上方取消。' : '';
    this.el('ai-analyze').title = blocked || '有素材则先理解再推荐；没有素材则按诗体和韵部推荐。';
    this.el('ai-recommend').title = blocked || (!state ? '语料正在加载。' : state.lineIds.length >= 4 ? '四句已完成，可进行点评。' : '按当前诗体、韵部与创作方向推荐合律候选');
    this.el('ai-evaluate').title = blocked || (state?.lineIds.length !== 4 ? '集满四句后即可点评。' : '点评当前四句诗');
    const nextLine = (state?.lineIds.length || 0) + 1;
    const setupLabel = context || window.creativeInput?.hasDraft() ? '理解并推荐诗句' : 'AI 推荐诗句';
    for (const [id, label, operation] of [['ai-analyze', setupLabel, 'recommend'], ['ai-recommend', nextLine <= 4 ? `AI 推荐第 ${nextLine} 句` : '四句已完成', 'recommend'], ['ai-evaluate', 'AI 成诗点评', 'evaluate']]) {
      this.el(id).textContent = this.busy === operation ? `正在细读… ${Math.floor((Date.now() - this.requestStarted) / 1000)}s` : label;
      this.el(id).setAttribute('aria-busy', String(this.busy === operation));
    }
    document.querySelectorAll('[data-ai-cancel]').forEach(button => { button.hidden = button.dataset.aiCancel !== this.busy; });
  }
  request(operation, payload, signal) {
    return aiRequest(operation, payload, signal, fetch, clientTimeoutMs(operation, this.timeoutSeconds));
  }
  async run(operation, statusId, action) {
    if (!this.configured || this.busy) return;
    const revision = this.revision, controller = new AbortController();
    this.controller = controller; this.busy = operation; this.requestStarted = Date.now(); this.pendingStatusId = statusId;
    this.waitTimer = setInterval(() => this.refresh(), 1000); this.refresh();
    this.message(statusId, `${operation === 'test' ? '正在测试连接' : 'AI 正在细读'}，本次模型调用最多等待 ${this.timeoutSeconds} 秒，可随时取消。`);
    try { await action(controller.signal); }
    catch (error) {
      if (revision === this.revision && !controller.signal.aborted) {
        if (error instanceof LocalServiceError) this.markOffline();
        this.message(statusId, error.name === 'TimeoutError' ? '本次请求等待超时，按钮已恢复，可重试或调整模型设置。' : error.message || '模型调用失败，请重试。', true);
      }
    } finally {
      if (revision === this.revision) {
        clearInterval(this.waitTimer); this.waitTimer = null;
        this.busy = ''; this.controller = null; this.pendingStatusId = null; this.refresh();
      }
    }
  }
  guard(signal) { if (signal.aborted) throw new DOMException('请求已取消', 'AbortError'); }
  async analyze(signal) {
    const context = window.creativeInput?.getContext();
    if (!context) throw new Error('请先保存创作素材。');
    const files = window.creativeInput.getImageFiles();
    const images = await Promise.all(context.images.map(async image => {
      const file = files.find(item => item.id === image.id)?.file;
      if (!file) throw new Error('图片素材已变化，请重新保存。');
      return { ...image, dataUrl: await readImageDataUrl(file, image.mime) };
    }));
    this.guard(signal);
    const result = await this.request('analyze', { context: { ...context, images } }, signal);
    this.guard(signal); this.analysis = result; this.el('ai-brief').value = result.brief;
    this.el('ai-analysis').hidden = false;
    this.el('ai-analysis-details').innerHTML = `<div class="ai-intent-tags"><span>${esc(result.theme)}</span><span>${esc(result.mood)}</span>${result.imagery.map(word => `<span>${esc(word)}</span>`).join('')}</div>${result.avoid.length ? `<p class="ai-hint">回避：${esc(result.avoid.join('、'))}</p>` : ''}${result.imageNotes.map(note => `<details class="ai-image-note"><summary>${esc(context.images.find(image => image.id === note.id)?.name || '图片')} ${note.uncertain ? '· 有待确认' : ''}</summary><p>${esc(note.observation)}</p>${note.extractedText ? `<p class="ai-ocr">识别文字：${esc(note.extractedText)}</p>` : ''}</details>`).join('')}`;
    this.message('ai-analysis-status', `素材理解完成 · ${result.model}${result.cached ? ' · 使用缓存' : ''}。可修改创作方向再推荐。`);
    document.dispatchEvent(new CustomEvent('poetry:analysis-ready'));
  }
  intent() {
    return { brief: this.el('ai-brief').value.trim(), theme: this.analysis?.theme || '', mood: this.analysis?.mood || '',
      imagery: this.analysis?.imagery || [], avoid: this.analysis?.avoid || [] };
  }
  pickRecommendation(index) {
    const item = this.recommendations?.[index];
    if (!item || this.busy) return;
    if (window.app?.selectCandidateLine(item.poetry)) {
      const count = this.state().lineIds.length;
      this.message('ai-recommend-status', count === 4 ? '四句已完成，可进行成诗点评或收藏诗牌。' : `已选入「${item.poetry.content}」。点击上方按钮继续推荐第 ${count + 1} 句，也可以切换到自己挑选。`);
    }
  }
  async recommend(swap, { fromSetup = false } = {}) {
    if (!this.available || !this.configured || this.busy) return;
    if (!window.creativeInput?.getContext() && window.creativeInput?.hasDraft()) {
      try { window.creativeInput.commit(); }
      catch (error) { this.message(fromSetup ? 'ai-analysis-status' : 'ai-recommend-status', error.message, true); return; }
    }
    window.app?.setDrawerView('ai');
    window.app?.setAssemblyStep('compose');
    window.app?.setMobilePane?.('pick');
    await this.run('recommend', 'ai-recommend-status', async signal => {
      if (window.creativeInput?.getContext() && !this.analysis) {
        this.message('ai-recommend-status', '先理解已保存的素材，再寻找合律诗句…'); await this.analyze(signal);
      }
      const state = this.state(); if (!state) throw new Error('语料尚未加载完成。');
      this.message('ai-recommend-status', `正在比较合律候选与诗意承接，最多等待 ${this.timeoutSeconds} 秒，可随时取消。`);
      const intent = this.intent();
      const result = await this.request('recommend', { ...state, intent, excludedIds: swap ? this.excluded.slice(-80) : [] }, signal);
      this.guard(signal);
      this.excluded = [...(swap ? this.excluded : []), ...(result.consideredIds || result.recommendations.map(item => item.id))].slice(-80);
      this.recommendations = result.recommendations;
      this.el('ai-candidate-results').innerHTML = result.recommendations.map((item, index) => {
        const poem = item.poetry;
        return `<article class="ai-candidate"><div class="ai-candidate-top"><h4>${esc(poem.content)}</h4><button class="smart-action-text" data-ai-pick="${index}" aria-label="选用${esc(poem.content)}">选入 →</button></div><p class="ai-source">${esc(poem.author)} · 《${esc(poem.title)}》</p><p class="ai-rhyme">${esc(item.role)} · ${poem.end_tone === '平' ? `韵部：${esc(poem.rhyme_group)}` : '此句不入韵'}${qualityText(poem) ? ` · ${esc(qualityText(poem))}` : ''}</p><p class="ai-reason ai-reason-preview">${esc(item.reason)}</p><details class="ai-line-details"><summary>细读理由与出处</summary><p class="ai-reason">${esc(item.reason)}</p>${item.caution ? `<p class="ai-caution">留意：${esc(item.caution)}</p>` : ''}${sourceDetailHtml(poem)}</details></article>`;
      }).join('');
      this.el('ai-candidate-results').querySelectorAll('[data-ai-pick]').forEach(button => button.addEventListener('click', () => {
        this.pickRecommendation(Number(button.dataset.aiPick));
      }));
      this.el('ai-swap').hidden = !result.recommendations.length && !result.consideredIds?.length;
      this.el('ai-selection-notes').innerHTML = `<summary>AI 的整体取舍</summary><p>${esc(result.direction)}</p><p class="ai-source">${esc(result.model)}${result.cached ? ' · 使用缓存' : ''}</p>`;
      this.el('ai-selection-notes').hidden = !result.direction;
      this.message('ai-recommend-status', result.recommendations.length ? `已推荐 ${result.recommendations.length} 句，可逐条选入。` : '本批未找到适合的诗句，可换一批或调整创作方向。');
    });
  }
  async evaluate() {
    await this.run('evaluate', 'ai-review-status', async signal => {
      const result = await this.request('evaluate', { ...this.state(), intent: this.intent() }, signal);
      this.guard(signal);
      const labels = { coherence: '语义连贯', imagery: '意象组织', emotion: '情绪发展', resonance: '语言余韵' };
      this.el('ai-review-result').innerHTML = `<p class="ai-summary">${esc(result.summary)}</p><div class="ai-ratings">${Object.entries(labels).map(([key, label]) => `<div><span>${label}</span><strong>${result.ratings[key]}<small> / 5</small></strong></div>`).join('')}</div>${result.strengths.length ? `<ul class="ai-strengths">${result.strengths.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}${result.issues.map(item => `<article class="ai-issue"><h4>${item.lineIndex ? `第 ${item.lineIndex} 句 · ${esc(item.quote)}` : '全诗'}</h4><p>${esc(item.issue)}</p><p class="ai-hint">换句方向：${esc(item.suggestion)}</p></article>`).join('')}${result.warnings.map(warning => `<p class="ai-caution">${esc(warning)}</p>`).join('')}`;
      this.message('ai-review-status', `点评完成 · ${result.model}${result.cached ? ' · 使用缓存' : ''} · 评分为模型审美参考。`);
    });
  }
}

if (typeof document !== 'undefined' && document.getElementById('ai-config-form')) window.poetryAI = new PoetryAssistant();
