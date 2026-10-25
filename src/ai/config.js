import { DEFAULT_MODEL_TIMEOUT_SECONDS, MIN_MODEL_TIMEOUT_SECONDS, MAX_MODEL_TIMEOUT_SECONDS } from './protocol.js';

export class AiError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const DEFAULT_CONFIG = Object.freeze({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini',
  visionModel: '', vision: true, outputMode: 'schema', tokenField: 'max_completion_tokens', apiKey: '',
  timeoutSeconds: DEFAULT_MODEL_TIMEOUT_SECONDS, thinkingMode: 'auto' });

export function normalizeConfig(value, previous = DEFAULT_CONFIG) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AiError('模型配置格式无效。');
  const result = { ...DEFAULT_CONFIG, ...previous };
  for (const key of ['baseUrl', 'model', 'visionModel', 'outputMode', 'tokenField', 'thinkingMode']) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'string' || value[key].length > 500 || /[\r\n\x00]/.test(value[key])) throw new AiError('配置字段格式无效。');
      result[key] = value[key].trim();
    }
  }
  let url;
  try { url = new URL(result.baseUrl); } catch { throw new AiError('请填写完整的 API 根地址。'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!['https:', 'http:'].includes(url.protocol) || (url.protocol === 'http:' && !local) || url.username || url.password || url.search || url.hash) {
    throw new AiError('API 地址须使用 HTTPS；本机接口可使用 HTTP。地址中不能包含密码或查询参数。');
  }
  result.baseUrl = url.href.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '');
  if (!result.model || !/^[\w.\-/:]+$/.test(result.model) || (result.visionModel && !/^[\w.\-/:]+$/.test(result.visionModel))) throw new AiError('请填写有效的模型名称。');
  if (!['schema', 'json'].includes(result.outputMode) || !['max_completion_tokens', 'max_tokens'].includes(result.tokenField)) throw new AiError('输出模式或 Token 参数不受支持。');
  if (!['auto', 'disabled', 'enabled'].includes(result.thinkingMode)) throw new AiError('思考模式无效。');
  if (value.timeoutSeconds !== undefined) result.timeoutSeconds = value.timeoutSeconds;
  if (!Number.isInteger(result.timeoutSeconds) || result.timeoutSeconds < MIN_MODEL_TIMEOUT_SECONDS || result.timeoutSeconds > MAX_MODEL_TIMEOUT_SECONDS) throw new AiError('模型等待时间须为 30 到 300 秒的整数。');
  if (value.vision !== undefined) {
    if (typeof value.vision !== 'boolean') throw new AiError('图片支持选项无效。');
    result.vision = value.vision;
  }
  if (value.apiKey !== undefined) {
    if (typeof value.apiKey !== 'string' || value.apiKey.length > 4000 || /[\x00-\x20\x7f]/.test(value.apiKey)) throw new AiError('密钥不能包含空格、换行或控制字符。');
    if (value.apiKey) result.apiKey = value.apiKey;
  }
  if (value.clearKey === true) result.apiKey = '';
  return result;
}

