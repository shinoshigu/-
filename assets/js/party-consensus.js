(() => {
  'use strict';

  const threshold = 0.70;
  const levels = Array.from({length: 150}, (_, i) => i + 1);
  const limits = Array.from({length: 11}, (_, i) => i);
  const reliable = observation => observation && observation.quality >= threshold;

  // The bag truncates at a tenth of the displayed unit, including hidden trailing zeroes.
  function readAttack(text, isolated = false) {
    const value = String(text || '').normalize('NFKC').trim().toUpperCase().replace(/,/g, '.');
    const pattern = isolated ? /^\s*(\d+(?:\.\d)?)\s*([KMBT])\s*$/g
      : /(?<![\d.])([0-9]+(?:\.\d)?)\s*([KMBT])(?![A-Z0-9])/g;
    const matches = [...value.matchAll(pattern)];
    if (matches.length === 1) {
      const [, number, suffix] = matches[0];
      const unit = {K: 1e3, M: 1e6, B: 1e9, T: 1e12}[suffix];
      if (+number > 0 && +number < 1000) return {value: +number * unit, step: unit / 10, label: number + suffix};
    }
    if (isolated && /^\d{1,3}(?:\.\d+)?$/.test(value) && +value > 0) {
      return {value: +value, step: 10 ** -(value.split('.')[1]?.length || 0), label: value};
    }
    return null;
  }

  function attackObservation(strip, card) {
    const a = readAttack(strip, true), b = readAttack(card);
    if (b && a && a.value < 1000) return {...b, quality:0.76};
    if (a && b && (a.value !== b.value || a.step !== b.step)) {
      return {alternatives:[a,b], conflict: '攻撃力の読みが ' + a.label + ' と ' + b.label + ' に分かれました'};
    }
    if (a || b) return {...(a || b), quality: a && b ? 0.98 : a ? (a.value < 1000 ? 0.55 : 0.86) : 0.76};
    return null;
  }

  function fits(value, attack) {
    // Only compensate for floating point round-off at the bucket boundary.
    const adjusted = value + Number.EPSILON * Math.max(value, attack.value) * 4;
    return adjusted >= attack.value && adjusted < attack.value + attack.step;
  }

  const pairIds = ['mikon', 'ponja'];

  function pairStates(roles) {
    const mikons = [], ponjas = [];
    roles.forEach((role, i) => {
      if (role === 'mikon') mikons.push(i);
      if (role === 'ponja') ponjas.push(i);
    });
    const count = Math.min(mikons.length, ponjas.length);
    return new Set([...mikons.slice(0,count), ...ponjas.slice(0,count)]);
  }

  function evaluate(api, row, entry, modes) {
    const name = row.names[entry.id] || 0;
    const mutation = row.mutations[entry.id] || row.mutations[entry.category];
    const hasForm = Boolean(api.mutations[entry.category]?.length);
    const canLimit = entry.category !== 'normal';
    const conflicts = [];
    if (row.identity && row.identity !== entry.id) conflicts.push('名前・キャラ画像と不一致');
    if (!canLimit && reliable(row.limit) && row.limit.value > 0) conflicts.push('通常キャラに凸表示があります');
    const levelValues = reliable(row.level) ? [row.level.value] : levels;
    const limitValues = !canLimit ? [0] : reliable(row.limit) ? [row.limit.value] : limits;
    const formValues = !hasForm ? ['normal'] : reliable(mutation) ? [mutation.value]
      : api.mutations[entry.category].map(option => option.id);
    const fields = [];
    if (name >= threshold) fields.push(['名前', name]);
    if (reliable(row.level)) fields.push(['Lv', row.level.quality]);
    if (canLimit && reliable(row.limit)) fields.push(['凸', row.limit.quality]);
    if (hasForm && reliable(mutation)) fields.push(['変異', mutation.quality]);
    const choices = {level: new Set(), limit: new Set(), mutation: new Set()};
    let exact = false;
    let attack = row.attack;
    let resolvedAttack = '';
    if (attack?.alternatives && name >= threshold && fields.length >= 3 &&
        levelValues.length === 1 && formValues.length === 1 && modes.length === 1) {
      const supported = attack.alternatives.filter(read => limitValues.some(limit =>
        fits(api.attackAtLevel(entry, formValues[0], levelValues[0], limit, modes[0]), read)));
      if (supported.length === 1) {
        attack = {...supported[0], quality:0.75};
        resolvedAttack = attack.label;
      }
    }
    if (reliable(attack)) {
      for (const paired of modes) for (const form of formValues) for (const limit of limitValues) {
        for (const level of levelValues) {
          if (!fits(api.attackAtLevel(entry, form, level, limit, paired), attack)) continue;
          exact = true;
          choices.level.add(level);
          choices.limit.add(limit);
          choices.mutation.add(form);
        }
      }
      if (exact) {
        if (!resolvedAttack) fields.push(['攻撃力', attack.quality]);
      } else conflicts.push('表示攻撃力 ' + attack.label + ' と計算値が不一致');
    }
    if (attack?.conflict) conflicts.push(attack.conflict);
    if (row.levelConflict && !(exact && name >= threshold && (reliable(mutation) || !hasForm))) {
      conflicts.push(row.levelConflict);
    }
    fields.sort((a, b) => b[1] - a[1]);
    return {entry, fields, name, choices, exact, conflicts, mutation, modes, resolvedAttack};
  }

  function alternatives(api, row, candidate) {
    if (!reliable(row.attack) || !reliable(row.level) || candidate.exact) return '';
    const {entry, mutation, modes} = candidate;
    const forms = api.mutations[entry.category] || [{id:'normal', label:'—'}];
    if (forms.length > 1 && !reliable(mutation)) return '';
    const form = forms.length > 1 ? mutation.value : 'normal';
    const limit = entry.category === 'normal' ? 0 : row.limit?.value;
    if (limit == null) return '';
    const matches = (m, l, c) => modes.some(p => fits(api.attackAtLevel(entry, m, l, c, p), row.attack));
    const fixes = [];
    for (const l of levels) if (matches(form, l, limit)) fixes.push('Lv' + l);
    if (entry.category !== 'normal') for (const c of limits) if (matches(form, row.level.value, c)) fixes.push(c + '凸');
    for (const m of forms) if (matches(m.id, row.level.value, limit)) fixes.push(m.label);
    return fixes.length ? '他を固定すると ' + fixes.slice(0, 4).join('／') + ' で攻撃力が一致' : '';
  }

  function decide(api, row, candidates) {
    const compatible = candidates.filter(c => c.exact && !c.conflicts.length);
    for (const c of candidates) {
      // Common values (Lv1, shared base stats) cannot identify a character on their own.
      const top = c.fields.slice(0, 3).reduce((sum, field) => sum + field[1], 0);
      const powerWeight = c.exact ? 0.45 / Math.max(1, compatible.length) : 0;
      c.score = top + c.name + powerWeight - c.conflicts.length * 0.55;
    }
    candidates.sort((a,b) => b.score - a.score);
    const pool = candidates.filter(c => !c.conflicts.length && c.fields.length >= 3 && (c.name >= threshold || c.exact));
    const best = pool[0];
    const anchor = row.identity && candidates.find(c => c.entry.id === row.identity);
    const lead = best && pool[1] ? best.score - pool[1].score : Infinity;
    const tiedPower = best && best.name < threshold && compatible.length > 1;
    const accepted = best && !tiedPower && lead >= 0.16 &&
      (best.name >= threshold || (best.exact && reliable(row.level) && best.modes.length === 1));
    const selected = accepted ? best : anchor || best || candidates[0];
    const reason = accepted ? '' : selected?.conflicts.length ? selected.conflicts.join('、')
      : tiedPower || lead < 0.16 ? '同じ条件に合う候補が複数あります'
      : 'キャラを絞れる手掛かりが不足しています';
    const values = {};
    const inferred = [];
    if (selected) {
      const fields = [
        ['level', 'Lv', row.level],
        ['limit', '凸', selected.entry.category === 'normal' ? {value:0, quality:1} : row.limit],
        ['mutation', '変異', !api.mutations[selected.entry.category] ? {value:'normal', quality:1} : selected.mutation],
      ];
      for (const [key, label, obs] of fields) {
        if (reliable(obs)) values[key] = obs.value;
        else if (accepted && selected.choices[key].size === 1) {
          values[key] = [...selected.choices[key]][0];
          inferred.push(label);
        }
      }
    }
    const suggested = (tiedPower ? compatible : candidates).filter(c => c.name >= 0.4 || c.exact || c === anchor);
    const shortlist = [...new Set([...(selected && (selected.name >= 0.4 || selected.exact) ? [selected] : []), ...suggested])];
    return {id: accepted ? best.entry.id : '', values, inferred, reason,
      evidence: selected?.fields.slice(0,3).map(f => f[0]) || [],
      candidates: shortlist.slice(0, 4).map(c => c.entry),
      detail: accepted && selected.resolvedAttack ? '攻撃力の読取候補のうち ' + selected.resolvedAttack + ' が他の項目と一致'
        : !accepted && anchor ? alternatives(api, row, anchor) : ''};
  }

  // Enumerate only three roles per slot; the other 93 characters share the same
  // pairing behavior. Attack calculations are cached outside the 3^7 search.
  function resolveParty(api, rows) {
    const prepared = rows.map(row => {
      const others = [], pairs = {};
      for (const entry of api.catalog) {
        const solo = evaluate(api, row, entry, [false]);
        if (pairIds.includes(entry.id)) pairs[entry.id] = [solo, evaluate(api, row, entry, [true])];
        else others.push(solo);
      }
      const strongOther = row.identity && !pairIds.includes(row.identity);
      const preference = row.manualId || row.identity;
      const otherName = Math.max(0, ...others.map(c => c.name));
      const pairName = Math.max(...pairIds.map(id => row.names[id] || 0));
      const hasStats = reliable(row.level) && reliable(row.attack);
      const otherFits = others.some(c => (!hasStats || c.exact) && !c.conflicts.length);
      const pairFits = pairIds.some(id => pairs[id].some(c => c.exact));
      const roles = [];
      if (!pairIds.includes(preference) && (strongOther || row.manualId || otherFits || !pairFits)) roles.push('other');
      if (!strongOther || pairIds.includes(row.manualId)) {
        for (const id of pairIds) if (!row.manualId || row.manualId === id) roles.push(id);
      }
      if (!roles.length) roles.push('other');
      function roleScore(role, paired) {
        if (row.manualId) {
          if (role !== (pairIds.includes(row.manualId) ? row.manualId : 'other')) return -Infinity;
        }
        if (role === 'other') return otherName >= 0.45 ? otherName : 0;
        const c = pairs[role][Number(paired)];
        if (hasStats && !c.exact) return -Infinity;
        // Ambiguous text may support membership of the pair without telling its two members apart.
        return Math.max(c.name >= 0.45 ? c.name : 0, pairName >= 0.65 ? pairName - 0.42 : 0);
      }
      return {others, pairs, roles, roleScore};
    });
    const layouts = [];
    const pattern = [];
    function visit(i) {
      if (i < rows.length) {
        for (const role of prepared[i].roles) { pattern[i] = role; visit(i + 1); }
        return;
      }
      const paired = pairStates(pattern);
      let score = 0;
      for (let j = 0; j < pattern.length; j++) {
        score += prepared[j].roleScore(pattern[j], paired.has(j));
        if (!Number.isFinite(score)) return;
      }
      layouts.push({roles:pattern.slice(), paired, score});
    }
    visit(0);
    const best = layouts.reduce((n, layout) => Math.max(n, layout.score), -Infinity);
    const plausible = layouts.filter(layout => layout.score >= best - 0.18);
    const options = prepared.map((_, i) => new Set(plausible.map(layout => layout.roles[i])));
    const mixed = options.map((roles,i) => roles.size === 2 && !roles.has('other') ? i : -1).filter(i => i >= 0);
    let groupNote = '';
    if (mixed.length > 1) {
      const counts = new Set(plausible.map(layout => mixed.filter(i => layout.roles[i] === 'mikon').length));
      const count = [...counts][0];
      if (counts.size === 1 && count > 0 && count < mixed.length) {
        groupNote = mixed.map(i => i+1).join('・') + '枠でミコン' + count + '体＋ポンジャ' + (mixed.length-count) + '体。位置を確認してください';
      }
    }
    return prepared.map(({others, pairs}, i) => {
      const row = rows[i], roles = options[i];
      const candidates = !plausible.length || roles.has('other') ? others.slice() : [];
      for (const id of pairIds) {
        if (plausible.length && !roles.has(id)) continue;
        const arrangements = plausible.filter(layout => layout.roles[i] === id);
        const modes = plausible.length ? [...new Set(arrangements.map(layout => layout.paired.has(i)))] : [false,true];
        let candidate = modes.length === 1 ? pairs[id][Number(modes[0])] : evaluate(api,row,pairs[id][0].entry,modes);
        if (roles.size === 1 && !row.manualId && pairIds.includes(row.identity) && row.identity !== id && candidate.exact) {
          // The roster may settle an M/P name disagreement. Only the other
          // observations may vote for the forced partner in this case.
          candidate = evaluate(api, {...row, identity:'', names:{}}, candidate.entry, modes);
        }
        candidates.push(candidate);
      }
      const verdict = decide(api, row, candidates);
      if (mixed.includes(i)) {
        verdict.id = '';
        verdict.candidates = pairIds.map(id => pairs[id][0].entry);
        verdict.reason = groupNote || 'ミコンとポンジャの位置を絞り切れません';
        verdict.inferred = [];
      } else if (!plausible.length && (pairIds.includes(verdict.id) || pairIds.includes(row.identity))) {
        verdict.id = '';
        verdict.reason = 'ミコン・ポンジャの編成人数と表示攻撃力が一致しません';
      } else if (pairIds.includes(verdict.id) && pairIds.includes(row.identity) && verdict.id !== row.identity) {
        verdict.detail = '名前の読みが食い違ったため、他の枠の相方と表示攻撃力で判定';
      }
      return verdict;
    });
  }

  const consensus = {resolveParty, attackObservation};
  if (typeof module !== 'undefined' && module.exports) module.exports = consensus;
  else window.moncolleConsensus = consensus;
})();
