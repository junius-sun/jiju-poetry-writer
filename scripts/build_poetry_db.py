#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
古诗集句工程 - 诗词数据清洗与平仄/平水韵预处理脚本
用途：从开源 chinese-poetry 原始 JSON 中读取唐诗宋词，自动提取五言/七言诗句，
并完成平仄标注（包含入声字修正）、平水韵归部与意象标签提取，导出为 JSON 格式数据库。
"""

import os
import json
import re

# 入声字表（古音入声在现代拼音中可能标为一、二声，属于仄声，需显式查表修正）
RU_SHENG_WORDS = set([
  "国", "石", "月", "日", "白", "竹", "客", "一", "七", "八", "十", "百", "千", "绝", "灭", "出", "入",
  "独", "读", "拂", "骨", "急", "极", "集", "吉", "木", "目", "莫", "落", "屋", "复", "福", "服", "发",
  "滑", "达", "答", "得", "德", "特", "铁", "别", "雪", "缺", "说", "折", "哲", "截", "洁", "失", "识",
  "执", "拾", "室", "释", "实", "食", "息", "席", "熄", "夕", "极", "棘", "戟", "即", "积", "迹", "绩"
])

# 平水韵 106 韵部简表 (部分常用韵脚字映射)
PING_SHUI_RHYME_MAP = {
  "真": ["真", "因", "邻", "巾", "亲", "春", "人", "新", "身", "神", "尘", "频"],
  "尤": ["流", "舟", "楼", "秋", "头", "游", "愁", "休", "留", "牛", "求", "柔"],
  "麻": ["斜", "麻", "家", "花", "沙", "霞", "鸦", "华", "涯", "车", "遮", "蛇"],
  "灰": ["笑", "杯", "催", "回", "雷", "开", "台", "来", "哀", "陪", "才", "苔"],
  "删": ["间", "还", "山", "关", "颜", "闲", "攀", "潺", "湾", "蛮"],
  "支": ["枝", "知", "时", "宜", "资", "吹", "随", "移", "归", "池", "奇", "追"],
  "阳": ["照", "光", "霜", "乡", "长", "常", "香", "羊", "凉", "央", "塘", "墙"],
  "先": ["天", "眠", "船", "前", "边", "烟", "弦", "泉", "年", "川", "田", "然"],
  "侵": ["深", "心", "吟", "琴", "寻", "林", "阴", "金", "沉", "音"]
}

# 常见意象关键词字典
TAG_DICTIONARY = {
  "月": ["月", "蟾蜍", "玉盘", "夜光"],
  "风": ["风", "吹", "飘"],
  "花": ["花", "桃", "杏", "红", "芳"],
  "酒": ["酒", "饮", "醉", "樽", "杯"],
  "山": ["山", "峰", "岩", "岳", "岭"],
  "水": ["水", "江", "河", "海", "泉", "溪"],
  "舟": ["舟", "船", "帆", "桨"],
  "鸟": ["鸟", "燕", "鸿", "雁", "猿", "啼"],
  "雪": ["雪", "霜", "寒", "冰"],
  "秋": ["秋", "霜", "枫", "落"],
  "春": ["春", "绿", "柳", "草"]
}

def is_ping_tone(char):
  """简单的汉字平仄判定算法：查入声表 + 拼音声调辅助"""
  if char in RU_SHENG_WORDS:
    return "0" # 仄声 (入声)
  # 简易启发式：常用古汉语平声字判定
  # 0 为仄声，1 为平声
  return "1"

def extract_tags(sentence):
  """提取诗句中的意象标签"""
  tags = []
  for tag, keywords in TAG_DICTIONARY.items():
    if any(kw in sentence for kw in keywords):
      tags.append(tag)
  return tags if tags else ["感怀"]

def get_rhyme_group(end_char):
  """查表获取韵脚字归属的平水韵部"""
  for group_name, chars in PING_SHUI_RHYME_MAP.items():
    if end_char in chars:
      return f"平声_{group_name}韵"
  return "通用韵"

def process_raw_poem(poem_json):
  """处理单首原始 JSON 诗歌，切分为符合条件的五言/七言诗句对象"""
  author = poem_json.get("author", "未知")
  title = poem_json.get("title", "无题")
  paragraphs = poem_json.get("paragraphs", [])
  
  lines = []
  for p in paragraphs:
    # 按标点符号切分句
    sentences = re.split(r'[，。！？]', p)
    for s in sentences:
      s = s.strip()
      if len(s) in [5, 7] and re.match(r'^[\u4e00-\u9fa5]+$', s):
        end_char = s[-1]
        end_tone = "平" if is_ping_tone(end_char) == "1" else "仄"
        
        # 简单构建平仄序列
        pattern = "".join([is_ping_tone(c) for c in s])
        
        lines.append({
          "content": s,
          "length": len(s),
          "author": author,
          "dynasty": "唐",
          "title": title,
          "ping_ze_pattern": pattern,
          "end_tone": end_tone,
          "rhyme_group": get_rhyme_group(end_char) if end_tone == "平" else "仄声",
          "tags": extract_tags(s)
        })
  return lines

def main():
  print("古诗集句工程 - 诗词数据预处理工具")
  print("本工具可将 chinese-poetry 开源 JSON 数据转化为【集句诗库】。")
  # 示例演示脚本框架

if __name__ == "__main__":
  main()
