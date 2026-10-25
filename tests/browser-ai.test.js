import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserAiClient,PROVIDERS} from '../src/ai/browser-client.js';
const key='browser-test-placeholder-not-a-real-key';
const packet=result=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]});
const analyzed={brief:'山间月夜，清静自在。',theme:'月夜',mood:'清静',imagery:['山','月'],avoid:[],imageNotes:[]};
const database=['00110','11001','11100','00011'].map((pattern,i)=>({id:'browser-'+i,content:['江边春月冷','孤舟带梦归','远岭生新雾','晨风拂客衣'][i],length:5,author:'作者'+i,title:'篇'+i,dynasty:'唐',tags:['月'],ping_ze_pattern:pattern,end_tone:pattern.endsWith('1')?'平':'仄',rhyme_group:pattern.endsWith('1')?'上平五微':'仄声'}));

test('预设服务只需 Key，连接直接访问所选服务，公开状态与新页面没有 Key',async()=>{
 let request;
 const client=createBrowserAiClient({fetcher:async(url,init)=>{request={url,init};return packet({ok:true});}});
 const status=client.save({apiKey:key});
 assert.equal(status.model,PROVIDERS.openrouter.model);assert.equal(status.configured,true);
 assert.ok(!JSON.stringify(status).includes(key));assert.equal(createBrowserAiClient().status().configured,false);
 await client.run('test');
 assert.equal(request.url,'https://openrouter.ai/api/v1/chat/completions');
 assert.equal(request.init.headers.Authorization,'Bearer '+key);assert.equal(request.init.redirect,'error');
 assert.ok(!request.url.includes(key));assert.ok(!request.init.body.includes(key));
 client.save({clearKey:true});await assert.rejects(client.run('test'),/尚未填写/);
});

test('切换服务不沿用旧 Key；格式与 HTTPS 验证在调用前执行',async()=>{
 let calls=0;const client=createBrowserAiClient({fetcher:async()=>{calls++;return packet({ok:true});}});
 client.save({apiKey:key});client.save({...PROVIDERS.openai});
 assert.equal(client.status().configured,false);await assert.rejects(client.run('test'),/尚未填写/);assert.equal(calls,0);
 assert.throws(()=>client.save({baseUrl:'https://user:pass@example.com/v1'}),/HTTPS/);
 assert.throws(()=>client.save({baseUrl:'http://example.com/v1'}),/HTTPS/);
 assert.throws(()=>client.save({apiKey:'bad key'}),/密钥/);
});

test('浏览器直连复用素材校验、真实候选复核与点评引用校验',async()=>{
 let invalid=false;
 const client=createBrowserAiClient({getCorpus:async()=>database,fetcher:async(_,init)=>{
  const body=JSON.parse(init.body),schema=body.response_format.json_schema.schema;
  if(schema.properties.brief)return packet(analyzed);
  if(schema.properties.recommendations){const ids=schema.properties.recommendations.items.properties.id.enum;return packet({direction:'以山月起笔。',recommendations:[{id:invalid?'invented-id':ids[0],role:'起句',reason:'景物起笔。',caution:''}]});}
  return packet({summary:'场景完整。',ratings:{coherence:3,imagery:3,emotion:3,resonance:3},strengths:['有画面'],issues:[{lineIndex:1,quote:invalid?'编造原文':database[0].content,issue:'可以推敲',suggestion:'比较别的候选'}],warnings:[]});
 }});
 client.save({apiKey:key});assert.equal((await client.run('analyze',{context:{instructions:'月夜'}})).brief,analyzed.brief);
 const result=await client.run('recommend',{lineIds:[],length:5});assert.ok(database.includes(result.recommendations[0].poetry));
 invalid=true;client.save({apiKey:key});
 await assert.rejects(client.run('recommend',{lineIds:[],length:5}),/格式/);
 await assert.rejects(client.run('evaluate',{lineIds:database.map(line=>line.id),length:5}),/不存在/);
});

test('浏览器模式处理跨域或网络错误、鉴权失败和取消，不回显密钥',async()=>{
 const client=createBrowserAiClient({fetcher:async()=>{throw new TypeError(key);}});client.save({apiKey:key});
 await assert.rejects(client.run('test'),error=>error.message.includes('跨域')&&!error.message.includes(key));
 const unauthorized=createBrowserAiClient({fetcher:async()=>new Response(key,{status:401})});unauthorized.save({apiKey:key});
 await assert.rejects(unauthorized.run('test'),error=>error.message.includes('密钥无效')&&!error.message.includes(key));
 const started=Promise.withResolvers(),controller=new AbortController();
 const pending=createBrowserAiClient({fetcher:async(_,init)=>{started.resolve();return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));}});
 pending.save({apiKey:key});const task=pending.run('test',{}, {signal:controller.signal});await started.promise;controller.abort();
 await assert.rejects(task,error=>error.status===499);
});

test('浏览器直连不读取或写入浏览器存储，模型结果中出现的 Key 会被移除',async t=>{
 const saved={localStorage:globalThis.localStorage,sessionStorage:globalThis.sessionStorage};
 for(const name of Object.keys(saved))Object.defineProperty(globalThis,name,{configurable:true,get(){throw new Error('must not access storage');}});
 t.after(()=>{for(const [name,value] of Object.entries(saved)){delete globalThis[name];if(value!==undefined)globalThis[name]=value;}});
 const client=createBrowserAiClient({fetcher:async()=>packet({...analyzed,brief:key})});client.save({apiKey:key});
 const result=await client.run('analyze',{context:{instructions:'夜色'}});assert.ok(!JSON.stringify(result).includes(key));
});
