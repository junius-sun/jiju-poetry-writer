import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { AiError } from './ai/config.js';

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.gz': 'application/gzip',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const local = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
const json = (response, code, value) => {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(value));
};
function localRequest(request) {
  if (!local(request.socket.remoteAddress)) throw new AiError('模型接口仅供本机使用。', 403);
  const host = new URL(`http://${request.headers.host || 'invalid'}`).hostname;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) throw new AiError('请求主机无效。', 403);
  if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}` && request.headers.origin !== `https://${request.headers.host}`) throw new AiError('不接受跨站配置或模型请求。', 403);
  if (request.headers['sec-fetch-site'] === 'cross-site') throw new AiError('不接受跨站模型请求。', 403);
}
function readJson(request, limit) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new AiError('接口只接受 JSON。', 415);
  if (Number(request.headers['content-length']) > limit) throw new AiError('请求内容超过上限。', 413);
  return new Promise((resolve, reject) => {
    let length = 0, chunks = [];
    request.on('data', chunk => { length += chunk.length; if (length > limit) chunks = []; else chunks.push(chunk); });
    request.once('end', () => {
      if (length > limit) { reject(new AiError('请求内容超过上限。', 413)); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new AiError('JSON 请求无效。')); }
    });
    request.once('aborted', () => reject(new AiError('请求已取消。', 499)));
    request.once('error', () => reject(new AiError('无法读取请求。')));
  });
}

export function createPoetryServer({ root, configStore, aiService }) {
  return http.createServer({ requestTimeout: 60000, headersTimeout: 15000 }, async (request, response) => {
    try {
      let pathname;
      try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
      catch { throw new AiError('请求路径无效。'); }
      if (pathname.startsWith('/api/')) {
        localRequest(request);
        if (request.method === 'GET' && pathname === '/api/ai/status') {
          json(response, 200, { ...await configStore.status(), localConfigEditable: true }); return;
        }
        if (request.method !== 'POST') throw new AiError('请求方法不受支持。', 405);
        const operation = pathname.replace('/api/ai/', '');
        if (!['config', 'test', 'analyze', 'recommend', 'evaluate'].includes(operation)) throw new AiError('接口不存在。', 404);
        const payload = await readJson(request, operation === 'analyze' ? 45 * 1024 * 1024 : operation === 'config' ? 12000 : 128000);
        if (operation === 'config') { json(response, 200, { ...await configStore.save(payload), localConfigEditable: true }); return; }
        const controller = new AbortController();
        response.once('close', () => { if (!response.writableEnded) controller.abort(); });
        json(response, 200, await aiService.run(operation, payload, { signal: controller.signal })); return;
      }
      if (!['GET', 'HEAD'].includes(request.method)) throw new AiError('请求方法不受支持。', 405);
      if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
      // Only publish the frontend and its assets. Secrets, server code, scripts and node_modules are never static files.
      if (pathname.includes('\\') || pathname.split('/').some(segment => segment.startsWith('.') || segment.includes(':')) ||
          !(pathname === '/' || ['/index.html', '/styles.css'].includes(pathname) || ['/src/', '/vendor/', '/reports/', '/assets/'].some(prefix => pathname.startsWith(prefix)))) {
        throw new AiError('该文件不可公开访问。', 403);
      }
      const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!filename.startsWith(path.resolve(root) + path.sep)) throw new AiError('文件路径超出站点范围。', 403);
      let content;
      try { content = await readFile(filename); } catch { throw new AiError('文件不存在。', 404); }
      response.writeHead(200, { 'Content-Type': MIME[path.extname(filename).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': ['.html', '.js', '.css', '.mjs'].includes(path.extname(filename)) ? 'no-cache' : 'public, max-age=0, must-revalidate',
        'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) { json(response, error instanceof AiError ? error.status : 500, { error: error instanceof AiError ? error.message : '服务暂时无法处理请求。' }); }
  });
}
