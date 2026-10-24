import test from 'node:test';
import assert from 'node:assert/strict';
import { PING_RHYME_GROUPS, planPoemSettings } from '../src/engine/rhymes.js';
import { MetricalEngine } from '../src/engine/metrical.js';
import { JijuPoetryApp } from '../src/app.js';

const RHYME = '上平一东';
const fivePatterns = ['00110', '11001', '11100', '00011'];
const sevenPatterns = ['0011100', '1100011', '1100110', '0011001'];
const texts = ['甲乙丙丁戊己庚', '辛壬癸子丑寅卯', '辰巳午未申酉戌', '亥天地玄黄宇宙'];

function line(index, pattern, overrides = {}) {
  const ping = pattern.endsWith('1');
  return {
    id: `line-${index}`, content: texts[index].slice(0, pattern.length), length: pattern.length,
    author: `作者${index}`, title: `篇目${index}`, dynasty: '唐', tags: [],
    ping_ze_pattern: pattern, end_tone: ping ? '平' : '仄', rhyme_group: ping ? RHYME : '仄声',
    ...overrides
  };
}

const poem = patterns => patterns.map((pattern, index) => line(index, pattern));
const engine = new MetricalEngine();
const hasError = (result, code) => result.errors.some(error => error.code === code);

function appFor(length = 5, activeLevel = null) {
  const app = Object.create(JijuPoetryApp.prototype);
  Object.assign(app, { engine, currentLength: length, currentPoemLines: [], activeLevel });
  app.updateSlotsDisplay = () => {};
  return app;
}

test('五言和七言的四种标准绝句格式均合格', () => {
  const forms = [
    ['00110', '11001', '11100', '00011'],
    ['00011', '11001', '11100', '00011'],
    ['11100', '00011', '00110', '11001'],
    ['11001', '00011', '00110', '11001'],
    ['0011100', '1100011', '1100110', '0011001'],
    ['0011001', '1100011', '1100110', '0011001'],
    ['1100110', '0011001', '0011100', '1100011'],
    ['1100011', '0011001', '0011100', '1100011']
  ];
  for (const patterns of forms) {
    const result = engine.evaluatePoem(poem(patterns));
    assert.equal(result.isValid, true, JSON.stringify(result.errors));
    assert.equal(result.score, 100);
  }
});

test('奇数位可变，但孤平、三平尾须拒绝；孤平本句自救与三仄尾允许', () => {
  for (const [actual, expected] of [['01001', '11001'], ['0001001', '0011001']]) {
    assert.equal(engine.isPatternStrictlyValid(actual, expected), false);
    assert.ok(engine.getPatternErrors(actual, expected).some(error => error.code === 'LONE_PING'));
  }
  for (const [actual, expected] of [['00111', '00011'], ['11100', '11001'], ['1100111', '1100011']]) {
    assert.equal(engine.isPatternStrictlyValid(actual, expected), false);
  }
  for (const [actual, expected] of [['01101', '11001'], ['0001101', '0011001'],
    ['10110', '00110'], ['11000', '11100'], ['0011000', '0011100']]) {
    assert.equal(engine.isPatternStrictlyValid(actual, expected), true, actual);
  }
});

test('关键位置失律不得再获得 95 分或合格等级，作者多样也不能抵消', () => {
  const lines = poem(sevenPatterns);
  lines[1].ping_ze_pattern = '1101011';
  const result = engine.evaluatePoem(lines);
  assert.equal(result.isValid, false);
  assert.ok(result.score < 85);
  assert.equal(result.rank, '未合律·请调整');
  assert.ok(hasError(result, 'PATTERN_MISMATCH'));
  assert.ok(result.report.some(message => message.includes('第 2 句')));
});

test('首句入韵须同韵，通用韵、空韵部、未知韵部均不能判为押韵', () => {
  const lines = poem(['00011', '11001', '11100', '00011']);
  lines[0].rhyme_group = '上平二冬';
  assert.ok(hasError(engine.validatePoem(lines), 'RHYME_MISMATCH'));
  for (const group of ['平水韵通用', '', null, '上平十六东']) {
    const invalid = poem(fivePatterns);
    invalid[1].rhyme_group = invalid[3].rhyme_group = group;
    assert.ok(hasError(engine.evaluatePoem(invalid), 'UNKNOWN_RHYME'));
  }
  const wrongTone = poem(fivePatterns);
  wrongTone[1] = line(1, '11000');
  assert.ok(hasError(engine.validatePoem(wrongTone), 'RHYME_TONE'));
});

test('混合字数、实际字数不符、尾字标注矛盾、未知编码均拒绝', () => {
  const mixed = poem(fivePatterns);
  mixed[2] = line(2, sevenPatterns[2]);
  assert.ok(hasError(engine.validatePoem(mixed), 'LINE_LENGTH'));
  const badContent = poem(fivePatterns);
  badContent[0].content += '字';
  assert.ok(hasError(engine.validatePoem(badContent), 'LINE_LENGTH'));
  const badTone = poem(fivePatterns);
  badTone[0].end_tone = '平';
  assert.ok(hasError(engine.validatePoem(badTone), 'END_TONE'));
  for (const pattern of [undefined, '', '0?110', '0011', '001100']) {
    const badPattern = poem(fivePatterns);
    badPattern[0].ping_ze_pattern = pattern;
    assert.equal(engine.evaluatePoem(badPattern).isValid, false);
    assert.equal(engine.isPatternStrictlyValid(pattern, '00110'), false);
  }
});

test('缺句、多句及损坏记录不崩溃，也不能合格', () => {
  for (const lines of [[], poem(fivePatterns).slice(0, 3), [...poem(fivePatterns), line(0, '00110')],
    [null, ...poem(fivePatterns).slice(1)], new Array(4), null]) {
    assert.equal(engine.evaluatePoem(lines).isValid, false);
  }
  assert.equal(engine.validatePoem([], { requireComplete: false }).isValid, true);
  assert.equal(engine.validatePoem([], { length: 6, requireComplete: false }).isValid, false);
});

test('重复 ID、重复文本和同一原诗多句均拒绝，同作者不同篇允许', () => {
  for (const field of ['id', 'content']) {
    const lines = poem(fivePatterns);
    lines[3][field] = lines[1][field];
    assert.ok(hasError(engine.validatePoem(lines), 'DUPLICATE_LINE'));
  }
  const lines = poem(fivePatterns).map(item => ({ ...item, author: '杜甫' }));
  assert.equal(engine.validatePoem(lines, { singleAuthorMode: true }).isValid, true);
  lines[3].title = lines[1].title;
  assert.ok(hasError(engine.validatePoem(lines), 'DUPLICATE_SOURCE'));
});

test('智能推荐及意象搜索在集杜模式也执行严格格律、韵部和来源检查', () => {
  const first = line(0, '0011100', { author: '杜甫' });
  const valid = line(1, '1100011', { author: '杜甫', tags: ['明月'] });
  const alternatives = [
    valid,
    { ...valid, id: 'off-pattern', ping_ze_pattern: '1101011' },
    { ...valid, id: 'three-ping', ping_ze_pattern: '1100111' },
    { ...valid, id: 'unknown', rhyme_group: '平水韵通用' },
    { ...valid, id: 'same-source', title: first.title },
    { ...valid, id: 'other-author', author: '李白' }
  ];
  const e = new MetricalEngine(alternatives);
  const options = { singleAuthorMode: true, keyword: '明月', length: 7 };
  assert.deepEqual(e.getSmartCandidatePool([first], 7, options).map(item => item.poetry.id), [valid.id]);
  assert.deepEqual(e.getRecommendations([first], options).map(item => item.poetry.id), [valid.id]);
  assert.deepEqual(e.getSmartCandidatePool([first], 7, { ...options, targetRhyme: '上平二冬' }), []);
  const broken = { ...first, ping_ze_pattern: '0?11100' };
  assert.deepEqual(e.getSmartCandidatePool([broken], 7), []);
  assert.deepEqual(e.getRecommendations([broken], { length: 7 }), []);
  assert.deepEqual(e.getRecommendations([null], { length: 7 }), []);
  assert.deepEqual(e.getSmartCandidatePool(null, 7), []);

  const loneFirst = line(0, '1100110', { author: '杜甫' });
  const loneEngine = new MetricalEngine([
    line(1, '0001001', { author: '杜甫', tags: ['明月'] }),
    line(1, '0001101', { id: 'rescued', author: '杜甫', tags: ['明月'] })
  ]);
  assert.deepEqual(loneEngine.getSmartCandidatePool([loneFirst], 7, options).map(item => item.poetry.id), ['rescued']);
  assert.deepEqual(loneEngine.getRecommendations([loneFirst], options).map(item => item.poetry.id), ['rescued']);
});

test('推荐起句、尾句与手动前缀校验使用同一规则', () => {
  const lines = poem(fivePatterns);
  const database = [line(0, '00110'), line(1, '00111'), line(3, '00011'),
    line(3, '00011', { id: 'wrong-rhyme', rhyme_group: '上平二冬' })];
  const e = new MetricalEngine(database);
  assert.ok(e.getSmartCandidatePool([], 5).every(item => e.isValidQuatrainStarterLine(item.poetry, 5)));
  assert.deepEqual(e.getSmartCandidatePool(lines.slice(0, 3), 5).map(item => item.poetry.id), ['line-3']);
  assert.deepEqual(e.getRecommendations(lines, { length: 5 }), []);
});

test('手动选句拒绝不同字数、重复、失律和集杜作者变化，并保持原状态', () => {
  const app = appFor();
  const alerts = [];
  const previousAlert = globalThis.alert;
  globalThis.alert = message => alerts.push(message);
  try {
    assert.equal(app.selectCandidateLine(line(0, '0011100')), false);
    assert.equal(app.selectCandidateLine(line(0, '00110')), true);
    assert.equal(app.selectCandidateLine(line(0, '00110')), false);
    assert.equal(app.selectCandidateLine(line(1, '10001')), false);
    assert.equal(app.currentPoemLines.length, 1);
    app.activeLevel = { length: 5, requireSingleAuthor: true };
    assert.equal(app.selectCandidateLine(line(1, '11001')), false);
    assert.equal(app.selectCandidateLine(line(1, '11001', { author: '作者0' })), true);
    assert.ok(alerts.length >= 4);
  } finally {
    if (previousAlert === undefined) delete globalThis.alert;
    else globalThis.alert = previousAlert;
  }
});

test('删句时移除依赖它的后续句，避免自动前移造成失律', () => {
  const app = appFor();
  app.currentPoemLines = poem(fivePatterns);
  app.removeLineAt(1);
  assert.equal(app.currentPoemLines.length, 1);
  assert.equal(engine.validatePoem(app.currentPoemLines, { requireComplete: false }).isValid, true);
  app.removeLineAt(-1);
  app.removeLineAt(10);
  assert.equal(app.currentPoemLines.length, 1);
});

test('通关须先格律及来源合格，再满足目标；不受评分或作者条件单独影响', () => {
  const app = appFor(7, { length: 7, requireSingleAuthor: true });
  const lines = poem(sevenPatterns).map(item => ({ ...item, author: '杜甫' }));
  assert.equal(app.checkLevelGoal(lines).passed, true);
  const offPattern = lines.map(item => ({ ...item }));
  offPattern[1].ping_ze_pattern = '1101011';
  assert.equal(app.checkLevelGoal(offPattern).passed, false);
  const sameSource = lines.map(item => ({ ...item, title: '同一篇' }));
  assert.equal(app.checkLevelGoal(sameSource).passed, false);
  assert.equal(app.checkLevelGoal([...lines.slice(0, 3), lines[1]]).passed, false);
  app.activeLevel = { length: 5, requireSingleAuthor: true };
  assert.equal(app.checkLevelGoal(lines).passed, false);
  assert.equal(app.checkLevelGoal(lines.slice(0, 3)), null);
});

test('目标韵部、作者数量与意象须分别满足，意象不跨句拼接误命中', () => {
  const app = appFor(5, { length: 5, targetRhyme: RHYME, requireUniqueAuthors: 4, requiredTags: ['明月'] });
  const lines = poem(fivePatterns);
  assert.equal(app.checkLevelGoal(lines).passed, false);
  lines[0].tags = ['明月'];
  assert.equal(app.checkLevelGoal(lines).passed, true);
  app.activeLevel.targetRhyme = '上平二冬';
  assert.equal(app.checkLevelGoal(lines).passed, false);
  app.activeLevel.targetRhyme = RHYME;
  lines[3].author = lines[0].author;
  assert.equal(app.checkLevelGoal(lines).passed, false);
  const crossing = poem(fivePatterns);
  crossing[0].content = '甲乙丙丁明';
  crossing[1].content = '月壬癸子丑';
  assert.equal(app.checkLevelGoal(crossing).passed, false);
});

test('30 个可选平声韵与校验器一致，切换设定只保留连续合律前缀', () => {
  assert.equal(PING_RHYME_GROUPS.length, 30);
  assert.equal(new Set(PING_RHYME_GROUPS.map(group => group.id)).size, 30);
  assert.ok(PING_RHYME_GROUPS.every(group => engine.isKnownPingRhyme(group.id)));
  const lines = poem(fivePatterns);
  assert.equal(planPoemSettings(engine, lines, 5, '上平二冬').keepCount, 1);
  assert.equal(planPoemSettings(engine, lines, 7, RHYME).keepCount, 0);
  assert.equal(planPoemSettings(engine, lines, 5, '').keepCount, 4);
  assert.equal(planPoemSettings(engine, poem(['00011', '11001', '11100', '00011']), 5, '上平二冬').keepCount, 0);
  assert.throws(() => planPoemSettings(engine, lines, 5, '仄声'));
});

test('换韵或换字数发生冲突时保留原诗，明确应用后才删去不兼容的后续句', () => {
  const app = appFor(); app.renderPoemSettings = () => {}; app.preferredRhyme = RHYME;
  app.currentPoemLines = poem(fivePatterns);
  const previous = [...app.currentPoemLines];
  assert.equal(app.requestPoemSettings({ rhyme: '上平二冬' }), false);
  assert.deepEqual(app.currentPoemLines, previous); assert.equal(app.getTargetRhyme(), RHYME);
  assert.equal(app.pendingSettings.keepCount, 1);
  assert.equal(app.requestPoemSettings(app.pendingSettings, true), true);
  assert.equal(app.currentPoemLines.length, 1); assert.equal(app.getTargetRhyme(), '上平二冬');
  assert.equal(app.requestPoemSettings({ length: 7 }), false);
  assert.equal(app.currentLength, 5); assert.equal(app.currentPoemLines.length, 1);
  app.requestPoemSettings(app.pendingSettings, true);
  assert.equal(app.currentLength, 7); assert.deepEqual(app.currentPoemLines, []);
});

test('自由选韵约束手动选句和候选池，关卡韵部独立于自由设定', () => {
  const app = appFor(); app.preferredRhyme = '上平二冬';
  const original = globalThis.alert; globalThis.alert = () => {};
  try {
    assert.equal(app.selectCandidateLine(line(0, '00011')), false);
    assert.equal(app.selectCandidateLine(line(0, '00110')), true);
    assert.equal(app.selectCandidateLine(line(1, '11001')), false);
    assert.equal(app.selectCandidateLine(line(1, '11001', { rhyme_group: '上平二冬' })), true);
  } finally { if (original === undefined) delete globalThis.alert; else globalThis.alert = original; }
  app.activeLevel = { targetRhyme: RHYME }; assert.equal(app.getTargetRhyme(), RHYME);
  app.activeLevel = {}; assert.equal(app.getTargetRhyme(), '');
  const pool = new MetricalEngine([line(1, '11001'), line(1, '11001', { id: 'winter', rhyme_group: '上平二冬' })]);
  assert.deepEqual(pool.getSmartCandidatePool([line(0, '00110')], 5, { targetRhyme: '上平二冬' }).map(item => item.poetry.id), ['winter']);
  assert.deepEqual(pool.getRecommendations([line(0, '00110')], { length: 5, targetRhyme: '上平二冬', keyword: line(1, '11001').content.slice(0, 2) }).map(item => item.poetry.id), ['winter']);
});
