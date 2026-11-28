function createMoncolleSimulation(rules) {
  'use strict';
  const { CHARACTERS, BOSS_MODEL, ATTACK_PERIODS } = rules;

  const enemyHpAtStage = stage => 30 * Math.pow(1.2, (stage - 1) + Math.floor(stage / 2));
  const HP = Array.from({ length: 75 }, (_, index) => enemyHpAtStage(index + 1));
  const MODEL = {
    enemyPeriod: 1 / 0.7,
    enemyHitRate: 0.35,
    replacementMin: 3,
    replacementMax: 5,
    revival: 5,
    acquireDelay: 1.5,
    seconds: 600,
    runs: 12,
  };

  const baseline = {
    chars: [
      { power:360.7e6, hp:360.7e6*20, type:'normal', character:'none' },
      { power:150.1e6, hp:150.1e6*20, type:'normal', character:'none' },
      { power:150.1e6, hp:150.1e6*20, type:'normal', character:'none' },
      { power:144.8e6, hp:144.8e6*20, type:'normal', character:'none' },
      { power:144.8e6, hp:144.8e6*20, type:'normal', character:'none' },
      { power:2.4e6, hp:2.4e6*20, type:'legend', character:'kyonshina' },
      { power:1.6e6, hp:1.6e6*20, type:'legend', character:'awakenedNyarowin' },
    ],
    rebirth: 61,
    skill: 4.75,
  };

  function xorshift(seed) {
    let x = seed >>> 0;
    return () => {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      return (x >>> 0) / 4294967296;
    };
  }

  function traitFor(character) { return CHARACTERS[character]?.trait || 'none'; }
  function attackPower(ally) {
    if (ally.trait === 'lowHpAttack') {
      const effect = CHARACTERS[ally.character];
      if (ally.hp <= ally.max * effect.hpThreshold) return ally.power * effect.damage;
    }
    return ally.power;
  }
  function uniqueActiveCharacters(chars) {
    return new Set(chars.filter(c => Number(c.power) > 0 && c.character !== 'none').map(c => c.character));
  }
  function partyBonus(chars) {
    const unique = uniqueActiveCharacters(chars);
    return unique.has('awakenedNyarowin') || unique.has('kyonshina') ? 1 : 0;
  }
  function foodRates(chars, basePremiumPercent) {
    const unique = uniqueActiveCharacters(chars);
    const dropRate = Math.min(1, 0.05 + (unique.has('kabochild') ? CHARACTERS.kabochild.dropBonus : 0));
    const premiumRate = Math.min(1, basePremiumPercent / 100 + (unique.has('ayatsuritch') ? CHARACTERS.ayatsuritch.premiumBonus : 0));
    return { dropRate, premiumRate };
  }

  function simulate(stage, party, seed, seconds, enemyType = 'normal') {
    const H = HP[stage - 1];
    const enemyDamage = H / 20;
    const random = xorshift(seed);
    const traitRandom = xorshift(seed ^ 0x9e3779b9);
    const combatParty = enemyType === 'boss' ? party.slice(0, BOSS_MODEL.charactersPerPlayer) : party;
    const activeJkCount = combatParty.filter(c => Number(c.power) > 0 && c.character === 'jk').length;
    const jkTeamDodge = enemyType === 'boss' && activeJkCount > 0 ? BOSS_MODEL.jkOwnTeamDodge : 0;
    const allies = combatParty.map(c => {
      const power = Number(c.power) || 0;
      const maxHp = Number(c.hp) || power * 20;
      return {
        power, hp:maxHp, max:maxHp,
        period: ATTACK_PERIODS[c.type] ?? ATTACK_PERIODS.normal,
        alive: power > 0, token: 0, pos: random() * 10,
        target: -1, character: c.character, trait: traitFor(c.character),
        bossDodge: Math.min(0.95, Math.max(0, Number(c.bossDodge) || 0)),
        jkFirstStrike: power > 0 && c.character === 'jk' && enemyType === 'normal',
        kingNidraProc: power > 0 && c.character === 'kingNidra',
      };
    });
    const enemies = Array.from({ length: 7 }, () => ({ hp: H, alive: true, token: 0, target: -1, pos: random() * 10, jkHitBy: new Set() }));
    const heap = [];
    const less = (a, b) => a.t < b.t || (a.t === b.t && a.type > b.type);
    function add(t, type, id, token) {
      let k = heap.length;
      heap.push({ t, type, id, token });
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (!less(heap[k], heap[p])) break;
        [heap[k], heap[p]] = [heap[p], heap[k]];
        k = p;
      }
    }
    function pop() {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let k = 0;
        while (true) {
          const l = k * 2 + 1, r = l + 1;
          let m = k;
          if (l < heap.length && less(heap[l], heap[m])) m = l;
          if (r < heap.length && less(heap[r], heap[m])) m = r;
          if (m === k) break;
          [heap[k], heap[m]] = [heap[m], heap[k]];
          k = m;
        }
      }
      return top;
    }
    function nearest(group, pos) {
      let chosen = -1, distance = Infinity;
      for (let i = 0; i < group.length; i++) {
        if (!group[i].alive) continue;
        const d = Math.abs(group[i].pos - pos);
        if (d < distance) { distance = d; chosen = i; }
      }
      return chosen;
    }
    function activeHealer() {
      return allies.some(a => a.alive && a.character === 'lovril');
    }

    for (let i = 0; i < allies.length; i++) {
      if (!allies[i].alive) continue;
      allies[i].target = nearest(enemies, allies[i].pos);
      add(random() * allies[i].period, 0, i, 0);
    }
    for (let i = 0; i < enemies.length; i++) {
      enemies[i].target = nearest(allies, enemies[i].pos);
      add(random() * MODEL.enemyPeriod, 1, i, 0);
    }
    const heal = CHARACTERS.lovril;
    const healFraction = enemyType === 'boss' ? heal.bossHeal : heal.stageHeal;
    add(heal.interval, 4, 0, 0);

    let kills = 0, deaths = 0, jkBoosts = 0, kingProcAttempts = 0, kingProcSuccesses = 0, enemyHitAttempts = 0, enemyHits = 0;
    while (heap.length) {
      const event = pop();
      const time = event.t;
      if (time > seconds) break;

      if (event.type === 0) {
        const ally = allies[event.id];
        if (event.token !== ally.token || !ally.alive) continue;
        if (ally.target < 0 || !enemies[ally.target].alive) {
          ally.pos = random() * 10;
          ally.target = nearest(enemies, ally.pos);
          add(time + MODEL.acquireDelay, 0, event.id, ally.token);
          continue;
        }
        const targets = ally.trait === 'multi'
          ? enemies.map((enemy, index) => index).filter(index => enemies[index].alive)
              .sort((a, b) => Math.abs(enemies[a].pos - ally.pos) - Math.abs(enemies[b].pos - ally.pos))
              .slice(0, CHARACTERS.kubinight.targets)
          : [nearest(enemies, ally.pos)];
        for (const index of targets) {
          const enemy = enemies[index];
          let damage = attackPower(ally);
          if (ally.jkFirstStrike && !enemy.jkHitBy.has(event.id)) {
            damage *= CHARACTERS.jk.firstStrike;
            enemy.jkHitBy.add(event.id);
            jkBoosts++;
          }
          if (ally.kingNidraProc) {
            kingProcAttempts++;
            if (traitRandom() < CHARACTERS.kingNidra.chance) {
              damage *= CHARACTERS.kingNidra.damage;
              kingProcSuccesses++;
            }
          }
          enemy.hp -= damage;
          if (enemy.hp <= 0) {
            kills++;
            enemy.alive = false;
            enemy.token++;
            const replacement = MODEL.replacementMin + random() * (MODEL.replacementMax - MODEL.replacementMin);
            add(time + replacement, 3, index, enemy.token);
            if (ally.target === index) ally.target = -1;
          }
        }
        add(time + ally.period, 0, event.id, ally.token);
      } else if (event.type === 1) {
        const enemy = enemies[event.id];
        if (event.token !== enemy.token || !enemy.alive) continue;
        if (enemy.target < 0 || !allies[enemy.target].alive) {
          enemy.pos = random() * 10;
          enemy.target = nearest(allies, enemy.pos);
        }
        if (enemy.target >= 0) {
          enemyHitAttempts++;
          const ally = allies[enemy.target];
          const dodgeRate = enemyType === 'boss' ? Math.min(0.95, ally.bossDodge + jkTeamDodge) : 0;
          const enemyHitChance = enemyType === 'boss' ? BOSS_MODEL.baseHitRate * (1 - dodgeRate) : MODEL.enemyHitRate;
          if (random() >= enemyHitChance) {
            add(time + MODEL.enemyPeriod, 1, event.id, enemy.token);
            continue;
          }
          enemyHits++;
          ally.hp -= enemyDamage;
          if (ally.hp <= 0) {
            deaths++;
            ally.alive = false;
            ally.hp = 0;
            ally.token++;
            add(time + MODEL.revival, 2, enemy.target, ally.token);
          }
        }
        add(time + MODEL.enemyPeriod, 1, event.id, enemy.token);
      } else if (event.type === 2) {
        const ally = allies[event.id];
        if (event.token !== ally.token) continue;
        ally.alive = true;
        ally.hp = ally.max;
        ally.pos = random() * 10;
        ally.target = nearest(enemies, ally.pos);
        add(time + ally.period, 0, event.id, ally.token);
      } else if (event.type === 3) {
        const enemy = enemies[event.id];
        if (event.token !== enemy.token) continue;
        enemy.alive = true;
        enemy.hp = H;
        enemy.jkHitBy.clear();
        enemy.pos = random() * 10;
        enemy.target = nearest(allies, enemy.pos);
        add(time + MODEL.enemyPeriod, 1, event.id, enemy.token);
      } else {
        if (activeHealer()) {
          for (const ally of allies) if (ally.alive) ally.hp = Math.min(ally.max, ally.hp + ally.max * healFraction);
        }
        add(time + heal.interval, 4, 0, 0);
      }
    }
    return {
      killsPerSecond: kills / seconds,
      deathsPerSecond: deaths / seconds,
      jkBoosts,
      kingProcAttempts,
      kingProcSuccesses,
      enemyHitAttempts,
      enemyHits,
    };
  }

  function estimate(stage, party, runs = MODEL.runs, seconds = MODEL.seconds, salt = 0, enemyType = 'normal') {
    let kills = 0, deaths = 0, jkBoosts = 0, kingProcAttempts = 0, kingProcSuccesses = 0, enemyHitAttempts = 0, enemyHits = 0;
    for (let i = 0; i < runs; i++) {
      const seed = (stage * 2654435761 + (i + salt) * 1013904223) >>> 0;
      const result = simulate(stage, party, seed, seconds, enemyType);
      kills += result.killsPerSecond;
      deaths += result.deathsPerSecond;
      jkBoosts += result.jkBoosts;
      kingProcAttempts += result.kingProcAttempts;
      kingProcSuccesses += result.kingProcSuccesses;
      enemyHitAttempts += result.enemyHitAttempts;
      enemyHits += result.enemyHits;
    }
    return {
      kills: kills / runs,
      deaths: deaths / runs,
      jkBoostsPerSecond: jkBoosts / (runs * seconds),
      kingProcRate: kingProcAttempts ? kingProcSuccesses / kingProcAttempts : null,
      enemyHitRate: enemyHitAttempts ? enemyHits / enemyHitAttempts : null,
    };
  }
  const BASE_HOURLY = 3.6 / (6 + 20 / 60);
  const MEASURED_72_HOURLY = 5.5 / (12 - 0.5 / 60);

  let calibration;
  function getCalibration() {
    if (calibration) return calibration;
    const base63 = estimate(63, baseline.chars).kills;
    const base72 = estimate(72, baseline.chars).kills;
    const rawMeasuredRatio = (base72 / base63) * Math.pow(1.3, 9);
    const highStageStepCorrection = Math.pow((MEASURED_72_HOURLY / BASE_HOURLY) / rawMeasuredRatio, 1 / 9);

    function stageRewardFactor(stage) {
      const base = Math.pow(1.3, stage - 1);
      return stage <= 63 ? base : base * Math.pow(highStageStepCorrection, stage - 63);
    }
    const baseScore = base63 * stageRewardFactor(63);
    calibration = { baseScore, stageRewardFactor };
    return calibration;
  }

  function gemMultiplier(party, rebirth, skill) {
    const bonus = partyBonus(party);
    const logFactor = (rebirth - 61) * Math.log(3.5) + Math.log(skill / 4.75) + Math.log((1 + 0.1 * bonus) / 1.1);
    return Math.exp(logFactor);
  }

  function rankStages(simulationRows, factor, rates) {
    const { baseScore, stageRewardFactor } = getCalibration();
    const stageRows = simulationRows.map(result => {
      const stage = result.stage;
      const gemScore = result.kills * stageRewardFactor(stage);
      const hour = BASE_HOURLY * (gemScore / baseScore) * factor;
      const foodEligible = stage >= 46;
      const foodHour = foodEligible ? result.kills * 3600 * rates.dropRate : 0;
      const premiumHour = foodHour * rates.premiumRate;
      const normalHour = foodHour - premiumHour;
      return { ...result, gemScore, hour, foodEligible, foodHour, premiumHour, normalHour };
    });
    const gemRows = [...stageRows].sort((a, b) => b.gemScore - a.gemScore || a.stage - b.stage);
    const feedRows = stageRows.filter(row => row.foodEligible).sort((a, b) => b.foodHour - a.foodHour || a.stage - b.stage);
    const bestGem = gemRows[0], bestFeed = feedRows[0];
    if (!bestGem || bestGem.gemScore <= 0) return { gemRows, feedRows, combinedRows: [] };
    const combinedRows = stageRows.map(row => {
      const gemRelative = row.gemScore / bestGem.gemScore;
      if (!row.foodEligible) return { ...row, gemRelative, foodRelative: null, combined: null };
      const foodRelative = bestFeed.foodHour > 0 ? row.foodHour / bestFeed.foodHour : 0;
      return { ...row, gemRelative, foodRelative, combined: Math.sqrt(gemRelative * foodRelative) };
    }).sort((a, b) => (b.combined ?? -1) - (a.combined ?? -1) || a.stage - b.stage);
    return { gemRows, feedRows, combinedRows };
  }

  return { rankStages, gemMultiplier, stageCount: HP.length, MODEL, BASE_HOURLY, estimate, getCalibration, partyBonus, foodRates, attackPower };
}

if (typeof module === 'object' && module.exports) module.exports = createMoncolleSimulation;
