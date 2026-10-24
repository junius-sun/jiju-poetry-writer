/** Local OFL calligraphy fonts; no Google Fonts request is needed at runtime. */
import { FONT_PARTS } from './card-font-manifest.js';
export const CARD_FONTS = {
  mashanzheng: { family:'"Ma Shan Zheng", "KaiTi", cursive', label:'马善政 · 毛笔楷书', face:'Ma Shan Zheng' },
  longcang: { family:'"Long Cang", "KaiTi", cursive', label:'龙藏 · 手书', face:'Long Cang' },
  zhimangxing: { family:'"Zhi Mang Xing", "KaiTi", cursive', label:'志莽 · 行书', face:'Zhi Mang Xing' },
  liujianmaocao: { family:'"Liu Jian Mao Cao", "KaiTi", cursive', label:'刘建 · 毛草', face:'Liu Jian Mao Cao' },
};
const registered = new Map();
const SAMPLE='明月松间照清泉石上流竹喧归浣女莲动下渔舟山月寄怀今人集诗境笺图出处壹贰叁肆';
export async function prepareCardFont(key,text=SAMPLE) {
  if(typeof document==='undefined') return;
  key=Object.hasOwn(CARD_FONTS,key)?key:'mashanzheng';
  if(!registered.has(key)) {
    const fonts=FONT_PARTS[key].map(({file,range})=>new FontFace(CARD_FONTS[key].face,`url("${new URL(`../../assets/fonts/${file}`,import.meta.url)}")`,{weight:'400',style:'normal',unicodeRange:range}));
    fonts.forEach(font=>document.fonts.add(font));
    registered.set(key,fonts);
  }
  try {await document.fonts.load(`400 48px "${CARD_FONTS[key].face}"`,text||SAMPLE);}
  catch {registered.get(key)?.forEach(font=>document.fonts.delete(font));registered.delete(key);throw new Error('书法字体未能载入，请重新选择字体重试。');}
}
