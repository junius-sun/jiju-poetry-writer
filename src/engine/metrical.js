/**
 * 古诗集句工程 - 近体诗格律校验与智能推荐引擎 (MetricalEngine)
 * 实现五言绝句/七言绝句的严密平仄校验、平水韵 100% 相同押韵保证、秒级轻量起句与详细格式错误指导。
 */

export class MetricalEngine {
  constructor(database = []) {
    this.database = database;
  }

  /**
   * 判定某个位置是否属于“一三五不论”的容忍位置 (1-indexed)
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
  isPatternStrictlyValid(actualPattern, expectedPattern) {
    if (!actualPattern || !expectedPattern || actualPattern.length !== expectedPattern.length) {
      return false;
    }

    const len = actualPattern.length;
    for (let i = 0; i < len; i++) {
      const pos1Indexed = i + 1;
      const isFlexible = this.isFlexiblePosition(pos1Indexed, len);

      if (!isFlexible && actualPattern[i] !== expectedPattern[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * 极速轻量判定一条诗句是否符合绝句【起句（首句）】格律要求（O(1) 瞬间完成，绝不卡顿）
   */
  isValidQuatrainStarterLine(item, targetLength = 5) {
    if (!item || item.length !== targetLength) return false;
    const p = item.ping_ze_pattern;
    if (!p) return false;

    if (targetLength === 5) {
      const valid5 = ["00110", "00011", "11100", "11001"];
      return valid5.some(exp => this.isPatternStrictlyValid(p, exp));
    } else if (targetLength === 7) {
      const valid7 = ["0011100", "0011001", "1100110", "1100011"];
      return valid7.some(exp => this.isPatternStrictlyValid(p, exp));
    }
    return false;
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

  /**
   * 核心 AI 推荐算法：构建完整候选池 (带单字零重复回避与 100% 押韵保证)
   * 返回按分数降序、同分组内洗牌的候选数组，供「换一批」分页取用。
   * @param {object} options - { singleAuthorMode, poolLimit }
   */
  getSmartCandidatePool(currentLines = [], targetLength = 5, options = {}) {
    const targetIndex = currentLines.length;

    if (targetIndex >= 4) return [];

    const chosenIds = new Set(currentLines.map(l => l.id));
    const chosenAuthors = currentLines.map(l => l.author);
    const prevTags = new Set(currentLines.flatMap(l => l.tags));
    const usedCharsSet = new Set(currentLines.flatMap(l => Array.from(l.content)));

    // 集杜（单家集句）模式：锁定首句作者，后续只推选同一名家之句
    const singleAuthor = (options.singleAuthorMode && currentLines.length > 0)
      ? currentLines[0].author
      : null;

    let expectedPattern = "";
    let requiredRhymeGroup = null;

    if (currentLines.length > 0) {
      const firstLine = currentLines[0];
      const standardPatterns = this.getStandardQuatrainPatterns(firstLine);
      expectedPattern = standardPatterns[targetIndex];

      const rhymingLine = currentLines.find(l => l.end_tone === "平" && l.rhyme_group && l.rhyme_group !== "仄声");
      if (rhymingLine) {
        requiredRhymeGroup = rhymingLine.rhyme_group;
      }
    }

    const validCandidates = this.database.filter(item => {
      if (item.length !== targetLength) return false;
      if (chosenIds.has(item.id)) return false;
      if (singleAuthor && item.author !== singleAuthor) return false;

      // 单字零重复
      const hasCharOverlap = Array.from(item.content).some(char => usedCharsSet.has(char));
      if (hasCharOverlap) return false;

      if (targetIndex === 0) {
        if (!this.isValidQuatrainStarterLine(item, targetLength)) return false;
      }

      if (targetIndex === 1) {
        if (item.end_tone !== "平" || !item.rhyme_group || item.rhyme_group === "仄声") return false;
        if (requiredRhymeGroup && item.rhyme_group !== requiredRhymeGroup) {
          return false;
        }
      }

      if (targetIndex === 2) {
        if (item.end_tone !== "仄") return false;
      }

      if (targetIndex === 3) {
        if (item.end_tone !== "平") return false;
        if (!requiredRhymeGroup || item.rhyme_group !== requiredRhymeGroup) {
          return false;
        }
      }

      if (expectedPattern && !singleAuthor) {
        if (!this.isPatternStrictlyValid(item.ping_ze_pattern, expectedPattern)) {
          return false;
        }
      }

      return true;
    });

    const scored = validCandidates.map(item => {
      let fitScore = 65;
      if (expectedPattern) {
        fitScore += Math.round(this.calculatePatternMatchScore(item.ping_ze_pattern, expectedPattern) * 0.2);
      } else {
        fitScore = 80;
      }

      const sharedTags = item.tags.filter(t => prevTags.has(t));
      fitScore += sharedTags.length * 10;

      const isNewAuthor = !chosenAuthors.includes(item.author);
      if (isNewAuthor) fitScore += 10;

      return {
        poetry: item,
        score: Math.min(99, fitScore),
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
      shuffled.push(...group);
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
    const targetLength = options.length || (currentLines.length > 0 ? currentLines[0].length : 5);
    const targetIndex = currentLines.length;

    if (targetIndex >= 4) return [];

    const chosenIds = new Set(currentLines.map(l => l.id));
    const chosenAuthors = currentLines.map(l => l.author);
    const usedCharsSet = new Set(currentLines.flatMap(l => Array.from(l.content)));

    // 集杜（单家集句）模式：锁定首句作者，后续只推选同一名家之句
    const singleAuthor = (options.singleAuthorMode && currentLines.length > 0)
      ? currentLines[0].author
      : null;

    let expectedPattern = "";
    let requiredRhymeGroup = null;

    if (currentLines.length > 0) {
      const firstLine = currentLines[0];
      const standardPatterns = this.getStandardQuatrainPatterns(firstLine);
      expectedPattern = standardPatterns[targetIndex];

      const rhymingLine = currentLines.find(l => l.end_tone === "平" && l.rhyme_group && l.rhyme_group !== "仄声");
      if (rhymingLine) {
        requiredRhymeGroup = rhymingLine.rhyme_group;
      }
    }

    const candidates = this.database.filter(item => {
      if (item.length !== targetLength) return false;
      if (chosenIds.has(item.id)) return false;
      if (singleAuthor && item.author !== singleAuthor) return false;

      if (!options.keyword) {
        const hasCharOverlap = Array.from(item.content).some(char => usedCharsSet.has(char));
        if (hasCharOverlap) return false;
      }

      if (options.keyword && !item.content.includes(options.keyword) && !item.tags.includes(options.keyword)) {
        return false;
      }

      if (targetIndex === 1 || targetIndex === 3) {
        if (item.end_tone !== "平") return false;
        if (requiredRhymeGroup && item.rhyme_group !== requiredRhymeGroup) {
          return false;
        }
      }

      if (targetIndex === 2) {
        if (item.end_tone !== "仄") return false;
      }

      return true;
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
        score: fitScore,
        isNewAuthor
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  /**
   * 评估全首集句诗合律度，并提供【格式错误的具体问题】与【针对性指导建议】
   */
  evaluatePoem(lines = []) {
    if (lines.length !== 4) {
      return { score: 0, rank: "未完成", report: ["请集满 4 句绝句后再行评估。"] };
    }

    const report = [];
    let score = 100;
    const firstLine = lines[0];
    const standardPatterns = this.getStandardQuatrainPatterns(firstLine);

    // 1. 逐句平仄格律诊断
    lines.forEach((line, idx) => {
      const exp = standardPatterns[idx];
      const matchScore = this.calculatePatternMatchScore(line.ping_ze_pattern, exp);
      if (matchScore < 80) {
        score -= (100 - matchScore) * 0.25;
        report.push(`❌ 【格式问题】第 ${idx + 1} 句《${line.title}》（${line.content}）关键字平仄失律。` + 
                    `💡 【修改指导】建议替换该句，使二四六位置平仄严格对齐格式建议 ${exp}。`);
      } else {
        report.push(`✅ 【格式合律】第 ${idx + 1} 句平仄二四六分明，切合律调。`);
      }
    });

    // 2. 粘对与押韵诊断
    const line2 = lines[1];
    const line3 = lines[2];
    const line4 = lines[3];

    // 粘律诊断 (第2句第2字与第3句第2字平仄须相同)
    if (line2.ping_ze_pattern[1] !== line3.ping_ze_pattern[1]) {
      score -= 15;
      report.push(`⚠️ 【格式问题】第 3 句犯失粘！第 2 句第2字为[${line2.ping_ze_pattern[1] === '1' ? '平' : '仄'}]，而第 3 句第2字为[${line3.ping_ze_pattern[1] === '1' ? '平' : '仄'}]。` + 
                  `💡 【修改指导】遵循“联间相粘”，建议挑选第 2 字平仄与第 2 句一致的出句。`);
    }

    // 押韵诊断 (偶数句 2, 4 必须同韵部平声)
    if (line2.end_tone !== "平" || line4.end_tone !== "平") {
      score -= 30;
      report.push("❌ 【格式大忌】偶数句（第 2 句或第 4 句）尾字未全押平声韵，违背近体诗绝句押韵基本规则！" + 
                  "💡 【修改指导】请确保第 2 句与第 4 句尾字均为平声字。");
    } else if (line2.rhyme_group !== line4.rhyme_group) {
      score -= 25;
      report.push(`❌ 【格式问题】押韵出韵！第 2 句属于《${line2.rhyme_group}》，而第 4 句属于《${line4.rhyme_group}》。` + 
                  `💡 【修改指导】请点击右侧推选，锁定选择《${line2.rhyme_group}》同韵部的尾句。`);
    } else {
      report.push(`🎉 【押韵完美】偶数句严合《平水韵·${line2.rhyme_group}》，协同铿锵！`);
    }

    // 3. 作者多样性诊断
    const authorsSet = new Set(lines.map(l => l.author));
    if (authorsSet.size === 4) {
      score += 5;
      report.push("🏆 【名家荟萃】4 句诗完全出自 4 位不同唐宋大家！");
    }

    // 4. 同源（集句铁律）诊断：每句须出自不同原诗，不可从同一首诗中摘取多句
    const sourceKeys = lines.map(l => `${l.author}《${l.title}》`);
    const uniqueSources = new Set(sourceKeys);
    const dupCount = lines.length - uniqueSources.size;
    if (dupCount > 0) {
      score -= Math.min(30, dupCount * 10);
      report.push(`⚠️ 【集句铁律】检测到 ${dupCount} 句取自同一首原诗！集句须"断句取用、各出不同诗篇"，请从其他作品另选，方成"浑然天成"之境。`);
    } else {
      report.push("✅ 【来源合规】四句分别出自不同原诗，严守集句「断句取用」之本。");
    }

    score = Math.min(100, Math.max(0, Math.round(score)));

    let rank = "丙等·初步成诗";
    if (score >= 95) rank = "甲等·浑然天成";
    else if (score >= 85) rank = "乙等·格律严整";

    return { score, rank, report };
  }
}
