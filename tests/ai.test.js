import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createConfigStore, DEFAULT_CONFIG, normalizeConfig } from '../server/ai/config.js';
import { createAiService, callModel } from '../server/ai/service.js';
import { schemas, validateContext } from '../server/ai/schema.js';
import { createPoetryServer } from '../server/http.js';
import { aiRequest, readImageDataUrl, PoetryAssistant, LocalServiceError } from '../src/ai/assistant.js';
import { modelRequestPolicy } from '../server/ai/request-policy.js';
import { clientTimeoutMs } from '../src/ai/protocol.js';
import { selectCandidates } from '../server/ai/candidates.js';
import { MetricalEngine } from '../src/engine/metrical.js';

const secret = 'unit-test-key-never-real';
const config = { ...DEFAULT_CONFIG, apiKey: secret };
const patterns = ['00110', '11001', '11100', '00011'];
const texts = ['江边春月冷', '孤舟带梦归', '远岭生新雾', '晨风拂客衣'];
const database = Array.from({ length: 20 }, (_, index) => {
  const part = index % 4, pattern = patterns[part], ping = pattern.endsWith('1');
  return { id: `fixture-${index}`, content: index < 4 ? texts[part] : `山月春${String.fromCharCode(0x4e00 + index)}秋`, length: 5,
    author: `作者${index}`, title: `篇${index}`, dynasty: '唐', tags: ['月', '春'], ping_ze_pattern: pattern,
    end_tone: ping ? '平' : '仄', rhyme_group: ping ? '上平五微' : '仄声' };
});
const poemIds = database.slice(0, 4).map(line => line.id);
const packet = (result, finish = 'stop') => new Response(JSON.stringify({ choices: [{ finish_reason: finish, message: { content: JSON.stringify(result) } }] }));
const analyzed = { brief: '江边春夜，从孤独写到希望。', theme: '春夜江舟', mood: '清冷而有希望', imagery: ['江', '月', '舟'], avoid: [], imageNotes: [] };
const reviewed = { summary: '有清晰的江夜场景，尾句向晨风推进。', ratings: { coherence: 3, imagery: 4, emotion: 3, resonance: 3 },
  strengths: ['由夜至晨。'], issues: [{ lineIndex: 1, quote: texts[0], issue: '夜色出现略快。', suggestion: '选择能明确开篇场景的首句。' }], warnings: [] };
const compatibleResponse = (url, request) => {
  const body = JSON.parse(request.body), name = body.response_format.json_schema.name;
  if (name === 'poetry_test') return Promise.resolve(packet({ ok: true }));
  if (name === 'poetry_analyze') return Promise.resolve(packet(analyzed));
  if (name === 'poetry_evaluate') return Promise.resolve(packet(reviewed));
  const ids = body.response_format.json_schema.schema.properties.recommendations.items.properties.id.enum;
  return Promise.resolve(packet({ direction: '以月与舟承接。', recommendations: ids.slice(0, 2).map(id => ({ id, role: '承接', reason: '场景连贯。', caution: '' })) }));
};
function service(fetcher = compatibleResponse, overrides = {}) {
  return createAiService({ configStore: { get: async () => config }, fetcher, getCorpus: async () => database, ...overrides });
}

test('配置支持根地址与兼容参数，并拒绝危险或无效地址', () => {
  assert.equal(normalizeConfig({ baseUrl: 'https://example.com/v1/chat/completions/' }).baseUrl, 'https://example.com/v1');
  assert.equal(normalizeConfig({ baseUrl: 'http://localhost:4399/v1', outputMode: 'json', tokenField: 'max_tokens' }).outputMode, 'json');
  for (const baseUrl of ['http://example.com/v1', 'https://user:pass@example.com', 'https://example.com?key=x', 'file:///tmp/api']) assert.throws(() => normalizeConfig({ baseUrl }));
  assert.throws(() => normalizeConfig({ apiKey: 'key\n' }));
  assert.throws(() => normalizeConfig({ model: '' }));
});

test('旧配置获得 120 秒默认值；思考模式和等待时间严格校验', () => {
  assert.equal(normalizeConfig({}).timeoutSeconds, 120);
  assert.equal(normalizeConfig({}).thinkingMode, 'auto');
  assert.equal(normalizeConfig({ timeoutSeconds: 300, thinkingMode: 'enabled' }).timeoutSeconds, 300);
  for (const timeoutSeconds of [29, 301, 30.5, '120', null, NaN]) assert.throws(() => normalizeConfig({ timeoutSeconds }));
  assert.throws(() => normalizeConfig({ thinkingMode: 'fast' }));
});

test('豆包 Seed 2 系列自动关闭深度思考，显式开启和视觉模型可单独生效', () => {
  const ark = { ...config, baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seed-2-1-lite-260915' };
  assert.deepEqual(modelRequestPolicy(ark, 'recommend').extra, { thinking: { type: 'disabled' } });
  assert.deepEqual(modelRequestPolicy({ ...ark, thinkingMode: 'enabled' }, 'evaluate').extra, { thinking: { type: 'enabled' } });
  assert.deepEqual(modelRequestPolicy({ ...ark, model: 'ep-custom-model' }, 'recommend').extra, {});
  assert.deepEqual(modelRequestPolicy({ ...ark, model: 'ep-custom-model', visionModel: 'doubao-seed-2-1-lite-260915' }, 'analyze').extra, { thinking: { type: 'disabled' } });
  assert.deepEqual(modelRequestPolicy({ ...ark, baseUrl: 'https://ark.cn-beijing.volces.com.example.org' }, 'recommend').extra, {});
  assert.deepEqual(modelRequestPolicy(config, 'test').extra, {});
});

test('OpenRouter 思考开关使用对应协议，不向未适配接口发送专用参数', () => {
  const router = { ...config, baseUrl: 'https://openrouter.ai/api/v1', model: 'openrouter/free', thinkingMode: 'disabled' };
  assert.deepEqual(modelRequestPolicy(router, 'test').extra, { reasoning: { enabled: false } });
  assert.throws(() => modelRequestPolicy({ ...config, thinkingMode: 'disabled' }, 'test'), /自动/);
});

test('浏览器等待长于服务端模型时限，配置请求仍使用短时限', () => {
  for (const seconds of [30, 120, 300]) {
    assert.ok(clientTimeoutMs('recommend', seconds) > modelRequestPolicy({ ...config, timeoutSeconds: seconds }, 'recommend').timeoutMs);
  }
  assert.equal(clientTimeoutMs('status', 300), 15000);
  assert.equal(clientTimeoutMs('config', 300), 15000);
});

test('模型等待时限覆盖整个响应体，超时返回 504 而不是误报 JSON 错误', async t => {
  const original = AbortSignal.timeout;
  const keepAlive = setTimeout(() => {}, 1000); t.after(() => clearTimeout(keepAlive));
  t.mock.method(AbortSignal, 'timeout', ms => { assert.equal(ms, 120000); return original(5); });
  await assert.rejects(callModel(config, 'test', schemas.test(), '', async (_, request) => new Response(new ReadableStream({
    start(controller) { request.signal.addEventListener('abort', () => controller.error(request.signal.reason), { once: true }); }
  }))), error => error.status === 504 && error.message.includes('120 秒'));
});

test('客户端读取响应体期间超时或取消，保留原始原因', async t => {
  const keepAlive = setTimeout(() => {}, 1000); t.after(() => clearTimeout(keepAlive));
  const stalled = async (_, request) => new Response(new ReadableStream({
    start(controller) { request.signal.addEventListener('abort', () => controller.error(request.signal.reason), { once: true }); }
  }));
  await assert.rejects(aiRequest('test', {}, undefined, stalled, 5), error => error.name === 'TimeoutError');
  const controller = new AbortController();
  const waiting = aiRequest('test', {}, controller.signal, stalled, 500);
  controller.abort(); await assert.rejects(waiting, error => error.name === 'AbortError');
});

test('密钥仅持久化在服务端，公开状态无密钥，留空保留，移除清空', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'poetry-ai-'));
  try {
    const filename = path.join(folder, 'config.json'), store = createConfigStore(filename, {});
    assert.equal((await store.status()).configured, false);
    const saved = await store.save({ apiKey: secret });
    assert.equal(saved.keyPresent, true); assert.ok(!JSON.stringify(saved).includes(secret));
    assert.equal(JSON.parse(await readFile(filename, 'utf8')).apiKey, secret);
    await store.save({ apiKey: '' }); assert.equal((await store.get()).apiKey, secret);
    await store.save({ clearKey: true }); assert.equal((await store.status()).configured, false);
    await assert.rejects(store.save(null), error => error.status === 400);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('环境配置锁定字段且不泄露密钥', async () => {
  const store = createConfigStore(path.join(os.tmpdir(), `nonexistent-${Date.now()}.json`), { AI_API_KEY: secret, AI_MODEL: 'test-model' });
  const status = await store.status(); assert.deepEqual(status.managedFields, ['model', 'apiKey']);
  assert.equal(status.model, 'test-model'); assert.ok(!JSON.stringify(status).includes(secret));
  await assert.rejects(store.save({ clearKey: true }), /环境变量/);
});

test('未配置密钥时不加载大语料或发出模型请求', async () => {
  const ai = service(() => assert.fail('不应请求'), { configStore: { get: async () => DEFAULT_CONFIG }, getCorpus: async () => assert.fail('不应加载语料') });
  await assert.rejects(ai.run('recommend', { intent: { brief: '春夜' } }), error => error.status === 503);
});

test('模型请求使用服务端鉴权、严格结构和新 Token 参数', async () => {
  const result = await callModel(config, 'test', schemas.test(), 'test', async (url, request) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(request.headers.Authorization, `Bearer ${secret}`); assert.equal(request.redirect, 'error');
    const body = JSON.parse(request.body);
    assert.equal(body.max_completion_tokens, 64); assert.equal(body.response_format.json_schema.strict, true);
    return packet({ ok: true });
  });
  assert.equal(result.ok, true);
});

test('兼容模式明确提供 JSON 结构与旧 Token 参数', async () => {
  await callModel({ ...config, outputMode: 'json', tokenField: 'max_tokens' }, 'test', schemas.test(), 'test', async (_, request) => {
    const body = JSON.parse(request.body);
    assert.equal(body.max_tokens, 64); assert.equal(body.response_format.type, 'json_object');
    assert.match(body.messages[0].content, /required/); return packet({ ok: true });
  });
});

test('上游错误体不会回传密钥或素材', async () => {
  await assert.rejects(callModel(config, 'test', schemas.test(), 'private', async () => new Response(secret + 'private', { status: 401 })), error => {
    assert.ok(!error.message.includes(secret)); assert.ok(!error.message.includes('private')); return /密钥无效/.test(error.message);
  });
});

test('模型错误格式、截断、拒绝和越界评分均拒绝', async () => {
  for (const response of [new Response('broken'), packet({ ok: 'true' }), packet({ ok: true }, 'length'),
    new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { refusal: 'no' } }] }))]) {
    await assert.rejects(callModel(config, 'test', schemas.test(), '', async () => response), error => error.status === 502);
  }
  await assert.rejects(callModel(config, 'evaluate', schemas.evaluate(), '', async () => packet({ ...reviewed, ratings: { ...reviewed.ratings, coherence: 100 } })), error => error.status === 502);
});

test('素材 API 接受内嵌图片并拒绝远程 URL、伪图片和重复编号', () => {
  const image = { id: 'img', name: '月.png', purpose: 'scene', note: '', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' };
  assert.equal(validateContext({ images: [image] }).images.length, 1);
  for (const dataUrl of ['https://example.com/a.png', 'data:image/png;base64,bm90LXBuZw==']) assert.throws(() => validateContext({ images: [{ ...image, dataUrl }] }));
  assert.throws(() => validateContext({ images: [image, image] }));
  assert.throws(() => validateContext({ documents: [{ id: 'doc', name: 'x', text: 'a'.repeat(30001) }] }));
});

test('图片理解按视觉模型发送原图，并验证每张图片编号', async () => {
  const image = { id: 'img', name: '月.png', purpose: 'both', note: '', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' };
  const ai = service(async (_, request) => {
    const body = JSON.parse(request.body); assert.equal(body.model, 'vision-test');
    assert.equal(body.messages[1].content.at(-1).image_url.url, image.dataUrl);
    assert.equal(body.messages[1].content.at(-1).image_url.detail, 'high');
    return packet({ ...analyzed, imageNotes: [{ id: 'img', observation: '月色', extractedText: '', uncertain: true }] });
  }, { configStore: { get: async () => ({ ...config, visionModel: 'vision-test' }) } });
  assert.equal((await ai.run('analyze', { context: { images: [image] } })).imageNotes[0].uncertain, true);
});

test('未启用视觉时阻止图片调用，重复输出编号也阻止', async () => {
  const image = { id: 'i1', name: '月.png', purpose: 'scene', note: '', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' };
  await assert.rejects(service(undefined, { configStore: { get: async () => ({ ...config, vision: false }) } }).run('analyze', { context: { images: [image] } }), /图片/);
  const duplicate = service(async () => packet({ ...analyzed, imageNotes: [1, 2].map(() => ({ id: 'i1', observation: '', extractedText: '', uncertain: true })) }));
  await assert.rejects(duplicate.run('analyze', { context: { images: [image, { ...image, id: 'i2' }] } }), /编号重复/);
});

test('推荐返回真实语料编号和原文，换批排除之前结果', async () => {
  const ai = service(), payload = { lineIds: [poemIds[0]], length: 5, intent: { brief: '春夜江舟', imagery: ['月'] } };
  const first = await ai.run('recommend', payload);
  assert.ok(first.recommendations.length); assert.ok(first.recommendations.every(item => database.includes(item.poetry) || database.some(line => line.id === item.poetry.id && line.content === item.poetry.content)));
  const ids = first.recommendations.map(item => item.id);
  const next = await ai.run('recommend', { ...payload, excludedIds: ids });
  assert.ok(next.recommendations.every(item => !ids.includes(item.id)));
});

test('未填写主题时，续句召回仍优先承接已选诗句的画面', () => {
  const nearby = { ...database[1], id: 'nearby', title: '独立出处', content: '江边秋水新' };
  const corpus = [...database, nearby];
  const candidates = selectCandidates(corpus, new MetricalEngine(corpus), [database[0]], 5, {}, {});
  assert.equal(candidates[0].id, 'nearby');
});

test('指定韵部传入召回与模型提示，推荐始终来自同韵真实候选', async () => {
  const winters = database.filter(item => item.end_tone === '平').map(item => ({ ...item, id: `winter-${item.id}`, title: `冬${item.title}`, rhyme_group: '上平二冬' }));
  const ai = service(async (url, request) => {
    const prompt = JSON.parse(JSON.parse(request.body).messages[1].content.split('\n').at(-1));
    assert.equal(prompt.constraints.targetRhyme, '上平二冬');
    return compatibleResponse(url, request);
  }, { getCorpus: async () => [...database, ...winters] });
  const result = await ai.run('recommend', { lineIds: [poemIds[0]], length: 5, options: { targetRhyme: '上平二冬' } });
  assert.ok(result.recommendations.length);
  assert.ok(result.recommendations.every(item => item.poetry.rhyme_group === '上平二冬' && item.id.startsWith('winter-')));
  const starters = await ai.run('recommend', { lineIds: [], length: 5, options: { targetRhyme: '上平二冬' } });
  assert.ok(starters.recommendations.length);
  assert.ok(starters.recommendations.every(item => item.poetry.end_tone === '仄' || item.poetry.rhyme_group === '上平二冬'));
  await assert.rejects(ai.run('recommend', { lineIds: [poemIds[0], poemIds[1]], options: { targetRhyme: '上平二冬' } }), error => error.status === 422);
});

test('从设定一步保存素材、理解并推荐，带上选定韵部，首推可直接选入', async t => {
  const originalWindow = globalThis.window, originalDocument = globalThis.document;
  t.after(() => {
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
  });
  const elements = new Map(), calls = []; let context = null, picked = null;
  const el = id => { if (!elements.has(id)) elements.set(id, { value: '', innerHTML: '', querySelectorAll: () => [] }); return elements.get(id); };
  globalThis.document = { dispatchEvent() {} };
  globalThis.window = {
    creativeInput: { hasDraft: () => true, getContext: () => context, getImageFiles: () => [], commit() { calls.push('commit'); context = { instructions: '江边春夜', documents: [], images: [] }; } },
    app: { setDrawerView(view) { calls.push(view); }, setAssemblyStep(step) { calls.push(step); }, selectCandidateLine(poetry) { picked = poetry; return true; } }
  };
  const assistant = Object.assign(Object.create(PoetryAssistant.prototype), {
    available: true, configured: true, busy: '', timeoutSeconds: 120, el, message() {},
    state: () => ({ lineIds: picked ? [picked.id] : [], length: 5, options: { targetRhyme: '上平五微' } }),
    run: async (operation, status, action) => action(new AbortController().signal),
    request: async (operation, payload) => {
      calls.push(operation);
      if (operation === 'analyze') return { ...analyzed, model: 'fixture' };
      assert.equal(payload.options.targetRhyme, '上平五微'); assert.equal(payload.intent.brief, analyzed.brief);
      return { recommendations: [{ id: poemIds[0], role: '起句', reason: '有夜色', caution: '', poetry: database[0] }], consideredIds: [poemIds[0]], direction: '起句', model: 'fixture' };
    }
  });
  await assistant.recommend(false, { fromSetup: true });
  assert.deepEqual(calls, ['commit', 'ai', 'compose', 'analyze', 'recommend']);
  assert.equal(picked, null); assistant.pickRecommendation(0); assert.equal(picked, database[0]);
});

test('不填素材也可直接按指定韵部请求 AI，跳过素材理解', async t => {
  const originalWindow = globalThis.window;
  t.after(() => { if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; });
  const elements = new Map(), calls = [];
  const el = id => { if (!elements.has(id)) elements.set(id, { value: '', innerHTML: '', querySelectorAll: () => [] }); return elements.get(id); };
  globalThis.window = {
    creativeInput: { hasDraft: () => false, getContext: () => null },
    app: { setDrawerView(view) { calls.push(view); }, setAssemblyStep(step) { calls.push(step); } }
  };
  const assistant = Object.assign(Object.create(PoetryAssistant.prototype), {
    available: true, configured: true, busy: '', timeoutSeconds: 120, el, message() {},
    state: () => ({ lineIds: [], length: 7, options: { targetRhyme: '下平六麻' } }),
    run: async (operation, status, action) => action(new AbortController().signal),
    request: async (operation, payload) => {
      calls.push(operation);
      assert.equal(operation, 'recommend'); assert.equal(payload.options.targetRhyme, '下平六麻');
      assert.equal(payload.length, 7); assert.equal(payload.intent.brief, '');
      return { recommendations: [], consideredIds: ['fixture'], direction: '请换一批。', model: 'fixture' };
    }
  });
  await assistant.recommend(false, { fromSetup: true });
  assert.deepEqual(calls, ['ai', 'compose', 'recommend']);
  assert.deepEqual(assistant.recommendations, []);
  assert.equal(el('ai-swap').hidden, false);
});

test('编造、重复推荐编号以及不合律前缀被拒绝', async () => {
  const payload = { lineIds: [poemIds[0]], length: 5 };
  await assert.rejects(service(async () => packet({ direction: '', recommendations: [{ id: 'invented', role: '承接', reason: '', caution: '' }] })).run('recommend', payload), error => error.status === 502);
  await assert.rejects(service(async (_, request) => {
    const ids = JSON.parse(request.body).response_format.json_schema.schema.properties.recommendations.items.properties.id.enum;
    const item = { id: ids[0], role: '承接', reason: '', caution: '' }; return packet({ direction: '', recommendations: [item, item] });
  }).run('recommend', payload), /重复推荐/);
  await assert.rejects(service().run('recommend', { lineIds: [poemIds[0], poemIds[2]] }), error => error.status === 422);
});

test('点评与程序格律结果分开，虚构引用被拒绝', async () => {
  const result = await service().run('evaluate', { lineIds: poemIds });
  assert.equal(result.validation.isValid, true); assert.equal(result.ratings.coherence, 3);
  await assert.rejects(service(async () => packet({ ...reviewed, issues: [{ ...reviewed.issues[0], quote: '模型编的诗句' }] })).run('evaluate', { lineIds: poemIds }), /不存在的诗句/);
  await assert.rejects(service().run('evaluate', { lineIds: poemIds.slice(0, 3) }), error => error.status === 422);
});

test('模型可拒绝勉强拼句，保留已比较编号供换批探索', async () => {
  const result = await service(async () => packet({ direction: '本批没有合适的承接，建议换一批。', recommendations: [] })).run('recommend', { lineIds: [poemIds[0]] });
  assert.deepEqual(result.recommendations, []);
  assert.ok(result.consideredIds.length > 0 && result.consideredIds.length <= 40);
  assert.match(result.direction, /没有合适/);
});

test('成功结果缓存，变更素材重新请求，回显密钥自动隐藏', async () => {
  let calls = 0;
  const ai = service(async () => { calls++; return packet({ ...analyzed, brief: secret }); });
  const payload = { context: { instructions: '春夜' } };
  const first = await ai.run('analyze', payload), second = await ai.run('analyze', payload);
  assert.equal(calls, 1); assert.equal(second.cached, true); assert.ok(!JSON.stringify(first).includes(secret));
  await ai.run('analyze', { context: { instructions: '秋夜' } }); assert.equal(calls, 2);
});

test('取消会中断上游调用且不写缓存，并限制并发数', async () => {
  let pending = 0;const started=Promise.withResolvers();
  const ai = service((_, request) => new Promise((resolve, reject) => {
    pending++;if(pending===2)started.resolve(); request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true });
  }));
  const c1 = new AbortController(), c2 = new AbortController();
  const p1 = ai.run('analyze', { context: { instructions: '甲' } }, { signal: c1.signal });
  const p2 = ai.run('analyze', { context: { instructions: '乙' } }, { signal: c2.signal });
  await started.promise; assert.equal(pending, 2);
  await assert.rejects(ai.run('test'), error => error.status === 429);
  c1.abort(); c2.abort(); await assert.rejects(p1, error => error.status === 499); await assert.rejects(p2, error => error.status === 499);
});

test('本机 HTTP 配置和调用可用，静态目录不能暴露密钥或后端源码', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'poetry-http-'));
  const store = createConfigStore(path.join(folder, '.local', 'ai-config.json'), {});
  const server = createPoetryServer({ root: folder, configStore: store, aiService: createAiService({ configStore: store, fetcher: compatibleResponse }) });
  try {
    await mkdir(path.join(folder, 'src')); await writeFile(path.join(folder, 'index.html'), '<h1>test</h1>'); await writeFile(path.join(folder, 'src', 'test.js'), 'export {};');
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`, post = (route, data, headers = {}) => fetch(`${base}/api/ai/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });
    assert.equal((await post('test', {})).status, 503);
    const saved = await (await post('config', { apiKey: secret })).json(); assert.ok(!JSON.stringify(saved).includes(secret));
    assert.equal((await (await post('test', {})).json()).ok, true);
    const status = await (await fetch(`${base}/api/ai/status`)).json(); assert.ok(!JSON.stringify(status).includes(secret));
    for (const file of ['/.local/ai-config.json', '/.env.local', '/server/ai/config.js', '/node_modules/x']) assert.equal((await fetch(base + file)).status, 403);
    assert.match((await fetch(base + '/src/test.js')).headers.get('content-type'), /javascript/);
    assert.equal((await fetch(base + '/src/test.js')).headers.get('cache-control'), 'no-cache');
    assert.equal((await fetch(base + '/')).headers.get('cache-control'), 'no-cache');
    assert.equal((await post('config', {}, { Origin: 'https://evil.example' })).status, 403);
    const badHost = await new Promise((resolve, reject) => {
      const request = http.request(base + '/api/ai/config', { method: 'POST', headers: { Host: 'evil.example', 'Content-Type': 'application/json' } }, response => { response.resume(); resolve(response.statusCode); });
      request.on('error', reject); request.end('{}');
    });
    assert.equal(badHost, 403);
    assert.equal((await post('config', { model: 'x'.repeat(13000) })).status, 413);
    assert.equal((await post('config', null)).status, 400);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(folder, { recursive: true, force: true }); }
});

test('前端请求使用同源接口，保留服务端可操作错误', async () => {
  await assert.rejects(aiRequest('test', {}, undefined, async (url, request) => {
    assert.equal(url, '/api/ai/test'); assert.equal(request.method, 'POST');
    return new Response(JSON.stringify({ error: '尚未配置密钥' }), { status: 503 });
  }), /尚未配置密钥/);
});

test('本机服务断开与模型错误区分，取消和超时保留原因', async () => {
  await assert.rejects(aiRequest('status', {}, undefined, async () => { throw new TypeError('fetch failed'); }), error => error instanceof LocalServiceError && error.message.includes('重新连接'));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(aiRequest('test', {}, controller.signal, async (_, request) => { throw request.signal.reason; }), error => error.name === 'AbortError');
});

test('首次断线后可重新连接，任务失败或取消均解除按钮忙碌状态', async t => {
  const elements = new Map();
  const el = id => { if (!elements.has(id)) elements.set(id, { disabled: false, textContent: '', classList: { toggle() {} } }); return elements.get(id); };
  const assistant = Object.assign(Object.create(PoetryAssistant.prototype), {
    configured: true, available: true, busy: '', revision: 0, managed: [], timeoutSeconds: 120,
    el, form: { elements: [{ name: 'apiKey' }, { name: 'model' }] }, refresh() {},
    applyStatus(status) { this.available = true; this.configured = status.configured; }
  });
  const originalDocument = globalThis.document;
  globalThis.document = { querySelector: () => el('connection') };
  t.after(() => { if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument; });
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('offline'); });
  await assistant.loadStatus();
  assert.equal(assistant.available, false);
  assert.equal(assistant.connecting, false);
  assert.ok(assistant.form.elements.every(input => !input.disabled));
  t.mock.method(globalThis, 'fetch', async () => Response.json({ configured: true }));
  await assistant.loadStatus(); assert.equal(assistant.available, true);
  await assistant.run('recommend', 'status', async () => { throw new Error('上游超时'); });
  assert.equal(assistant.busy, ''); assert.equal(assistant.waitTimer, null);
  assert.equal(el('status').textContent, '上游超时');
  const request = assistant.run('analyze', 'status', signal => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })));
  assert.equal(assistant.busy, 'analyze'); assistant.cancel(); await request;
  assert.equal(assistant.busy, ''); assert.equal(assistant.waitTimer, null);
});

test('图片上传使用字节验证的 MIME，不误信文件扩展名', async () => {
  class Reader {
    async readAsDataURL(blob) { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onload(); }
  }
  const mislabeled = new File([Buffer.from([255, 216, 255, 224])], 'wrong.png', { type: 'image/png' });
  const dataUrl = await readImageDataUrl(mislabeled, 'image/jpeg', Reader);
  assert.match(dataUrl, /^data:image\/jpeg;/);
  assert.equal(validateContext({ images: [{ id: 'i', purpose: 'scene', dataUrl }] }).images.length, 1);
});
