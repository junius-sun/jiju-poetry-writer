/** Bounded, dependency-free decorative effects; never blocks corpus loading. */
const canvas = document.getElementById('ink-universe');
const context = canvas.getContext('2d', { alpha: true });
const toggle = document.getElementById('motion-toggle');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(pointer: fine)');
let preference = 'on';
try { preference = localStorage.getItem('poetry-motion') || 'on'; } catch { /* Storage may be unavailable. */ }
let enabled = false;
let frame = 0;
let lastFrame = 0;
let width = 0;
let height = 0;
let motes = [];
let sparks = [];
let ripples = [];
let pointer = { x: -1000, y: -1000 };

function resize() {
  width = innerWidth;
  height = innerHeight;
  const scale = Math.min(devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context?.setTransform(scale, 0, 0, scale, 0, 0);
  // Density is capped for phones and large displays alike.
  motes = Array.from({ length: Math.min(64, Math.floor(width / 24)) }, () => ({
    x: Math.random() * width, y: Math.random() * height,
    radius: Math.random() * 1.1 + .35, drift: Math.random() * .25 + .08,
    phase: Math.random() * Math.PI * 2
  }));
}

function draw(now) {
  frame = 0;
  if (!enabled || document.hidden || document.documentElement.dataset.view === 'home' || !context) return;
  frame = requestAnimationFrame(draw);
  if (now - lastFrame < 1000 / 30) return;
  const dt = Math.min((now - lastFrame) / 33.33 || 1, 2);
  lastFrame = now;
  context.clearRect(0, 0, width, height);
  for (const mote of motes) {
    mote.y -= mote.drift * dt;
    mote.x += Math.sin(now / 5000 + mote.phase) * .12 * dt;
    if (mote.y < -5) mote.y = height + 5;
    const dx = mote.x - pointer.x, dy = mote.y - pointer.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 110 && distance > 0) {
      mote.x += dx / distance * .6 * dt;
      mote.y += dy / distance * .6 * dt;
    }
    const opacity = .14 + (Math.sin(now / 2600 + mote.phase) + 1) * .12;
    context.fillStyle = `rgba(104,120,87,${opacity})`;
    context.beginPath();
    context.arc(mote.x, mote.y, mote.radius, 0, Math.PI * 2);
    context.fill();
  }
  sparks = sparks.filter(spark => spark.life > 0);
  for (const spark of sparks) {
    spark.x += spark.vx * dt; spark.y += spark.vy * dt;
    spark.vx *= .98; spark.vy *= .98; spark.life -= .018 * dt;
    context.fillStyle = `rgba(172,102,73,${Math.max(0, spark.life)})`;
    context.fillRect(spark.x, spark.y, spark.size, spark.size);
  }
  ripples = ripples.filter(ripple => ripple.life > 0);
  for (const ripple of ripples) {
    ripple.radius += 2 * dt; ripple.life -= .025 * dt;
    context.strokeStyle = `rgba(105,124,84,${Math.max(0, ripple.life) * .35})`;
    context.lineWidth = .8;
    context.beginPath(); context.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2); context.stroke();
  }
}

function synchronizeMotion() {
  enabled = preference !== 'off' && !reducedMotion.matches;
  document.documentElement.classList.toggle('motion-paused', !enabled || document.hidden);
  toggle.setAttribute('aria-pressed', String(enabled));
  toggle.lastElementChild.textContent = enabled ? '动效开启' : '静谧模式';
  toggle.title = reducedMotion.matches ? '已遵循系统的减少动态效果设置' : '切换书册景深、纸墨微光与入场效果';
  cancelAnimationFrame(frame); frame = 0;
  context?.clearRect(0, 0, width, height);
  sparks = []; ripples = []; lastFrame = 0;
  if (enabled && !document.hidden && document.documentElement.dataset.view !== 'home' && context) frame = requestAnimationFrame(draw);
}

toggle.addEventListener('click', () => {
  preference = enabled ? 'off' : 'on';
  try { localStorage.setItem('poetry-motion', preference); } catch { /* Keep session preference. */ }
  synchronizeMotion();
});
reducedMotion.addEventListener('change', synchronizeMotion);
document.addEventListener('visibilitychange', synchronizeMotion);
document.addEventListener('poetry:view-changed', synchronizeMotion);
document.addEventListener('poetry:motion-preference', event => { preference = event.detail; synchronizeMotion(); });
window.addEventListener('resize', resize, { passive: true });
document.addEventListener('pointermove', event => {
  if (!enabled || !finePointer.matches) return;
  pointer = { x: event.clientX, y: event.clientY };
  const hero = event.target.closest('.poetry-hero');
  if (hero) {
    const bounds = hero.getBoundingClientRect();
    hero.style.setProperty('--art-x', `${(event.clientX - bounds.left - bounds.width / 2) * .014}px`);
    hero.style.setProperty('--art-y', `${(event.clientY - bounds.top - bounds.height / 2) * .018}px`);
  }
  const card = event.target.closest('.smart-card, .candidate-card');
  if (card) {
    const bounds = card.getBoundingClientRect();
    card.style.setProperty('--spot-x', `${event.clientX - bounds.left}px`);
    card.style.setProperty('--spot-y', `${event.clientY - bounds.top}px`);
  }
}, { passive: true });
document.addEventListener('pointerleave', () => { pointer = { x: -1000, y: -1000 }; });
document.addEventListener('click', event => {
  if (!enabled || !event.target.closest('button') || !event.detail) return;
  ripples.push({ x: event.clientX, y: event.clientY, radius: 3, life: 1 });
  ripples = ripples.slice(-5);
});
document.addEventListener('poetry:updated', event => {
  if (!enabled || !context) return;
  const slots = document.querySelectorAll('.line-slot.just-filled');
  for (const slot of slots) {
    const bounds = slot.getBoundingClientRect();
    if (bounds.bottom < 0 || bounds.top > height) continue;
    const count = event.detail.count === 4 ? 38 : 18;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      sparks.push({ x: bounds.left + bounds.width * .6, y: bounds.top + bounds.height / 2,
        vx: Math.cos(angle) * (Math.random() * 2 + .5), vy: Math.sin(angle) * 1.5 - .6,
        life: 1, size: Math.random() + .6 });
    }
  }
  sparks = sparks.slice(-90);
});
resize();
synchronizeMotion();
