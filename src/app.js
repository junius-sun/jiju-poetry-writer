/**
 * 古诗集句工程 - 主应用逻辑 (App.js)
 */

import { POETRY_DATABASE } from './data/poetry_db.js';
import { MetricalEngine } from './engine/metrical.js';

class JijuPoetryApp {
  constructor() {
    this.engine = new MetricalEngine(POETRY_DATABASE);
    
    // 应用状态
    this.currentLength = 5; // 5言 或 7言
    this.currentPoemLines = []; // 已选择的诗句数组 (最多4条)
    this.activeLevel = null; // 当前正在挑战的飞花关卡 (null = 自由创作)

    // AI 智能推选「换一批」状态
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
      author: '今人集句',
      theme: 'xuan',
      direction: 'vertical',
      style: 'classic',
      font: 'mashanzheng'
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
    this.bindNavigation();
    this.bindAssemblyEvents();
    this.bindCardEvents();
    this.bindPingshuiGuideEvents();
    this.renderPuzzleLevels();
    this.updateSlotsDisplay();
  }

  // ==================== 1. Tab 导航逻辑 ====================
  bindNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const targetTab = tab.getAttribute('data-tab');
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        const activeContent = document.getElementById(`tab-${targetTab}`);
        if (activeContent) activeContent.classList.add('active');

        if (targetTab === 'card') {
          this.updateCardPreview();
        }
      });
    });
  }

  // ==================== 2. 自由集句及 AI 5句推选逻辑 ====================
  bindAssemblyEvents() {
    // 字数切换 (五言/七言)
    const toggleBtns = document.querySelectorAll('.length-selector .btn-toggle');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        toggleBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const newLen = parseInt(btn.getAttribute('data-length'), 10);
        if (newLen !== this.currentLength) {
          this.currentLength = newLen;
          this.currentPoemLines = []; // 切换字数清空诗架
          this.activeLevel = null; // 手动切换诗体视为退出当前关卡
          this.renderActiveLevelBanner();
          this.updateSlotsDisplay();
        }
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
    const validStarters = POETRY_DATABASE.filter(item => {
      return this.engine.isValidQuatrainStarterLine(item, this.currentLength);
    });
    
    if (validStarters.length === 0) return;

    const randomIndex = Math.floor(Math.random() * validStarters.length);
    const starter = validStarters[randomIndex];

    this.currentPoemLines = [starter];
    this.updateSlotsDisplay();
  }

  selectCandidateLine(poetryItem) {
    if (this.currentPoemLines.length >= 4) return;

    this.currentPoemLines.push(poetryItem);
    this.updateSlotsDisplay();
  }

  removeLineAt(index) {
    this.currentPoemLines.splice(index, 1);
    this.updateSlotsDisplay();
  }

  updateSlotsDisplay() {
    const slots = document.querySelectorAll('#quatrain-slots .line-slot');
    
    slots.forEach((slot, index) => {
      const lineData = this.currentPoemLines[index];
      slot.className = 'line-slot';

      if (index === this.currentPoemLines.length && index < 4) {
        slot.classList.add('active-target');
      }

      if (lineData) {
        slot.classList.add('filled');
        slot.innerHTML = `
          <div class="slot-number">第 ${index + 1} 句</div>
          <div class="slot-main">
            <div class="slot-content-display">
              <div class="verse-text">${lineData.content}</div>
              <div class="verse-meta">
                <span class="verse-author">【${lineData.dynasty}】${lineData.author} · 《${lineData.title}》</span>
                <span>韵部: ${lineData.rhyme_group}</span>
              </div>
            </div>
          </div>
          <div class="slot-badge ${lineData.end_tone === '平' ? 'rhyme' : ''}">
            ${lineData.end_tone === '平' ? '押韵' : '出句'}
          </div>
          <button class="btn-remove-line" data-remove-index="${index}">✕</button>
        `;
      } else {
        slot.classList.add('empty');
        let hintText = "在右侧搜寻或智能推选选择此句...";
        if (index === 0) hintText = "请在右侧搜索或点击【随机起句】选择首句...";
        else if (index === 1) hintText = "选择第二句（对句·需押韵）...";
        else if (index === 2) hintText = "选择第三句（出句·需相粘）...";
        else if (index === 3) hintText = "选择第四句（尾句·需押韵）...";

        slot.innerHTML = `
          <div class="slot-number">第 ${index + 1} 句</div>
          <div class="slot-main">
            <div class="slot-text-placeholder">${hintText}</div>
          </div>
          <div class="slot-badge">未选</div>
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
  }

  /**
   * 取当前诗架状态对应的候选池（带缓存：诗架不变则复用，保证「换一批」翻页稳定不重复）
   */
  getSmartPool() {
    const key = [
      this.currentLength,
      this.isSingleAuthorMode() ? 'single' : 'multi',
      this.currentPoemLines.map(l => l.id).join(',')
    ].join('|');

    if (key !== this._smartPoolKey) {
      this._smartPoolKey = key;
      this._smartPool = this.engine.getSmartCandidatePool(
        this.currentPoemLines,
        this.currentLength,
        { singleAuthorMode: this.isSingleAuthorMode(), poolLimit: 500 }
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
   * AI 智能绝句推选 5 句 (第一句不显示推荐，仅在已选好首句后显示后续推荐)
   */
  renderSmartFiveRecommendations() {
    const section = document.getElementById('smart-recommendation-section');
    const placeholder = document.getElementById('smart-placeholder');
    const gridContainer = document.getElementById('smart-five-grid');
    const tipEl = document.getElementById('smart-step-tip');

    const targetIndex = this.currentPoemLines.length;

    // 第一句 (targetIndex === 0) 或 集满4句 (targetIndex >= 4) 时，隐藏推荐区域，显示空状态提示！
    if (targetIndex === 0 || targetIndex >= 4) {
      if (section) section.classList.add('hidden');
      if (placeholder) placeholder.classList.remove('hidden');
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

    if (targetIndex === 1 || targetIndex === 3) {
      const rhymingLine = this.currentPoemLines.find(l => l.end_tone === '平' && l.rhyme_group !== '仄声');
      const rhymeName = rhymingLine ? rhymingLine.rhyme_group : (smartFive[0] ? smartFive[0].poetry.rhyme_group : '');
      tipEl.textContent = `推选第 ${targetIndex + 1} 句 (100% 押韵·《${rhymeName}》)`;
    } else {
      tipEl.textContent = `推选第 3 句 (出句·严合粘律·5句)`;
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
        <div class="smart-card" data-id="${p.id}">
          <div class="smart-card-left">
            <div class="smart-card-text">${p.content}</div>
            <div class="smart-card-meta">
              <span>【${p.dynasty}】${p.author}</span>
              <span>《${p.title}》</span>
              <span>韵部: ${p.rhyme_group}</span>
            </div>
          </div>
          <div class="smart-card-right">
            <span class="smart-score-pill">${item.score}分</span>
            <span class="smart-action-text">选此句 ➔</span>
          </div>
        </div>
      `;
    });

    gridContainer.innerHTML = html;

    gridContainer.querySelectorAll('.smart-card').forEach(card => {
      card.addEventListener('click', () => {
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
      matrixContainer.innerHTML = `<div class="matrix-empty">填写诗句后将实时呈现平仄对粘与平水韵契合矩阵</div>`;
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

        pillsHtml += `<span class="tone-pill ${pillClass}" title="${isFlex ? '一三五不论位置' : ''}">${charTag}</span>`;
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
      const result = this.engine.evaluatePoem(this.currentPoemLines);

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
      document.getElementById('eval-score').textContent = `得分: ${result.score} 分`;

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
    const candidateListContainer = document.getElementById('candidate-list');
    const candidateCountPill = document.getElementById('candidate-count');
    const drawerDesc = document.getElementById('drawer-desc');

    if (this.searchExecutedMode === null) {
      candidateCountPill.textContent = '0 条';
      drawerDesc.textContent = '在下方输入框中搜索诗句、意象或诗人名';
      candidateListContainer.innerHTML = `
        <div class="search-placeholder">
          <span class="icon" style="font-size:1.8rem; display:block; margin-bottom:6px;">💡</span>
          平时默认不展出搜索列表。<br>
          请在下方输入 <b>至少 2 个字</b>，然后点击 <b>【搜索】</b> 按钮展开对应原诗或诗句。
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

      const poetMatches = POETRY_DATABASE.filter(item => {
        const base = item.author.includes(this.poetKeyword) || item.title.includes(this.poetKeyword);
        return lockAuthor ? (base && item.author === lockAuthor) : base;
      });

      const poemGroups = new Map();
      poetMatches.forEach(item => {
        if (!poemGroups.has(item.title)) {
          poemGroups.set(item.title, []);
        }
        poemGroups.get(item.title).push(item);
      });

      candidateCountPill.textContent = `${poemGroups.size} 首名作 (${poetMatches.length}句)`;
      drawerDesc.textContent = `“${this.poetKeyword}”关联古诗列表 (点击诗名展开全诗)`;

      if (poemGroups.size === 0) {
        candidateListContainer.innerHTML = `<div class="matrix-empty">未找到包含“${this.poetKeyword}”的诗人或诗名，尝试搜索: 王维、王安石、李白、静夜思、山居秋暝、泊船瓜洲...</div>`;
        return;
      }

      let html = '';
      poemGroups.forEach((lines, title) => {
        const first = lines[0];
        html += `
          <div class="poet-poem-card collapsed">
            <div class="poem-title-header">
              <div class="poem-title-main">
                <span class="poem-title-text">《${title}》</span>
                <span class="poem-author-tag">【${first.dynasty}】${first.author}</span>
              </div>
              <span class="poem-toggle-badge">▼ 展开全诗 (${lines.length}句)</span>
            </div>
            <div class="poem-lines-group">
              ${lines.map(line => `
                <div class="poem-line-btn" data-id="${line.id}">
                  <span class="poem-line-text">${line.content}</span>
                  <span class="poem-line-action">选用此句 ➔</span>
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
          if (isExpanded) {
            card.classList.remove('expanded');
            card.classList.add('collapsed');
            badge.textContent = `▼ 展开全诗 (${linesCount}句)`;
          } else {
            card.classList.remove('collapsed');
            card.classList.add('expanded');
            badge.textContent = `▲ 收起全诗`;
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
        singleAuthorMode: this.isSingleAuthorMode()
      };

      const recommendations = this.engine.getRecommendations(this.currentPoemLines, options);

      candidateCountPill.textContent = `${recommendations.length} 条`;
      drawerDesc.textContent = `包含“${this.verseKeyword}”的 ${this.currentLength} 言检索结果 (按平仄打分)`;

      if (recommendations.length === 0) {
        candidateListContainer.innerHTML = `<div class="matrix-empty">暂无包含“${this.verseKeyword}”的 ${this.currentLength} 言诗句，请尝试其他关键词。</div>`;
        return;
      }

      let listHtml = '';
      recommendations.forEach(item => {
        const p = item.poetry;
        listHtml += `
          <div class="candidate-card" data-id="${p.id}">
            <div class="cand-info">
              <div class="cand-text">${p.content}</div>
              <div class="cand-meta">
                <span class="cand-author">【${p.dynasty}】${p.author}</span>
                <span>《${p.title}》</span>
                <span>韵部: ${p.rhyme_group}</span>
              </div>
            </div>
            <div class="cand-score-badge">
              <span class="score-num">${item.score}分</span>
              <span class="score-label">${item.isNewAuthor ? '避重名家' : '匹配'}</span>
            </div>
          </div>
        `;
      });

      candidateListContainer.innerHTML = listHtml;

      candidateListContainer.querySelectorAll('.candidate-card').forEach(card => {
        card.addEventListener('click', () => {
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
    this.currentLength = level.length;
    this.currentPoemLines = [];

    document.querySelectorAll('.length-selector .btn-toggle').forEach(b => {
      b.classList.toggle('active', parseInt(b.getAttribute('data-length'), 10) === level.length);
    });

    document.querySelector('.nav-tab[data-tab="assembly"]').click();
    this.renderActiveLevelBanner();
    this.updateSlotsDisplay();
  }

  exitPuzzleLevel() {
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
    if (!level || lines.length !== 4) return null;

    const results = [];
    let passed = true;

    // 1. 目标韵部：第 2、4 句必须同押目标韵部的平声韵
    if (level.targetRhyme) {
      const ok = lines[1].end_tone === '平' && lines[3].end_tone === '平'
        && lines[1].rhyme_group === level.targetRhyme
        && lines[3].rhyme_group === level.targetRhyme;
      if (!ok) passed = false;
      results.push({ ok, text: `韵部目标：第二、四句同押《${level.targetRhyme}》平声韵` });
    }

    // 2. 意象目标：全诗（内容或标签）至少命中一个限定意象
    if (level.requiredTags && level.requiredTags.length > 0) {
      const haystack = lines.map(l => l.content + (l.tags || []).join('')).join('');
      const hit = level.requiredTags.find(t => haystack.includes(t));
      const ok = Boolean(hit);
      if (!ok) passed = false;
      results.push({
        ok,
        text: `意象目标：包含「${level.requiredTags.join(' / ')}」之一${ok ? `（已命中「${hit}」）` : ''}`
      });
    }

    // 3. 名家目标：N 句出自 N 位不同名家
    if (level.requireUniqueAuthors) {
      const authorCount = new Set(lines.map(l => l.author)).size;
      const ok = authorCount >= level.requireUniqueAuthors;
      if (!ok) passed = false;
      results.push({
        ok,
        text: `名家目标：${level.requireUniqueAuthors} 句出自 ${level.requireUniqueAuthors} 位不同名家（当前 ${authorCount} 位）`
      });
    }

    // 4. 集杜目标：四句同出一位名家（可取自其不同诗篇）
    if (level.requireSingleAuthor) {
      const authors = lines.map(l => l.author);
      const ok = authors.length === 4 && authors.every(a => a === authors[0]);
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
  bindCardEvents() {
    document.getElementById('card-title-input').addEventListener('input', (e) => {
      this.cardConfig.title = e.target.value || '集句诗';
      this.updateCardPreview();
    });

    document.getElementById('card-author-input').addEventListener('input', (e) => {
      this.cardConfig.author = e.target.value || '今人集';
      this.updateCardPreview();
    });

    // 样式风格选择器
    document.querySelectorAll('.style-picker .style-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.style-picker .style-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.cardConfig.style = btn.getAttribute('data-style');
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

    document.getElementById('btn-copy-poem').addEventListener('click', () => {
      if (this.currentPoemLines.length === 0) {
        alert("请先在'自由集句'页面组装诗句！");
        return;
      }
      const poemText = `《${this.cardConfig.title}》\n[${this.cardConfig.author}]\n\n` +
        this.currentPoemLines.map(l => `${l.content} （【${l.dynasty}】${l.author}《${l.title}》）`).join('\n');
      
      navigator.clipboard.writeText(poemText).then(() => {
        alert("📋 诗句全文与溯源出处已复制到剪贴板！");
      }).catch(() => {
        window.prompt("自动复制失败，请手动复制：", poemText);
      });
    });
  }

  updateCardPreview() {
    const cardElement = document.getElementById('xuan-card');
    const titleEl = document.getElementById('card-poem-title');
    const authorEl = document.getElementById('card-poem-author');
    const bodyEl = document.getElementById('card-poem-body');

    titleEl.textContent = this.cardConfig.title;
    authorEl.textContent = this.cardConfig.author;

    // Build class list: base + theme + direction + style + font
    cardElement.className = [
      'xuan-paper-card',
      `theme-${this.cardConfig.theme}`,
      this.cardConfig.direction,
      `style-${this.cardConfig.style}`,
      `font-${this.cardConfig.font}`
    ].join(' ');

    if (this.currentPoemLines.length === 0) {
      bodyEl.innerHTML = `<div style="font-size:1.1rem; opacity:0.6;">(请先在自由集句页面组装诗句...)</div>`;
      return;
    }

    let linesHtml = '';
    this.currentPoemLines.forEach(line => {
      linesHtml += `
        <div class="card-line-item">
          <div>${line.content}</div>
          <div class="card-line-meta">——【${line.dynasty}】${line.author}</div>
        </div>
      `;
    });

    bodyEl.innerHTML = linesHtml;
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

    try {
      const canvas = await html2canvas(cardEl, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
        logging: false
      });

      const link = document.createElement('a');
      link.download = `诗牌_${this.cardConfig.title}_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('导出失败:', err);
      alert('导出图片失败，请检查浏览器设置后重试。');
    } finally {
      exportBtn.innerHTML = originalText;
      exportBtn.disabled = false;
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

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  window.app = new JijuPoetryApp();
});
