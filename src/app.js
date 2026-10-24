/**
 * 古诗集句工程 - 主应用逻辑 (App.js)
 */

import { POETRY_DATABASE } from './data/poetry_db.js';
import { MetricalEngine } from './engine/metrical.js';
import { PING_RHYME_GROUPS, planPoemSettings } from './engine/rhymes.js';
import { groupPoemLines, escapeHtml, sourceDetailHtml, qualityText, formatPoemWithSources } from './data/source_helpers.js';
import { CARD_TEMPLATES, CARD_FONTS, prepareCardFont, createCardModel, cardModelHtml, renderCardCanvas, prepareCardStyle, cardPickerHtml, hydrateCardThumbnails } from './ui/poetry-card.js';

export class JijuPoetryApp {
  constructor() {
    this.engine = new MetricalEngine(POETRY_DATABASE);
    
    // 应用状态
    this.currentLength = 5; // 5言 或 7言
    this.currentPoemLines = []; // 已选择的诗句数组 (最多4条)
    this.activeLevel = null; // 当前正在挑战的飞花关卡 (null = 自由创作)
    this.preferredRhyme = '';
    this.assemblyStep = 'direction';
    this.creativeContext = window.creativeInput?.getContext() || null;

    // 本地合律候选「换一批」状态
    this.smartPage = 0;        // 当前批次 (0-based)
    this.smartPageSize = 5;    // 每批 5 句
    this._smartPoolKey = null; // 候选池缓存键 (诗架状态签名)
    this._smartPool = [];      // 候选池 (按分数降序、同分洗牌)

    // 搜索状态 (保留搜索功能：不搜索不显示；搜索诗人和诗名时折叠显示)
    this.searchExecutedMode = null; // null | 'verse' | 'poet' | 'error'
    this.verseKeyword = '';
    this.poetKeyword = '';
    this.errorMessage = '';

    // 水墨诗牌状态
    this.cardConfig = {
      title: '集句·秋夜思',
      theme: 'xuan',
      direction: 'vertical',
      style: 'letter',
      font: 'mashanzheng',
      format: 'portrait',
    };

    // 飞花闯关数据
    this.puzzleLevels = [
      {
        id: 1,
        title: '游子思乡',
        badge: '初级关卡',
        length: 5,
        targetRhyme: '上平十一真',
        requiredTags: ['乡', '思', '天涯', '佳节'],
        desc: '拼集一首五言绝句，要求第二、四句押《上平十一真》韵，且含有思乡意境。'
      },
      {
        id: 2,
        title: '水墨山水',
        badge: '中级关卡',
        length: 5,
        targetRhyme: '下平十一尤',
        requiredTags: ['山', '水', "月", "舟"],
        desc: '拼集一首五言绝句，要求押《下平十一尤》韵，勾勒幽深空灵的山水意境。'
      },
      {
        id: 3,
        title: '边塞豪情',
        badge: '高级关卡',
        length: 7,
        targetRhyme: '上平十五删',
        requiredTags: ['边塞', '风', '山', '城'],
        desc: '拼集一首七言绝句，要求押《上平十五删》韵，体现大漠边塞的豪放胸怀。'
      },
      {
        id: 4,
        title: '绝妙四家',
        badge: '大师关卡',
        length: 7,
        requireUniqueAuthors: 4,
        desc: '拼集一首七言绝句，要求四句诗必须完全来自 4 位不同唐宋名家！'
      },
      {
        id: 5,
        title: '独宗一家',
        badge: '文人雅趣',
        length: 7,
        requireSingleAuthor: true,
        desc: '挑战"集杜"绝技：四句诗须全部出自同一位唐宋名家之手（可取自其不同诗篇），方见文天祥"集杜诗"般"打成一片"之妙。'
      }
    ];

    this.init();
  }

  init() {
    document.addEventListener('poetry:context-changed', event => {
      this.creativeContext = event.detail.context;
      this._smartPoolKey = null;
      this.renderPoemSettings();
    });
    this.bindNavigation();
    this.bindAssemblyEvents();
    this.bindAtelierEvents();
    this.bindPoemSettings();
    this.bindSongbookUI();
    this.bindCardEvents();
    this.bindPingshuiGuideEvents();
    this.renderPuzzleLevels();
    this.updateSlotsDisplay();
    this.setAssemblyStep(['#assembly-direction', '#creative-materials'].includes(location.hash) ? 'direction' : 'compose', { historyMode: 'replace', scroll: false });
  }

  getTargetRhyme() {
    return this.activeLevel ? this.activeLevel.targetRhyme || '' : this.preferredRhyme || '';
  }

  setAssemblyStep(step, { historyMode = 'push', scroll = true } = {}) {
    if (!['direction', 'compose'].includes(step)) return;
    const changed = this.assemblyStep !== step;
    this.assemblyStep = step;
    document.querySelectorAll('[data-assembly-panel]').forEach(panel => { panel.hidden = panel.dataset.assemblyPanel !== step; });
    document.querySelectorAll('[data-assembly-step]').forEach(button => {
      if (button.dataset.assemblyStep === step) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    });
    document.getElementById('tab-assembly').dataset.step = step;
    const hash = `#assembly-${step}`;
    if (historyMode && location.hash !== hash) history[historyMode === 'replace' ? 'replaceState' : 'pushState'](null, '', hash);
    this.renderPoemSettings();
    if (step === 'compose' && document.querySelector('.candidate-drawer').dataset.view === 'recommend') this.renderSmartFiveRecommendations();
    if (scroll && changed) document.querySelector('.app-header').scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  bindPoemSettings() {
    const select = document.getElementById('rhyme-select');
    select.innerHTML = '<option value="">自动定韵</option>' + PING_RHYME_GROUPS.map(group => `<option value="${group.id}">${group.id} · ${group.words.replaceAll(' ', '')}</option>`).join('');
    select.addEventListener('change', () => this.requestPoemSettings({ rhyme: select.value }));
    document.getElementById('apply-settings-change').addEventListener('click', () => {
      if (this.pendingSettings) this.requestPoemSettings(this.pendingSettings, true);
    });
    document.getElementById('cancel-settings-change').addEventListener('click', () => { this.pendingSettings = null; this.renderPoemSettings(); });
    document.addEventListener('poetry:analysis-ready', () => this.renderPoemSettings());
  }

  bindSongbookUI() {
    document.querySelectorAll('[data-song-pane]').forEach(button => button.addEventListener('click', () => this.setMobilePane(button.dataset.songPane)));
    this.setMobilePane('poem');
    const compact = matchMedia('(max-width:700px)');
    const resizeSettings = () => { document.getElementById('song-settings-fold').open = !compact.matches; };
    compact.addEventListener('change', resizeSettings);
    resizeSettings();
  }

  setMobilePane(pane) {
    document.getElementById('assembly-compose').dataset.mobilePane = pane;
    document.querySelectorAll('[data-song-pane]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.songPane === pane)));
  }

  requestPoemSettings({ length = this.currentLength, rhyme = this.preferredRhyme || '' }, trim = false) {
    if (this.activeLevel) return false;
    const plan = planPoemSettings(this.engine, this.currentPoemLines, length, rhyme);
    if (plan.removed && !trim) {
      this.pendingSettings = plan; this.renderPoemSettings(); return false;
    }
    this.pendingSettings = null;
    this.currentLength = length; this.preferredRhyme = rhyme;
    this.currentPoemLines = this.currentPoemLines.slice(0, plan.keepCount);
    this._smartPoolKey = null;
    this.updateSlotsDisplay();
    return true;
  }

  renderPoemSettings() {
    const rhyme = this.getTargetRhyme(), inferred = this.currentPoemLines.find(line => line.end_tone === '平')?.rhyme_group;
    const select = document.getElementById('rhyme-select'); select.value = rhyme; select.disabled = Boolean(this.activeLevel);
    select.querySelector('option[value=""]').textContent = inferred ? `自动·${inferred}` : '自动定韵';
    document.querySelectorAll('.length-selector .btn-toggle').forEach(button => {
      const active = Number(button.dataset.length) === this.currentLength;
      button.disabled = Boolean(this.activeLevel); button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    document.getElementById('poem-settings-status').textContent = this.activeLevel
      ? `闯关中：诗体和目标韵部由关卡锁定。${rhyme ? `当前押《${rhyme}》。` : '韵部随首个入韵句确定。'}`
      : `${rhyme ? `指定押《${rhyme}》` : inferred ? `自动定韵：《${inferred}》` : '自动定韵：随首个入韵句确定'}。第二、四句及入韵首句同韵，AI 与手动选择均按此筛选。`;
    const pending = this.pendingSettings;
    document.getElementById('settings-conflict').hidden = !pending;
    if (pending) document.getElementById('settings-conflict-text').textContent = `新设定为${pending.length === 5 ? '五言' : '七言'}、${pending.rhyme || '自动定韵'}，与现有诗句冲突。确认后保留前 ${pending.keepCount} 句，重选后 ${pending.removed} 句；素材和创作方向会保留。`;
    const brief = window.poetryAI?.intent().brief || this.creativeContext?.instructions || '未限定主题，可以先按韵部选句';
    document.getElementById('compose-context-summary').textContent = brief;
    document.getElementById('song-compact-settings-label').textContent = `${this.currentLength === 5 ? '五言' : '七言'} · ${rhyme || inferred || '自动定韵'} ▾`;
    if (pending) document.getElementById('song-settings-fold').open = true;
  }

  // ==================== 1. Tab 导航逻辑 ====================
  bindNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => {
          t.classList.remove('active');
          t.removeAttribute('aria-current');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-current', 'page');

        const targetTab = tab.getAttribute('data-tab');
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        const activeContent = document.getElementById(`tab-${targetTab}`);
        if (activeContent) activeContent.classList.add('active');
        const route = targetTab === 'assembly' ? `#assembly-${this.assemblyStep}` : `#${targetTab}`;
        if (location.hash !== route) history.pushState(null, '', route);

        if (targetTab === 'card') {
          this.updateCardPreview();
        }
      });
    });
  }

  // ==================== 2. 自由集句及本地候选逻辑 ====================
  setDrawerView(view) {
    document.querySelector('.candidate-drawer').dataset.view = view;
    document.querySelectorAll('.drawer-tab').forEach(button => {
      const selected = button.dataset.drawer === view;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    if (view === 'recommend') this.renderSmartFiveRecommendations();
    if (view === 'search') this.renderCandidateDrawer();
  }

  bindAtelierEvents() {
    document.querySelectorAll('[data-assembly-step]').forEach(button => button.addEventListener('click', () => this.setAssemblyStep(button.dataset.assemblyStep)));
    window.addEventListener('popstate', () => {
      if (['#assembly-direction','#assembly-compose','#creative-materials'].includes(location.hash)) this.setAssemblyStep(['#assembly-direction','#creative-materials'].includes(location.hash)?'direction':'compose',{historyMode:null});
    });
    document.getElementById('btn-manual-compose').addEventListener('click', () => { this.setDrawerView('recommend'); this.setAssemblyStep('compose'); this.setMobilePane('pick'); });
    document.querySelectorAll('[data-atelier-tab]').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelector(`.nav-tab[data-tab="${button.dataset.atelierTab}"]`)?.click();
        document.querySelector('.app-header').scrollIntoView({ block: 'start' });
      });
    });
    document.querySelectorAll('.drawer-tab').forEach(button => {
      button.addEventListener('click', () => this.setDrawerView(button.dataset.drawer));
    });
    for (const id of ['btn-empty-start']) {
      document.getElementById(id).addEventListener('click', () => {
        this.pickRandomStarterLine();
        document.getElementById('assembly-compose').scrollIntoView({ block: 'start' });
      });
    }
    document.querySelectorAll('[data-search]').forEach(button => {
      button.addEventListener('click', () => {
        const input = document.getElementById('search-verse-input');
        input.value = button.dataset.search;
        input.dispatchEvent(new Event('input'));
        document.getElementById('btn-verse-search').click();
      });
    });
    // The completion action uses delegation because its empty-state is rendered again.
    document.querySelector('.candidate-drawer').addEventListener('click', event => {
      if (event.target.closest('[data-open-card]')) {
        document.querySelector('.nav-tab[data-tab="card"]').click();
        document.querySelector('.app-header').scrollIntoView();
      }
    });
  }

  bindAssemblyEvents() {
    // 字数切换 (五言/七言)
    const toggleBtns = document.querySelectorAll('.length-selector .btn-toggle');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const newLen = parseInt(btn.getAttribute('data-length'), 10);
        if (newLen !== this.currentLength) this.requestPoemSettings({ length: newLen });
      });
    });

    // 随机起句按钮 (必须严格符合近体绝句起句格律)
    document.getElementById('btn-random-start').addEventListener('click', () => {
      this.pickRandomStarterLine();
    });

    // 重置按钮
    document.getElementById('btn-reset-poem').addEventListener('click', () => {
      this.currentPoemLines = [];
      this.updateSlotsDisplay();
    });

    // 🔄 换一批：在同一候选池内翻到下一批 5 句（到末批自动回到第 1 批）
    const swapSmartBtn = document.getElementById('btn-swap-smart');
    if (swapSmartBtn) {
      swapSmartBtn.addEventListener('click', () => {
        const total = this.getSmartBatchTotal();
        if (total <= 1) return;
        this.smartPage = (this.smartPage + 1) % total;
        this.renderSmartFiveRecommendations();
      });
    }

    // 退出当前闯关关卡
    const exitLevelBtn = document.getElementById('btn-exit-active-level');
    if (exitLevelBtn) {
      exitLevelBtn.addEventListener('click', () => this.exitPuzzleLevel());
    }

    // 手动搜索控件
    const verseInput = document.getElementById('search-verse-input');
    const verseSearchBtn = document.getElementById('btn-verse-search');
    const verseClearBtn = document.getElementById('btn-verse-clear');

    const poetInput = document.getElementById('search-poet-input');
    const poetSearchBtn = document.getElementById('btn-poet-search');
    const poetClearBtn = document.getElementById('btn-poet-clear');

    verseInput.addEventListener('input', () => {
      verseClearBtn.classList.toggle('hidden', verseInput.value.trim().length === 0);
    });

    poetInput.addEventListener('input', () => {
      poetClearBtn.classList.toggle('hidden', poetInput.value.trim().length === 0);
    });

    // 搜索 诗句/意象
    const executeVerseSearch = () => {
      const val = verseInput.value.trim();
      if (val.length < 2) {
        this.searchExecutedMode = 'error';
        this.errorMessage = '⚠️ 诗句/意象搜索必须输入至少 2 个字（例如：“明月”、“春风”）。';
      } else {
        this.searchExecutedMode = 'verse';
        this.verseKeyword = val;
        this.poetKeyword = '';
        poetInput.value = '';
        poetClearBtn.classList.add('hidden');
      }
      this.renderCandidateDrawer();
    };

    verseSearchBtn.addEventListener('click', executeVerseSearch);
    verseInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executeVerseSearch();
    });

    // 搜索 诗人/诗名
    const executePoetSearch = () => {
      const val = poetInput.value.trim();
      if (val.length < 2) {
        this.searchExecutedMode = 'error';
        this.errorMessage = '⚠️ 诗人/诗名搜索必须输入至少 2 个字（例如：“王维”、“李白”、“山居秋暝”）。';
      } else {
        this.searchExecutedMode = 'poet';
        this.poetKeyword = val;
        this.verseKeyword = '';
        verseInput.value = '';
        verseClearBtn.classList.add('hidden');
      }
      this.renderCandidateDrawer();
    };

    poetSearchBtn.addEventListener('click', executePoetSearch);
    poetInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executePoetSearch();
    });

    verseClearBtn.addEventListener('click', () => {
      verseInput.value = '';
      this.verseKeyword = '';
      verseClearBtn.classList.add('hidden');
      this.searchExecutedMode = null;
      this.renderCandidateDrawer();
    });

    poetClearBtn.addEventListener('click', () => {
      poetInput.value = '';
      this.poetKeyword = '';
      poetClearBtn.classList.add('hidden');
      this.searchExecutedMode = null;
      this.renderCandidateDrawer();
    });
  }

  // 随机起句：严格要求符合近体绝句【起句（首句）】格律
  pickRandomStarterLine() {
    const isStarter = this.engine.createCandidateFilter([], this.currentLength, {
      targetRhyme: this.getTargetRhyme()
    });
    const validStarters = POETRY_DATABASE.filter(isStarter);
    
    if (validStarters.length === 0) return;

    const randomIndex = Math.floor(Math.random() * validStarters.length);
    const starter = validStarters[randomIndex];

    this.currentPoemLines = [starter];
    this.updateSlotsDisplay();
  }

  selectCandidateLine(poetryItem) {
    if (this.currentPoemLines.length >= 4) return false;

    const result = this.engine.validatePoem([...this.currentPoemLines, poetryItem], {
      length: this.currentLength,
      requireComplete: false,
      singleAuthorMode: this.isSingleAuthorMode(),
      targetRhyme: this.getTargetRhyme()
    });
    if (!result.isValid) {
      alert(`此句暂不能选用：\n${result.errors.map(error => error.message).join('\n')}`);
      return false;
    }

    this.currentPoemLines.push(poetryItem);
    this.updateSlotsDisplay();
    return true;
  }

  removeLineAt(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.currentPoemLines.length) return;
    // 后续句的句位、平仄和韵部依赖前缀；一起移除，避免删句后错位。
    this.currentPoemLines.splice(index);
    this.updateSlotsDisplay();
  }

  updateSlotsDisplay() {
    // A pending replacement describes the previous poem; editing the poem cancels that proposal.
    this.pendingSettings = null;
    const slots = document.querySelectorAll('#quatrain-slots .line-slot');
    
    slots.forEach((slot, index) => {
      const lineData = this.currentPoemLines[index];
      const changed = lineData && slot.dataset.lineId !== lineData.id;
      slot.dataset.lineId = lineData?.id || '';
      slot.className = 'line-slot';
      slot.removeAttribute('aria-current');

      if (index === this.currentPoemLines.length && index < 4) {
        slot.classList.add('active-target');
        slot.setAttribute('aria-current', 'step');
      }

      if (lineData) {
        slot.classList.add('filled');
        if (changed && !document.documentElement.classList.contains('motion-paused') && !matchMedia('(prefers-reduced-motion:reduce)').matches) slot.classList.add('just-filled');
        slot.innerHTML = `
          <div class="slot-number" aria-label="第 ${index + 1} 句">${['壹', '贰', '叁', '肆'][index]}</div>
          <div class="slot-main">
            <div class="slot-content-display">
              <div class="verse-text" aria-label="${escapeHtml(lineData.content)}">${Array.from(lineData.content).map((character, position) => `<span aria-hidden="true" style="--char-index:${position}">${escapeHtml(character)}</span>`).join('')}</div>
              <div class="verse-meta">
                <span class="verse-author">【${escapeHtml(lineData.dynasty)}】${escapeHtml(lineData.author)} · 《${escapeHtml(lineData.title)}》</span>
                <span>韵部: ${lineData.rhyme_group}</span>
              </div>
              ${sourceDetailHtml(lineData)}
            </div>
          </div>
          <div class="slot-badge ${lineData.end_tone === '平' ? 'rhyme' : ''}">
            ${lineData.end_tone === '平' ? '押韵' : '出句'}
          </div>
          <button class="btn-remove-line" data-remove-index="${index}" title="移除此句及后续诗句" aria-label="移除第 ${index + 1} 句及后续诗句">✕</button>
        `;
        slot.querySelector('.verse-text span:last-child')?.addEventListener('animationend', () => slot.classList.remove('just-filled'), { once: true });
      } else {
        slot.classList.add('empty');
        const hintText = index === this.currentPoemLines.length
          ? `待选第${['一', '二', '三', '四'][index]}句`
          : ['选一句，起笔', '承接前句，入韵', '换一重意境', '以余韵收笔'][index];

        slot.innerHTML = `
          <div class="slot-number" aria-label="第 ${index + 1} 句">${['壹', '贰', '叁', '肆'][index]}</div>
          <div class="slot-main">
            <div class="slot-text-placeholder">${hintText}</div>
          </div>
          <div class="slot-badge">${['起', '承', '转', '合'][index]}</div>
        `;
      }
    });

    document.querySelectorAll('.btn-remove-line').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-remove-index'), 10);
        this.removeLineAt(idx);
      });
    });

    this.renderMetricalMatrix();
    this.renderSmartFiveRecommendations();
    this.renderCandidateDrawer();
    this.renderPoemSettings();
    const count = this.currentPoemLines.length;
    const progress = document.getElementById('poem-progress');
    if (progress) progress.textContent = `${['落笔之前', '灵感初现', '诗意相和', '转入佳境', '四句成篇'][count]} · ${count} / 4`;
    document.body.classList.toggle('poem-complete', count === 4);
    document.getElementById('song-finish-card').disabled = count !== 4;
    document.getElementById('song-meter-status').textContent = count ? `${count} 句已检查` : '待落笔';
    document.getElementById('song-mobile-count').textContent = `${count} / 4`;
    document.getElementById('song-candidate-heading').textContent = count === 4 ? '四句成篇' : `为第${['一', '二', '三', '四'][count]}句寻诗`;
    const lastCount = this._songPreviousCount || 0;
    document.getElementById('song-selection-status').textContent = count > lastCount
      ? `已选入「${this.currentPoemLines.at(-1).content}」`
      : count < lastCount ? `已保留 ${count} 句，可以重新选句。` : '';
    this._songPreviousCount = count;
    if (count === 4) this.setMobilePane('poem');
    document.dispatchEvent(new CustomEvent('poetry:updated', { detail: { count } }));
  }

  /**
   * 取当前诗架状态对应的候选池（带缓存：诗架不变则复用，保证「换一批」翻页稳定不重复）
   */
  getSmartPool() {
    const key = [
      this.currentLength,
      this.isSingleAuthorMode() ? 'single' : 'multi',
      this.getTargetRhyme() || '',
      this.currentPoemLines.map(l => l.id).join(',')
    ].join('|');

    if (key !== this._smartPoolKey) {
      this._smartPoolKey = key;
      this._smartPool = this.engine.getSmartCandidatePool(
        this.currentPoemLines,
        this.currentLength,
        { singleAuthorMode: this.isSingleAuthorMode(), targetRhyme: this.getTargetRhyme(), poolLimit: 500 }
      );
      this.smartPage = 0; // 诗架变动即回到第 1 批
    }
    return this._smartPool;
  }

  getSmartBatchTotal() {
    const pool = this._smartPool || [];
    return Math.max(1, Math.ceil(pool.length / this.smartPageSize));
  }

  /**
   * 本地规则候选 5 句 (仅在已选好首句后显示后续推荐)
   */
  renderSmartFiveRecommendations() {
    if (document.querySelector('.candidate-drawer').dataset.view !== 'recommend') return;
    const section = document.getElementById('smart-recommendation-section');
    const placeholder = document.getElementById('smart-placeholder');
    const gridContainer = document.getElementById('smart-five-grid');
    const tipEl = document.getElementById('smart-step-tip');

    const targetIndex = this.currentPoemLines.length;

    // 第一句 (targetIndex === 0) 或 集满4句 (targetIndex >= 4) 时，隐藏推荐区域，显示空状态提示！
    if ((targetIndex === 0 && this.assemblyStep !== 'compose') || targetIndex >= 4) {
      if (section) section.classList.add('hidden');
      if (placeholder) {
        placeholder.classList.remove('hidden');
        if (!this._initialPlaceholder) this._initialPlaceholder = placeholder.innerHTML;
        if (targetIndex >= 4) {
          placeholder.innerHTML = '<h3>留作一笺</h3><p>选一张诗笺，收藏这四句。</p><button class="text-button" data-open-card>挑选诗笺 →</button>';
        } else {
          // Preserve the original button node on initial render; restore its handler after completion.
          if (placeholder.querySelector('[data-open-card]')) {
            placeholder.innerHTML = this._initialPlaceholder;
            placeholder.querySelector('#btn-empty-start').addEventListener('click', () => this.pickRandomStarterLine());
          }
        }
      }
      return;
    }

    if (section) section.classList.remove('hidden');
    if (placeholder) placeholder.classList.add('hidden');

    // 候选池 + 当前批次
    const pool = this.getSmartPool();
    const totalBatches = this.getSmartBatchTotal();
    if (this.smartPage >= totalBatches) this.smartPage = 0;

    const start = this.smartPage * this.smartPageSize;
    const smartFive = pool.slice(start, start + this.smartPageSize);

    // 更新「换一批」按钮与批次标识
    const swapBtn = document.getElementById('btn-swap-smart');
    const batchLabel = document.getElementById('smart-batch-label');
    if (batchLabel) {
      batchLabel.textContent = pool.length > 0
        ? `第 ${this.smartPage + 1}/${totalBatches} 批 · 共 ${pool.length} 句`
        : '';
    }
    if (swapBtn) {
      swapBtn.disabled = pool.length <= this.smartPageSize;
      swapBtn.title = swapBtn.disabled
        ? '符合此句格律的候选不足 5 句以上，无可更换的批次'
        : `换一批：另换 5 句同样严合格律的诗句（共 ${totalBatches} 批）`;
    }

    if (targetIndex === 0) {
      tipEl.textContent = `第 1 句 · ${this.getTargetRhyme() ? `按《${this.getTargetRhyme()}》筛选` : '选择合律起句'}`;
    } else if (targetIndex === 1 || targetIndex === 3) {
      const rhymingLine = this.currentPoemLines.find(l => l.end_tone === '平' && l.rhyme_group !== '仄声');
      const rhymeName = this.getTargetRhyme() || rhymingLine?.rhyme_group || '待定：选入本句后确定';
      tipEl.textContent = `第 ${targetIndex + 1} 句 · 依语料标注匹配《${rhymeName}》`;
    } else {
      tipEl.textContent = '第 3 句 · 出句相粘，转换意境';
    }

    if (this.isSingleAuthorMode() && this.currentPoemLines.length > 0) {
      tipEl.textContent += ` ｜ 集杜模式·锁定【${this.currentPoemLines[0].author}】`;
    }

    if (smartFive.length === 0) {
      let msg = `当前暂无完美符合此律调的推选，请尝试下方手动搜索。`;
      if (this.isSingleAuthorMode() && this.currentPoemLines.length > 0) {
        const who = this.currentPoemLines[0].author;
        msg = `【${who}】七言佳作中难以集杜成篇（同韵部平收句不足）。建议换一位七言丰沛的大家作首句，如王维、李白、苏轼；或点开下方搜索抽屉手动挑选同家之句。`;
      }
      gridContainer.innerHTML = `<div class="matrix-empty">${msg}</div>`;
      return;
    }

    let html = '';
    smartFive.forEach(item => {
      const p = item.poetry;
      html += `
        <div class="smart-card" data-id="${escapeHtml(p.id)}">
          <div class="smart-card-left">
            <div class="smart-card-text">${escapeHtml(p.content)}</div>
            <div class="smart-card-meta">
              <span>【${escapeHtml(p.dynasty)}】${escapeHtml(p.author)}</span>
              <span>《${escapeHtml(p.title)}》</span>
              <span>韵部: ${p.rhyme_group}</span>
            </div>
            ${sourceDetailHtml(p)}
          </div>
          <div class="smart-card-right">
            <span class="smart-score-pill" title="本地规则匹配程度，不是诗意评分">匹配 ${item.score}</span>
            <button class="smart-action-text" aria-label="选用${escapeHtml(p.content)}">选入 →</button>
          </div>
        </div>
      `;
    });

    gridContainer.innerHTML = html;

    gridContainer.querySelectorAll('.smart-card').forEach(card => {
      card.addEventListener('click', (event) => {
        if (event.target.closest('.source-details')) return;
        const id = card.getAttribute('data-id');
        const item = POETRY_DATABASE.find(p => p.id === id);
        if (item) this.selectCandidateLine(item);
      });
    });
  }

  renderMetricalMatrix() {
    const matrixContainer = document.getElementById('matrix-grid');
    const evalBox = document.getElementById('evaluation-box');

    if (this.currentPoemLines.length === 0) {
      matrixContainer.innerHTML = '<div class="matrix-empty">落下第一句，平仄与韵脚便在此回应。</div>';
      evalBox.classList.add('hidden');
      return;
    }

    let html = '';
    this.currentPoemLines.forEach((line, idx) => {
      const pattern = line.ping_ze_pattern;
      let pillsHtml = '';

      for (let i = 0; i < pattern.length; i++) {
        const isPing = pattern[i] === '1';
        const isFlex = this.engine.isFlexiblePosition(i + 1, pattern.length);
        
        let pillClass = isPing ? 'ping' : 'ze';
        let charTag = isPing ? '平' : '仄';
        if (isFlex) {
          pillClass += ' flexible';
          charTag += '*';
        }

        pillsHtml += `<span class="tone-pill ${pillClass}" title="${isFlex ? '可变位置，仍须避免孤平和三平尾' : ''}">${charTag}</span>`;
      }

      html += `
        <div class="matrix-row">
          <span class="row-label">第 ${idx + 1} 句:</span>
          <div class="tone-pills">${pillsHtml}</div>
          <span style="font-size:0.8rem; color:var(--color-ink-muted);">[尾字: ${line.end_tone}]</span>
        </div>
      `;
    });

    matrixContainer.innerHTML = html;

    if (this.currentPoemLines.length === 4) {
      const result = this.engine.evaluatePoem(this.currentPoemLines, { length: this.currentLength, targetRhyme: this.getTargetRhyme(), singleAuthorMode: this.isSingleAuthorMode() });

      // 若处于飞花闯关中，追加关卡目标判定
      if (this.activeLevel) {
        const goal = this.checkLevelGoal(this.currentPoemLines);
        if (goal) {
          const goalReports = goal.results.map(g =>
            `${g.ok ? '✅' : '❌'} 【关卡目标】${g.text}`
          );
          goalReports.unshift(goal.passed
            ? `🎊 【通关成功】恭喜达成关卡「${this.activeLevel.title}」全部目标！`
            : `⏳ 【尚未通关】仍有关卡目标未达成，请按提示调整诗句。`);
          result.report = [...goalReports, ...result.report];
          if (goal.passed) {
            result.rank = `🏅 通关·${this.activeLevel.title}`;
          }
        }
      }

      document.getElementById('eval-rank').textContent = result.rank;
      document.getElementById('eval-score').textContent = `规则得分: ${result.score} 分`;

      const reportsList = document.getElementById('eval-reports');
      reportsList.innerHTML = result.report.map(r => `<li>${r}</li>`).join('');
      evalBox.classList.remove('hidden');
    } else {
      evalBox.classList.add('hidden');
    }
  }

  /**
   * 手动搜索结果抽屉：保留搜诗人和搜诗名折叠卡片与搜意象功能，不搜索不显示
   */
  renderCandidateDrawer() {
    if (document.querySelector('.candidate-drawer').dataset.view !== 'search') return;
    const candidateListContainer = document.getElementById('candidate-list');
    const candidateCountPill = document.getElementById('candidate-count');
    const drawerDesc = document.getElementById('drawer-desc');

    if (this.currentPoemLines.length >= 4) {
      candidateCountPill.textContent = '4 / 4';
      drawerDesc.textContent = '四句已选齐，可以查看格律或制作诗牌。';
      candidateListContainer.innerHTML = '<div class="search-placeholder"><h3>四句成篇，留作一笺</h3><p>选一张诗笺，收藏这四句。</p><button class="text-button" data-open-card>制作诗牌 →</button></div>';
      return;
    }

    if (this.searchExecutedMode === null) {
      candidateCountPill.textContent = '0 条';
      drawerDesc.textContent = '在下方输入框中搜索诗句、意象或诗人名';
      candidateListContainer.innerHTML = `
        <div class="search-placeholder">
          <div class="empty-orbit" aria-hidden="true"><span>寻</span></div>
          <h3>心有所想，诗有所应</h3>
          <p>输入至少两个字，寻一处风景、一位故人。<br>每一句，都有迹可循。</p>
        </div>
      `;
      return;
    }

    if (this.searchExecutedMode === 'error') {
      candidateCountPill.textContent = '0 条';
      drawerDesc.textContent = '字数未达标';
      candidateListContainer.innerHTML = `<div class="search-hint-error">${this.errorMessage}</div>`;
      return;
    }

    if (this.searchExecutedMode === 'poet') {
      const lockAuthor = (this.isSingleAuthorMode() && this.currentPoemLines.length > 0)
        ? this.currentPoemLines[0].author
        : null;

      const accepted = this.engine.createCandidateFilter(this.currentPoemLines, this.currentLength, { targetRhyme: this.getTargetRhyme(), singleAuthorMode: this.isSingleAuthorMode() });
      const poetMatches = POETRY_DATABASE.filter(item => {
        const base = item.author.includes(this.poetKeyword) || item.title.includes(this.poetKeyword);
        return base && accepted(item) && (!lockAuthor || item.author === lockAuthor);
      });

      const poemGroups = groupPoemLines(poetMatches);

      candidateCountPill.textContent = `${poemGroups.size} 个出处 (${poetMatches.length}句)`;
      drawerDesc.textContent = `“${this.poetKeyword}”适合当前第 ${this.currentPoemLines.length + 1} 句的合律候选，已按字数和韵部筛选`;

      if (poemGroups.size === 0) {
        candidateListContainer.innerHTML = `<div class="matrix-empty">“${escapeHtml(this.poetKeyword)}”暂时没有适合当前句位、字数与韵部的诗句。可换一个诗人或诗名，或调整创作设定。</div>`;
        return;
      }

      let html = '';
      poemGroups.forEach(lines => {
        const first = lines[0];
        html += `
          <div class="poet-poem-card collapsed">
            <button class="poem-title-header" aria-expanded="false">
              <span class="poem-title-main">
                <span class="poem-title-text">《${escapeHtml(first.title)}》</span>
                <span class="poem-author-tag">【${escapeHtml(first.dynasty)}】${escapeHtml(first.author)}</span>
              </span>
              <span class="poem-toggle-badge">▼ 展开收录句 (${lines.length}句)</span>
            </button>
            ${sourceDetailHtml(first)}
            <div class="poem-lines-group">
              ${lines.map(line => `
                <div class="poem-line-btn" data-id="${escapeHtml(line.id)}">
                  <span class="poem-line-text">${escapeHtml(line.content)}</span>
                  ${qualityText(line) ? `<span class="source-details">${escapeHtml(qualityText(line))}</span>` : ''}
                  <button class="poem-line-action" aria-label="选用${escapeHtml(line.content)}">选入 →</button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });

      candidateListContainer.innerHTML = html;

      candidateListContainer.querySelectorAll('.poet-poem-card').forEach(card => {
        const header = card.querySelector('.poem-title-header');
        const badge = card.querySelector('.poem-toggle-badge');
        const linesCount = card.querySelectorAll('.poem-line-btn').length;

        header.addEventListener('click', () => {
          const isExpanded = card.classList.contains('expanded');
          header.setAttribute('aria-expanded', String(!isExpanded));
          if (isExpanded) {
            card.classList.remove('expanded');
            card.classList.add('collapsed');
            badge.textContent = `▼ 展开收录句 (${linesCount}句)`;
          } else {
            card.classList.remove('collapsed');
            card.classList.add('expanded');
            badge.textContent = `▲ 收起收录句`;
          }
        });
      });

      candidateListContainer.querySelectorAll('.poem-line-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          const item = POETRY_DATABASE.find(p => p.id === id);
          if (item) this.selectCandidateLine(item);
        });
      });
      return;
    }

    if (this.searchExecutedMode === 'verse') {
      const options = {
        length: this.currentLength,
        keyword: this.verseKeyword,
        tag: null,
        singleAuthorMode: this.isSingleAuthorMode(),
        targetRhyme: this.getTargetRhyme()
      };

      const recommendations = this.engine.getRecommendations(this.currentPoemLines, options);

      candidateCountPill.textContent = `${recommendations.length} 条`;
      drawerDesc.textContent = `包含“${this.verseKeyword}”的 ${this.currentLength} 言合律候选，已按当前句位与韵部筛选`;

      if (recommendations.length === 0) {
        candidateListContainer.innerHTML = `<div class="matrix-empty">暂无包含“${escapeHtml(this.verseKeyword)}”且适合当前句位、字数与韵部的诗句。可换个关键词，或调整创作设定。</div>`;
        return;
      }

      let listHtml = '';
      recommendations.forEach(item => {
        const p = item.poetry;
        listHtml += `
          <div class="candidate-card" data-id="${escapeHtml(p.id)}">
            <div class="cand-info">
              <div class="cand-text">${escapeHtml(p.content)}</div>
              <div class="cand-meta">
                <span class="cand-author">【${escapeHtml(p.dynasty)}】${escapeHtml(p.author)}</span>
                <span>《${escapeHtml(p.title)}》</span>
                <span>韵部: ${p.rhyme_group}</span>
              </div>
              ${sourceDetailHtml(p)}
            </div>
            <div class="cand-score-badge">
              <span class="score-num">${item.score}分</span>
              <span class="score-label">规则匹配</span>
              <button class="smart-action-text" aria-label="选用${escapeHtml(p.content)}">选入 →</button>
            </div>
          </div>
        `;
      });

      candidateListContainer.innerHTML = listHtml;

      candidateListContainer.querySelectorAll('.candidate-card').forEach(card => {
        card.addEventListener('click', (event) => {
          if (event.target.closest('.source-details')) return;
          const id = card.getAttribute('data-id');
          const selectedPoetry = POETRY_DATABASE.find(item => item.id === id);
          if (selectedPoetry) {
            this.selectCandidateLine(selectedPoetry);
          }
        });
      });
    }
  }

  // ==================== 3. 飞花闯关模块逻辑 ====================
  renderPuzzleLevels() {
    const levelsContainer = document.getElementById('puzzle-levels');
    let html = '';

    this.puzzleLevels.forEach(level => {
      html += `
        <div class="level-card" data-level-id="${level.id}">
          <span class="level-badge">${level.badge}</span>
          <h3 class="level-title">${level.title}</h3>
          <p class="level-desc">${level.desc}</p>
          <div class="level-footer">
            <span>诗体: ${level.length === 5 ? '五言绝句' : '七言绝句'}</span>
            <button class="btn btn-primary btn-sm">开始关卡</button>
          </div>
        </div>
      `;
    });

    levelsContainer.innerHTML = html;

    levelsContainer.querySelectorAll('.level-card').forEach(card => {
      card.addEventListener('click', () => {
        const levelId = parseInt(card.getAttribute('data-level-id'), 10);
        this.startPuzzleLevel(levelId);
      });
    });
  }

  startPuzzleLevel(levelId) {
    const level = this.puzzleLevels.find(l => l.id === levelId);
    if (!level) return;

    this.activeLevel = level;
    this.pendingSettings = null;
    this.currentLength = level.length;
    this.currentPoemLines = [];

    document.querySelectorAll('.length-selector .btn-toggle').forEach(b => {
      const selected = parseInt(b.getAttribute('data-length'), 10) === level.length;
      b.classList.toggle('active', selected);
      b.setAttribute('aria-pressed', String(selected));
    });

    document.querySelector('.nav-tab[data-tab="assembly"]').click();
    this.setAssemblyStep('compose');
    this.setDrawerView('recommend');
    this.renderActiveLevelBanner();
    this.updateSlotsDisplay();
  }

  exitPuzzleLevel() {
    this.preferredRhyme = this.getTargetRhyme() || this.currentPoemLines.find(line => line.end_tone === '平')?.rhyme_group || '';
    this.activeLevel = null;
    this.renderActiveLevelBanner();
    this.updateSlotsDisplay();
  }

  /**
   * 在自由集句面板顶部渲染「闯关中」横幅
   */
  renderActiveLevelBanner() {
    const banner = document.getElementById('active-level-banner');
    if (!banner) return;

    if (!this.activeLevel) {
      banner.classList.add('hidden');
      return;
    }

    banner.classList.remove('hidden');
    document.getElementById('active-level-title').textContent =
      `🚩 闯关中：${this.activeLevel.title}（${this.activeLevel.badge}）`;
    document.getElementById('active-level-goal').textContent =
      `目标：${this.activeLevel.desc}`;
  }

  /**
   * 校验当前 4 句是否达成关卡目标，返回 { passed, results[] }
   */
  isSingleAuthorMode() {
    return !!(this.activeLevel && this.activeLevel.requireSingleAuthor);
  }

  checkLevelGoal(lines) {
    const level = this.activeLevel;
    if (!level || !Array.isArray(lines) || lines.length !== 4) return null;

    const validation = this.engine.validatePoem(lines, { length: level.length });
    const results = [{
      ok: validation.isValid,
      text: `${level.length} 言绝句须格律、押韵及集句来源全部合格`
    }];
    let passed = validation.isValid;

    // 1. 目标韵部：第 2、4 句必须同押目标韵部的平声韵
    if (level.targetRhyme) {
      const ok = lines[1]?.end_tone === '平' && lines[3]?.end_tone === '平'
        && lines[1]?.rhyme_group === level.targetRhyme
        && lines[3]?.rhyme_group === level.targetRhyme;
      if (!ok) passed = false;
      results.push({ ok, text: `韵部目标：第二、四句同押《${level.targetRhyme}》平声韵` });
    }

    // 2. 意象目标：全诗（内容或标签）至少命中一个限定意象
    if (level.requiredTags && level.requiredTags.length > 0) {
      const hit = level.requiredTags.find(t => lines.some(l =>
        (l?.content || '').includes(t) || (l?.tags || []).some(tag => tag.includes(t))
      ));
      const ok = Boolean(hit);
      if (!ok) passed = false;
      results.push({
        ok,
        text: `意象目标：包含「${level.requiredTags.join(' / ')}」之一${ok ? `（已命中「${hit}」）` : ''}`
      });
    }

    // 3. 名家目标：N 句出自 N 位不同名家
    if (level.requireUniqueAuthors) {
      const authorCount = new Set(lines.map(l => l?.author).filter(Boolean)).size;
      const ok = authorCount >= level.requireUniqueAuthors;
      if (!ok) passed = false;
      results.push({
        ok,
        text: `名家目标：${level.requireUniqueAuthors} 句出自 ${level.requireUniqueAuthors} 位不同名家（当前 ${authorCount} 位）`
      });
    }

    // 4. 集杜目标：四句同出一位名家（可取自其不同诗篇）
    if (level.requireSingleAuthor) {
      const authors = lines.map(l => l?.author);
      const ok = Boolean(authors[0]) && authors.every(a => a === authors[0]);
      if (!ok) passed = false;
      const distinctAuthors = [...new Set(authors)];
      results.push({
        ok,
        text: `集杜目标：四句同出一位名家之手（当前 ${distinctAuthors.length} 位：${distinctAuthors.join('、')}）`
      });
    }

    return { passed, results };
  }

  // ==================== 4. 水墨诗牌导出逻辑 ====================
  loadCardFonts() {
    return prepareCardFont(this.cardConfig.font).then(()=>true);
  }

  bindCardEvents() {
    const picker=document.querySelector('.card-template-picker');
    picker.innerHTML=cardPickerHtml();
    hydrateCardThumbnails(picker);
    document.querySelector('.font-picker').innerHTML=Object.entries(CARD_FONTS).map(([key,font])=>`<button class="font-btn" data-font="${key}" aria-label="${font.label}"><span style="font-family:${escapeHtml(font.family)}">山月清风</span><small>${font.label}</small></button>`).join('');
    document.getElementById('view-selected-card').addEventListener('click',()=>document.querySelector('.card-preview-area').scrollIntoView({block:'start',behavior:'smooth'}));
    document.querySelectorAll('[data-card-group]').forEach(button=>button.addEventListener('click',()=>{
      const group=button.dataset.cardGroup;
      document.querySelectorAll('[data-card-group]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab===button)));
      let count=0;
      picker.querySelectorAll('[data-style]').forEach(choice=>{choice.hidden=group!=='全部' && choice.dataset.group!==group;if(!choice.hidden)count++;});
      document.getElementById('card-collection-count').textContent=`${group} · ${count} 款`;
    }));
    document.getElementById('card-title-input').addEventListener('input', (e) => {
      this.cardConfig.title = e.target.value || '集句诗';
      this.updateCardPreview();
    });

    // 样式风格选择器
    document.querySelectorAll('.style-picker .style-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.style-picker .style-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.cardConfig.style = btn.getAttribute('data-style');
        const preset = CARD_TEMPLATES[this.cardConfig.style];
        this.cardConfig.theme = preset.theme;
        this.cardConfig.font = preset.font;
        this.updateCardPreview();
      });
    });

    // 字体选择器
    document.querySelectorAll('.font-picker .font-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.font-picker .font-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.cardConfig.font = btn.getAttribute('data-font');
        this.updateCardPreview();
      });
    });

    document.querySelectorAll('.theme-picker .theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.theme-picker .theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.cardConfig.theme = btn.getAttribute('data-theme');
        this.updateCardPreview();
      });
    });

    document.querySelectorAll('.direction-picker .dir-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.direction-picker .dir-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.cardConfig.direction = btn.getAttribute('data-dir');
        this.updateCardPreview();
      });
    });

    // 导出为图片按钮
    document.getElementById('btn-export-image').addEventListener('click', () => {
      this.exportCardAsImage();
    });

    document.querySelectorAll('.format-btn').forEach(button => button.addEventListener('click', () => {
      this.cardConfig.format = button.dataset.format; this.updateCardPreview();
    }));
    this.cardResizeObserver = new ResizeObserver(() => this.scaleCardPreview());
    this.cardResizeObserver.observe(document.getElementById('card-preview-stage'));

    document.getElementById('btn-copy-poem').addEventListener('click', () => {
      if (this.currentPoemLines.length === 0) {
        alert("请先在'自由集句'页面组装诗句！");
        return;
      }
      const poemText = formatPoemWithSources(this.currentPoemLines, this.cardConfig.title);
      
      navigator.clipboard.writeText(poemText).then(() => {
        alert("📋 诗句全文与溯源出处已复制到剪贴板！");
      }).catch(() => {
        window.prompt("自动复制失败，请手动复制：", poemText);
      });
    });
  }

  async updateCardPreview() {
    const version=this._cardPreviewVersion=(this._cardPreviewVersion||0)+1;
    const exportButton=document.getElementById('btn-export-image');
    exportButton.disabled=true;
    document.getElementById('card-export-state').textContent=`正在准备${CARD_TEMPLATES[this.cardConfig.style].name}…`;
    document.getElementById('card-preview-stage').setAttribute('aria-busy','true');
    try {
      const text=this.currentPoemLines.map(line=>line.content).join('')+this.cardConfig.title;
      await Promise.all([prepareCardStyle(this.cardConfig.style),prepareCardFont(this.cardConfig.font,text)]);
    } catch(error) {
      if(version!==this._cardPreviewVersion) return;
      document.getElementById('card-preview-stage').setAttribute('aria-busy','false');
      document.getElementById('card-export-state').textContent=error.message;
      return;
    }
    if(version!==this._cardPreviewVersion) return;
    document.getElementById('card-preview-stage').setAttribute('aria-busy','false');
    const cardElement = document.getElementById('xuan-card');
    this.cardModel = createCardModel(this.cardConfig, this.currentPoemLines);
    const model = this.cardModel, stage = document.getElementById('card-preview-stage');
    cardElement.style.width = `${model.width}px`; cardElement.style.height = `${model.height}px`;
    cardElement.innerHTML = cardModelHtml(model);
    stage.style.maxWidth = `${model.width}px`; stage.style.aspectRatio = `${model.width} / ${model.height}`;
    document.getElementById('card-preview-name').textContent = `${CARD_TEMPLATES[model.style].name} · ${CARD_FONTS[model.font].label}`;
    document.getElementById('card-output-size').textContent = `${model.width * 3} × ${model.height * 3} PNG`;
    document.getElementById('card-example-badge').textContent = model.isExample ? '版式示意 · 请先集句' : `${this.currentPoemLines.length} 句诗作`;
    document.getElementById('card-export-state').textContent = '导出保留完整纸幅；复制全诗可查看完整出处。';
    document.getElementById('btn-export-image').disabled = model.isExample;
    document.getElementById('btn-copy-poem').disabled = model.isExample;
    for (const [selector, field] of [['.style-btn', 'style'], ['.font-btn', 'font'], ['.theme-btn', 'theme'], ['.dir-btn', 'dir'], ['.format-btn', 'format']]) {
      const value = field === 'dir' ? this.cardConfig.direction : this.cardConfig[field];
      document.querySelectorAll(selector).forEach(button => {
        const active = button.dataset[field] === value;
        button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
      });
    }
    this.scaleCardPreview();
  }

  scaleCardPreview() {
    if (!this.cardModel) return;
    const stage = document.getElementById('card-preview-stage');
    const available = stage.getBoundingClientRect().width;
    document.getElementById('xuan-card').style.transform = `scale(${available ? available / this.cardModel.width : 1})`;
  }

  /**
   * 导出诗牌为 PNG 高清图片
   */
  async exportCardAsImage() {
    const cardEl = document.getElementById('xuan-card');
    if (!cardEl) return;

    if (this.currentPoemLines.length === 0) {
      alert("请先在'自由集句'页面组装诗句！");
      return;
    }

    const exportBtn = document.getElementById('btn-export-image');
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = '<span class="icon">⏳</span> 渲染中...';
    exportBtn.disabled = true;
    const snapshot = this.cardModel;
    const status = document.getElementById('card-export-state');
    status.textContent = '正在准备字体与高清纸笺…';

    try {
      await prepareCardFont(snapshot.font);
      await document.fonts.ready;
      const canvas = await renderCardCanvas(snapshot, 3);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('图片编码失败')), 'image/png'));
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.download = `诗牌_${snapshot.title.replace(/[\\/:*?"<>|]/g, '_')}_${Date.now()}.png`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = `已导出 ${canvas.width} × ${canvas.height} PNG。`;
    } catch (err) {
      console.error('导出失败:', err);
      status.textContent = '导出失败，请重试或检查浏览器设置。';
    } finally {
      exportBtn.innerHTML = originalText;
      exportBtn.disabled = this.currentPoemLines.length === 0 || document.getElementById('card-preview-stage').getAttribute('aria-busy')==='true';
    }
  }

  // ==================== 5. 平水韵介绍交互 ====================
  bindPingshuiGuideEvents() {
    const catBtns = document.querySelectorAll('.rhyme-cat-btn');
    const shangpingGrid = document.getElementById('rhyme-grid-shangping');
    const xiapingGrid = document.getElementById('rhyme-grid-xiaping');

    catBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        catBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const cat = btn.getAttribute('data-rhyme-cat');
        if (cat === 'shangping') {
          shangpingGrid.classList.remove('hidden');
          xiapingGrid.classList.add('hidden');
        } else {
          shangpingGrid.classList.add('hidden');
          xiapingGrid.classList.remove('hidden');
        }
      });
    });
  }
}

// 由 bootstrap.js 在异步语料加载完成后启动。
