import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const URLS = [
  "https://gitee.com/chinese-poetry/chinese-poetry/raw/master/%E5%94%90%E8%AF%97/%E5%94%90%E8%AF%97%E4%B8%89%E7%99%BE%E9%A6%96.json",
  "https://gitee.com/chinese-poetry/chinese-poetry/raw/master/%E5%94%90%E8%AF%97/%E5%8D%83%E5%AE%B6%E8%AF%97.json",
  "https://gitee.com/chinese-poetry/chinese-poetry/raw/master/%E5%AE%8B%E8%AF%8D/%E5%AE%8B%E8%AF%8D%E4%B8%89%E7%99%BE%E9%A6%96.json"
];

// 常见入声字表 (古音仄声)
const RU_SHENG_SET = new Set([
  "国", "石", "月", "日", "白", "竹", "客", "一", "七", "八", "十", "百", "千", "绝", "灭", "出", "入",
  "独", "读", "拂", "骨", "急", "极", "集", "吉", "木", "目", "莫", "落", "屋", "复", "福", "服", "发",
  "滑", "达", "答", "得", "德", "特", "铁", "别", "雪", "缺", "说", "折", "哲", "截", "洁", "失", "识",
  "执", "拾", "室", "释", "实", "食", "息", "席", "熄", "夕", "极", "棘", "戟", "即", "积", "迹", "绩",
  "昔", "迫", "择", "质", "赤", "敕", "乞", "泣", "黑", "色", "薄", "脚", "角", "若", "弱", "郭", "阁"
]);

// 平水韵 106 韵部简表 (平声)
const RHYME_MAP = {
  "上平一东": ["东", "同", "童", "空", "风", "红", "公", "中", "终", "翁", "通", "融", "重", "雄", "宫", "弓", "蓬"],
  "上平二冬": ["冬", "农", "宗", "钟", "龙", "松", "重", "凶", "胸", "庸", "容", "峰", "蓉", "踪"],
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

// 意象提取
const TAG_MAP = {
  "月": ["月", "蟾", "桂", "夜光", "冰轮"],
  "风": ["风", "吹", "飘", "飒"],
  "花": ["花", "桃", "杏", "红", "芳", "华", "梅"],
  "酒": ["酒", "饮", "醉", "樽", "杯", "酌"],
  "山": ["山", "峰", "岩", "岳", "岭", "翠"],
  "水": ["水", "江", "河", "海", "泉", "溪", "川", "浪"],
  "舟": ["舟", "船", "帆", "桨", "舸"],
  "鸟": ["鸟", "燕", "鸿", "雁", "猿", "啼", "莺", "鸥"],
  "雪": ["雪", "霜", "寒", "冰"],
  "秋": ["秋", "霜", "枫", "落", "萧"],
  "春": ["春", "绿", "柳", "草", "枝"],
  "夜": ["夜", "暮", "昏", "黑", "烛"]
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
  const tags = [];
  for (const [tag, kws] of Object.entries(TAG_MAP)) {
    if (kws.some(kw => text.includes(kw))) {
      tags.push(tag);
    }
  }
  return tags.length > 0 ? tags : ["感怀"];
}

async function start() {
  console.log("正在从 Gitee 镜像仓库获取【真实诗词原名】全量数据...");
  const uniqueLinesMap = new Map();
  let idCounter = 1;

  for (const url of URLS) {
    try {
      console.log(`获取: ${url.split('/').pop()}...`);
      const rawStr = await fetchText(url);
      const data = JSON.parse(rawStr);

      for (const poem of data) {
        // 关键修复：从 json 中精确获取 title 或 rhythmic 词牌
        let rawTitle = poem.title || poem.rhythmic || "";
        rawTitle = rawTitle.trim();

        // 丢弃没有准确诗名或依然标注无题的极其边缘的数据
        if (!rawTitle || rawTitle === "无题") continue;

        const author = poem.author || "未知";
        const paragraphs = poem.paragraphs || poem.stanzas || [];

        for (const p of paragraphs) {
          if (typeof p !== 'string') continue;
          const sentences = p.split(/[，。！？；]/).map(s => s.trim()).filter(Boolean);

          for (const s of sentences) {
            if ((s.length === 5 || s.length === 7) && /^[\u4e00-\u9fa5]+$/.test(s)) {
              if (uniqueLinesMap.has(s)) continue;

              const endChar = s[s.length - 1];
              const isPingEnd = getTone(endChar) === "1";
              const pattern = Array.from(s).map(c => getTone(c)).join("");

              idCounter++;
              uniqueLinesMap.set(s, {
                id: `real_${idCounter}`,
                content: s,
                length: s.length,
                author,
                dynasty: "唐/宋",
                title: rawTitle, // 100% 精确诗词原名，如《山居秋暝》《水调歌头》《静夜思》
                ping_ze_pattern: pattern,
                end_tone: isPingEnd ? "平" : "仄",
                rhyme_group: isPingEnd ? getRhyme(endChar) : "仄声",
                tags: extractTags(s)
              });
            }
          }
        }
      }
    } catch (e) {
      console.error(`抓取失败: ${e.message}`);
    }
  }

  const allLines = Array.from(uniqueLinesMap.values());
  console.log(`抓取完成！共获得 ${allLines.length} 条带有【100%精确原诗名】的独立名句。`);

  // 输出到 src/data/poetry_db.js
  const outputPath = path.join(__dirname, '../src/data/poetry_db.js');
  const code = `/**
 * 古诗集句工程 - 100% 真实原诗名数据库 (唐诗三百首 + 宋词三百首 + 千家诗)
 * 包含王维《山居秋暝》、李白《静夜思》、苏轼《水调歌头》等所有名篇，100% 带具体诗名。
 * 共包含 ${allLines.length} 条精选诗句。
 */

export const POETRY_DATABASE = ${JSON.stringify(allLines, null, 2)};
`;

  fs.writeFileSync(outputPath, code, 'utf-8');
  console.log(`已成功更新数据库 ${outputPath}！所有诗名均显示真实古诗名。`);
}

start();
