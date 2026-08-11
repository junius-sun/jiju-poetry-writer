/**
 * 自动从开源 chinese-poetry 数据库下载并清洗全量古诗词
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCES = [
  {
    name: "唐诗三百首",
    url: "https://fastly.jsdelivr.net/gh/chinese-poetry/chinese-poetry@master/%E7%B3%96%E8%AF%97/%E5%94%90%E8%AF%97%E4%B8%89%E7%99%BE%E9%A6%96.json"
  },
  {
    name: "千家诗",
    url: "https://fastly.jsdelivr.net/gh/chinese-poetry/chinese-poetry@master/%E7%B3%96%E8%AF%97/%E5%8D%83%E5%AE%B6%E8%AF%97.json"
  }
];

// 常见入声字表 (古音仄声)
const RU_SHENG_SET = new Set([
  "国", "石", "月", "日", "白", "竹", "客", "一", "七", "八", "十", "百", "千", "绝", "灭", "出", "入",
  "独", "读", "拂", "骨", "急", "极", "集", "吉", "木", "目", "莫", "落", "屋", "复", "福", "服", "发",
  "滑", "达", "答", "得", "德", "特", "铁", "别", "雪", "缺", "说", "折", "哲", "截", "洁", "失", "识",
  "执", "拾", "室", "释", "实", "食", "息", "席", "熄", "夕", "极", "棘", "戟", "即", "积", "迹", "绩",
  "昔", "迫", "择", "质", "赤", "敕", "乞", "泣", "黑", "色", "薄", "脚", "角", "若", "弱", "郭", "阁"
]);

// 平水韵 106 韵部简表
const RHYME_MAP = {
  "一东": ["东", "同", "童", "空", "风", "红", "公", "中", "终", "翁", "通", "融", "重", "雄"],
  "二冬": ["冬", "农", "宗", "钟", "龙", "松", "重", "凶", "胸", "庸", "容", "峰"],
  "四支": ["支", "知", "枝", "移", "推", "归", "吹", "池", "奇", "姿", "宜", "时", "垂", "诗", "悲", "随"],
  "五微": ["微", "挥", "飞", "依", "归", "衣", "稀", "祈", "非", "几"],
  "六麻": ["麻", "花", "家", "沙", "斜", "华", "霞", "鸦", "遮", "蛇", "车", "涯"],
  "七阳": ["阳", "香", "长", "乡", "光", "霜", "狂", "床", "凉", "央", "黄", "庄", "照", "防"],
  "八庚": ["庚", "明", "清", "声", "成", "情", "行", "惊", "城", "生", "精", "倾", "平", "城", "冷", "亭"],
  "十灰": ["灰", "开", "来", "回", "杯", "催", "笑", "台", "哀", "陪", "猜", "苔", "载"],
  "十一真": ["真", "因", "人", "亲", "春", "身", "尘", "新", "邻", "巾", "频", "神", "申", "辰"],
  "十一尤": ["尤", "游", "留", "秋", "头", "楼", "流", "舟", "愁", "休", "牛", "求", "柔", "悠"],
  "十二侵": ["侵", "深", "心", "寻", "林", "阴", "琴", "吟", "金", "沉", "音", "今"],
  "十五删": ["删", "山", "间", "还", "关", "颜", "闲", "攀", "潺", "湾", "蛮", "艰"]
};

// 意象提取
const TAG_MAP = {
  "月": ["月", "蟾", "桂", "夜光"],
  "风": ["风", "吹", "飘"],
  "花": ["花", "桃", "杏", "红", "芳", "华"],
  "酒": ["酒", "饮", "醉", "樽", "杯"],
  "山": ["山", "峰", "岩", "岳", "岭"],
  "水": ["水", "江", "河", "海", "泉", "溪", "川"],
  "舟": ["舟", "船", "帆", "桨"],
  "鸟": ["鸟", "燕", "鸿", "雁", "猿", "啼", "莺"],
  "雪": ["雪", "霜", "寒", "冰"],
  "秋": ["秋", "霜", "枫", "落"],
  "春": ["春", "绿", "柳", "草"]
};

function downloadUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function getTone(char) {
  if (RU_SHENG_SET.has(char)) return "0"; // 仄声 (入声)
  return "1"; // 默认为平声
}

function getRhyme(char) {
  for (const [name, chars] of Object.entries(RHYME_MAP)) {
    if (chars.includes(char)) return `平声_${name}`;
  }
  return "通用韵";
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

async function run() {
  console.log("正在从 GitHub/JsDelivr 下载开源古诗词数据...");
  let allLines = [];
  let idCounter = 1000;

  for (const src of SOURCES) {
    try {
      console.log(`正在获取 ${src.name}...`);
      const rawData = await downloadUrl(src.url);
      
      for (const poem of rawData) {
        const author = poem.author || "未知";
        const title = poem.title || "无题";
        const paragraphs = poem.paragraphs || [];

        for (const p of paragraphs) {
          // 清理标点，按句拆分
          const sentences = p.split(/[，。！？]/).map(s => s.trim()).filter(s => Boolean(s));
          for (const s of sentences) {
            if ((s.length === 5 || s.length === 7) && /^[\u4e00-\u9fa5]+$/.test(s)) {
              const endChar = s[s.length - 1];
              const isPingEnd = getTone(endChar) === "1";
              
              const pattern = Array.from(s).map(c => getTone(c)).join("");
              
              idCounter++;
              allLines.push({
                id: `fetched_${idCounter}`,
                content: s,
                length: s.length,
                author,
                dynasty: "唐",
                title,
                ping_ze_pattern: pattern,
                end_tone: isPingEnd ? "平" : "仄",
                rhyme_group: isPingEnd ? getRhyme(endChar) : "仄声",
                tags: extractTags(s)
              });
            }
          }
        }
      }
    } catch (err) {
      console.error(`获取 ${src.name} 失败:`, err.message);
    }
  }

  console.log(`处理完成！共成功解析并标注了 ${allLines.length} 条五言/七言诗句。`);

  // 去重 (按句内容)
  const uniqueLinesMap = new Map();
  for (const item of allLines) {
    if (!uniqueLinesMap.has(item.content)) {
      uniqueLinesMap.set(item.content, item);
    }
  }
  const uniqueLines = Array.from(uniqueLinesMap.values());
  console.log(`去重后共有 ${uniqueLines.length} 条无重复经典名句！`);

  // 写入 src/data/poetry_db.js
  const outputPath = path.join(__dirname, '../src/data/poetry_db.js');
  const code = `/**
 * 古诗集句工程 - 开源数据库全量索引
 * 自动从 chinese-poetry 开源仓库解析构建，包含 ${uniqueLines.length} 条高品质诗句。
 */

export const POETRY_DATABASE = ${JSON.stringify(uniqueLines, null, 2)};
`;

  fs.writeFileSync(outputPath, code, 'utf-8');
  console.log(`成功覆盖更新 ${outputPath}！`);
}

run();
