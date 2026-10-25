/** 先显示页面，再异步加载语料；加载失败时给出可见提示。 */
const status = document.getElementById('corpus-load-status');
const controls = [...document.querySelectorAll('button:not([data-independent]), input:not([data-independent])')];
const previousStates = controls.map(control => control.disabled);
controls.forEach(control => { control.disabled = true; });

try {
  const { JijuPoetryApp } = await import('./app.js?v=20261025-wmz9');
  controls.forEach((control, index) => { control.disabled = previousStates[index]; });
  window.app = new JijuPoetryApp();
  document.dispatchEvent(new CustomEvent('poetry:ready'));
  status.classList.add('hidden');
} catch (error) {
  controls.forEach(control => { control.disabled = true; });
  status.textContent = '语料加载失败，请刷新页面重试，或检查网络连接。';
  status.setAttribute('role', 'alert');
  console.error('语料加载失败:', error);
}
