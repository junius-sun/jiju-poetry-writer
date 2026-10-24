/**
 * 古诗集句工程 - 近体诗格律校验与智能推荐引擎 (MetricalEngine)
 * 五/七言平韵绝句的严格模式：基本句式、孤平（允许本句自救）、三平尾、同韵与集句来源。
 * 校验基于语料的平仄/韵部标注，不处理首句借韵、其他特殊拗救或多音字语境消歧。
 */

import { poemSourceKey } from '../data/source_helpers.js';
import { PING_RHYME_GROUPS } from './rhymes.js';

const PING_RHYMES = new Set(PING_RHYME_GROUPS.map(group => group.id));

export class MetricalEngine {
  constructor(database = []) {
    this.database = database;
  }

  /**
   * 标识有条件可变的位置；完整判定还须避免孤平和三平尾 (1-indexed)。
   */
  isFlexiblePosition(index, totalLength) {
    if (totalLength === 5) {
      return index === 1 || index === 3;
    } else if (totalLength === 7) {
      return index === 1 || index === 3 || index === 5;
    }
    return false;
  }

  /**
   * 严格校验平仄格式是否符合近体诗标准 (二四六分明)
   */
  getPatternErrors(actualPattern, expectedPattern) {
    if (typeof actualPattern !== 'string' || typeof expectedPattern !== 'string' ||
        ![5, 7].includes(actualPattern.length) || actualPattern.length !== expectedPattern.length ||
        !/^[01]+$/.test(actualPattern) || !/^[01]+$/.test(expectedPattern)) {
      return [{ code: 'PATTERN_DATA', message: '平仄标注缺失、长度不符或含未知声调。' }];
    }

    const errors = [];
    const len = actualPattern.length;
    const wrongPositions = [];
    for (let i = 0; i < len; i++) {
      const pos1Indexed = i + 1;
      const isFlexible = this.isFlexiblePosition(pos1Indexed, len);

      if (!isFlexible && actualPattern[i] !== expectedPattern[i]) {
        wrongPositions.push(pos1Indexed);
      }
    }
    if (wrongPositions.length) {
      errors.push({ code: 'PATTERN_MISMATCH', message: `第 ${wrongPositions.join('、')} 字平仄不符，应符合 ${expectedPattern}（1 为平，0 为仄）。` });
    }
    // 五言仄平仄仄平 / 七言末五字仄平仄仄平犯孤平；第三/第五字改平后的本句自救允许通过。
    if (actualPattern.slice(-5) === '01001') {
      errors.push({ code: 'LONE_PING', message: '犯孤平，请替换诗句或选择已完成本句自救的句子。' });
    }
    if (actualPattern.endsWith('111')) {
      errors.push({ code: 'THREE_PING', message: '句尾连续三个平声，犯三平尾。' });
    }
    return errors;
  }

  isPatternStrictlyValid(actualPattern, expectedPattern) {
    return this.getPatternErrors(actualPattern, expectedPattern).length === 0;
  }

  isKnownPingRhyme(group) {
    return PING_RHYMES.has(group);
  }

  sourceKey(item) {
    return poemSourceKey(item);
  }

  getLineErrors(item, targetLength, expectedPattern) {
    if (!item || typeof item.content !== 'string') {
      return [{ code: 'LINE_DATA', message: '诗句数据缺失。' }];
    }
    const errors = [];
    if (item.quality_flags?.includes('TONE_UNKNOWN')) {
      errors.push({ code: 'TONE_UNKNOWN', message: '古音存在字典未收录的字，不能严格判定此句，请另选或核对。' });
    }
    if (item.quality_flags?.includes('SOURCE_CONFLICT')) {
      errors.push({ code: 'SOURCE_CONFLICT', message: '此句出处与上游原文存在署名冲突，核实前不可选用。' });
    }
    if ((item.source && item.source.status !== 'matched') ||
        item.quality_flags?.some(flag => ['SOURCE_AMBIGUOUS', 'SOURCE_UNVERIFIED'].includes(flag))) {
      errors.push({ code: 'SOURCE_UNVERIFIED', message: '此句主出处尚未核对，暂不参与选句，请另选一句。' });
    }
    if (['prose', 'fu'].includes(item.source?.genre)) {
      errors.push({ code: 'NON_POETIC', message: '此条属于古文或赋的切句，不作为近体诗集句候选。' });
    }
    if (item.length !== targetLength || Array.from(item.content).length !== targetLength) {
      errors.push({ code: 'LINE_LENGTH', message: `必须选择 ${targetLength} 言诗句，不能混用不同字数。` });
    }
    if (!item.id || typeof item.author !== 'string' || !item.author.trim() ||
        typeof item.title !== 'string' || !item.title.trim()) {
      errors.push({ code: 'SOURCE_DATA', message: '诗句编号或作者、篇名缺失，无法确认出处。' });
    }
    const pattern = item.ping_ze_pattern;
    if (typeof pattern !== 'string' || pattern.length !== targetLength || !/^[01]+$/.test(pattern)) {
      errors.push({ code: 'PATTERN_DATA', message: '平仄标注缺失、长度不符或含未知声调。' });
    } else {
      const tone = pattern.endsWith('1') ? '平' : '仄';
      if (item.end_tone !== tone) {
        errors.push({ code: 'END_TONE', message: '尾字声调与平仄标注矛盾。' });
      }
      if (expectedPattern) errors.push(...this.getPatternErrors(pattern, expectedPattern));
      if (tone === '平' && !this.isKnownPingRhyme(item.rhyme_group)) {
        errors.push({ code: 'UNKNOWN_RHYME', message: '平声韵部未明确，不能以“通用韵”判定押韵。' });
      }
      if (tone === '仄' && item.rhyme_group !== '仄声') {
        errors.push({ code: 'RHYME_DATA', message: '仄声尾字的韵部标注不一致。' });
      }
    }
    return errors;
  }

  /** 完整诗或创作中的前缀共用此校验；通关只接受完整且无错误的结果。 */
  validatePoem(lines = [], options = {}) {
    const errors = [];
    const add = (code, message, index) => errors.push({ code, message, index });
    if (!Array.isArray(lines)) {
      return { isValid: false, complete: false, errors: [{ code: 'LINE_DATA', message: '诗句列表无效。' }] };
    }
    const length = options.length ?? lines[0]?.length ?? 5;
    const complete = lines.length === 4;
    if (![5, 7].includes(length)) add('POEM_LENGTH', '仅支持五言或七言绝句。');
    if (lines.length > 4 || (options.requireComplete !== false && !complete)) {
      add('LINE_COUNT', '绝句须恰好四句。');
    }
    const patterns = this.getStandardQuatrainPatterns(lines[0]);
    const ids = new Set(), contents = new Set(), sources = new Set();
    let requiredRhyme = options.targetRhyme || null;
    if (requiredRhyme && !this.isKnownPingRhyme(requiredRhyme)) {
      add('UNKNOWN_RHYME', '目标韵部必须是明确的平水韵平声韵部。');
    }
    for (const [index, item] of lines.entries()) {
      this.getLineErrors(item, length, patterns[index]).forEach(error => add(error.code, error.message, index));
      if (!item || typeof item.content !== 'string') continue;
      if (ids.has(item.id) || contents.has(item.content)) add('DUPLICATE_LINE', '不能重复选用同一句诗。', index);
      ids.add(item.id); contents.add(item.content);
      const source = this.sourceKey(item);
      if (sources.has(source)) add('DUPLICATE_SOURCE', '本项目要求四句分别出自不同原诗，请另选篇目。', index);
      sources.add(source);
      if (options.singleAuthorMode && item.author !== lines[0]?.author) {
        add('AUTHOR_MISMATCH', '集杜模式须与首句出自同一位作者。', index);
      }
      const isRhymeLine = index === 1 || index === 3 || (index === 0 && item.end_tone === '平');
      if (isRhymeLine) {
        if (item.end_tone !== '平') add('RHYME_TONE', '入韵句必须以平声收尾。', index);
        if (this.isKnownPingRhyme(item.rhyme_group)) {
          if (requiredRhyme && item.rhyme_group !== requiredRhyme) {
            add('RHYME_MISMATCH', `入韵句须同押《${requiredRhyme}》，当前为《${item.rhyme_group}》。`, index);
          }
          requiredRhyme ||= item.rhyme_group;
        }
      }
    }
    return { isValid: errors.length === 0, complete, errors };
  }

  /**
   * 判定诗句能否作为五/七言平韵绝句的首句。
   */
  isValidQuatrainStarterLine(item, targetLength = 5) {
    const expected = this.getStandardQuatrainPatterns(item)[0];
    return [5, 7].includes(targetLength) && !!expected && this.getLineErrors(item, targetLength, expected).length === 0;
  }

  /**
   * 计算两条平仄序列的契合度分数 (0~100)
   */
  calculatePatternMatchScore(actualPattern, expectedPattern) {
    if (!actualPattern || !expectedPattern || actualPattern.length !== expectedPattern.length) {
      return 0;
    }

    const len = actualPattern.length;
    let score = 0;
    let maxPossibleScore = 0;

    for (let i = 0; i < len; i++) {
      const pos1Indexed = i + 1;
      const isFlexible = this.isFlexiblePosition(pos1Indexed, len);
      const weight = isFlexible ? 1 : 4;
      maxPossibleScore += weight;

      if (actualPattern[i] === expectedPattern[i]) {
        score += weight;
      } else if (isFlexible) {
        score += weight * 0.6;
      }
    }

    return Math.round((score / maxPossibleScore) * 100);
  }

  /**
   * 推算整首诗标准近体诗绝句平仄格式 (4句)
   */
  getStandardQuatrainPatterns(firstLine) {
    if (!firstLine || ![5, 7].includes(firstLine.length) ||
        typeof firstLine.ping_ze_pattern !== 'string' ||
        firstLine.ping_ze_pattern.length !== firstLine.length ||
        !/^[01]+$/.test(firstLine.ping_ze_pattern)) return [];
    const len = firstLine.length;
    const p = firstLine.ping_ze_pattern;
    const isFirstLineRhyme = firstLine.end_tone === "平";
    const secondCharTone = p[1]; // 第 2 字平仄

    let patterns = [];

    if (len === 5) {
      if (secondCharTone === "0") { // 仄起
        patterns = isFirstLineRhyme
          ? ["00011", "11001", "11100", "00011"]
          : ["00110", "11001", "11100", "00011"];
      } else { // 平起
        patterns = isFirstLineRhyme
          ? ["11001", "00011", "00110", "11001"]
          : ["11100", "00011", "00110", "11001"];
      }
    } else if (len === 7) {
      if (secondCharTone === "0") { // 仄起
        patterns = isFirstLineRhyme
          ? ["0011001", "1100011", "1100110", "0011001"]
          : ["0011100", "1100011", "1100110", "0011001"];
      } else { // 平起
        patterns = isFirstLineRhyme
          ? ["1100011", "0011001", "0011100", "1100011"]
          : ["1100110", "0011001", "0011100", "1100011"];
      }
    }

    return patterns;
  }

  /** 为推荐和搜索预先计算相同的硬性约束，避免逐条重复校验整个前缀。 */
  createCandidateFilter(currentLines, targetLength, options = {}) {
    if (!this.validatePoem(currentLines, { ...options, length: targetLength, requireComplete: false }).isValid ||
        currentLines.length >= 4) return () => false;
    const index = currentLines.length;
    const expected = this.getStandardQuatrainPatterns(currentLines[0])[index];
    const ids = new Set(currentLines.map(line => line.id));
    const contents = new Set(currentLines.map(line => line.content));
    const sources = new Set(currentLines.map(line => this.sourceKey(line)));
    const usedChars = new Set(currentLines.flatMap(line => Array.from(line.content)));
    const author = options.singleAuthorMode ? currentLines[0]?.author : null;
    const rhyme = options.targetRhyme || currentLines.find(line => line.end_tone === '平')?.rhyme_group;
    return item => {
      if (!item || item.length !== targetLength || ids.has(item.id) || contents.has(item.content)) return false;
      if (author && item.author !== author) return false;
      if (sources.has(this.sourceKey(item))) return false;
      if (options.avoidCharOverlap && Array.from(item.content || '').some(char => usedChars.has(char))) return false;
      const pattern = index === 0 ? this.getStandardQuatrainPatterns(item)[0] : expected;
      if (!pattern || this.getLineErrors(item, targetLength, pattern).length) return false;
      if (index === 1 || index === 3 || (index === 0 && item.end_tone === '平')) {
        if (item.end_tone !== '平' || (rhyme && item.rhyme_group !== rhyme)) return false;
      }
      return true;
    };
  }

  /**
   * 推荐候选池：严格合律、明确同韵、不同原诗，并回避重复汉字。
   * 返回按分数降序、同分组内洗牌的候选数组，供「换一批」分页取用。
   * @param {object} options - { singleAuthorMode, targetRhyme, poolLimit }
   */
  getSmartCandidatePool(currentLines = [], targetLength = 5, options = {}) {
    if (!Array.isArray(currentLines) || currentLines.some(line => !line || typeof line.content !== 'string')) return [];
    const isCandidate = this.createCandidateFilter(currentLines, targetLength, { ...options, avoidCharOverlap: true });
    const chosenAuthors = currentLines.map(l => l.author);
    const prevTags = new Set(currentLines.flatMap(l => l.tags || []));
    const expectedPattern = this.getStandardQuatrainPatterns(currentLines[0])[currentLines.length];
    const validCandidates = this.database.filter(isCandidate);

    const scored = validCandidates.map(item => {
      let fitScore = 65;
      if (expectedPattern) {
        fitScore += Math.round(this.calculatePatternMatchScore(item.ping_ze_pattern, expectedPattern) * 0.2);
      } else {
        fitScore = 80;
      }

      const sharedTags = (item.tags || []).filter(t => prevTags.has(t));
      fitScore += sharedTags.length * 10;

      const isNewAuthor = !chosenAuthors.includes(item.author);
      if (isNewAuthor) fitScore += 10;

      return {
        poetry: item,
        score: Math.max(0, Math.min(99, fitScore)
          - (item.source && item.source.status !== 'matched' ? 12 : 0)
          - (item.quality_flags?.includes('TONE_AMBIGUOUS') ? 5 : 0)
          - (item.source?.genre === 'qu' ? 12 : 0)),
        sharedTags,
        isNewAuthor
      };
    });

    scored.sort((a, b) => b.score - a.score);

    // 同分数组内洗牌：避免「换一批」时连号取到同一诗人的相邻诗句，保证每批风格各异
    const shuffled = [];
    let i = 0;
    while (i < scored.length) {
      let j = i;
      while (j < scored.length && scored[j].score === scored[i].score) j++;
      const group = scored.slice(i, j);
      for (let k = group.length - 1; k > 0; k--) {
        const r = Math.floor(Math.random() * (k + 1));
        [group[k], group[r]] = [group[r], group[k]];
      }
      for (const candidate of group) shuffled.push(candidate);
      i = j;
    }

    // 只保留高分候选，避免池过大（默认 500 条 = 100 批）
    const poolLimit = options.poolLimit || 500;
    return shuffled.slice(0, poolLimit);
  }

  /**
   * 取一批推选诗句 (默认 5 句)。options.offset 可用于「换一批」环形取用。
   */
  getSmartFiveRecommendations(currentLines = [], targetLength = 5, count = 5, options = {}) {
    const pool = this.getSmartCandidatePool(currentLines, targetLength, options);
    if (pool.length === 0) return [];

    const offset = options.offset || 0;
    const start = ((offset % pool.length) + pool.length) % pool.length;
    const take = Math.min(count, pool.length);

    const batch = [];
    for (let n = 0; n < take; n++) {
      batch.push(pool[(start + n) % pool.length]);
    }
    return batch;
  }

  /**
   * 通用检索
   */
  getRecommendations(currentLines = [], options = {}) {
    if (!Array.isArray(currentLines) || currentLines.some(line => !line || typeof line.content !== 'string')) return [];
    const targetLength = options.length || (currentLines.length > 0 ? currentLines[0].length : 5);
    const targetIndex = currentLines.length;

    if (targetIndex >= 4) return [];

    const chosenAuthors = currentLines.map(l => l.author);
    const expectedPattern = this.getStandardQuatrainPatterns(currentLines[0])[targetIndex];
    const isCandidate = this.createCandidateFilter(currentLines, targetLength, {
      ...options, avoidCharOverlap: !options.keyword
    });
    const candidates = this.database.filter(item => {
      if (!item || typeof item.content !== 'string') return false;
      if (options.keyword && !item.content.includes(options.keyword) && !(item.tags || []).includes(options.keyword)) {
        return false;
      }
      return isCandidate(item);
    });

    const scored = candidates.map(item => {
      let fitScore = 50;
      if (expectedPattern) {
        fitScore = this.calculatePatternMatchScore(item.ping_ze_pattern, expectedPattern);
      } else {
        fitScore = 80;
      }

      const isNewAuthor = !chosenAuthors.includes(item.author);
      if (isNewAuthor) fitScore += 10;

      return {
        poetry: item,
        score: Math.min(100, fitScore),
        isNewAuthor
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  /**
   * 评估全首集句诗合律度，并提供【格式错误的具体问题】与【针对性指导建议】
   */
  evaluatePoem(lines = [], options = {}) {
    const validation = this.validatePoem(lines, { ...options, requireComplete: true });
    if (Array.isArray(lines) && lines.length < 4) {
      return { ...validation, score: 0, rank: '未完成', report: ['请集满 4 句绝句后再行评估。'] };
    }
    const report = validation.errors.map(error => {
      const position = error.index === undefined ? '' : '第 ' + (error.index + 1) + ' 句：';
      return '❌ 【校验问题】' + position + error.message;
    });
    if (validation.isValid) {
      report.push('✅ 【标注合律】按语料标注，四句平仄、粘对、孤平及三平尾检查通过。');
      report.push('✅ 【押韵合格】入韵句同押《平水韵·' + lines[1].rhyme_group + '》。');
      report.push('✅ 【来源标识】四句按收录的出处标识未重复选句或原诗。');
      if (new Set(lines.map(line => line.author)).size === 4) {
        report.push('🏆 【作者多样】四句分别来自四位作者。');
      }
    }
    const toneReview = Array.isArray(lines) && lines.some(line => line?.quality_flags?.some(flag => ['TONE_AMBIGUOUS', 'RHYME_UNCERTAIN'].includes(flag)));
    const sourceReview = Array.isArray(lines) && lines.some(line => line?.source && line.source.status !== 'matched');
    if (toneReview) report.push('⚠️ 【古音待核】含多读字或多韵字，须结合语境核对；标注合律不代表读音已人工确认。');
    if (sourceReview) report.push('⚠️ 【出处待核】部分句子尚未唯一匹配上游原文与署名，请查看每句的出处说明。');
    // 分数仅表示规则检查结果；硬性错误不能被作者多样性等加分抵消。
    const score = validation.isValid ? 100 : Math.max(0, Math.min(79, 100 - validation.errors.length * 15));
    return { ...validation, score, rank: validation.isValid ? (toneReview || sourceReview ? '标注合律·仍需核对' : '格律检查通过') : '未合律·请调整', report };
  }
}
