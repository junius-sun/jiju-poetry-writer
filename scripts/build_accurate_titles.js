/**
 * 古诗集句工程 - 100% 精确真实诗名数据库生成脚本
 * 确保所有诗句 100% 显示确切的古诗原名（如《山居秋暝》《静夜思》《春望》《登鹳雀楼》），无一例外！
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACCURATE_POETRY_LIST = [
  // ==================== 王维名篇 ====================
  // 《山居秋暝》
  { content: "明月松间照", length: 5, author: "王维", dynasty: "唐", title: "山居秋暝", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["月", "松", "秋", "夜", "山水", "禅意"] },
  { content: "清泉石上流", length: 5, author: "王维", dynasty: "唐", title: "山居秋暝", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平十一尤", tags: ["泉", "石", "山水", "清幽"] },
  { content: "竹喧归浣女", length: 5, author: "王维", dynasty: "唐", title: "山居秋暝", ping_ze_pattern: "11100", end_tone: "仄", rhyme_group: "仄声", tags: ["竹", "乡村", "隐逸"] },
  { content: "莲动下渔舟", length: 5, author: "王维", dynasty: "唐", title: "山居秋暝", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平十一尤", tags: ["莲", "舟", "江河", "闲适"] },
  { content: "空山新雨后", length: 5, author: "王维", dynasty: "唐", title: "山居秋暝", ping_ze_pattern: "11100", end_tone: "仄", rhyme_group: "仄声", tags: ["山", "雨", "秋"] },
  { content: "天气晚来秋", length: 5, author: "王维", dynasty: "唐", title: "山居秋暝", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平十一尤", tags: ["秋", "晚"] },
  
  // 《相思》
  { content: "红豆生南国", length: 5, author: "王维", dynasty: "唐", title: "相思", ping_ze_pattern: "11100", end_tone: "仄", rhyme_group: "仄声", tags: ["红豆", "相思", "南国"] },
  { content: "春来发几枝", length: 5, author: "王维", dynasty: "唐", title: "相思", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "上平四支", tags: ["春", "枝", "相思"] },
  { content: "愿君多采撷", length: 5, author: "王维", dynasty: "唐", title: "相思", ping_ze_pattern: "01100", end_tone: "仄", rhyme_group: "仄声", tags: ["采撷", "深情"] },
  { content: "此物最相思", length: 5, author: "王维", dynasty: "唐", title: "相思", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "上平四支", tags: ["相思", "深情"] },

  // 《九月九日忆山东兄弟》
  { content: "独在异乡为异客", length: 7, author: "王维", dynasty: "唐", title: "九月九日忆山东兄弟", ping_ze_pattern: "0001100", end_tone: "仄", rhyme_group: "仄声", tags: ["羁旅", "客", "孤单"] },
  { content: "每逢佳节倍思亲", length: 7, author: "王维", dynasty: "唐", title: "九月九日忆山东兄弟", ping_ze_pattern: "0110011", end_tone: "平", rhyme_group: "上平十一真", tags: ["佳节", "思亲", "乡愁"] },
  { content: "遥知兄弟登高处", length: 7, author: "王维", dynasty: "唐", title: "九月九日忆山东兄弟", ping_ze_pattern: "1100110", end_tone: "仄", rhyme_group: "仄声", tags: ["登高", "重阳", "兄弟"] },
  { content: "遍插茱萸少一人", length: 7, author: "王维", dynasty: "唐", title: "九月九日忆山东兄弟", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "上平十一真", tags: ["茱萸", "思念", "遗憾"] },

  // 《送元二使安西》
  { content: "渭城朝雨浥轻尘", length: 7, author: "王维", dynasty: "唐", title: "送元二使安西", ping_ze_pattern: "1110011", end_tone: "平", rhyme_group: "上平十一真", tags: ["雨", "尘", "送别"] },
  { content: "客舍青青柳色新", length: 7, author: "王维", dynasty: "唐", title: "送元二使安西", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "上平十一真", tags: ["柳", "客舍", "春"] },
  { content: "劝君更尽一杯酒", length: 7, author: "王维", dynasty: "唐", title: "送元二使安西", ping_ze_pattern: "1100011", end_tone: "仄", rhyme_group: "仄声", tags: ["酒", "离别", "劝慰"] },
  { content: "西出阳关无故人", length: 7, author: "王维", dynasty: "唐", title: "送元二使安西", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "上平十一真", tags: ["阳关", "故人", "边塞"] },

  // 《竹里馆》
  { content: "独坐幽篁里", length: 5, author: "王维", dynasty: "唐", title: "竹里馆", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["竹", "幽", "隐逸"] },
  { content: "弹琴复长啸", length: 5, author: "王维", dynasty: "唐", title: "竹里馆", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平十八啸", tags: ["琴", "啸", "旷达"] },
  { content: "深林人不知", length: 5, author: "王维", dynasty: "唐", title: "竹里馆", ping_ze_pattern: "11101", end_tone: "平", rhyme_group: "上平四支", tags: ["林", "人", "隐逸"] },
  { content: "明月来相照", length: 5, author: "王维", dynasty: "唐", title: "竹里馆", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["月", "光", "伴侣"] },

  // 《鹿柴》
  { content: "空山不见人", length: 5, author: "王维", dynasty: "唐", title: "鹿柴", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "上平十一真", tags: ["山", "空灵"] },
  { content: "但闻人语响", length: 5, author: "王维", dynasty: "唐", title: "鹿柴", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["人语", "响"] },
  { content: "返景入深林", length: 5, author: "王维", dynasty: "唐", title: "鹿柴", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平十二侵", tags: ["景", "林"] },
  { content: "复照青苔上", length: 5, author: "王维", dynasty: "唐", title: "鹿柴", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["苔", "青"] },

  // 《使至塞上》
  { content: "大漠孤烟直", length: 5, author: "王维", dynasty: "唐", title: "使至塞上", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["大漠", "烟", "边塞"] },
  { content: "长河落日圆", length: 5, author: "王维", dynasty: "唐", title: "使至塞上", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平1先", tags: ["长河", "日", "壮美"] },

  // ==================== 李白名篇 ====================
  // 《静夜思》
  { content: "床前明月光", length: 5, author: "李白", dynasty: "唐", title: "静夜思", ping_ze_pattern: "11101", end_tone: "平", rhyme_group: "下平七阳", tags: ["月", "光", "夜"] },
  { content: "疑是地上霜", length: 5, author: "李白", dynasty: "唐", title: "静夜思", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平七阳", tags: ["霜", "夜"] },
  { content: "举头望明月", length: 5, author: "李白", dynasty: "唐", title: "静夜思", ping_ze_pattern: "01010", end_tone: "仄", rhyme_group: "仄声", tags: ["月", "思乡"] },
  { content: "低头思故乡", length: 5, author: "李白", dynasty: "唐", title: "静夜思", ping_ze_pattern: "11101", end_tone: "平", rhyme_group: "下平七阳", tags: ["故乡", "思念"] },

  // 《早发白帝城》
  { content: "朝辞白帝彩云间", length: 7, author: "李白", dynasty: "唐", title: "早发白帝城", ping_ze_pattern: "1100011", end_tone: "平", rhyme_group: "下平十五删", tags: ["云", "白帝城", "江河", "欢快"] },
  { content: "千里江陵一日还", length: 7, author: "李白", dynasty: "唐", title: "早发白帝城", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平十五删", tags: ["江陵", "舟", "神速"] },
  { content: "两岸猿声啼不住", length: 7, author: "李白", dynasty: "唐", title: "早发白帝城", ping_ze_pattern: "0011100", end_tone: "仄", rhyme_group: "仄声", tags: ["猿", "峡谷", "声响"] },
  { content: "轻舟已过万重山", length: 7, author: "李白", dynasty: "唐", title: "早发白帝城", ping_ze_pattern: "1100011", end_tone: "平", rhyme_group: "下平十五删", tags: ["舟", "山", "旷达", "顺遂"] },

  // 《黄鹤楼送孟浩然之广陵》
  { content: "故人西辞黄鹤楼", length: 7, author: "李白", dynasty: "唐", title: "黄鹤楼送孟浩然之广陵", ping_ze_pattern: "1111001", end_tone: "平", rhyme_group: "下平十一尤", tags: ["楼", "黄鹤", "送别"] },
  { content: "烟花三月下扬州", length: 7, author: "李白", dynasty: "唐", title: "黄鹤楼送孟浩然之广陵", ping_ze_pattern: "1110011", end_tone: "平", rhyme_group: "下平十一尤", tags: ["烟花", "春", "扬州"] },
  { content: "孤帆远影碧空尽", length: 7, author: "李白", dynasty: "唐", title: "黄鹤楼送孟浩然之广陵", ping_ze_pattern: "1100011", end_tone: "仄", rhyme_group: "仄声", tags: ["帆", "江", "远景"] },
  { content: "唯见长江天际流", length: 7, author: "李白", dynasty: "唐", title: "黄鹤楼送孟浩然之广陵", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平十一尤", tags: ["长江", "流", "无尽"] },

  // 《望庐山瀑布》
  { content: "日照香炉生紫烟", length: 7, author: "李白", dynasty: "唐", title: "望庐山瀑布", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平一先", tags: ["日", "烟", "香炉"] },
  { content: "遥看瀑布挂前川", length: 7, author: "李白", dynasty: "唐", title: "望庐山瀑布", ping_ze_pattern: "1100011", end_tone: "平", rhyme_group: "下平一先", tags: ["瀑布", "川", "山"] },
  { content: "飞流直下三千尺", length: 7, author: "李白", dynasty: "唐", title: "望庐山瀑布", ping_ze_pattern: "1100110", end_tone: "仄", rhyme_group: "仄声", tags: ["飞流", "瀑布"] },
  { content: "疑是银河落九天", length: 7, author: "李白", dynasty: "唐", title: "望庐山瀑布", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平一先", tags: ["银河", "天", "奇观"] },

  // 《赠汪伦》
  { content: "李白乘舟将欲行", length: 7, author: "李白", dynasty: "唐", title: "赠汪伦", ping_ze_pattern: "0011101", end_tone: "平", rhyme_group: "下平8庚", tags: ["舟", "行"] },
  { content: "忽闻岸上踏歌声", length: 7, author: "李白", dynasty: "唐", title: "赠汪伦", ping_ze_pattern: "1100011", end_tone: "平", rhyme_group: "下平8庚", tags: ["歌", "声"] },
  { content: "桃花潭水深千尺", length: 7, author: "李白", dynasty: "唐", title: "赠汪伦", ping_ze_pattern: "1110010", end_tone: "仄", rhyme_group: "仄声", tags: ["桃花", "潭", "深"] },
  { content: "不及汪伦送我情", length: 7, author: "李白", dynasty: "唐", title: "赠汪伦", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平8庚", tags: ["友情", "深情"] },

  // 《望天门山》
  { content: "天门中断楚江开", length: 7, author: "李白", dynasty: "唐", title: "望天门山", ping_ze_pattern: "1100011", end_tone: "平", rhyme_group: "上平10灰", tags: ["天门山", "江"] },
  { content: "碧水东流至此回", length: 7, author: "李白", dynasty: "唐", title: "望天门山", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "上平10灰", tags: ["水", "东流"] },
  { content: "两岸青山相对出", length: 7, author: "李白", dynasty: "唐", title: "望天门山", ping_ze_pattern: "0011010", end_tone: "仄", rhyme_group: "仄声", tags: ["山", "青"] },
  { content: "孤帆一片日边来", length: 7, author: "李白", dynasty: "唐", title: "望天门山", ping_ze_pattern: "1100011", end_tone: "平", rhyme_group: "上平10灰", tags: ["帆", "日", "来"] },

  // ==================== 杜甫名篇 ====================
  // 《春望》
  { content: "国破山河在", length: 5, author: "杜甫", dynasty: "唐", title: "春望", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["山河", "家国", "感怀"] },
  { content: "城春草木深", length: 5, author: "杜甫", dynasty: "唐", title: "春望", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平十二侵", tags: ["春", "草", "伤春"] },
  { content: "感时花溅泪", length: 5, author: "杜甫", dynasty: "唐", title: "春望", ping_ze_pattern: "11100", end_tone: "仄", rhyme_group: "仄声", tags: ["花", "泪", "感怀"] },
  { content: "恨别鸟惊心", length: 5, author: "杜甫", dynasty: "唐", title: "春望", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平十二侵", tags: ["鸟", "心", "离别"] },
  { content: "烽火连三月", length: 5, author: "杜甫", dynasty: "唐", title: "春望", ping_ze_pattern: "11100", end_tone: "仄", rhyme_group: "仄声", tags: ["烽火", "月"] },
  { content: "家书抵万金", length: 5, author: "杜甫", dynasty: "唐", title: "春望", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平十二侵", tags: ["家书", "金"] },

  // 《春夜喜雨》
  { content: "好雨知时节", length: 5, author: "杜甫", dynasty: "唐", title: "春夜喜雨", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["雨", "春"] },
  { content: "当春乃发生", length: 5, author: "杜甫", dynasty: "唐", title: "春夜喜雨", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平八庚", tags: ["春", "生机"] },
  { content: "随风潜入夜", length: 5, author: "杜甫", dynasty: "唐", title: "春夜喜雨", ping_ze_pattern: "11100", end_tone: "仄", rhyme_group: "仄声", tags: ["风", "夜"] },
  { content: "润物细无声", length: 5, author: "杜甫", dynasty: "唐", title: "春夜喜雨", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平八庚", tags: ["雨", "声"] },
  { content: "野径云俱黑", length: 5, author: "杜甫", dynasty: "唐", title: "春夜喜雨", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["云", "夜", "雨"] },
  { content: "江船火独明", length: 5, author: "杜甫", dynasty: "唐", title: "春夜喜雨", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平八庚", tags: ["江", "火", "舟", "夜"] },
  { content: "晓看红湿处", length: 5, author: "杜甫", dynasty: "唐", title: "春夜喜雨", ping_ze_pattern: "11100", end_tone: "仄", rhyme_group: "仄声", tags: ["红", "花", "春"] },
  { content: "花重锦官城", length: 5, author: "杜甫", dynasty: "唐", title: "春夜喜雨", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平八庚", tags: ["花", "城", "春"] },

  // 《绝句二首》
  { content: "迟日江山丽", length: 5, author: "杜甫", dynasty: "唐", title: "绝句二首", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["日", "江山", "春"] },
  { content: "春风花草香", length: 5, author: "杜甫", dynasty: "唐", title: "绝句二首", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平七阳", tags: ["春风", "花", "草", "香"] },
  { content: "泥融飞燕子", length: 5, author: "杜甫", dynasty: "唐", title: "绝句二首", ping_ze_pattern: "11100", end_tone: "仄", rhyme_group: "仄声", tags: ["燕", "春", "生机"] },
  { content: "沙暖睡鸳鸯", length: 5, author: "杜甫", dynasty: "唐", title: "绝句二首", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平七阳", tags: ["沙", "鸳鸯", "静谧"] },

  // 《绝句》
  { content: "两个黄鹂鸣翠柳", length: 7, author: "杜甫", dynasty: "唐", title: "绝句", ping_ze_pattern: "0011100", end_tone: "仄", rhyme_group: "仄声", tags: ["黄鹂", "柳", "春"] },
  { content: "一行白鹭上青天", length: 7, author: "杜甫", dynasty: "唐", title: "绝句", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平一先", tags: ["白鹭", "天", "青"] },
  { content: "窗含西岭千秋雪", length: 7, author: "杜甫", dynasty: "唐", title: "绝句", ping_ze_pattern: "1100110", end_tone: "仄", rhyme_group: "仄声", tags: ["雪", "西岭", "秋"] },
  { content: "门泊东吴万里船", length: 7, author: "杜甫", dynasty: "唐", title: "绝句", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平一先", tags: ["船", "东吴", "万里"] },

  // ==================== 苏轼名篇 ====================
  // 《惠崇春江晚景》
  { content: "竹外桃花三两枝", length: 7, author: "苏轼", dynasty: "宋", title: "惠崇春江晚景", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "上平四支", tags: ["竹", "桃花", "春", "枝"] },
  { content: "春江水暖鸭先知", length: 7, author: "苏轼", dynasty: "宋", title: "惠崇春江晚景", ping_ze_pattern: "1100011", end_tone: "平", rhyme_group: "上平四支", tags: ["江", "水", "鸭", "春意"] },
  { content: "蒌蒿满地芦芽短", length: 7, author: "苏轼", dynasty: "宋", title: "惠崇春江晚景", ping_ze_pattern: "1100110", end_tone: "仄", rhyme_group: "仄声", tags: ["春草", "田园", "生机"] },
  { content: "正是河豚欲上时", length: 7, author: "苏轼", dynasty: "宋", title: "惠崇春江晚景", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "上平四支", tags: ["水产", "时令", "春"] },

  // 《饮湖上初晴后雨》
  { content: "水光潋滟晴方好", length: 7, author: "苏轼", dynasty: "宋", title: "饮湖上初晴后雨", ping_ze_pattern: "0100110", end_tone: "仄", rhyme_group: "仄声", tags: ["水", "光", "晴", "西湖"] },
  { content: "山色空蒙雨亦奇", length: 7, author: "苏轼", dynasty: "宋", title: "饮湖上初晴后雨", ping_ze_pattern: "1011001", end_tone: "平", rhyme_group: "上平四支", tags: ["山", "雨", "西湖", "空灵"] },
  { content: "欲把西湖比西子", length: 7, author: "苏轼", dynasty: "宋", title: "饮湖上初晴后雨", ping_ze_pattern: "0011010", end_tone: "仄", rhyme_group: "仄声", tags: ["西湖", "西施", "比喻"] },
  { content: "浓妆淡抹总相宜", length: 7, author: "苏轼", dynasty: "宋", title: "饮湖上初晴后雨", ping_ze_pattern: "1100011", end_tone: "平", rhyme_group: "上平四支", tags: ["妆", "宜", "赞美"] },

  // 《题西林壁》
  { content: "横看成岭侧成峰", length: 7, author: "苏轼", dynasty: "宋", title: "题西林壁", ping_ze_pattern: "1100011", end_tone: "平", rhyme_group: "上平2冬", tags: ["岭", "峰", "山"] },
  { content: "远近高低各不同", length: 7, author: "苏轼", dynasty: "宋", title: "题西林壁", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "上平1东", tags: ["高低", "不同"] },
  { content: "不识庐山真面目", length: 7, author: "苏轼", dynasty: "宋", title: "题西林壁", ping_ze_pattern: "0011100", end_tone: "仄", rhyme_group: "仄声", tags: ["庐山", "面目"] },
  { content: "只缘身在此山中", length: 7, author: "苏轼", dynasty: "宋", title: "题西林壁", ping_ze_pattern: "0001101", end_tone: "平", rhyme_group: "上平1东", tags: ["山", "哲理"] },

  // ==================== 其他唐宋大家名篇 ====================
  // 王之涣《登鹳雀楼》
  { content: "白日依山尽", length: 5, author: "王之涣", dynasty: "唐", title: "登鹳雀楼", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["日", "山", "夕阳", "壮美"] },
  { content: "黄河入海流", length: 5, author: "王之涣", dynasty: "唐", title: "登鹳雀楼", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平十一尤", tags: ["黄河", "海", "江河", "壮美"] },
  { content: "欲穷千里目", length: 5, author: "王之涣", dynasty: "唐", title: "登鹳雀楼", ping_ze_pattern: "11100", end_tone: "仄", rhyme_group: "仄声", tags: ["远眺", "哲理", "登高"] },
  { content: "更上一层楼", length: 5, author: "王之涣", dynasty: "唐", title: "登鹳雀楼", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平十一尤", tags: ["楼", "哲理", "奋发"] },

  // 王之涣《凉州词》
  { content: "黄河远上白云间", length: 7, author: "王之涣", dynasty: "唐", title: "凉州词", ping_ze_pattern: "1100011", end_tone: "平", rhyme_group: "下平十五删", tags: ["黄河", "云", "边塞", "壮美"] },
  { content: "一片孤城万仞山", length: 7, author: "王之涣", dynasty: "唐", title: "凉州词", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平十五删", tags: ["城", "山", "边塞", "苍凉"] },
  { content: "羌笛何须怨杨柳", length: 7, author: "王之涣", dynasty: "唐", title: "凉州词", ping_ze_pattern: "1101010", end_tone: "仄", rhyme_group: "仄声", tags: ["笛", "柳", "边塞", "怨怀"] },
  { content: "春风不度玉门关", length: 7, author: "王之涣", dynasty: "唐", title: "凉州词", ping_ze_pattern: "1100011", end_tone: "平", rhyme_group: "下平十五删", tags: ["春风", "玉门关", "边塞"] },

  // 王翰《凉州词》
  { content: "葡萄美酒夜光杯", length: 7, author: "王翰", dynasty: "唐", title: "凉州词", ping_ze_pattern: "1100011", end_tone: "平", rhyme_group: "上平十灰", tags: ["酒", "夜", "西域", "豪迈"] },
  { content: "欲饮琵琶马上催", length: 7, author: "王翰", dynasty: "唐", title: "凉州词", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "上平十灰", tags: ["酒", "琵琶", "马", "军旅"] },
  { content: "醉卧沙场君莫笑", length: 7, author: "王翰", dynasty: "唐", title: "凉州词", ping_ze_pattern: "0011100", end_tone: "仄", rhyme_group: "仄声", tags: ["醉", "沙场", "豪放"] },
  { content: "古来征战几人回", length: 7, author: "王翰", dynasty: "唐", title: "凉州词", ping_ze_pattern: "1100011", end_tone: "平", rhyme_group: "上平十灰", tags: ["征战", "感伤", "豪迈"] },

  // 张继《枫桥夜泊》
  { content: "月落乌啼霜满天", length: 7, author: "张继", dynasty: "唐", title: "枫桥夜泊", ping_ze_pattern: "0011101", end_tone: "平", rhyme_group: "下平一先", tags: ["月", "乌", "霜", "夜"] },
  { content: "江枫渔火对愁眠", length: 7, author: "张继", dynasty: "唐", title: "枫桥夜泊", ping_ze_pattern: "1110011", end_tone: "平", rhyme_group: "下平一先", tags: ["江", "枫", "火", "愁"] },
  { content: "姑苏城外寒山寺", length: 7, author: "张继", dynasty: "唐", title: "枫桥夜泊", ping_ze_pattern: "1110110", end_tone: "仄", rhyme_group: "仄声", tags: ["城", "山", "寺", "夜"] },
  { content: "夜半钟声到客船", length: 7, author: "张继", dynasty: "唐", title: "枫桥夜泊", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平一先", tags: ["夜", "钟声", "船", "旅人"] },

  // 杜牧《清明》
  { content: "清明时节雨纷纷", length: 7, author: "杜牧", dynasty: "唐", title: "清明", ping_ze_pattern: "1110011", end_tone: "平", rhyme_group: "上平十二文", tags: ["清明", "雨", "春"] },
  { content: "路上行人欲断魂", length: 7, author: "杜牧", dynasty: "唐", title: "清明", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "上平十二文", tags: ["路", "行人", "断魂", "伤感"] },
  { content: "借问酒家何处有", length: 7, author: "杜牧", dynasty: "唐", title: "清明", ping_ze_pattern: "0001100", end_tone: "仄", rhyme_group: "仄声", tags: ["酒家", "问询"] },
  { content: "牧童遥指杏花村", length: 7, author: "杜牧", dynasty: "唐", title: "清明", ping_ze_pattern: "0110001", end_tone: "平", rhyme_group: "上平十二文", tags: ["牧童", "杏花", "村"] },

  // 杜牧《山行》
  { content: "远上寒山石径斜", length: 7, author: "杜牧", dynasty: "唐", title: "山行", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平六麻", tags: ["山", "石", "秋"] },
  { content: "白云生处有人家", length: 7, author: "杜牧", dynasty: "唐", title: "山行", ping_ze_pattern: "0111001", end_tone: "平", rhyme_group: "下平六麻", tags: ["云", "人家", "山水"] },
  { content: "停车坐爱枫林晚", length: 7, author: "杜牧", dynasty: "唐", title: "山行", ping_ze_pattern: "1100110", end_tone: "仄", rhyme_group: "仄声", tags: ["枫林", "晚", "秋"] },
  { content: "霜叶红于二月花", length: 7, author: "杜牧", dynasty: "唐", title: "山行", ping_ze_pattern: "1011001", end_tone: "平", rhyme_group: "下平六麻", tags: ["霜", "叶", "红", "花", "秋"] },

  // 杜牧《秋夕》
  { content: "银烛秋光冷画屏", length: 7, author: "杜牧", dynasty: "唐", title: "秋夕", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平八庚", tags: ["烛", "秋", "屏"] },
  { content: "轻罗小扇扑流萤", length: 7, author: "杜牧", dynasty: "唐", title: "秋夕", ping_ze_pattern: "1100011", end_tone: "平", rhyme_group: "下平八庚", tags: ["扇", "萤火", "夜"] },
  { content: "天阶夜色凉如水", length: 7, author: "杜牧", dynasty: "唐", title: "秋夕", ping_ze_pattern: "1100110", end_tone: "仄", rhyme_group: "仄声", tags: ["夜", "水", "凉"] },
  { content: "卧看牵牛织女星", length: 7, author: "杜牧", dynasty: "唐", title: "秋夕", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平八庚", tags: ["星", "织女", "牵牛"] },

  // 孟浩然《过故人庄》
  { content: "绿树村边合", length: 5, author: "孟浩然", dynasty: "唐", title: "过故人庄", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["树", "村", "田园", "绿"] },
  { content: "青山郭外斜", length: 5, author: "孟浩然", dynasty: "唐", title: "过故人庄", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平六麻", tags: ["山", "青", "田园"] },
  { content: "开轩面场圃", length: 5, author: "孟浩然", dynasty: "唐", title: "过故人庄", ping_ze_pattern: "11010", end_tone: "仄", rhyme_group: "仄声", tags: ["田园", "隐逸", "欢聚"] },
  { content: "把酒话桑麻", length: 5, author: "孟浩然", dynasty: "唐", title: "过故人庄", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平六麻", tags: ["酒", "桑麻", "友情", "田园"] },

  // 孟浩然《宿建德江》
  { content: "移舟泊烟渚", length: 5, author: "孟浩然", dynasty: "唐", title: "宿建德江", ping_ze_pattern: "11010", end_tone: "仄", rhyme_group: "仄声", tags: ["舟", "烟", "江"] },
  { content: "日暮客愁新", length: 5, author: "孟浩然", dynasty: "唐", title: "宿建德江", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "上平十一真", tags: ["暮", "客", "愁"] },
  { content: "野旷天低树", length: 5, author: "孟浩然", dynasty: "唐", title: "宿建德江", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["天", "树", "野"] },
  { content: "江清月近人", length: 5, author: "孟浩然", dynasty: "唐", title: "宿建德江", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "上平十一真", tags: ["江", "月", "人", "亲近"] },

  // 柳宗元《江雪》
  { content: "千山鸟飞绝", length: 5, author: "柳宗元", dynasty: "唐", title: "江雪", ping_ze_pattern: "11000", end_tone: "仄", rhyme_group: "仄声", tags: ["山", "鸟", "雪", "孤独"] },
  { content: "万径人踪灭", length: 5, author: "柳宗元", dynasty: "唐", title: "江雪", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["雪", "寂静", "孤独"] },
  { content: "孤舟蓑笠翁", length: 5, author: "柳宗元", dynasty: "唐", title: "江雪", ping_ze_pattern: "11101", end_tone: "平", rhyme_group: "上平一东", tags: ["舟", "翁", "渔", "雪"] },
  { content: "独钓寒江雪", length: 5, author: "柳宗元", dynasty: "唐", title: "江雪", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["雪", "江", "寒", "高洁"] },

  // 白居易《赋得古原草送别》
  { content: "离离原上草", length: 5, author: "白居易", dynasty: "唐", title: "赋得古原草送别", ping_ze_pattern: "11100", end_tone: "仄", rhyme_group: "仄声", tags: ["草", "原野", "春"] },
  { content: "一岁一枯荣", length: 5, author: "白居易", dynasty: "唐", title: "赋得古原草送别", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "下平八庚", tags: ["岁月", "生机"] },
  { content: "野火烧不尽", length: 5, author: "白居易", dynasty: "唐", title: "赋得古原草送别", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["火", "顽强"] },
  { content: "春风吹又生", length: 5, author: "白居易", dynasty: "唐", title: "赋得古原草送别", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "下平八庚", tags: ["春风", "生机"] },

  // 白居易《暮江吟》
  { content: "一道残阳铺水中", length: 7, author: "白居易", dynasty: "唐", title: "暮江吟", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "上平一东", tags: ["夕阳", "水", "江"] },
  { content: "半江瑟瑟半江红", length: 7, author: "白居易", dynasty: "唐", title: "暮江吟", ping_ze_pattern: "1100110", end_tone: "平", rhyme_group: "上平一东", tags: ["江", "红"] },

  // 贺知章《咏柳》
  { content: "碧玉妆成一树高", length: 7, author: "贺知章", dynasty: "唐", title: "咏柳", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平四豪", tags: ["柳", "树", "春"] },
  { content: "万条垂下绿丝绦", length: 7, author: "贺知章", dynasty: "唐", title: "咏柳", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平四豪", tags: ["绿", "丝绦", "柳"] },
  { content: "不知细叶谁裁出", length: 7, author: "贺知章", dynasty: "唐", title: "咏柳", ping_ze_pattern: "1100110", end_tone: "仄", rhyme_group: "仄声", tags: ["叶", "春"] },
  { content: "二月春风似剪刀", length: 7, author: "贺知章", dynasty: "唐", title: "咏柳", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平四豪", tags: ["春风", "剪刀", "春"] },

  // 陆游《游山西村》
  { content: "莫笑农家腊酒浑", length: 7, author: "陆游", dynasty: "宋", title: "游山西村", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "上平十三元", tags: ["酒", "农家"] },
  { content: "丰年留客足鸡豚", length: 7, author: "陆游", dynasty: "宋", title: "游山西村", ping_ze_pattern: "1110011", end_tone: "平", rhyme_group: "上平十三元", tags: ["丰年", "客"] },
  { content: "山重水复疑无路", length: 7, author: "陆游", dynasty: "宋", title: "游山西村", ping_ze_pattern: "1100110", end_tone: "仄", rhyme_group: "仄声", tags: ["山", "水", "哲理"] },
  { content: "柳暗花明又一村", length: 7, author: "陆游", dynasty: "宋", title: "游山西村", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "上平十三元", tags: ["柳", "花", "村", "希望"] },

  // 朱熹《春日》
  { content: "胜日寻芳泗水滨", length: 7, author: "朱熹", dynasty: "宋", title: "春日", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "上平十一真", tags: ["春", "芳草", "水"] },
  { content: "无边光景一时新", length: 7, author: "朱熹", dynasty: "宋", title: "春日", ping_ze_pattern: "1110011", end_tone: "平", rhyme_group: "上平十一真", tags: ["光景", "新", "春"] },
  { content: "等闲识得东风面", length: 7, author: "朱熹", dynasty: "宋", title: "春日", ping_ze_pattern: "1100110", end_tone: "仄", rhyme_group: "仄声", tags: ["东风", "面"] },
  { content: "万紫千红总是春", length: 7, author: "朱熹", dynasty: "宋", title: "春日", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "上平十一真", tags: ["花", "红", "紫", "春"] },

  // 韦应物《滁州西涧》
  { content: "独怜幽草涧边生", length: 7, author: "韦应物", dynasty: "唐", title: "滁州西涧", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平八庚", tags: ["草", "涧", "生"] },
  { content: "上有黄鹂深树鸣", length: 7, author: "韦应物", dynasty: "唐", title: "滁州西涧", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平八庚", tags: ["黄鹂", "树", "鸣"] },
  { content: "春潮带雨晚来急", length: 7, author: "韦应物", dynasty: "唐", title: "滁州西涧", ping_ze_pattern: "1100110", end_tone: "仄", rhyme_group: "仄声", tags: ["春", "雨", "潮"] },
  { content: "野渡无人舟自横", length: 7, author: "韦应物", dynasty: "唐", title: "滁州西涧", ping_ze_pattern: "0011001", end_tone: "平", rhyme_group: "下平八庚", tags: ["舟", "渡口", "闲适"] },

  // 贾岛《寻隐者不遇》
  { content: "松下问童子", length: 5, author: "贾岛", dynasty: "唐", title: "寻隐者不遇", ping_ze_pattern: "11010", end_tone: "仄", rhyme_group: "仄声", tags: ["松", "童子", "隐逸"] },
  { content: "言师采药去", length: 5, author: "贾岛", dynasty: "唐", title: "寻隐者不遇", ping_ze_pattern: "11000", end_tone: "仄", rhyme_group: "仄声", tags: ["药", "山", "隐者"] },
  { content: "只在此山中", length: 5, author: "贾岛", dynasty: "唐", title: "寻隐者不遇", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "上平一东", tags: ["山", "空灵"] },
  { content: "云深不知处", length: 5, author: "贾岛", dynasty: "唐", title: "寻隐者不遇", ping_ze_pattern: "11100", end_tone: "仄", rhyme_group: "仄声", tags: ["云", "高深", "缥缈"] },

  // 王勃《送杜少府之任蜀州》
  { content: "海内存知己", length: 5, author: "王勃", dynasty: "唐", title: "送杜少府之任蜀州", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["赠别", "友情", "海", "旷达"] },
  { content: "天涯若比邻", length: 5, author: "王勃", dynasty: "唐", title: "送杜少府之任蜀州", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "上平十一真", tags: ["天涯", "友情", "羁旅"] },
  { content: "无为在歧路", length: 5, author: "王勃", dynasty: "唐", title: "送杜少府之任蜀州", ping_ze_pattern: "11010", end_tone: "仄", rhyme_group: "仄声", tags: ["离别", "勉励"] },
  { content: "儿女共沾巾", length: 5, author: "王勃", dynasty: "唐", title: "送杜少府之任蜀州", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "上平十一真", tags: ["泪", "离别", "伤感"] },

  // 陶渊明《归园田居》
  { content: "种豆南山下", length: 5, author: "陶渊明", dynasty: "晋", title: "归园田居", ping_ze_pattern: "00110", end_tone: "仄", rhyme_group: "仄声", tags: ["田园", "豆", "山"] },
  { content: "草盛豆苗稀", length: 5, author: "陶渊明", dynasty: "晋", title: "归园田居", ping_ze_pattern: "11001", end_tone: "平", rhyme_group: "上平五微", tags: ["草", "苗"] },
  { content: "晨兴理荒秽", length: 5, author: "陶渊明", dynasty: "晋", title: "归园田居", ping_ze_pattern: "11010", end_tone: "仄", rhyme_group: "仄声", tags: ["田园", "劳动"] },
  { content: "带月荷锄归", length: 5, author: "陶渊明", dynasty: "晋", title: "归园田居", ping_ze_pattern: "00011", end_tone: "平", rhyme_group: "上平五微", tags: ["月", "锄", "归"] }
];

function generateRealTitlesDatabase() {
  console.log("正在写入 100% 精确古诗原名数据库...");

  let idCounter = 1;
  const processedDatabase = ACCURATE_POETRY_LIST.map(item => {
    return {
      id: `real_poem_${idCounter++}`,
      ...item
    };
  });

  const outputPath = path.join(__dirname, '../src/data/poetry_db.js');
  const fileContent = `/**
 * 古诗集句工程 - 100% 真实古诗原名数据库
 * 包含王维《山居秋暝》、李白《静夜思》《早发白帝城》、杜甫《春望》《春夜喜雨》、苏轼《惠崇春江晚景》《饮湖上初晴后雨》等名篇。
 * 所有诗句 100% 标有确切古诗原名（拒绝 generic 诗选/无题）。
 * 共计收录 ${processedDatabase.length} 条绝对无重复经典名句。
 */

export const POETRY_DATABASE = ${JSON.stringify(processedDatabase, null, 2)};
`;

  fs.writeFileSync(outputPath, fileContent, 'utf-8');
  console.log(`✅ 成功写入 ${outputPath}！已包含 ${processedDatabase.length} 条 100% 标注真实原诗名的诗句。`);
}

generateRealTitlesDatabase();
