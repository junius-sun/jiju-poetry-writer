import { DEFAULT_CONFIG, normalizeConfig, AiError } from './config.js';
import { createAiService } from './service.js';

export const PROVIDERS = Object.freeze({
  openrouter: { name:'OpenRouter', baseUrl:'https://openrouter.ai/api/v1', model:'openrouter/free', outputMode:'schema', tokenField:'max_tokens', vision:true },
  openai: { name:'OpenAI', baseUrl:'https://api.openai.com/v1', model:'gpt-4.1-mini', outputMode:'schema', tokenField:'max_completion_tokens', vision:true },
  custom: { name:'自定义兼容服务', baseUrl:'', model:'', outputMode:'json', tokenField:'max_tokens', vision:false }
});

// Each page owns this closure. No key, material or result is written to web storage.
export function createBrowserAiClient({fetcher=globalThis.fetch,getCorpus}={}) {
  let config={...DEFAULT_CONFIG,...PROVIDERS.openrouter,apiKey:'',thinkingMode:'auto'},service,revision=0;
  const reset=()=>{service=createAiService({configStore:{get:async()=>({...config})},getCorpus,fetcher:async(url,request)=>{
    try { return await fetcher(url,request); }
    catch(error) {
      if(request.signal?.aborted) throw error;
      throw new AiError('浏览器无法连接所选服务。请检查网络，或确认该服务允许浏览器跨域调用；本地运行时也可选择本机代理。',502);
    }
  }});};
  const status=()=>{const {apiKey,...safe}=config;return {...safe,configured:Boolean(apiKey),keyPresent:Boolean(apiKey),managedFields:[],revision};};
  reset();
  return {
    status,
    save(value={}) {
      const next=normalizeConfig({...value,thinkingMode:'auto'},config);
      if(next.baseUrl!==config.baseUrl&&!value.apiKey) next.apiKey='';
      config=next;revision++;reset();return status();
    },
    async run(operation,payload={},options={}) { return service.run(operation,payload,options); }
  };
}
