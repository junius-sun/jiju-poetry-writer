/**
 * 冒烟测试：校验数据库完整性 + 格律引擎全流程可走通
 * 运行：node scripts/smoke_test.js
 */
import { POETRY_DATABASE } from '../src/data/poetry_db.js';
import { MetricalEngine } from '../src/engine/metrical.js';

let failures = 0;
const check = (ok, msg) => {
  if (!ok) { failures++; console.error(`  ❌ ${msg}`); }
};

// ============ 1. 数据库完整性 ============
console.log('【1】数据库完整性校验');
check(Array.isArray(POETRY_DATABASE) && POETRY_DATABASE.length > 0, '数据库为空');
console.log(`  条目总数: ${POETRY_DATABASE.length}`);

const ids = new Set();
let badFields = 0, badLength = 0, badPattern = 0, dupIds = 0, badRhyme = 0;
for (const item of POETRY_DATABASE) {
  if (!item.id || !item.content || !item.author || !item.title ||
      !item.ping_ze_pattern || !item.end_tone || !item.rhyme_group ||
      !Array.isArray(item.tags)) badFields++;
  if (ids.has(item.id)) dupIds++; else ids.add(item.id);
  const charCount = Array.from(item.content).length;
  if (charCount !== item.length) badLength++;
  if (item.ping_ze_pattern.length !== item.length || !/^[01]+$/.test(item.ping_ze_pattern)) badPattern++;
  // 平声收尾的句子不应标记为“仄声”韵部，反之亦然
  if (item.end_tone === '平' && item.rhyme_group === '仄声') badRhyme++;
  if (item.end_tone === '仄' && item.rhyme_group !== '仄声') badRhyme++;
}
check(badFields === 0, `${badFields} 条记录字段缺失`);
check(dupIds === 0, `${dupIds} 个重复 id`);
check(badLength === 0, `${badLength} 条记录 length 与 content 字数不符`);
check(badPattern === 0, `${badPattern} 条记录平仄pattern异常`);
check(badRhyme === 0, `${badRhyme} 条记录尾字平仄与韵部标记矛盾`);

// ============ 2. 引擎全流程：五言 + 七言各自动组装一首 ============
const engine = new MetricalEngine(POETRY_DATABASE);

for (const len of [5, 7]) {
  console.log(`【2】${len}言绝句自动集句流程`);
  const starters = POETRY_DATABASE.filter(i => engine.isValidQuatrainStarterLine(i, len));
  check(starters.length > 0, `${len}言无合法起句`);
  console.log(`  合法起句数量: ${starters.length}`);

  const poem = [starters[0]];
  for (let slot = 1; slot < 4; slot++) {
    const recs = engine.getSmartFiveRecommendations(poem, len, 5);
    check(recs.length > 0, `${len}言第 ${slot + 1} 句无推荐（基于首句《${poem[0].title}》）`);
    if (recs.length === 0) break;
    poem.push(recs[0].poetry);
  }

  if (poem.length === 4) {
    const result = engine.evaluatePoem(poem);
    console.log(`  集句结果: ${poem.map(l => l.content).join(' / ')}`);
    console.log(`  评估: ${result.rank}，得分 ${result.score}`);
    check(result.isValid, `${len}言自动集句未通过统一校验: ${JSON.stringify(result.errors)}`);
    // 偶数句押韵一致性
    check(poem[1].rhyme_group === poem[3].rhyme_group && poem[1].rhyme_group !== '仄声',
      `${len}言自动集句偶数句未押同韵`);
  }
}

// ============ 3. 通用检索 ============
console.log('【3】关键词检索');
const searchRes = engine.getRecommendations([], { length: 5, keyword: '明月' });
check(searchRes.length > 0, '搜索“明月”无结果');
console.log(`  “明月”五言检索命中: ${searchRes.length} 条`);

// ============ 4. 集杜真实语料推荐须逐条严格合格 ============
console.log('【4】集杜模式严格校验');
const duStarter = POETRY_DATABASE.find(item => item.author === '杜甫' && engine.isValidQuatrainStarterLine(item, 7));
check(Boolean(duStarter), '杜甫缺少合法七言起句');
if (duStarter) {
  const options = { singleAuthorMode: true };
  const pool = engine.getSmartCandidatePool([duStarter], 7, options);
  check(pool.length > 0, '集杜模式没有合法续句');
  for (const candidate of pool) {
    const result = engine.validatePoem([duStarter, candidate.poetry], {
      ...options, length: 7, requireComplete: false
    });
    check(result.isValid, `集杜候选失律: ${candidate.poetry.content}`);
  }
  console.log(`  首句: ${duStarter.content} | ${pool.length} 条候选均已逐条校验`);
}

console.log(failures === 0 ? '\n✅ 全部冒烟测试通过' : `\n❌ 共 ${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
