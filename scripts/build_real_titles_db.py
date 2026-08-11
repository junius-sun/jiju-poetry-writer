#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
精准诗名提取与古诗词数据库构建脚本
从 GitHub/Gitee 官方开源数据集获取唐诗宋词全量 JSON，确保 100% 诗句带精确诗词原名（如《山居秋暝》《静夜思》《春望》）。
"""

import os
import json
import urllib.request
import re

# 常见入声字表 (古音仄声)
RU_SHENG_SET = set([
  "国", "石", "月", "日", "白", "竹", "客", "一", "七", "八", "十", "百", "千", "绝", "灭", "出", "入",
  "独", "读", "拂", "骨", "急", "极", "集", "吉", "木", "目", "莫", "落", "屋", "复", "福", "服", "发",
  "滑", "达", "答", "得", "德", "特", "铁", "别", "雪", "缺", "说", "折", "哲", "截", "洁", "失", "识",
  "执", "拾", "室", "释", "实", "食", "息", "席", "熄", "夕", "极", "棘", "戟", "即", "积", "迹", "绩",
  "昔", "迫", "择", "质", "赤", "敕", "乞", "泣", "黑", "色", "薄", "脚", "角", "若", "弱", "郭", "阁"
])

# 平水韵 106 韵部简表 (平声)
RHYME_MAP = {
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
}

TAG_MAP = {
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
}

def get_tone(char):
  if char in RU_SHENG_SET:
    return "0" # 仄声 (入声)
  return "1"

def get_rhyme(char):
  for name, chars in RHYME_MAP.items():
    if char in chars:
      return name
  return "平水韵通用"

def extract_tags(text):
  tags = []
  for tag, kws in TAG_MAP.items():
    if any(kw in text for kw in kws):
      tags.append(tag)
  return tags if tags else ["感怀"]

# Gitee / CDN 镜像地址 (避免 GitHub 404/Block)
DATA_SOURCES = [
  "https://gitee.com/chinese-poetry/chinese-poetry/raw/master/%E5%94%90%E8%AF%97/%E5%94%90%E8%AF%97%E4%B8%89%E7%99%BE%E9%A6%96.json",
  "https://gitee.com/chinese-poetry/chinese-poetry/raw/master/%E5%94%90%E8%AF%97/%E5%8D%83%E5%AE%B6%E8%AF%97.json",
  "https://gitee.com/chinese-poetry/chinese-poetry/raw/master/%E5%AE%8B%E8%AF%8D/%E5%AE%8B%E8%AF%8D%E4%B8%89%E7%99%BE%E9%A6%96.json"
]

def fetch_json(url):
  req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
  with urllib.request.urlopen(req, timeout=15) as response:
    content = response.read().decode('utf-8')
    return json.loads(content)

def main():
  print("正在从 Gitee 镜像仓库抓取带有【精确原诗名】的古诗词数据...")
  unique_lines = {}
  id_counter = 1

  for url in DATA_SOURCES:
    try:
      print(f"正在读取: {url}...")
      data = fetch_json(url)
      for poem in data:
        # 获取精确原诗题目（词牌名或诗题）
        raw_title = poem.get("title") or poem.get("rhythmic") or ""
        author = poem.get("author") or "未知"
        paragraphs = poem.get("paragraphs") or poem.get("stanzas") or []

        # 过滤清洗标题
        title = raw_title.strip()
        if not title or title in ["无题", "词", "诗"]:
          continue # 放弃没有确切题目的诗词

        for p in paragraphs:
          # 按标点分句
          sentences = re.split(r'[，。！？；]', p)
          for s in sentences:
            s = s.strip()
            # 筛选五言与七言标准诗句
            if len(s) in (5, 7) and re.match(r'^[\u4e00-\u9fa5]+$', s):
              if s in unique_lines:
                continue
              
              end_char = s[-1]
              is_ping_end = get_tone(end_char) == "1"
              pattern = "".join([get_tone(c) for c in s])

              unique_lines[s] = {
                "id": f"real_poem_{id_counter}",
                "content": s,
                "length": len(s),
                "author": author,
                "dynasty": "唐/宋",
                "title": title, # 100% 真实原诗名，如《山居秋暝》《静夜思》《水调歌头》
                "ping_ze_pattern": pattern,
                "end_tone": "平" if is_ping_end else "仄",
                "rhyme_group": get_rhyme(end_char) if is_ping_end else "仄声",
                "tags": extract_tags(s)
              }
              id_counter += 1
    except Exception as e:
      print(f"读取 {url} 出错:", e)

  lines_list = list(unique_lines.values())
  print(f"抓取并提取完成！共得到 {len(lines_list)} 条带【100%精确原诗名】的绝对无重复诗句！")

  output_path = os.path.join(os.path.dirname(__file__), "../src/data/poetry_db.js")
  
  # 生成最终代码
  js_content = f"""/**
 * 古诗集句工程 - 100% 带【真实原诗名】数据库
 * 包含《山居秋暝》《静夜思》《早发白帝城》《水调歌头》《春望》等经典名篇名句。
 * 共计 {len(lines_list)} 条精选名句。
 */

export const POETRY_DATABASE = {json.dumps(lines_list, ensure_ascii=False, indent=2)};
"""

  with open(output_path, "w", encoding="utf-8") as f:
    f.write(js_content)
  print(f"✅ 成功写入 {output_path}！所有诗句现均对应真实原诗名。")

if __name__ == "__main__":
  main()
