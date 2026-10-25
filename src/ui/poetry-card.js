import { escapeHtml } from '../data/source_helpers.js';
import { FLORAL_SHEET } from '../../assets/poem-slips/wenmeizhai-art.js';
import { CARD_FONTS, prepareCardFont } from './card-fonts.js';
export { CARD_FONTS, prepareCardFont } from './card-fonts.js';

export const CARD_TEMPLATES = {
  letter: { name: '朱栏花笺', subtitle: '菊花', theme: 'xuan', font: 'mashanzheng', group:'花笺', layout:'margin' },
  peony: { name:'牡丹春笺', subtitle:'朱华浓淡 · 富贵春色', theme:'rose', font:'mashanzheng', group:'花笺', layout:'margin', image:'wmz04', crop:'185 255 505 960', imageHeight:1379 },
  camellia: { name:'山茶清供', subtitle:'一枝山茶 · 温润素纸', theme:'xuan', font:'longcang', group:'花笺', layout:'margin', image:'wmz05', crop:'120 480 500 740', imageHeight:1402 },
  blossom: { name:'海棠小笺', subtitle:'疏枝繁花 · 春信入笺', theme:'xuan', font:'mashanzheng', group:'花笺', layout:'margin', image:'wmz07', crop:'90 310 520 930', imageHeight:1398 },
  lotus: { name:'荷风莲笺', subtitle:'碧叶红蕖 · 一纸清凉', theme:'bamboo', font:'zhimangxing', group:'花笺', layout:'margin', image:'wmz08', crop:'95 360 540 860', imageHeight:1387 },
  narcissus: { name:'水仙岁朝', subtitle:'凌波一枝 · 冬日清芬', theme:'xuan', font:'longcang', group:'花笺', layout:'margin', image:'wmz09', crop:'120 340 490 890', imageHeight:1385 },
  morningglory: { name:'牵牛朝颜', subtitle:'红蓝相映 · 藤蔓舒展', theme:'porcelain', font:'mashanzheng', group:'花笺', layout:'margin', image:'wmz10', crop:'90 325 650 760', imageHeight:1377 },
  yellowbranch: { name:'黄花疏枝', subtitle:'黄花细枝 · 疏影清供', theme:'xuan', font:'longcang', group:'花笺', layout:'margin', image:'wmz11', crop:'90 235 650 915', imageHeight:1394 },
  redchrysanthemum: { name:'红菊秋笺', subtitle:'卷瓣红英 · 一枝秋色', theme:'rose', font:'zhimangxing', group:'花笺', layout:'margin', image:'wmz12', crop:'100 360 570 850', imageHeight:1381 },
};
export const CARD_FORMATS = {
  portrait: { width: 600, height: 800, name: '长笺 · 3:4' },
  square: { width: 720, height: 720, name: '斗方 · 1:1' },
  wide: { width: 960, height: 640, name: '横笺 · 3:2' }
};
const PALETTES = {
  xuan: { paper: '#f5f3eb', ink: '#292e2b', muted: '#76766b', gold: '#a2977b', seal: '#a94738', mountain: '#657468', dark: false },
  bamboo: { paper: '#edf0e8', ink: '#28342d', muted: '#727a70', gold: '#9d9a81', seal: '#a14c3c', mountain: '#718174', dark: false },
  ink: { paper: '#232b29', ink: '#efe8d5', muted: '#b0b6a9', gold: '#c4ab72', seal: '#d28b71', mountain: '#91a297', dark: true },
  red: { paper: '#402829', ink: '#e9d4ac', muted: '#bea68f', gold: '#c6a773', seal: '#d99a78', mountain: '#b29b8d', dark: true },
  rose: { paper:'#f5f1ed',ink:'#38312f',muted:'#7e756d',gold:'#a99b83',seal:'#a7484b',mountain:'#8a8e78',dark:false },
  porcelain: { paper:'#f2f4f0',ink:'#314b63',muted:'#627585',gold:'#8c9cb1',seal:'#ad5149',mountain:'#6d8eae',dark:false }
};
const imageData = new Map([['letter',FLORAL_SHEET]]), pendingImages = new Map();
export function cardStyleGroup(style) { return '花笺'; }
export async function prepareCardStyle(style) {
  const template=CARD_TEMPLATES[style];
  if(!template) return;
  await prepareCardFont(template.font);
  if(!(template.image) || imageData.has(style)) return;
  if(!pendingImages.has(style)) pendingImages.set(style,(async()=>{
    const response=await fetch(new URL(`../../assets/poem-slips/collection/${template.image}.jpg`,import.meta.url));
    if(!response.ok) throw new Error('笺图未能加载，请重新选择此款重试。');
    const bytes=new Uint8Array(await response.arrayBuffer());
    let binary=''; for(let i=0;i<bytes.length;i+=16384) binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
    imageData.set(style,`data:image/jpeg;base64,${btoa(binary)}`);
  })().catch(error=>{pendingImages.delete(style);throw error;}));
  await pendingImages.get(style);
}
const SMALL_FONT = '"Microsoft YaHei", "PingFang SC", sans-serif';
const DEMO = [
  { content: '明月松间照', author: '王维', dynasty: '唐', title: '山居秋暝' },
  { content: '清泉石上流', author: '王维', dynasty: '唐', title: '山居秋暝' },
  { content: '竹喧归浣女', author: '王维', dynasty: '唐', title: '山居秋暝' },
  { content: '莲动下渔舟', author: '王维', dynasty: '唐', title: '山居秋暝' }
];
const clip = (text, max) => { const chars = Array.from(String(text || '')); return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : chars.join(''); };

/** Native artwork; letter includes an attributed, locally embedded historical illustration. */
export function createCardArtwork(style, palette, width, height, columns, bodyTop, bodyBottom, direction = 'vertical') {
  const p = palette; let decoration;
    const preset=CARD_TEMPLATES[style];
    const floralWidth=direction==='vertical'?190:150;
    const floralHeight=direction==='vertical'?340:Math.min(190,height-bodyBottom-65);
    const floralTop=direction==='vertical'?height-440:bodyBottom+35;
    const [cx,cy,cw,ch]=(preset.crop || '60 230 260 455').split(' ').map(Number);
    const fit=Math.min(floralWidth/cw,floralHeight/ch), iw=(style==='letter'?845:1500)*fit, ih=(preset.imageHeight||792)*fit;
    const ix=22+(floralWidth-cw*fit)/2-cx*fit, iy=floralTop+(floralHeight-ch*fit)/2-cy*fit;
    const cropX=ix+cx*fit, cropY=iy+cy*fit, cropW=cw*fit, cropH=ch*fit;
    const filter=p.dark?'cardFlowerInk':'cardFlowerPaper';
    const flower=`<defs><clipPath id="cardFloralClip"><rect x="${cropX}" y="${cropY}" width="${cropW}" height="${cropH}"/></clipPath><linearGradient id="cardFlowerFade"><stop stop-color="white"/><stop offset=".87" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient><mask id="cardFlowerMask" maskUnits="userSpaceOnUse" x="${cropX}" y="${cropY}" width="${cropW}" height="${cropH}"><rect x="${cropX}" y="${cropY}" width="${cropW}" height="${cropH}" fill="url(#cardFlowerFade)"/></mask><filter id="cardFlowerPaper" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -3 -3 -3 0 6.8"/></filter><filter id="cardFlowerInk" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix values="0 0 0 0 .8  0 0 0 0 .68  0 0 0 0 .45  -3 -3 -3 0 6.8"/></filter></defs><g clip-path="url(#cardFloralClip)" mask="url(#cardFlowerMask)"><image x="${ix}" y="${iy}" width="${iw}" height="${ih}" href="${imageData.get(style)||''}" filter="url(#${filter})"/></g>`;

    decoration = flower;
  const fibres=Array.from({length:60},(_,i)=>{const x=(i*137.3+31)%width,y=(i*83.7+11)%height,len=2+i%4;return `<path d="M${x.toFixed(1)} ${y.toFixed(1)}q${(len/2).toFixed(1)} -1.4 ${len} -1"/>`;}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><filter id="cardPaper"><feTurbulence type="fractalNoise" baseFrequency=".68" numOctaves="3" seed="17" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><radialGradient id="cardMoon"><stop stop-color="${p.gold}" stop-opacity=".82"/><stop offset=".84" stop-color="${p.gold}" stop-opacity=".62"/><stop offset="1" stop-color="${p.gold}" stop-opacity=".35"/></radialGradient><radialGradient id="cardEdge"><stop offset=".65" stop-color="${p.paper}" stop-opacity="0"/><stop offset="1" stop-color="${p.mountain}" stop-opacity=".09"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="${p.paper}"/><rect width="100%" height="100%" filter="url(#cardPaper)" opacity=".045"/><rect width="100%" height="100%" fill="url(#cardEdge)"/><g fill="none" stroke="${p.muted}" stroke-width=".35" opacity=".04">${fibres}</g>
    ${decoration}
  </svg>`;
}

/** Shared geometry for DOM preview and Canvas export; mobile previews scale the whole sheet. */
export function createCardModel(config = {}, inputLines = []) {
  const style = Object.hasOwn(CARD_TEMPLATES, config.style) ? config.style : 'letter';
  const preset=CARD_TEMPLATES[style];
  const format=Object.hasOwn(CARD_FORMATS,config.format)?config.format:'portrait';
  const font=Object.hasOwn(CARD_FONTS,config.font)?config.font:preset.font;
  const palette=Object.hasOwn(PALETTES,config.theme)?PALETTES[config.theme]:PALETTES[preset.theme];
  const direction=config.direction==='horizontal'?'horizontal':'vertical';
  const {width:w,height:h}=CARD_FORMATS[format],isExample=!inputLines.length;
  const lines=(isExample?DEMO:inputLines).slice(0,4),length=Math.max(...lines.map(line=>Array.from(line.content).length));
  const title=clip(config.title||'集句·山月',20),mainFont=CARD_FONTS[font].family,elements=[];
  const add=(text,x,y,size,kind,options={})=>elements.push({text,x,y,size,kind,family:mainFont,color:palette.ink,align:'center',tracking:0,weight:400,...options});
  let columns=[],bodyTop,bodyBottom;
  if(direction==='vertical'){
    const size=length>5?40:48,step=length>5?52:62;
    bodyTop=142;bodyBottom=bodyTop+(length-1)*step+size/2;
    const gap=Math.min(70,(w-410)/3),center=(225+w-145)/2;
    columns=[0,1,2,3].map(i=>center+(1.5-i)*gap);
    lines.forEach((line,i)=>Array.from(line.content).forEach((char,n)=>add(char,columns[i],bodyTop+n*step,size,'poem')));
    Array.from(title).forEach((char,i)=>add(char,w-72-Math.floor(i/10)*31,113+(i%10)*35,29,'title'));
  }else{
    const size=length>5?46:53,step=h<700?75:88;
    bodyTop=h<700?163:202;bodyBottom=bodyTop+3*step+size/2;
    const count=Array.from(title).length,titleSize=Math.min(31,(w-110-(count-1)*3)/count);
    add(title,w/2,107,titleSize,'title',{tracking:3});
    lines.forEach((line,i)=>add(line.content,w/2,bodyTop+i*step,size,'poem',{tracking:8}));
  }
  const origins=new Map();
  for(const line of lines){
    const author=line.author||'佚名',work=line.title||'篇目待核',key=JSON.stringify([author,work]);
    const uncertain=!isExample&&line.source?.status!=='matched';
    origins.set(key,{author,work,uncertain:uncertain||origins.get(key)?.uncertain});
  }
  const sources=[...origins.values()],sourceX=215,sourceSize=12,maxChars=Math.floor((w-sourceX-50)/sourceSize);
  sources.forEach((source,i)=>{
    const suffix=source.uncertain?'（待核）':'';
    add(clip(`${source.author}《${source.work}》`,maxChars-suffix.length)+suffix,sourceX,h-145+i*23,sourceSize,'source',{family:SMALL_FONT,align:'left',color:palette.muted});
  });
  return {width:w,height:h,style,format,font,direction,title,author:'',lines,sources,isExample,elements,seal:null,artReady:!preset.image||imageData.has(style),art:createCardArtwork(style,palette,w,h,columns,bodyTop,bodyBottom,direction)};
}

export function cardModelHtml(model) {
  const artwork = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(model.art);
  const text = model.elements.map(item => `<span class="card-glyph card-glyph-${item.kind || 'detail'}" style="left:${item.x}px;top:${item.y}px;font-size:${item.size}px;font-weight:${item.weight};font-family:${escapeHtml(item.family)};color:${item.color};letter-spacing:${item.tracking}px;transform:translate(${item.align === 'center' ? '-50%' : item.align === 'right' ? '-100%' : '0'},-50%)">${escapeHtml(item.text)}</span>`).join('');
  return `<img class="card-artwork" src="${artwork}" alt=""><div class="card-typeset" aria-hidden="true">${text}${model.seal ? `<span class="card-seal-border" style="left:${model.seal.x}px;top:${model.seal.y}px;width:${model.seal.size}px;height:${model.seal.size}px;border-color:${model.seal.color}"></span>` : ''}</div><div class="sr-only"><h3>${escapeHtml(model.title)}</h3><ol>${model.lines.map(line => `<li>${escapeHtml(line.content)} — ${escapeHtml(line.author)}《${escapeHtml(line.title)}》</li>`).join('')}</ol></div>`;
}

function cardThumbnailHtml(style) {
  const preset=CARD_TEMPLATES[style];
  const model=createCardModel({style,theme:preset.theme,font:preset.font,sources:false,title:'山月寄怀'},[]);
  return `<span class="card-mini">${cardModelHtml(model)}</span>`;
}
export function hydrateCardThumbnails(root) {
  const resize=new ResizeObserver(entries=>entries.forEach(({target})=>{const mini=target.querySelector('.card-mini');if(mini)mini.style.transform=`translate(-50%,-50%) scale(${Math.min(target.clientWidth/600,target.clientHeight/800)})`;}));
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting) return;
      const slot=entry.target; observer.unobserve(slot);
      prepareCardStyle(slot.dataset.cardThumbnail).then(()=>{slot.innerHTML=cardThumbnailHtml(slot.dataset.cardThumbnail);slot.dataset.ready='true';const mini=slot.querySelector('.card-mini');mini.style.transform=`translate(-50%,-50%) scale(${Math.min(slot.clientWidth/600,slot.clientHeight/800)})`;}).catch(()=>{slot.dataset.ready='false';});
    });
  },{rootMargin:'100px'});
  root.querySelectorAll('[data-card-thumbnail]').forEach(slot=>{observer.observe(slot);resize.observe(slot);});
}
export function cardPickerHtml(attribute='style',styles=Object.keys(CARD_TEMPLATES)) {
  return styles.filter(style=>Object.hasOwn(CARD_TEMPLATES,style)).map(style=>{
    const preset=CARD_TEMPLATES[style];
    return `<button class="${attribute==='style'?'style-btn':'home-style-choice'}" data-${attribute}="${style}" data-group="${cardStyleGroup(style)}" aria-pressed="false" aria-label="${preset.name}" title="${preset.subtitle}"><span class="template-thumb collection-thumb" data-card-thumbnail="${style}" aria-hidden="true">${cardThumbnailHtml(style)}</span><strong>${preset.name}</strong><small>${preset.subtitle}</small></button>`;
  }).join('');
}

function drawTrackedText(context, item) {
  context.font = `${item.weight} ${item.size}px ${item.family}`; context.fillStyle = item.color;
  context.textBaseline = 'middle'; context.textAlign = 'left';
  const chars = Array.from(item.text), total = chars.reduce((sum, char) => sum + context.measureText(char).width, 0) + Math.max(0, chars.length - 1) * item.tracking;
  let x = item.x - (item.align === 'center' ? total / 2 : item.align === 'right' ? total : 0);
  for (const char of chars) { context.fillText(char, x, item.y); x += context.measureText(char).width + item.tracking; }
}

export async function renderCardCanvas(model, scale = 3) {
  if(model.artReady === false) throw new Error('笺图尚未载入，请重新选择此款。');
  const allText=model.elements.map(item=>item.text).join('');
  await prepareCardFont(model.font,allText);
  const canvas = document.createElement('canvas'); canvas.width = model.width * scale; canvas.height = model.height * scale;
  const context = canvas.getContext('2d'); if (!context) throw new Error('浏览器不支持图片绘制。');
  context.scale(scale, scale);
  const url = URL.createObjectURL(new Blob([model.art], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image(); image.src = url; await image.decode();
    context.drawImage(image, 0, 0, model.width, model.height);
  } finally { URL.revokeObjectURL(url); }
  model.elements.forEach(item => drawTrackedText(context, item));
  return canvas;
}
