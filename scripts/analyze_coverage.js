/**
 * 数据库覆盖度分析：规模、分布、中学必背名篇命中率
 * 运行：node scripts/analyze_coverage.js
 */
import { POETRY_DATABASE } from '../src/data/poetry_db.js';

const db = POETRY_DATABASE;

// ============ 1. 基本规模 ============
const byLen = { 5: 0, 7: 0, other: 0 };
const authors = new Map();
const dynasties = new Map();
const titles = new Set();
for (const it of db) {
  if (it.length === 5) byLen[5]++;
  else if (it.length === 7) byLen[7]++;
  else byLen.other++;
  authors.set(it.author, (authors.get(it.author) || 0) + 1);
  dynasties.set(it.dynasty, (dynasties.get(it.dynasty) || 0) + 1);
  titles.add(it.title);
}

console.log('=== 规模 ===');
console.log(`总条目: ${db.length}（五言 ${byLen[5]} / 七言 ${byLen[7]} / 其他 ${byLen.other}）`);
console.log(`诗人数量: ${authors.size}，诗题数量: ${titles.size}`);
console.log(`朝代分布: ${[...dynasties.entries()].map(([d, n]) => `${d}:${n}`).join('  ')}`);
console.log('\n=== 收录最多的 15 位诗人 ===');
[...authors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
  .forEach(([a, n]) => console.log(`  ${a}: ${n} 句`));

// ============ 2. 中学必背/常识性名篇命中率 ============
// 人教版中小学语文教材中最常见的篇目（按教材出现频率选取）
const MUST_HAVE = [
  // 小学高段~初中超高频
  ['李白', '静夜思'], ['孟浩然', '春晓'], ['王之涣', '登鹳雀楼'], ['李白', '望庐山瀑布'],
  ['李白', '早发白帝城'], ['杜甫', '绝句'], ['柳宗元', '江雪'], ['王安石', '梅花'],
  ['杜牧', '山行'], ['杜牧', '清明'], ['王维', '九月九日忆山东兄弟'], ['李白', '赠汪伦'],
  ['李白', '黄鹤楼送孟浩然之广陵'], ['苏轼', '题西林壁'], ['陆游', '游山西村'],
  ['王维', '送元二使安西'], ['贺知章', '咏柳'], ['杜甫', '春夜喜雨'], ['白居易', '赋得古原草送别'],
  ['白居易', '池上'], ['杨万里', '小池'], ['杨万里', '晓出净慈寺送林子方'],
  ['杜牧', '江南春'], ['王安石', '泊船瓜洲'], ['王安石', '元日'], ['苏轼', '饮湖上初晴后雨'],
  ['王翰', '凉州词'], ['王昌龄', '出塞'], ['王昌龄', '芙蓉楼送辛渐'], ['李白', '望天门山'],
  ['刘禹锡', '望洞庭'], ['白居易', '忆江南'], ['张志和', '渔歌子'], ['孟郊', '游子吟'],
  ['曹植', '七步诗'], ['李绅', '悯农'], ['骆宾王', '咏鹅'], ['王之涣', '凉州词'],
  ['王维', '鹿柴'], ['王维', '竹里馆'], ['李白', '独坐敬亭山'], ['杜甫', '江畔独步寻花'],
  ['朱熹', '观书有感'], ['陆游', '示儿'], ['林升', '题临安邸'], ['龚自珍', '己亥杂诗'],
  ['于谦', '石灰吟'], ['郑燮', '竹石'], ['王冕', '墨梅'], ['杜甫', '闻官军收河南河北'],
  // 初中重点
  ['王湾', '次北固山下'], ['李白', '闻王昌龄左迁龙标遥有此寄'], ['杜甫', '望岳'],
  ['杜甫', '春望'], ['王维', '使至塞上'], ['李白', '渡荆门送别'], ['白居易', '钱塘湖春行'],
  ['陶渊明', '饮酒'], ['杜牧', '赤壁'], ['杜牧', '泊秦淮'], ['李商隐', '夜雨寄北'],
  ['李商隐', '无题'], ['李白', '行路难'], ['刘禹锡', '酬乐天扬州初逢席上见赠'],
  ['文天祥', '过零丁洋'], ['辛弃疾', '破阵子'], ['苏轼', '水调歌头'], ['马致远', '天净沙'],
  ['崔颢', '黄鹤楼'], ['常建', '题破山寺后禅院'], ['岑参', '白雪歌送武判官归京'],
  ['李商隐', '登乐游原'], ['贾岛', '寻隐者不遇'], ['李峤', '风'], ['杜甫', '江南逢李龟年'],
  ['韦应物', '滁州西涧'], ['韩愈', '早春呈水部张十八员外'], ['白居易', '观刈麦'],
  ['辛弃疾', '西江月'], ['曹操', '观沧海'], ['李清照', '如梦令'], ['晏殊', '浣溪沙'],
];

// 诗题匹配策略：DB 中 title 可能是「凉州词二首·其一」等变体，做包含匹配
const normTitle = t => t.replace(/[·\s]/g, '');
const titleList = [...titles].map(normTitle);

let hit = 0;
const missed = [];
for (const [author, title] of MUST_HAVE) {
  const nt = normTitle(title);
  const found = db.some(it =>
    normTitle(it.title).includes(nt) && (it.author === author || it.author.includes(author))
  ) || db.some(it => normTitle(it.title).includes(nt)); // 宽松兜底：只按诗题
  if (found) hit++;
  else missed.push(`${author}《${title}》`);
}

console.log('\n=== 中学常识名篇覆盖 ===');
console.log(`抽查 ${MUST_HAVE.length} 篇，命中 ${hit} 篇，缺失 ${missed.length} 篇（命中率 ${(hit / MUST_HAVE.length * 100).toFixed(1)}%）`);
if (missed.length) {
  console.log('缺失篇目:');
  missed.forEach(m => console.log(`  - ${m}`));
}

// ============ 3. 名句抽查（不看诗题，直接搜句子本身） ============
const FAMOUS_LINES = [
  '床前明月光', '疑是地上霜', '举头望明月', '低头思故乡',
  '春眠不觉晓', '处处闻啼鸟', '夜来风雨声', '花落知多少',
  '白日依山尽', '黄河入海流', '欲穷千里目', '更上一层楼',
  '两个黄鹂鸣翠柳', '一行白鹭上青天', '窗含西岭千秋雪', '门泊东吴万里船',
  '日照香炉生紫烟', '飞流直下三千尺', '锄禾日当午', '汗滴禾下土',
  '离离原上草', '野火烧不尽', '春风吹又生', '慈母手中线', '游子身上衣',
  '谁知盘中餐', '粒粒皆辛苦', '鹅鹅鹅', '曲项向天歌',
  '国破山河在', '城春草木深', '感时花溅泪', '恨别鸟惊心',
  '会当凌绝顶', '一览众山小', '海内存知己', '天涯若比邻',
  '沉舟侧畔千帆过', '病树前头万木春', '山重水复疑无路', '柳暗花明又一村',
  '人生自古谁无死', '留取丹心照汗青', '但愿人长久', '千里共婵娟',
  '枯藤老树昏鸦', '小桥流水人家', '大漠孤烟直', '长河落日圆',
  '忽如一夜春风来', '千树万树梨花开', '不识庐山真面目', '只缘身在此山中',
  '问渠那得清如许', '为有源头活水来', '商女不知亡国恨', '隔江犹唱后庭花',
  '何当共剪西窗烛', '却话巴山夜雨时', '春蚕到死丝方尽', '蜡炬成灰泪始干',
  '长风破浪会有时', '直挂云帆济沧海', '安得广厦千万间', '大庇天下寒士俱欢颜',
];

let lineHit = 0;
const missedLines = [];
for (const line of FAMOUS_LINES) {
  if (db.some(it => it.content.includes(line))) lineHit++;
  else missedLines.push(line);
}
console.log('\n=== 名句抽查 ===');
console.log(`抽查 ${FAMOUS_LINES.length} 句，命中 ${lineHit} 句，缺失 ${missedLines.length} 句（命中率 ${(lineHit / FAMOUS_LINES.length * 100).toFixed(1)}%）`);
if (missedLines.length) {
  console.log('缺失名句:');
  missedLines.forEach(m => console.log(`  - ${m}`));
}
