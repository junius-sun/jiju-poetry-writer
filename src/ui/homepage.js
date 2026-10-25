import { HOME_POEM } from './homepage-poem.js';
import { CARD_TEMPLATES, createCardModel, cardModelHtml, prepareCardStyle } from './poetry-card.js?v=20261025-wmz9';

const home = document.getElementById('site-home'), studio = document.getElementById('atelier-app');
const appHashes = new Set(['#assembly','#assembly-compose','#assembly-direction','#creative-materials','#puzzle','#card','#pingshui']);
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const compactView = matchMedia('(max-width:700px)');
const motionButton = document.getElementById('home-motion-toggle');
let mounted, routeVersion = 0, currentRoute = location.hash || '#home';
let motionModules, motionContext, firstEntrance = true, motionVersion = 0;
let motionOn = true;
try { motionOn = localStorage.getItem('poetry-motion') !== 'off'; } catch { /* Session setting remains usable. */ }

function setAddress(hash, replace = false) {
  if (location.hash !== hash) history[replace ? 'replaceState' : 'pushState'](null,'',hash);
}
function addStyles(href) {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link'); link.rel='stylesheet'; link.href=href;
    link.onload=resolve; link.onerror=()=>reject(new Error('界面样式未能加载。'));
    document.head.append(link);
  });
}
function loadMotionScript(file) {
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=new URL(`../../vendor/gsap/${file}`,import.meta.url).href;
    script.onload=resolve; script.onerror=()=>reject(new Error('动效资源加载失败。'));
    document.head.append(script);
  });
}
async function mountStudio() {
  if (mounted) return mounted;
  mounted = (async () => {
    const response = await fetch(new URL('./workspace.html',import.meta.url));
    if (!response.ok) throw new Error('书案页面未能加载。');
    const fragment = await response.text();
    const template = document.createElement('template'); template.innerHTML=fragment;
    await Promise.all(['styles.css','src/ui/poetry-card.css','src/input/materials.css','src/ai/assistant.css','src/ui/atelier.css','src/ui/assembly-flow.css','src/ui/poetry-guide.css'].map(addStyles));
    // Keep the shared control hierarchy after each feature stylesheet.
    document.head.append(document.getElementById('ui-clarity'));
    studio.replaceChildren(template.content.cloneNode(true));
    await import('../input/creative-input.js');
    await import('../ai/assistant.js');
    await import('./effects.js');
    await import('../bootstrap.js?v=20261025-wmz9');
    if (!window.app) throw new Error('诗句暂未准备好，请刷新后重试。');
  })();
  return mounted;
}
function announceView(view) { document.dispatchEvent(new CustomEvent('poetry:view-changed',{detail:{view}})); }
function showHome(hash = '#home', update = false) {
  currentRoute=hash; routeVersion++;
  motionContext?.revert(); motionContext=null;
  studio.hidden=true; home.hidden=false; document.documentElement.dataset.view='home';
  document.title='诗境集句 · 借古人的诗句，写此刻的心意';
  if(update) setAddress(hash);
  announceView('home');
  try { motionOn=localStorage.getItem('poetry-motion') !== 'off'; } catch { /* Keep session setting. */ }
  updateMotion();
  if(hash === '#home') window.scrollTo({top:0,behavior:'instant'});
}
async function showStudio(hash, update = true) {
  const token=++routeVersion; currentRoute=hash;
  if(update) setAddress(hash);
  motionContext?.revert(); motionContext=null;
  home.hidden=true; studio.hidden=false; document.documentElement.dataset.view='app';
  document.title='诗境集句 · 创作书案';
  window.scrollTo({top:0,behavior:'instant'}); announceView('app');
  try {
    await mountStudio();
    if(token !== routeVersion) { setAddress(currentRoute,true); return; }
    const tab = ['#card','#pingshui','#puzzle'].includes(hash) ? hash.slice(1) : 'assembly';
    setAddress(tab === 'assembly' ? `#assembly-${window.app.assemblyStep}` : hash,true);
    document.querySelector(`.nav-tab[data-tab="${tab}"]`)?.click();
    if(tab === 'assembly') window.app.setAssemblyStep(['#assembly-direction','#creative-materials'].includes(hash)?'direction':'compose',{historyMode:null,scroll:false});
    setAddress(hash === '#assembly' ? '#assembly-compose' : hash,true);
    announceView('app');
  } catch(error) {
    if(token !== routeVersion) return;
    studio.replaceChildren();
    const box=document.createElement('div'); box.className='home-studio-loading'; box.setAttribute('role','alert');
    const message=document.createElement('p'); message.textContent=error.message;
    const back=document.createElement('a'); back.href='#home'; back.dataset.home=''; back.textContent='返回首页';
    const retry=document.createElement('a'); retry.href=location.href; retry.textContent='刷新并重试';
    box.append(message,back,retry); studio.append(box);
  }
}

document.addEventListener('click',event=>{
  const entry=event.target.closest('[data-enter]');
  if(entry) { if(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); showStudio(entry.hash); return; }
  const back=event.target.closest('[data-home]');
  if(back) { event.preventDefault(); showHome('#home',true); }
});
function followAddress() {
  const hash=location.hash || '#home';
  if(appHashes.has(hash)) showStudio(hash,false);
  else if(home.hidden) showHome(hash);
}
window.addEventListener('popstate',followAddress);
window.addEventListener('hashchange',()=>{ if(appHashes.has(location.hash) && home.hidden === false) showStudio(location.hash,false); });

const cardRoot=document.getElementById('home-card-render');
function sizeCard() { const surface=cardRoot.querySelector('.home-card-surface'); if(surface) surface.style.transform=`scale(${cardRoot.clientWidth/600})`; }
async function renderHomeCard() {
  const style='letter';
  document.getElementById('home-card-status').textContent=`正在准备${CARD_TEMPLATES[style].name}…`;
  try { await prepareCardStyle(style); }
  catch(error) { document.getElementById('home-card-status').textContent=error.message; return; }
  const model=createCardModel({style,format:'portrait',title:'山月寄怀',font:CARD_TEMPLATES[style].font},HOME_POEM);
  cardRoot.innerHTML=`<div class="home-card-surface">${cardModelHtml(model)}</div>`;
  cardRoot.setAttribute('aria-label',`山月寄怀，${CARD_TEMPLATES[style].name}诗牌预览`);
  document.getElementById('home-card-status').textContent=`${CARD_TEMPLATES[style].name} · ${CARD_TEMPLATES[style].subtitle}`;
  sizeCard();
}
new ResizeObserver(sizeCard).observe(cardRoot);
renderHomeCard();

async function updateMotion() {
  const version=++motionVersion;
  const enabled=motionOn && !motionPreference.matches;
  motionButton.textContent=motionPreference.matches?'已减少动效':enabled?'动效开启':'动效已暂停';
  motionButton.disabled=motionPreference.matches; motionButton.setAttribute('aria-pressed',String(enabled));
  document.documentElement.classList.toggle('home-motion-paused',!enabled);
  motionContext?.revert(); motionContext=null;
  if(!enabled || home.hidden) return;
  motionModules ||= (async()=>{ await loadMotionScript('gsap.min.js'); await loadMotionScript('ScrollTrigger.min.js'); return {gsap:window.gsap,ScrollTrigger:window.ScrollTrigger}; })();
  try {
    const {gsap,ScrollTrigger}=await motionModules;
    if(version !== motionVersion || home.hidden || !motionOn || motionPreference.matches) return;
    gsap.registerPlugin(ScrollTrigger);
    motionContext=gsap.context(()=>{
      if(firstEntrance) {
        gsap.from('.home-hero-copy,.home-hero-actions',{opacity:0,y:5,duration:.35,stagger:.06,ease:'power2.out'});
        firstEntrance=false;
      }
      document.querySelectorAll('[data-reveal],.home-section-heading').forEach(element=>{
        if(element.dataset.revealed) return;
        gsap.from(element,{opacity:0,y:element.classList.contains('home-card-preview')?20:12,duration:.5,ease:'power2.out',scrollTrigger:{trigger:element,start:'top 90%',once:true,onEnter:()=>{element.dataset.revealed='true';}}});
      });
      const scene=document.querySelector('.home-source-canvas'), rows=[...scene.querySelectorAll('.home-origin-line')];
      // Reading must not depend on parking the scroll position at one timeline point.
      if(scene.dataset.expanded === 'true') return;
      if(compactView.matches) {
        scene.dataset.expanded='true';
        rows.forEach(row=>{
          gsap.fromTo(row,{y:12},{y:0,duration:.45,ease:'power2.out',scrollTrigger:{trigger:row,start:'top 90%',once:true}});
        });
        return;
      }
      const timeline=gsap.timeline({
        onComplete:()=>{scene.dataset.expanded='true';},
        scrollTrigger:{trigger:scene,start:'top 85%',once:true,invalidateOnRefresh:true,onLeave:self=>self.animation?.progress(1)}
      });
      timeline.fromTo('.home-source-paper',{opacity:1},{opacity:0,duration:.3},0);
      rows.forEach((row,index)=>{
        timeline.fromTo(row,{x:()=>scene.clientWidth/2-row.offsetLeft-row.offsetWidth/2,y:()=>scene.clientHeight/2+(index-1.5)*48-row.offsetTop-row.offsetHeight/2,borderBottomColor:'transparent'}, {x:0,y:0,borderBottomColor:'#d9d1c4',duration:.65,ease:'power2.out'},0);
      });
      timeline.fromTo('.home-origin-caption',{opacity:0},{opacity:1,duration:.25,ease:'power2.out'},.25);
    },home);
    ScrollTrigger.refresh();
  } catch(error) { motionContext?.revert(); motionContext=null; console.warn('首页动效未能启用，已保留静态阅读。',error); }
}
motionButton.addEventListener('click',()=>{
  motionOn=!motionOn;
  try {localStorage.setItem('poetry-motion',motionOn?'on':'off');} catch { /* Keep session preference. */ }
  document.dispatchEvent(new CustomEvent('poetry:motion-preference',{detail:motionOn?'on':'off'})); updateMotion();
});
motionPreference.addEventListener('change',updateMotion);
compactView.addEventListener('change',updateMotion);
document.fonts?.ready.then(()=>{sizeCard();window.ScrollTrigger?.refresh();});
if(appHashes.has(location.hash)) showStudio(location.hash,false); else updateMotion();
