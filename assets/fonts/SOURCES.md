# 本地书法字体

均从 Google Fonts 官方仓库获取，随字体保留独立 `*-OFL.txt` 授权文件。

| 选项 | 官方来源 | 授权文件 |
| --- | --- | --- |
| 马善政 · 毛笔楷书 | https://github.com/google/fonts/tree/main/ofl/mashanzheng | mashanzheng-OFL.txt |
| 龙藏 · 手书 | https://github.com/google/fonts/tree/main/ofl/longcang | longcang-OFL.txt |
| 志莽 · 行书 | https://github.com/google/fonts/tree/main/ofl/zhimangxing | zhimangxing-OFL.txt |
| 刘建 · 毛草 | https://github.com/google/fonts/tree/main/ofl/liujianmaocao | liujianmaocao-OFL.txt |

原始 TTF 存在本地忽略目录 `.local/font-sources`。`scripts/prepare_card_fonts.py` 使用 fontTools 转为常用字包和 Unicode 区间 WOFF2；保留字体原有名称、字形、字重与授权，不将其改造为新的字体。`src/ui/card-font-manifest.js` 记录各包的字符范围。页面按需加载实际文字需要的区间，不再依赖 Google Fonts 外链，也不会以宋体作为诗牌的回退字体。

文楷已从字体选项、默认值、回退链、清单和 WOFF2 文件中移除。

字体检索也参考猫啃网 https://www.maoken.com/all-fonts ，下载及许可核对以上述官方仓库为准。
