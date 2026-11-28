const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../assets/data/characters.json');
const createCharacters = require('../assets/js/characters.js');
const createSimulation = require('../assets/js/simulation.js');
const rules = createCharacters(data);
const simulation = createSimulation(rules);

// The seven slots in the photographed formation, in their original order.
const slots = [
  ['kubinight', 140, 0, 'awakened', '138M'],
  ['mikon', 94, 2, 'normal', '62.4M'],
  ['ponja', 100, 0, 'normal', '59.7M'],
  ['lovril', 100, 0, 'awakened', '59.7M'],
  ['lovril', 100, 0, 'awakened', '59.7M'],
  ['jk', 100, 0, 'normal', '49.8M'],
  ['kyonshina', 100, 1, 'normal', '10.1M'],
];
const chars = slots.map(([catalogId, level, limitBreak, mutation]) => ({
  category: rules.CATALOG_BY_ID[catalogId].category, catalogId, level, limitBreak, mutation,
}));
const party = rules.resolveParty(chars);

test('実測7枠の攻撃力とペア編成', () => {
  assert.deepEqual(party.map(c => rules.formatStat(c.power, 'bag')), slots.map(row => row[4]));
  const twoMikon = rules.resolveParty([chars[1], chars[1]]);
  assert.ok(twoMikon.every(c => !c.truePair));
});

test('図鑑を並べ替えても保存済みIDと通常キャラの基礎値が一致する', () => {
  const reversed = createCharacters({ ...data, characters: [...data.characters].reverse() });
  assert.deepEqual(reversed.catalogEntries('normal'), rules.catalogEntries('normal'));
  assert.deepEqual(reversed.resolveParty(chars), party);
});

test('固定した乱数で旧版のステージ63と一致する', () => {
  const result = simulation.estimate(63, party, 3, 120, 4);
  assert.deepEqual(result, {
    kills: 96 / 360, deaths: 6 / 360, jkBoostsPerSecond: 35 / 360,
    kingProcRate: null, enemyHitRate: 0.3601108033240997,
  });
});

test('餌は46から計上し、討伐数ゼロでも順位計算が完了する', () => {
  const rates = simulation.foodRates(party, 25);
  const stages = [{ stage: 45, kills: 1 }, { stage: 46, kills: 1 }];
  const ranked = simulation.rankStages(stages, 1, rates);
  assert.equal(ranked.gemRows[0].stage, 46);
  assert.deepEqual(ranked.feedRows.map(row => row.stage), [46]);
  assert.equal(ranked.combinedRows[0].combined, 1);
  assert.equal(ranked.combinedRows[1].foodHour, 0);
  assert.deepEqual(simulation.rankStages([{ stage: 46, kills: 0 }], 1, rates).combinedRows, []);
});
