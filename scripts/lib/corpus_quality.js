import { createHash } from 'node:crypto';

export const PROSE_REFERENCE = 'https://www.gushiwen.cn/wenyan/guanzhi.aspx';
// 按作者 + 完整篇名确认文体，不能见到“记”“书”“赋”就删除诗作。
const NON_POETIC = new Map([
  ['司马迁', '五帝本纪赞'], ['司马迁', '项羽本纪赞'], ['司马迁', '伯夷列传'],
  ['司马迁', '屈原列传'], ['司马迁', '报任安书'], ['司马迁', '太史公自序'],
  ['司马迁', '孔子世家赞'], ['司马迁', '外戚世家序'], ['司马迁', '游侠列传序'],
  ['司马迁', '酷吏列传序'], ['司马迁', '货殖列传序'], ['贾谊', '过秦论'],
  ['诸葛亮', '前出师表'], ['诸葛亮', '后出师表'], ['诸葛亮', '出师表'],
  ['李密', '陈情表'], ['陶渊明', '桃花源记'], ['陶渊明', '五柳先生传'],
  ['王羲之', '兰亭集序'], ['王勃', '滕王阁序'], ['李白', '春夜宴从弟桃花园序'],
  ['刘禹锡', '陋室铭'], ['韩愈', '师说'], ['韩愈', '马说'], ['韩愈', '进学解'],
  ['柳宗元', '小石潭记'], ['柳宗元', '始得西山宴游记'], ['柳宗元', '捕蛇者说'],
  ['柳宗元', '种树郭橐驼传'], ['范仲淹', '岳阳楼记'], ['欧阳修', '醉翁亭记'],
  ['欧阳修', '丰乐亭记'], ['欧阳修', '五代史伶官传序'], ['苏舜钦', '沧浪亭记'],
  ['曾巩', '墨池记'], ['苏轼', '石钟山记'], ['苏轼', '记承天寺夜游'],
  ['周敦颐', '爱莲说'], ['王安石', '游褒禅山记'], ['归有光', '项脊轩志'],
  ['袁宏道', '满井游记'], ['袁宏道', '虎丘记'], ['张岱', '湖心亭看雪'],
  ['袁枚', '祭妹文'], ['袁枚', '随园记'], ['龚自珍', '病梅馆记'],
  ['高启', '游灵岩记'], ['黄宗羲', '过云木冰记'], ['王士祯', '红桥游记'],
  ['沈德潜', '游虞山记']
].map(([author, title]) => [JSON.stringify([author, title]), 'prose']));
for (const [author, title] of [['苏轼', '赤壁赋'], ['苏轼', '前赤壁赋'], ['苏轼', '后赤壁赋'],
  ['欧阳修', '秋声赋'], ['曹植', '洛神赋'], ['宋玉', '风赋'], ['宋玉', '高唐赋'],
  ['宋玉', '神女赋'], ['王粲', '登楼赋'], ['张衡', '归田赋'], ['贾谊', '鵩鸟赋'],
  ['贾谊', '吊屈原赋'], ['陆机', '文赋'], ['向秀', '思旧赋'], ['左思', '三都赋'],
  ['谢庄', '月赋'], ['谢惠连', '雪赋'], ['鲍照', '芜城赋'], ['江淹', '别赋'],
  ['庾信', '小园赋']]) NON_POETIC.set(JSON.stringify([author, title]), 'fu');

export function normalizeTitle(title) {
  return String(title || '').replace(/\uFFFD/g, '').replace(/[\s　]+/g, '').replace(/[（(].*?[）)]/g, '');
}

export function normalizeDynasty(dynasty) {
  const value = String(dynasty || '').trim();
  const aliases = { 唐代: '唐', 宋代: '宋', 元代: '元', 明代: '明', 清代: '清', 隋代: '隋', 金代: '金',
    两汉: '汉', 汉代: '汉', 金朝: '金', 北宋: '宋', 南宋: '宋',
    近: '近现代', 近代: '近现代', 现: '现代', 五: '五代', 未知: '未标注' };
  return aliases[value] || value;
}

export function classifyGenre(author, title, dataset) {
  const genre = String(title || '').split(/\s*[\/／]\s*/).map(alias =>
    NON_POETIC.get(JSON.stringify([author, alias.trim()]))).find(Boolean);
  if (genre) return genre;
  if (/^[【\[]?(双调|越调|中吕|南吕|正宫|仙吕|黄钟|商调|般涉调)[】\]]/.test(title)) return 'qu';
  if (/^(满江红|水调歌头|蝶恋花|浣溪沙|临江仙|鹧鸪天|菩萨蛮|江城子|西江月|念奴娇|减字木兰花|玉楼春|点绛唇|鹊桥仙|八声甘州|沁园春|水龙吟|清平乐|虞美人|南乡子|浪淘沙|卜算子|如梦令|声声慢)([·（(]|$)/.test(title)) return 'ci';
  return dataset.includes('全唐诗') || dataset.includes('全宋诗') || dataset.includes('曹操') ? 'poem' : 'unknown';
}

export function splitOriginalText(text) {
  return String(text || '').replace(/[（(][^）)]*[）)]/g, '')
    .split(/[，。！？；：、\n\r\t\s,.!?;:]/u).map(part => part.trim()).filter(Boolean);
}

export function sourceId(author, text) {
  return 'work:' + createHash('sha256').update(JSON.stringify([author, splitOriginalText(text)])).digest('hex').slice(0, 24);
}

/** 简繁对应字合并声调集合；有冲突或多读时不猜读音。 */
export function buildToneIndex(tune, rhyme, simplify = value => value) {
  const index = new Map();
  const get = char => {
    if (!index.has(char)) index.set(char, { tones: new Set(), rhymes: new Set() });
    return index.get(char);
  };
  for (const [char, tone] of Object.entries(tune)) {
    const info = get(simplify(char));
    if (tone === '平') info.tones.add('1');
    else if (tone === '仄') info.tones.add('0');
    else if (tone === '多') { info.tones.add('0'); info.tones.add('1'); }
  }
  for (const [section, groups] of Object.entries(rhyme)) {
    const ping = section.includes('平');
    for (const [name, chars] of Object.entries(groups)) for (const char of chars) {
      const info = get(simplify(char));
      info.tones.add(ping ? '1' : '0');
      if (ping) info.rhymes.add(section.replace('声部', '') + name);
    }
  }
  return index;
}

export function reviewTones(item, index) {
  const flags = new Set();
  const chars = Array.from(item.content);
  const pattern = chars.map((char, position) => {
    const info = index.get(char);
    if (!info?.tones.size) { flags.add('TONE_UNKNOWN'); return item.ping_ze_pattern[position]; }
    if (info.tones.size > 1) { flags.add('TONE_AMBIGUOUS'); return item.ping_ze_pattern[position]; }
    return [...info.tones][0];
  }).join('');
  const endTone = pattern.endsWith('1') ? '平' : '仄';
  const endInfo = index.get(chars.at(-1));
  let rhymeGroup = endTone === '仄' ? '仄声' : item.rhyme_group;
  if (endTone === '平' && endInfo?.rhymes.size === 1) rhymeGroup = [...endInfo.rhymes][0];
  if (endTone === '平' && (!endInfo?.rhymes.size || endInfo.rhymes.size > 1)) flags.add('RHYME_UNCERTAIN');
  return { ping_ze_pattern: pattern, end_tone: endTone, rhyme_group: rhymeGroup, flags: [...flags] };
}

export function improveTags(item) {
  // “故”“思”“家”单字不足以说明思乡；不把猿类当作鸟类。
  const tags = item.tags.filter(tag => tag !== '思乡' && !(tag === '鸟' && !/[鸟燕鸿雁莺鸥鹤雀鹏凤]/.test(item.content)));
  if (/乡|故园|故国|归家|家书|客愁|客梦|思归|怀归|天涯/.test(item.content)) tags.push('思乡');
  return [...new Set(tags)];
}
