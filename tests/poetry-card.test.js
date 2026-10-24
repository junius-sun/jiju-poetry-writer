import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCardModel, cardModelHtml, CARD_TEMPLATES, CARD_FORMATS, CARD_FONTS, prepareCardStyle, renderCardCanvas } from '../src/ui/poetry-card.js';
const five=['明月松间照','江清月近人','故乡今夜思','芳草又逢春'];
const seven=['江边明月照山川','一叶扁舟过晚烟','客梦遥随流水去','清风吹到旧窗前'];
const poem=texts=>texts.map((content,i)=>({content,author:`作者${i}`,title:`篇目${i}`,source:{status:'matched'},quality_flags:[]}));

test('成品只有标题、诗句和出处；旧署名、印章与关闭出处的配置不会混入',()=>{
  const input=poem(five),original=structuredClone(input);
  const model=createCardModel({title:'清夜',author:'不应显示的署名',seal:true,sources:false},input);
  assert.deepEqual(new Set(model.elements.map(e=>e.kind)),new Set(['title','poem','source']));
  assert.equal(model.seal,null);assert.equal(model.author,'');assert.equal(model.isExample,false);
  assert.equal(model.elements.filter(e=>e.kind==='source').length,4);
  assert.ok(!cardModelHtml(model).includes('不应显示的署名'));
  assert.deepEqual(input,original);
  assert.equal(createCardModel().isExample,true);
  assert.equal(createCardModel({},input.slice(0,2)).lines.length,2);
});

test('同一作者同一篇目合并出处，不吞掉待核状态；古音标记不增加画面说明',()=>{
  const input=poem(five);input.forEach(line=>{line.author='王维';line.title='山居秋暝';});
  let model=createCardModel({},input);
  assert.deepEqual(model.elements.filter(e=>e.kind==='source').map(e=>e.text),['王维《山居秋暝》']);
  input[0].source.status='ambiguous';input[1].quality_flags=['TONE_AMBIGUOUS'];
  model=createCardModel({},input);
  assert.equal(model.elements.filter(e=>e.kind==='source')[0].text,'王维《山居秋暝》（待核）');
  input.forEach(line=>line.title='很长的篇名'.repeat(40));
  assert.ok(createCardModel({},input).elements.find(e=>e.kind==='source').text.endsWith('（待核）'));
});

test('六款花笺的三种纸幅、横竖排、五七言正文和出处均在纸幅内且分区',()=>{
  for(const style of Object.keys(CARD_TEMPLATES))for(const format of Object.keys(CARD_FORMATS))for(const direction of ['vertical','horizontal'])for(const texts of [five,seven]){
    const model=createCardModel({style,format,direction,title:'春江月夜归乡题名测试二十字长标题之诗笺'},poem(texts));
    for(const e of model.elements){
      assert.ok(e.y-e.size/2>=0&&e.y+e.size/2<=model.height,`${style}/${format}/${direction}/${e.text}`);
      assert.ok(e.x>=0&&e.x<=model.width);
      if(direction==='vertical'&&['poem','title'].includes(e.kind))assert.ok(e.x-e.size/2>=0&&e.x+e.size/2<=model.width);
      if(direction==='horizontal'&&e.kind==='title')assert.ok([...e.text].length*e.size+([...e.text].length-1)*e.tracking<=model.width-100);
    }
    const glyphs=model.elements.filter(e=>e.kind==='poem'),notes=model.elements.filter(e=>e.kind==='source');
    assert.ok(Math.max(...glyphs.map(e=>e.y+e.size/2))<Math.min(...notes.map(e=>e.y-e.size/2)));
    if(direction==='vertical')assert.ok(glyphs.every(e=>e.x-e.size/2>212));
    assert.equal(glyphs.map(e=>e.text).join(''),texts.join(''));
  }
});

test('古笺按需加载、并发复用、失败重试；未准备好不能导出空图',async()=>{
  const missing=createCardModel({style:'lotus'},poem(five));
  assert.equal(missing.artReady,false);await assert.rejects(renderCardCanvas(missing),/尚未载入/);
  const originalFetch=globalThis.fetch;let calls=0,fail=true;
  globalThis.fetch=async url=>{calls++;if(fail){fail=false;throw new Error('temporary failure');}return new Response(await readFile(url));};
  try{
    await assert.rejects(prepareCardStyle('lotus'),/temporary/);
    await Promise.all([prepareCardStyle('lotus'),prepareCardStyle('lotus')]);assert.equal(calls,2);
    const snapshots=[];
    for(const style of Object.keys(CARD_TEMPLATES)){
      await prepareCardStyle(style);const model=createCardModel({style},poem(five));
      assert.equal(model.artReady,true);assert.match(model.art,/href="data:image\/jpeg;base64,/);
      assert.ok(!model.art.includes('href="http'));snapshots.push(model.art);
    }
    assert.equal(new Set(snapshots).size,6);
  }finally{globalThis.fetch=originalFetch;}
});

test('横排逐句向下，竖排逐字向下、逐句向左',()=>{
  const h=createCardModel({direction:'horizontal'},poem(five)).elements.filter(e=>e.kind==='poem');
  assert.deepEqual(h.map(e=>e.text),five);assert.ok(h.every((e,i)=>!i||e.y>h[i-1].y));
  const v=createCardModel({},poem(five)).elements.filter(e=>e.kind==='poem');
  assert.ok(v[0].x>v[5].x&&v[5].x>v[10].x&&v[10].x>v[15].x);assert.ok(v[4].y>v[0].y);
});

test('只提供文美斋六款和四款书法字体；移除款式或文楷旧配置安全回退',()=>{
  assert.deepEqual(Object.keys(CARD_TEMPLATES),['letter','peony','camellia','blossom','lotus','narcissus']);
  assert.equal(Object.keys(CARD_FONTS).length,4);assert.ok(!CARD_FONTS.wenkai);
  for(const preset of Object.values(CARD_TEMPLATES)){assert.ok(CARD_FONTS[preset.font]);assert.ok(!preset.scan&&!preset.artwork);}
  for(const config of [{style:'classic',font:'wenkai'},{style:'brocade'},{style:'__proto__',format:'constructor',font:'constructor',theme:'constructor'}]){
    const model=createCardModel(config);assert.equal(model.style,'letter');assert.equal(model.font,'mashanzheng');
    assert.ok(!model.art.includes('undefined'));assert.ok(model.elements.every(e=>!/WenKai|Noto Serif|SimSun/.test(e.family)));
  }
});

test('标题、诗句与出处转义，来源图不依赖导出时的外部请求',()=>{
  const model=createCardModel({title:'<img src=x>'},[{content:'<svg>',author:'<script>',title:'"<&'}]);
  const html=cardModelHtml(model);assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<script>'));
  assert.ok(!model.art.includes('foreignObject'));assert.ok(!model.art.includes('href="http'));
});
