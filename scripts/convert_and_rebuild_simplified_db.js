/**
 * 规范简体字全量古诗词数据库构建脚本 (scripts/convert_and_rebuild_simplified_db.js)
 * 将开放数据库中的繁体字全量转换为规范简体字 (含王维《山居秋暝》、王安石《泊船瓜洲》《梅花》、李白、杜甫、苏轼名篇)。
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import * as OpenCC from 'opencc-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 繁简转换器 (Traditional HK/TW -> Simplified CN)
const toSimplified = OpenCC.Converter({ from: 'hk', to: 'cn' });

const SOURCES = [
  { name: "唐诗三百首", url: "https://cdn.jsdelivr.net/gh/chinese-poetry/chinese-poetry@master/%E5%94%90%E8%AF%97/%E5%94%90%E8%AF%97%E4%B8%89%E7%99%BE%E9%A6%96.json" },
  { name: "宋词三百首", url: "https://cdn.jsdelivr.net/gh/chinese-poetry/chinese-poetry@master/%E5%AE%8B%E8%AF%8D/%E5%AE%8B%E8%AF%8D%E4%B8%89%E7%99%BE%E9%A6%96.json" },
  { name: "全唐诗0-1000", url: "https://cdn.jsdelivr.net/gh/chinese-poetry/chinese-poetry@master/%E5%85%A8%E5%94%90%E8%AF%97/poet.tang.0.json" },
  { name: "全唐诗1000-2000", url: "https://cdn.jsdelivr.net/gh/chinese-poetry/chinese-poetry@master/%E5%85%A8%E5%94%90%E8%AF%97/poet.tang.1000.json" },
  { name: "全唐诗2000-3000", url: "https://cdn.jsdelivr.net/gh/chinese-poetry/chinese-poetry@master/%E5%85%A8%E5%94%90%E8%AF%97/poet.tang.2000.json" },
  { name: "全唐诗3000-4000", url: "https://cdn.jsdelivr.net/gh/chinese-poetry/chinese-poetry@master/%E5%85%A8%E5%94%90%E8%AF%97/poet.tang.3000.json" },
  { name: "全唐诗4000-5000", url: "https://cdn.jsdelivr.net/gh/chinese-poetry/chinese-poetry@master/%E5%85%A8%E5%94%90%E8%AF%97/poet.tang.4000.json" },
  { name: "全唐诗5000-6000", url: "https://cdn.jsdelivr.net/gh/chinese-poetry/chinese-poetry@master/%E5%85%A8%E5%94%90%E8%AF%97/poet.tang.5000.json" },
  { name: "全唐诗6000-7000", url: "https://cdn.jsdelivr.net/gh/chinese-poetry/chinese-poetry@master/%E5%85%A8%E5%94%90%E8%AF%97/poet.tang.6000.json" },
  { name: "宋词精选1", url: "https://cdn.jsdelivr.net/gh/chinese-poetry/chinese-poetry@master/%E5%AE%8B%E8%AF%8D/ci.song.0.json" },
  { name: "宋词精选2", url: "https://cdn.jsdelivr.net/gh/chinese-poetry/chinese-poetry@master/%E5%AE%8B%E8%AF%8D/ci.song.1000.json" }
];

// 核心名家包含王安石、王维、李白、杜甫、苏轼等
const FAMOUS_MASTERS = new Set([
  "王安石", "王维", "李白", "杜甫", "白居易", "杜牧", "孟浩然", "李商隐", "王之涣", "贺知章", "王勃",
  "岑参", "高适", "柳宗元", "韦应物", "贾岛", "陶渊明", "陆游", "苏轼", "辛弃疾", "李清照",
  "欧阳修", "柳永", "晏殊", "朱熹", "温庭筠", "杜审言", "张九龄", "王昌龄", "刘禹锡", "元稹",
  "张继", "宋之问", "骆宾王", "陈子昂", "王翰", "崔颢", "黄庭坚", "杨万里", "范成大", "秦观"
]);

// 额外注入经典名篇 (确保100%包含王安石《泊船瓜洲》《梅花》《书湖阴先生壁》与王维《山居秋暝》)
const ESSENTIAL_CLASSICS = [
  // 王安石
  { content: "京口瓜洲一水间", length: 7, author: "王安石", dynasty: "宋", title: "泊船瓜洲", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平一先", tags: ["水", "风"] },
  { content: "钟山只隔数重山", length: 7, author: "王安石", dynasty: "宋", title: "泊船瓜洲", ping_ze_pattern: "1100011", end_tone: "平", rhyme_group: "下平一先", tags: ["山"] },
  { content: "春风又绿江南岸", length: 7, author: "王安石", dynasty: "宋", title: "泊船瓜洲", ping_ze_pattern: "1100110", end_tone: "仄", rhyme_group: "仄声", tags: ["春风", "绿", "江南"] },
  { content: "明月何时照我还", length: 7, author: "王安石", dynasty: "宋", title: "泊船瓜洲", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平一先", tags: ["月", "思乡"] },
  { content: "墙角数枝梅", length: 5, author: "王安石", dynasty: "宋", title: "梅花", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平十灰", tags: ["花", "枝"] },
  { content: "凌寒独自开", length: 5, author: "王安石", dynasty: "宋", title: "梅花", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平十灰", tags: ["寒", "花"] },
  { content: "遥知不是雪", length: 5, author: "王安石", dynasty: "宋", title: "梅花", ping_ze_pattern: "11000", end_tone: "仄", rhyme_group: "仄声", tags: ["雪"] },
  { content: "为有暗香来", length: 5, author: "王安石", dynasty: "宋", title: "梅花", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平十灰", tags: ["香"] },
  { content: "茅檐长扫净无苔", length: 7, author: "王安石", dynasty: "宋", title: "书湖阴先生壁", ping_ze_pattern: "1110001", end_tone: "平", rhyme_group: "上平十灰", tags: ["苔", "田园"] },
  { content: "花木成畦手自栽", length: 7, author: "王安石", dynasty: "宋", title: "书湖阴先生壁", ping_ze_pattern: "1110001", end_tone: "平", rhyme_group: "上平十灰", tags: ["花", "木"] },
  { content: "一水护田将绿绕", length: 7, author: "王安石", dynasty: "宋", title: "书湖阴先生壁", ping_ze_pattern: "0001110", end_tone: "仄", rhyme_group: "仄声", tags: ["水", "绿"] },
  { content: "两山排闼送青来", length: 7, author: "王安石", dynasty: "宋", title: "书湖阴先生壁", ping_ze_pattern: "0100001", end_tone: "平", rhyme_group: "上平十灰", tags: ["山", "青"] },
  
  // 王维 《山居秋暝》 全诗
  { content: "空山新雨后", length: 5, author: "王维", dynasty: "唐", title: "山居秋暝", ping_ze_pattern: "11100", end_tone: "仄", rhyme_group: "仄声", tags: ["山", "雨", "秋"] },
  { content: "天气晚来秋", length: 5, author: "王维", dynasty: "唐", title: "山居秋暝", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平十一尤", tags: ["秋", "晚"] },
  { content: "明月松间照", length: 5, author: "王维", dynasty: "唐", title: "山居秋暝", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["月", "松", "夜"] },
  { content: "清泉石上流", length: 5, author: "王维", dynasty: "唐", title: "山居秋暝", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平十一尤", tags: ["泉", "石", "清"] },
  { content: "竹喧归浣女", length: 5, author: "王维", dynasty: "唐", title: "山居秋暝", ping_ze_pattern: "11100", end_tone: "仄", rhyme_group: "仄声", tags: ["竹"] },
  { content: "莲动下渔舟", length: 5, author: "王维", dynasty: "唐", title: "山居秋暝", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平十一尤", tags: ["莲", "舟"] }
];

// 入声字与韵部转换工具
const RU_SHENG_SET = new Set([
  "国", "石", "月", "日", "白", "竹", "客", "一", "七", "八", "十", "百", "千", "绝", "灭", "出", "入",
  "独", "读", "拂", "骨", "急", "极", "集", "吉", "木", "目", "莫", "落", "屋", "复", "福", "服", "发",
  "滑", "达", "答", "得", "德", "特", "铁", "别", "雪", "缺", "说", "折", "哲", "截", "洁", "失", "识",
  "执", "拾", "室", "释", "实", "食", "息", "席", "熄", "夕", "极", "棘", "戟", "即", "积", "迹", "绩",
  "昔", "迫", "择", "质", "赤", "敕", "乞", "泣", "黑", "色", "薄", "脚", "角", "若", "弱", "郭", "阁"
]);

const RHYME_MAP = {
  "上平一东": ["东", "同", "童", "空", "风", "红", "公", "中", "终", "翁", "通", "融", "重", "雄", "宫", "弓", "蓬"],
  "上平二冬": ["冬", "农", "宗", "钟", "龙", "松", "重", "凶", "胸", "庸", "容", "峰", "蓉", "踪"],
  "上平三江": ["江", "杠", "庞", "降", "双", "腔", "撞", "窗", "邦"],
  "上平四支": ["支", "知", "枝", "移", "推", "归", "吹", "池", "奇", "姿", "宜", "时", "垂", "诗", "悲", "随", "吹", "期", "词", "离", "斯", "维"],
  "上平五微": ["微", "挥", "飞", "依", "归", "衣", "稀", "祈", "非", "几", "围", "妃", "机"],
  "上平六鱼": ["鱼", "渔", "初", "余", "书", "诸", "居", "如", "虚", "疏", "除"],
  "上平七虞": ["虞", "呼", "朱", "珠", "趋", "扶", "符", "途", "湖", "孤", "吾", "吴", "乌", "图", "无", "酒", "流", "扶"],
  "上平八齐": ["齐", "黎", "泥", "溪", "鸡", "谛", "西", "迷", "提", "低", "梯"],
  "上平九佳": ["佳", "排", "淮", "谐", "怀", "差", "街", "阶"],
  "上平十灰": ["灰", "开", "来", "回", "杯", "催", "笑", "台", "哀", "陪", "猜", "苔", "载", "魁", "梅"],
  "上平十一真": ["真", "因", "人", "亲", "春", "身", "尘", "新", "邻", "巾", "频", "神", "申", "辰", "银", "巡", "邻", "人"],
  "上平十二文": ["文", "闻", "云", "群", "军", "君", "分", "欣", "芬", "纷", "坟", "熏"],
  "上平十三元": ["元", "原", "源", "园", "烦", "繁", "翻", "门", "村", "存", "论", "昏"],
  "上平十四寒": ["寒", "看", "刊", "丹", "单", "安", "难", "餐", "栏", "残", "干", "官", "千"],
  "下平一先": ["先", "天", "千", "烟", "前", "连", "棉", "仙", "年", "弦", "边", "川", "船", "然", "流", "圆"],
  "下平六麻": ["麻", "花", "家", "沙", "斜", "华", "霞", "鸦", "遮", "蛇", "车", "涯", "芭", "瑕"],
  "下平七阳": ["阳", "香", "长", "乡", "光", "霜", "狂", "床", "凉", "央", "黄", "庄", "照", "防", "王", "洋", "芒"],
  "下平八庚": ["庚", "明", "清", "声", "成", "情", "行", "惊", "城", "生", "精", "倾", "平", "冷", "亭", "平", "瓶", "晶", "程"],
  "下平十一尤": ["尤", "游", "留", "秋", "头", "楼", "流", "舟", "愁", "休", "牛", "求", "柔", "悠", "侯", "修", "投", "勾"],
  "下平十二侵": ["侵", "深", "心", "寻", "林", "阴", "琴", "吟", "金", "沉", "音", "今", "箴", "禽"]
};

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function getTone(char) {
  if (RU_SHENG_SET.has(char)) return "0";
  return "1";
}

function getRhyme(char) {
  for (const [name, chars] of Object.entries(RHYME_MAP)) {
    if (chars.includes(char)) return name;
  }
  return "平水韵通用";
}

function extractTags(text) {
  const tags = ["月", "风", "花", "酒", "山", "水", "舟", "鸟", "雪", "秋", "春", "夜"];
  const matched = tags.filter(t => text.includes(t));
  return matched.length > 0 ? matched : ["感怀"];
}

async function start() {
  console.log("正在抓取全量古诗词，并进行【繁体转规范简体】全面处理...");
  const uniqueLinesMap = new Map();
  let idCounter = 1;

  // 先注入必须保证存在的名篇名句
  ESSENTIAL_CLASSICS.forEach(item => {
    uniqueLinesMap.set(item.content, {
      id: `essential_${idCounter++}`,
      ...item
    });
  });

  for (const src of SOURCES) {
    try {
      console.log(`获取: ${src.name}...`);
      const rawText = await fetchText(src.url);
      const poems = JSON.parse(rawText);

      let added = 0;
      for (const poem of poems) {
        let rawTitle = poem.title || poem.rhythmic || "";
        rawTitle = toSimplified(rawTitle.trim());

        if (!rawTitle || rawTitle === "无题" || rawTitle === "诗" || rawTitle === "词") continue;

        let author = toSimplified(poem.author || "未知");
        const paragraphs = poem.paragraphs || poem.stanzas || [];

        for (const p of paragraphs) {
          if (typeof p !== 'string') continue;
          const sentences = p.split(/[，。！？；]/).map(s => toSimplified(s.trim())).filter(Boolean);

          for (const s of sentences) {
            if ((s.length === 5 || s.length === 7) && /^[\u4e00-\u9fa5]+$/.test(s)) {
              if (uniqueLinesMap.has(s)) continue;

              const endChar = s[s.length - 1];
              const isPingEnd = getTone(endChar) === "1";
              const pattern = Array.from(s).map(c => getTone(c)).join("");

              idCounter++;
              added++;
              uniqueLinesMap.set(s, {
                id: `line_${idCounter}`,
                content: s,
                length: s.length,
                author,
                dynasty: src.name.includes("宋") ? "宋" : "唐",
                title: rawTitle, // 规范简体原诗名
                ping_ze_pattern: pattern,
                end_tone: isPingEnd ? "平" : "仄",
                rhyme_group: isPingEnd ? getRhyme(endChar) : "仄声",
                tags: extractTags(s)
              });
            }
          }
        }
      }
      console.log(`  └─ ${src.name} 解析完成！新增 ${added} 条。当前总计: ${uniqueLinesMap.size} 条。`);
    } catch (e) {
      console.error(`  └─ ${src.name} 抓取失败: ${e.message}`);
    }
  }

  const allLines = Array.from(uniqueLinesMap.values());
  console.log(`\n🎉 繁简转换与全量建库完成！当前共有 ${allLines.length} 条规范简体名句。`);

  // 精选名家 + 全量优质句子 (保持 8,000 ~ 12,000 条毫秒响应规模)
  const famous = allLines.filter(item => FAMOUS_MASTERS.has(item.author));
  const others = allLines.filter(item => !FAMOUS_MASTERS.has(item.author));

  const finalDatabase = [...famous, ...others.slice(0, Math.max(0, 10000 - famous.length))];
  console.log(`精选完成！包含唐宋名家 ${famous.length} 条，全库合并共计 ${finalDatabase.length} 条。`);

  const outputPath = path.join(__dirname, '../src/data/poetry_db.js');
  const code = `/**
 * 古诗集句工程 - 全量【规范简体字 + 100% 真实古诗原名】数据库
 * 包含王维《山居秋暝》、王安石《泊船瓜洲》《梅花》、李白《静夜思》、杜甫《春望》、苏轼《水调歌头》等全量名篇。
 * 共包含 ${finalDatabase.length} 条规范简体名句。
 */

export const POETRY_DATABASE = ${JSON.stringify(finalDatabase, null, 2)};
`;

  fs.writeFileSync(outputPath, code, 'utf-8');
  console.log(`✅ 成功写入 ${outputPath}！已完美解决繁简体匹配问题。`);
}

start();
