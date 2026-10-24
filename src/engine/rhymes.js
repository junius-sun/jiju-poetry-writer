/** Same canonical 平水韵 identifiers used by validation, UI and model requests. */
export const PING_RHYME_GROUPS = Object.freeze([
  ['上平一东', '东 同 风 中'], ['上平二冬', '冬 松 钟 龙'], ['上平三江', '江 窗 双'],
  ['上平四支', '枝 时 诗 思'], ['上平五微', '微 归 衣 飞'], ['上平六鱼', '鱼 书 居 初'],
  ['上平七虞', '湖 孤 无 途'], ['上平八齐', '齐 溪 题 西'], ['上平九佳', '佳 怀 阶 街'],
  ['上平十灰', '来 开 杯 回'], ['上平十一真', '人 春 尘 新'], ['上平十二文', '云 君 闻 分'],
  ['上平十三元', '园 原 门 村'], ['上平十四寒', '寒 安 难 餐'], ['上平十五删', '山 间 关 还'],
  ['下平一先', '天 烟 年 船'], ['下平二萧', '萧 桥 宵 潮'], ['下平三肴', '肴 茅 巢 郊'],
  ['下平四豪', '豪 高 桃 刀'], ['下平五歌', '歌 多 河 波'], ['下平六麻', '花 家 霞 茶'],
  ['下平七阳', '阳 乡 香 长'], ['下平八庚', '庚 清 明 生'], ['下平九青', '青 星 亭 萤'],
  ['下平十蒸', '蒸 灯 僧 冰'], ['下平十一尤', '秋 舟 流 楼'], ['下平十二侵', '心 深 林 音'],
  ['下平十三覃', '覃 潭 南 蓝'], ['下平十四盐', '盐 帘 纤 添'], ['下平十五咸', '咸 衫 岩 帆']
].map(([id, words]) => Object.freeze({ id, words })));

export function planPoemSettings(engine, lines, length, rhyme = '') {
  if (![5, 7].includes(length) || (rhyme && !engine.isKnownPingRhyme(rhyme))) throw new Error('请选择五言或七言，以及有效的平水韵平声韵部。');
  let keepCount = 0;
  for (let i = 1; i <= lines.length; i++) {
    if (!engine.validatePoem(lines.slice(0, i), { length, targetRhyme: rhyme || undefined, requireComplete: false }).isValid) break;
    keepCount = i;
  }
  return { length, rhyme, keepCount, removed: lines.length - keepCount };
}
