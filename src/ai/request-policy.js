import { AiError } from './config.js';
import { DEFAULT_MODEL_TIMEOUT_SECONDS } from './protocol.js';

export function modelRequestPolicy(config, operation) {
  const model = operation === 'analyze' ? config.visionModel || config.model : config.model;
  const hostname = new URL(config.baseUrl).hostname;
  const ark = /^ark\.[a-z0-9-]+\.volces\.com$/.test(hostname);
  const openRouter = hostname === 'openrouter.ai';
  const mode = config.thinkingMode || 'auto';
  let extra = {};
  if (mode !== 'auto') {
    if (ark) extra = { thinking: { type: mode } };
    else if (openRouter) extra = { reasoning: { enabled: mode === 'enabled' } };
    else throw new AiError('此接口暂未适配思考模式切换，请将思考模式设为「自动」。');
  } else if (ark && /^doubao-seed-2[-.][01][-.]/.test(model)) {
    // Seed 2.x defaults to deep thinking. Interactive poem selection should answer directly.
    extra = { thinking: { type: 'disabled' } };
  }
  return { model, extra, timeoutMs: (config.timeoutSeconds ?? DEFAULT_MODEL_TIMEOUT_SECONDS) * 1000 };
}
