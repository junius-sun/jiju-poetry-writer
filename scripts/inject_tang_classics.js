import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TANG_CLASSICS = [
  // 王维
  { content: "明月松间照", length: 5, author: "王维", dynasty: "唐", title: "山居秋暝", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["月", "松", "秋", "夜"] },
  { content: "清泉石上流", length: 5, author: "王维", dynasty: "唐", title: "山居秋暝", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平十一尤", tags: ["泉", "石", "清"] },
  { content: "竹喧归浣女", length: 5, author: "王维", dynasty: "唐", title: "山居秋暝", ping_ze_pattern: "11100", end_tone: "仄", rhyme_group: "仄声", tags: ["竹"] },
  { content: "莲动下渔舟", length: 5, author: "王维", dynasty: "唐", title: "山居秋暝", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平十一尤", tags: ["莲", "舟"] },
  { content: "红豆生南国", length: 5, author: "王维", dynasty: "唐", title: "相思", ping_ze_pattern: "11100", end_tone: "仄", rhyme_group: "仄声", tags: ["红豆", "相思"] },
  { content: "春来发几枝", length: 5, author: "王维", dynasty: "唐", title: "相思", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "上平四支", tags: ["春", "枝"] },
  { content: "愿君多采撷", length: 5, author: "王维", dynasty: "唐", title: "相思", ping_ze_pattern: "01100", end_tone: "仄", rhyme_group: "仄声", tags: ["采撷"] },
  { content: "此物最相思", length: 5, author: "王维", dynasty: "唐", title: "相思", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "上平四支", tags: ["相思"] },
  { content: "独在异乡为异客", length: 7, author: "王维", dynasty: "唐", title: "九月九日忆山东兄弟", ping_ze_pattern: "0001100", end_tone: "仄", rhyme_group: "仄声", tags: ["乡", "客"] },
  { content: "每逢佳节倍思亲", length: 7, author: "王维", dynasty: "唐", title: "九月九日忆山东兄弟", ping_ze_pattern: "0110011", end_tone: "平", rhyme_group: "上平十一真", tags: ["佳节", "思念"] },
  { content: "遥知兄弟登高处", length: 7, author: "王维", dynasty: "唐", title: "九月九日忆山东兄弟", ping_ze_pattern: "1100110", end_tone: "仄", rhyme_group: "仄声", tags: ["登高", "兄弟"] },
  { content: "遍插茱萸少一人", length: 7, author: "王维", dynasty: "唐", title: "九月九日忆山东兄弟", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "上平十一真", tags: ["茱萸", "思念"] },
  { content: "渭城朝雨浥轻尘", length: 7, author: "王维", dynasty: "唐", title: "送元二使安西", ping_ze_pattern: "1110011", end_tone: "平", rhyme_group: "上平十一真", tags: ["雨", "尘"] },
  { content: "客舍青青柳色新", length: 7, author: "王维", dynasty: "唐", title: "送元二使安西", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "上平十一真", tags: ["柳", "春"] },
  { content: "劝君更尽一杯酒", length: 7, author: "王维", dynasty: "唐", title: "送元二使安西", ping_ze_pattern: "1100011", end_tone: "仄", rhyme_group: "仄声", tags: ["酒", "离别"] },
  { content: "西出阳关无故人", length: 7, author: "王维", dynasty: "唐", title: "送元二使安西", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "上平十一真", tags: ["故人", "阳关"] },
  { content: "独坐幽篁里", length: 5, author: "王维", dynasty: "唐", title: "竹里馆", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["竹", "幽"] },
  { content: "弹琴复长啸", length: 5, author: "王维", dynasty: "唐", title: "竹里馆", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平十八啸", tags: ["琴"] },
  { content: "深林人不知", length: 5, author: "王维", dynasty: "唐", title: "竹里馆", ping_ze_pattern: "11101", end_tone: "平", rhyme_group: "上平四支", tags: ["林", "人"] },
  { content: "明月来相照", length: 5, author: "王维", dynasty: "唐", title: "竹里馆", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["月"] },
  { content: "空山不见人", length: 5, author: "王维", dynasty: "唐", title: "鹿柴", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "上平十一真", tags: ["山"] },
  { content: "但闻人语响", length: 5, author: "王维", dynasty: "唐", title: "鹿柴", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["人语"] },
  { content: "返景入深林", length: 5, author: "王维", dynasty: "唐", title: "鹿柴", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平十二侵", tags: ["林"] },
  { content: "复照青苔上", length: 5, author: "王维", dynasty: "唐", title: "鹿柴", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["苔"] },
  { content: "大漠孤烟直", length: 5, author: "王维", dynasty: "唐", title: "使至塞上", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["漠", "烟", "边塞"] },
  { content: "长河落日圆", length: 5, author: "王维", dynasty: "唐", title: "使至塞上", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平1先", tags: ["河", "日"] },

  // 李白
  { content: "床前明月光", length: 5, author: "李白", dynasty: "唐", title: "静夜思", ping_ze_pattern: "11101", end_tone: "平", rhyme_group: "下平七阳", tags: ["月", "光", "夜"] },
  { content: "疑是地上霜", length: 5, author: "李白", dynasty: "唐", title: "静夜思", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平七阳", tags: ["霜"] },
  { content: "举头望明月", length: 5, author: "李白", dynasty: "唐", title: "静夜思", ping_ze_pattern: "01010", end_tone: "仄", rhyme_group: "仄声", tags: ["月"] },
  { content: "低头思故乡", length: 5, author: "李白", dynasty: "唐", title: "静夜思", ping_ze_pattern: "11101", end_tone: "平", rhyme_group: "下平七阳", tags: ["乡", "思"] },
  { content: "朝辞白帝彩云间", length: 7, author: "李白", dynasty: "唐", title: "早发白帝城", ping_ze_pattern: "1100011", end_tone: "平", rhyme_group: "下平十五删", tags: ["云"] },
  { content: "千里江陵一日还", length: 7, author: "李白", dynasty: "唐", title: "早发白帝城", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平十五删", tags: ["江", "舟"] },
  { content: "两岸猿声啼不住", length: 7, author: "李白", dynasty: "唐", title: "早发白帝城", ping_ze_pattern: "0011100", end_tone: "仄", rhyme_group: "仄声", tags: ["猿", "声"] },
  { content: "轻舟已过万重山", length: 7, author: "李白", dynasty: "唐", title: "早发白帝城", ping_ze_pattern: "1100011", end_tone: "平", rhyme_group: "下平十五删", tags: ["舟", "山"] },
  { content: "故人西辞黄鹤楼", length: 7, author: "李白", dynasty: "唐", title: "黄鹤楼送孟浩然之广陵", ping_ze_pattern: "1111001", end_tone: "平", rhyme_group: "下平十一尤", tags: ["楼", "送别"] },
  { content: "烟花三月下扬州", length: 7, author: "李白", dynasty: "唐", title: "黄鹤楼送孟浩然之广陵", ping_ze_pattern: "1110011", end_tone: "平", rhyme_group: "下平十一尤", tags: ["花", "春"] },
  { content: "孤帆远影碧空尽", length: 7, author: "李白", dynasty: "唐", title: "黄鹤楼送孟浩然之广陵", ping_ze_pattern: "1100011", end_tone: "仄", rhyme_group: "仄声", tags: ["帆"] },
  { content: "唯见长江天际流", length: 7, author: "李白", dynasty: "唐", title: "黄鹤楼送孟浩然之广陵", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平十一尤", tags: ["长江", "流"] },
  { content: "日照香炉生紫烟", length: 7, author: "李白", dynasty: "唐", title: "望庐山瀑布", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平一先", tags: ["日", "烟"] },
  { content: "遥看瀑布挂前川", length: 7, author: "李白", dynasty: "唐", title: "望庐山瀑布", ping_ze_pattern: "1100011", end_tone: "平", rhyme_group: "下平一先", tags: ["瀑布", "川"] },
  { content: "飞流直下三千尺", length: 7, author: "李白", dynasty: "唐", title: "望庐山瀑布", ping_ze_pattern: "1100110", end_tone: "仄", rhyme_group: "仄声", tags: ["飞流"] },
  { content: "疑是银河落九天", length: 7, author: "李白", dynasty: "唐", title: "望庐山瀑布", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平一先", tags: ["银河", "天"] },

  // 杜甫
  { content: "国破山河在", length: 5, author: "杜甫", dynasty: "唐", title: "春望", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["山河", "国"] },
  { content: "城春草木深", length: 5, author: "杜甫", dynasty: "唐", title: "春望", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平十二侵", tags: ["春", "草", "木"] },
  { content: "感时花溅泪", length: 5, author: "杜甫", dynasty: "唐", title: "春望", ping_ze_pattern: "11100", end_tone: "仄", rhyme_group: "仄声", tags: ["花", "泪"] },
  { content: "恨别鸟惊心", length: 5, author: "杜甫", dynasty: "唐", title: "春望", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平十二侵", tags: ["鸟", "心"] },
  { content: "好雨知时节", length: 5, author: "杜甫", dynasty: "唐", title: "春夜喜雨", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["雨", "春"] },
  { content: "当春乃发生", length: 5, author: "杜甫", dynasty: "唐", title: "春夜喜雨", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平八庚", tags: ["春"] },
  { content: "随风潜入夜", length: 5, author: "杜甫", dynasty: "唐", title: "春夜喜雨", ping_ze_pattern: "11100", end_tone: "仄", rhyme_group: "仄声", tags: ["风", "夜"] },
  { content: "润物细无声", length: 5, author: "杜甫", dynasty: "唐", title: "春夜喜雨", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平八庚", tags: ["物", "声"] },
  { content: "两个黄鹂鸣翠柳", length: 7, author: "杜甫", dynasty: "唐", title: "绝句", ping_ze_pattern: "0011100", end_tone: "仄", rhyme_group: "仄声", tags: ["黄鹂", "柳"] },
  { content: "一行白鹭上青天", length: 7, author: "杜甫", dynasty: "唐", title: "绝句", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平一先", tags: ["白鹭", "天"] },
  { content: "窗含西岭千秋雪", length: 7, author: "杜甫", dynasty: "唐", title: "绝句", ping_ze_pattern: "1100110", end_tone: "仄", rhyme_group: "仄声", tags: ["雪", "秋"] },
  { content: "门泊东吴万里船", length: 7, author: "杜甫", dynasty: "唐", title: "绝句", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平一先", tags: ["船"] },

  // 王之涣 / 杜牧 / 孟浩然 / 柳宗元 / 白居易
  { content: "白日依山尽", length: 5, author: "王之涣", dynasty: "唐", title: "登鹳雀楼", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["日", "山"] },
  { content: "黄河入海流", length: 5, author: "王之涣", dynasty: "唐", title: "登鹳雀楼", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平十一尤", tags: ["黄河", "海", "流"] },
  { content: "欲穷千里目", length: 5, author: "王之涣", dynasty: "唐", title: "登鹳雀楼", ping_ze_pattern: "11100", end_tone: "仄", rhyme_group: "仄声", tags: ["目"] },
  { content: "更上一层楼", length: 5, author: "王之涣", dynasty: "唐", title: "登鹳雀楼", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平十一尤", tags: ["楼"] },
  { content: "清明时节雨纷纷", length: 7, author: "杜牧", dynasty: "唐", title: "清明", ping_ze_pattern: "1110011", end_tone: "平", rhyme_group: "上平十二文", tags: ["清明", "雨"] },
  { content: "路上行人欲断魂", length: 7, author: "杜牧", dynasty: "唐", title: "清明", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "上平十二文", tags: ["路", "行人"] },
  { content: "借问酒家何处有", length: 7, author: "杜牧", dynasty: "唐", title: "清明", ping_ze_pattern: "0001100", end_tone: "仄", rhyme_group: "仄声", tags: ["酒家"] },
  { content: "牧童遥指杏花村", length: 7, author: "杜牧", dynasty: "唐", title: "清明", ping_ze_pattern: "0110001", end_tone: "平", rhyme_group: "上平十二文", tags: ["牧童", "花", "村"] },
  { content: "远上寒山石径斜", length: 7, author: "杜牧", dynasty: "唐", title: "山行", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平六麻", tags: ["山", "石"] },
  { content: "白云生处有人家", length: 7, author: "杜牧", dynasty: "唐", title: "山行", ping_ze_pattern: "0111001", end_tone: "平", rhyme_group: "下平六麻", tags: ["云", "人家"] },
  { content: "停车坐爱枫林晚", length: 7, author: "杜牧", dynasty: "唐", title: "山行", ping_ze_pattern: "1100110", end_tone: "仄", rhyme_group: "仄声", tags: ["枫林", "晚"] },
  { content: "霜叶红于二月花", length: 7, author: "杜牧", dynasty: "唐", title: "山行", ping_ze_pattern: "1011001", end_tone: "平", rhyme_group: "下平六麻", tags: ["霜", "叶", "红", "花"] },
  { content: "千山鸟飞绝", length: 5, author: "柳宗元", dynasty: "唐", title: "江雪", ping_ze_pattern: "11000", end_tone: "仄", rhyme_group: "仄声", tags: ["山", "鸟", "雪"] },
  { content: "万径人踪灭", length: 5, author: "柳宗元", dynasty: "唐", title: "江雪", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["人", "雪"] },
  { content: "孤舟蓑笠翁", length: 5, author: "柳宗元", dynasty: "唐", title: "江雪", ping_ze_pattern: "11101", end_tone: "平", rhyme_group: "上平一东", tags: ["舟", "翁"] },
  { content: "独钓寒江雪", length: 5, author: "柳宗元", dynasty: "唐", title: "江雪", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["雪", "江", "寒"] }
];

const dbPath = path.join(__dirname, '../src/data/poetry_db.js');
let fileContent = fs.readFileSync(dbPath, 'utf-8');

// 提取 JSON 部分
const jsonStart = fileContent.indexOf('[');
const jsonEnd = fileContent.lastIndexOf(']') + 1;

if (jsonStart !== -1 && jsonEnd !== -1) {
  const existingList = JSON.parse(fileContent.slice(jsonStart, jsonEnd));
  console.log(`原数据库已有 ${existingList.length} 条数据。正在注入唐诗绝妙名篇...`);

  const map = new Map();
  existingList.forEach(item => map.set(item.content, item));

  let addedCount = 0;
  TANG_CLASSICS.forEach((item, idx) => {
    if (!map.has(item.content)) {
      map.set(item.content, {
        id: `tang_classic_${idx + 1}`,
        ...item
      });
      addedCount++;
    }
  });

  const mergedList = Array.from(map.values());

  const newCode = `/**
 * 古诗集句工程 - 大容量【100% 真实古诗原名】数据库
 * 包含唐诗、宋词精选全量数据，共收录 ${mergedList.length} 条带真实原诗名的名句。
 */

export const POETRY_DATABASE = ${JSON.stringify(mergedList, null, 2)};
`;

  fs.writeFileSync(dbPath, newCode, 'utf-8');
  console.log(`🎉 成功合并！总条数提升至 ${mergedList.length} 条（新增 ${addedCount} 条名篇经典）！`);
}
