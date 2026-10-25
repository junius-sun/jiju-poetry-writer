import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AiError, DEFAULT_CONFIG, normalizeConfig } from '../../src/ai/config.js';
export { AiError, DEFAULT_CONFIG, normalizeConfig } from '../../src/ai/config.js';

export function createConfigStore(filename, env = process.env) {
  let revision = 0;
  const environment = () => ({
    ...(env.AI_BASE_URL ? { baseUrl: env.AI_BASE_URL } : {}),
    ...(env.AI_MODEL ? { model: env.AI_MODEL } : {}),
    ...(env.AI_VISION_MODEL ? { visionModel: env.AI_VISION_MODEL } : {}),
    ...(env.AI_OUTPUT_MODE ? { outputMode: env.AI_OUTPUT_MODE } : {}),
    ...(env.AI_TOKEN_FIELD ? { tokenField: env.AI_TOKEN_FIELD } : {}),
    ...(env.AI_TIMEOUT_SECONDS ? { timeoutSeconds: Number(env.AI_TIMEOUT_SECONDS) } : {}),
    ...(env.AI_THINKING_MODE ? { thinkingMode: env.AI_THINKING_MODE } : {}),
    ...(env.AI_VISION ? { vision: env.AI_VISION !== 'false' } : {}),
    ...((env.AI_API_KEY || env.OPENAI_API_KEY) ? { apiKey: env.AI_API_KEY || env.OPENAI_API_KEY } : {})
  });
  const stored = async () => {
    try { return normalizeConfig(JSON.parse(await readFile(filename, 'utf8'))); }
    catch (error) { if (error.code === 'ENOENT') return { ...DEFAULT_CONFIG }; throw new AiError('无法读取本地模型配置，请检查服务端配置文件。', 500); }
  };
  return {
    async get() { return normalizeConfig(environment(), await stored()); },
    async status() {
      const config = await this.get(); const { apiKey, ...publicConfig } = config;
      return { ...publicConfig, configured: Boolean(apiKey), keyPresent: Boolean(apiKey),
        managedFields: Object.keys(environment()), revision };
    },
    async save(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AiError('模型配置格式无效。');
      const fields = Object.keys(environment());
      if (fields.some(field => value[field] !== undefined) || (fields.includes('apiKey') && value.clearKey)) throw new AiError('部分配置由环境变量管理，请在服务端修改这些字段。');
      const config = normalizeConfig(value, await stored());
      await mkdir(path.dirname(filename), { recursive: true });
      const temporary = filename + '.' + randomUUID() + '.tmp';
      await writeFile(temporary, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
      await rename(temporary, filename); revision++;
      return this.status();
    }
  };
}
