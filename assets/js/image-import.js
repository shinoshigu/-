(() => {
  'use strict';

  const api = window.moncolleCalculator;
  const byId = id => document.getElementById(id);
  const fileInput = byId('partyImageFile');
  const modeInput = byId('partyImageMode');
  const analyzeButton = byId('partyImageAnalyze');
  const workspace = byId('partyImageWorkspace');
  const preview = byId('partyImagePreview');
  const status = byId('partyImageStatus');
  const resultsBox = byId('partyImageResults');
  const resultRows = byId('partyImageResultRows');
  const applyButton = byId('partyImageApply');
  const cropInputs = {
    x: byId('partyCropX'),
    y: byId('partyCropY'),
    width: byId('partyCropW'),
    height: byId('partyCropH'),
  };

  if (!api || !fileInput || !modeInput || !analyzeButton || !preview) return;

  const CATEGORY_LABELS = { normal: '通常', legend: '伝説', illusion: '幻' };
  let sourceImage = null;
  let ocrWorker = null;
  let recognized = [];

  function setStatus(message) {
    status.textContent = message;
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('画像を開けませんでした'));
      };
      image.src = url;
    });
  }

  function effectiveMode() {
    if (modeInput.value !== 'auto') return modeInput.value;
    if (!sourceImage) return 'full';
    return sourceImage.naturalWidth / sourceImage.naturalHeight >= 2.7 ? 'party' : 'full';
  }

  function setCropValues(values) {
    cropInputs.x.value = String(values.x);
    cropInputs.y.value = String(values.y);
    cropInputs.width.value = String(values.width);
    cropInputs.height.value = String(values.height);
  }

  function resetCrop() {
    setCropValues(effectiveMode() === 'party'
      ? { x: 0, y: 0, width: 100, height: 100 }
      : { x: 26, y: 18, width: 54, height: 27 });
    drawPreview();
  }

  function cropRect() {
    if (!sourceImage) return null;
    const xPercent = Math.min(90, Math.max(0, Number(cropInputs.x.value) || 0));
    const yPercent = Math.min(90, Math.max(0, Number(cropInputs.y.value) || 0));
    const widthPercent = Math.min(100 - xPercent, Math.max(10, Number(cropInputs.width.value) || 10));
    const heightPercent = Math.min(100 - yPercent, Math.max(10, Number(cropInputs.height.value) || 10));
    return {
      x: sourceImage.naturalWidth * xPercent / 100,
      y: sourceImage.naturalHeight * yPercent / 100,
      width: sourceImage.naturalWidth * widthPercent / 100,
      height: sourceImage.naturalHeight * heightPercent / 100,
    };
  }

  function drawPreview() {
    const rect = cropRect();
    if (!rect) return;
    const targetWidth = Math.min(1600, Math.max(1000, Math.round(rect.width)));
    const scale = targetWidth / rect.width;
    preview.width = targetWidth;
    preview.height = Math.max(1, Math.round(rect.height * scale));
    const context = preview.getContext('2d', { alpha: false });
    context.fillStyle = '#111722';
    context.fillRect(0, 0, preview.width, preview.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(sourceImage, rect.x, rect.y, rect.width, rect.height, 0, 0, preview.width, preview.height);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (window.Tesseract) resolve();
        else existing.addEventListener('load', resolve, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('OCRライブラリを読み込めませんでした'));
      document.head.append(script);
    });
  }

  async function getOcrWorker() {
    if (ocrWorker) return ocrWorker;
    setStatus('初回用のOCRデータを読み込んでいます…');
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
    ocrWorker = await window.Tesseract.createWorker(['jpn', 'eng'], 1, {
      logger(message) {
        if (!message.progress) return;
        setStatus(`OCR準備中… ${Math.round(message.progress * 100)}%`);
      },
    });
    await ocrWorker.setParameters({
      tessedit_pageseg_mode: '6',
      preserve_interword_spaces: '1',
    });
    return ocrWorker;
  }

  async function recognizeText(worker, canvas, options = {}) {
    await worker.setParameters({
      tessedit_pageseg_mode: options.pageMode || '6',
      tessedit_char_whitelist: options.whitelist || '',
      preserve_interword_spaces: '1',
    });
    const result = await worker.recognize(canvas);
    return result.data.text || '';
  }

  function makeTextCanvas(rowCanvas, index, options = {}) {
    const {
      top = 0,
      bottom = 1,
      left = 0,
      right = 1,
      variant = 'strict',
    } = options;
    const slotWidth = rowCanvas.width / 7;
    const sourceX = Math.round(slotWidth * (index + left));
    const sourceWidth = Math.max(1, Math.round(slotWidth * (right - left)));
    const sourceY = Math.max(0, Math.round(rowCanvas.height * top));
    const sourceHeight = Math.max(1, Math.round(rowCanvas.height * (bottom - top)));
    const scale = Math.min(4, Math.max(2, 360 / sourceWidth));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(rowCanvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let offset = 0; offset < image.data.length; offset += 4) {
      const red = image.data[offset];
      const green = image.data[offset + 1];
      const blue = image.data[offset + 2];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const saturation = maximum ? (maximum - minimum) / maximum : 0;
      const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
      const isWhiteText = variant === 'loose'
        ? luminance >= 112 && saturation <= 0.58
        : variant === 'bright'
          ? luminance >= 128
          : luminance >= 145 && saturation <= 0.4;
      const value = isWhiteText ? 0 : 255;
      image.data[offset] = value;
      image.data[offset + 1] = value;
      image.data[offset + 2] = value;
      image.data[offset + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    return canvas;
  }

  function makeOcrCanvas(rowCanvas, index) {
    return makeTextCanvas(rowCanvas, index);
  }

  function makeNameCanvas(rowCanvas, index) {
    const wideCrop = rowCanvas.width / rowCanvas.height >= 5.5;
    return makeTextCanvas(rowCanvas, index, {
      top: 0,
      bottom: wideCrop ? 0.43 : 0.35,
      variant: 'loose',
    });
  }

  function makeLevelCanvas(rowCanvas, index) {
    return makeTextCanvas(rowCanvas, index, {
      top: 0.34,
      bottom: 0.92,
      left: 0.2,
      right: 1,
      variant: 'loose',
    });
  }

  function makeLimitCanvas(rowCanvas, index) {
    return makeTextCanvas(rowCanvas, index, {
      top: 0,
      bottom: 0.34,
      variant: 'loose',
    });
  }

  function makeAttackCanvas(rowCanvas, index) {
    return makeTextCanvas(rowCanvas, index, {
      top: 0.68,
      bottom: 1,
      variant: 'bright',
    });
  }

  function normalizeText(value) {
    return String(value || '')
      .toUpperCase()
      .replace(/[０-９]/g, character => String.fromCharCode(character.charCodeAt(0) - 0xFEE0))
      .replace(/[―‐−]/g, 'ー')
      .replace(/[^A-Z0-9ァ-ヶー一-龠々]/g, '');
  }

  function levenshtein(left, right) {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i += 1) {
      let diagonal = previous[0];
      previous[0] = i;
      for (let j = 1; j <= right.length; j += 1) {
        const above = previous[j];
        previous[j] = Math.min(
          previous[j] + 1,
          previous[j - 1] + 1,
          diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
        );
        diagonal = above;
      }
    }
    return previous[right.length];
  }

  function similarityWithin(haystack, needle) {
    if (!haystack || !needle) return 0;
    if (haystack.includes(needle)) return 1;
    let best = 0;
    const shortest = Math.max(1, needle.length - 2);
    const longest = Math.min(haystack.length, needle.length + 2);
    for (let length = shortest; length <= longest; length += 1) {
      for (let start = 0; start + length <= haystack.length; start += 1) {
        const part = haystack.slice(start, start + length);
        const score = 1 - levenshtein(part, needle) / Math.max(part.length, needle.length);
        if (score > best) best = score;
      }
    }
    return best;
  }

  function catalogAliases(entry) {
    const aliases = [{ text: entry.name, mutation: 'normal' }];
    if (entry.category === 'illusion') {
      aliases.push(
        { text: `闇${entry.name}`, mutation: 'dark' },
        { text: `漆黒${entry.name}`, mutation: 'dark' },
        { text: `覚醒${entry.name}`, mutation: 'awakened' },
      );
    }
    return aliases;
  }

  function rankCatalog(text) {
    const sources = String(text || '')
      .split(/[\r\n|]+/)
      .map(line => normalizeText(line)
        .replace(/[LI1][VY][0-9]{1,3}/g, '')
        .replace(/[0-9]{1,3}凸/g, '')
        .replace(/[0-9]+/g, ''))
      .filter(Boolean);
    if (!sources.length) sources.push(normalizeText(text).replace(/[0-9]+/g, ''));
    const matches = [];
    for (const entry of api.catalog) {
      let best = { entry, mutation: 'normal', score: 0 };
      for (const alias of catalogAliases(entry)) {
        const needle = normalizeText(alias.text);
        for (const source of sources) {
          const fullScore = 1 - levenshtein(source, needle) / Math.max(source.length, needle.length);
          const partialCap = needle.length <= 3 ? 0.55 : needle.length <= 4 ? 0.68 : 0.84;
          const partialScore = similarityWithin(source, needle) * partialCap;
          const exactScore = source === needle ? 1 : source.includes(needle) ? (needle.length <= 3 ? 0.7 : 0.96) : 0;
          const score = Math.max(fullScore, partialScore, exactScore);
          if (score > best.score) best = { entry, mutation: alias.mutation, score };
        }
      }
      matches.push(best);
    }
    return matches.sort((left, right) => right.score - left.score);
  }

  function mergeCatalogMatches(texts) {
    const byEntry = new Map();
    for (const text of texts.filter(Boolean)) {
      for (const match of rankCatalog(text)) {
        const previous = byEntry.get(match.entry.id);
        if (!previous || match.score > previous.score) byEntry.set(match.entry.id, match);
      }
    }
    return [...byEntry.values()].sort((left, right) => right.score - left.score);
  }

  function findBestCatalog(texts) {
    const matches = mergeCatalogMatches(Array.isArray(texts) ? texts : [texts]);
    const best = matches[0] || { entry: null, mutation: 'normal', score: 0 };
    return best.score >= 0.38 ? best : { entry: null, mutation: 'normal', score: best.score };
  }

  function rgbToHsv(red, green, blue) {
    const r = red / 255;
    const g = green / 255;
    const b = blue / 255;
    const maximum = Math.max(r, g, b);
    const minimum = Math.min(r, g, b);
    const difference = maximum - minimum;
    let hue = 0;
    if (difference) {
      if (maximum === r) hue = ((g - b) / difference) % 6;
      else if (maximum === g) hue = (b - r) / difference + 2;
      else hue = (r - g) / difference + 4;
      hue = ((hue * 60) + 360) % 360;
    }
    return { hue, saturation: maximum ? difference / maximum : 0, value: maximum };
  }

  function classifyNormalMutation(rowCanvas, index) {
    const slotWidth = rowCanvas.width / 7;
    const startX = Math.round(slotWidth * index);
    const width = Math.max(1, Math.round(slotWidth));
    const context = rowCanvas.getContext('2d');
    const cropBottom = rowCanvas.width / rowCanvas.height >= 5.5 ? 1 : 0.76;
    const cropHeight = Math.max(1, Math.round(rowCanvas.height * cropBottom));
    const image = context.getImageData(startX, 0, Math.min(width, rowCanvas.width - startX), cropHeight);
    const hueBins = new Set();
    let samples = 0;
    let saturated = 0;
    let yellow = 0;
    let purple = 0;
    let bright = 0;
    let valueTotal = 0;
    const sampleWidth = image.width;
    const sampleHeight = image.height;
    for (let y = 0; y < sampleHeight; y += 4) {
      for (let x = 0; x < sampleWidth; x += 4) {
        const border = x < sampleWidth * 0.2 || x > sampleWidth * 0.8 || y < sampleHeight * 0.16;
        if (!border) continue;
        const offset = (y * sampleWidth + x) * 4;
        const hsv = rgbToHsv(image.data[offset], image.data[offset + 1], image.data[offset + 2]);
        samples += 1;
        valueTotal += hsv.value;
        if (hsv.value > 0.72) bright += 1;
        if (hsv.saturation > 0.42 && hsv.value > 0.28) {
          saturated += 1;
          hueBins.add(Math.floor(hsv.hue / 30));
          if (hsv.hue >= 42 && hsv.hue <= 78) yellow += 1;
          if (hsv.hue >= 255 && hsv.hue <= 330) purple += 1;
        }
      }
    }
    if (!samples) return 'normal';
    const saturatedRatio = saturated / samples;
    const brightRatio = bright / samples;
    const averageValue = valueTotal / samples;
    if (hueBins.size >= 6 && saturatedRatio >= 0.18) return 'rainbow';
    if (yellow / samples >= 0.16 && brightRatio >= 0.34) return 'shiny';
    if (averageValue <= 0.34 || (purple / samples >= 0.17 && brightRatio < 0.3)) return 'dark';
    return 'normal';
  }

  function parseLevelDirect(text) {
    const cleaned = String(text || '')
      .toUpperCase()
      .replace(/[０-９]/g, character => String.fromCharCode(character.charCodeAt(0) - 0xFEE0))
      .replace(/[Ｌ]/g, 'L')
      .replace(/[Ｖ]/g, 'V')
      .replace(/[|!ＩⅠI]/g, '1')
      .replace(/[OＯ]/g, '0');
    const direct = cleaned.match(/(?:L|1|I)?\s*[VY]\s*[^0-9]{0,3}([0-9]{1,3})/);
    return direct ? Math.min(150, Math.max(1, Number(direct[1]))) : null;
  }

  function parseLevel(text, levelText = '') {
    const direct = parseLevelDirect(levelText) || parseLevelDirect(text);
    if (direct) return direct;
    const cleaned = normalizeText(levelText || text).replace(/[OＯ]/g, '0').replace(/[IＩ]/g, '1');
    const candidates = [...cleaned.matchAll(/[0-9]{1,3}/g)]
      .map(match => Number(match[0]))
      .filter(value => value >= 1 && value <= 150);
    return candidates.at(-1) || 1;
  }

  function parseLimitBreak(...texts) {
    const cleaned = normalizeText(texts.filter(Boolean).join(' ')).replace(/[OＯ]/g, '0');
    const match = cleaned.match(/([0-9]{1,2})凸/);
    return match ? Math.min(10, Math.max(0, Number(match[1]))) : 0;
  }

  function parseAttack(...texts) {
    const source = texts.filter(Boolean).join(' ').toUpperCase().replace(/,/g, '.');
    const matches = [...source.matchAll(/([0-9]{1,4}(?:\.[0-9]+)?)\s*([KMBT])/g)];
    const match = matches.at(-1);
    if (!match) return null;
    const units = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
    return Number(match[1]) * units[match[2]];
  }

  function inferResult(nameTexts, levelText, limitText, attackText, rowCanvas, index) {
    const matches = mergeCatalogMatches(nameTexts);
    const best = matches[0] || { entry: null, mutation: 'normal', score: 0 };
    const match = best.score >= 0.38 ? best : { entry: null, mutation: 'normal', score: best.score };
    let mutation = match.mutation;
    if (match.entry?.category === 'normal') mutation = classifyNormalMutation(rowCanvas, index);
    const allNameText = nameTexts.filter(Boolean).join(' / ');
    const limitBreak = match.entry?.category === 'normal'
      ? 0
      : parseLimitBreak(allNameText, limitText);
    return {
      catalogId: match.entry?.id || '',
      mutation,
      level: parseLevel(allNameText, levelText),
      limitBreak,
      confidence: match.score,
      rawText: [allNameText, levelText, limitText, attackText].filter(Boolean).join(' / ').replace(/\s+/g, ' ').trim(),
      observedAttack: parseAttack(allNameText, attackText),
      candidateMatches: matches.slice(0, 10),
      attackVerified: false,
    };
  }

  function mutationOptions(entry) {
    return api.mutations[entry.category] || [{ id: 'normal', label: '—', multiplier: 1 }];
  }

  function expectedAttack(entry, mutation, level, limitBreak, paired) {
    const pairBase = paired && (entry.id === 'mikon' || entry.id === 'ponja') ? 10e6 : entry.attack;
    const mutationMultiplier = mutationOptions(entry).find(option => option.id === mutation)?.multiplier || 1;
    const levelMultiplier = 1 + 0.05 * (level - 1);
    const limitMultiplier = entry.category === 'legend' || entry.category === 'illusion'
      ? 1 + 0.05 * limitBreak
      : 1;
    return pairBase * mutationMultiplier * levelMultiplier * limitMultiplier;
  }

  function bestAttackFit(entry, item, observedAttack, paired) {
    let best = null;
    const limits = entry.category === 'legend' || entry.category === 'illusion'
      ? Array.from({ length: 11 }, (_, index) => index)
      : [0];
    for (const mutation of mutationOptions(entry)) {
      for (let level = 1; level <= 150; level += 1) {
        for (const limitBreak of limits) {
          const expected = expectedAttack(entry, mutation.id, level, limitBreak, paired);
          const relativeError = Math.abs(expected - observedAttack) / observedAttack;
          const preferencePenalty = Math.abs(level - item.level) * 0.00015
            + (mutation.id === item.mutation ? 0 : 0.012)
            + Math.abs(limitBreak - item.limitBreak) * 0.0015;
          const score = relativeError + preferencePenalty;
          if (!best || score < best.score) {
            best = { mutation: mutation.id, level, limitBreak, relativeError, score };
          }
        }
      }
    }
    return best;
  }

  function reconcileWithAttack(items) {
    const possibleIds = new Set();
    items.forEach(item => {
      if (item.catalogId) possibleIds.add(item.catalogId);
      item.candidateMatches
        .filter(candidate => candidate.score >= 0.32)
        .forEach(candidate => possibleIds.add(candidate.entry.id));
    });
    const pairAvailable = possibleIds.has('mikon') && possibleIds.has('ponja');

    items.forEach(item => {
      if (!item.observedAttack) return;
      const candidates = item.candidateMatches.filter(candidate => candidate.score >= 0.26).slice(0, 10);
      let best = null;
      for (const candidate of candidates) {
        const paired = pairAvailable && (candidate.entry.id === 'mikon' || candidate.entry.id === 'ponja');
        const fit = bestAttackFit(candidate.entry, item, item.observedAttack, paired);
        const attackScore = Math.max(0, 1 - fit.relativeError / 0.12);
        const combinedScore = candidate.score * 0.55 + attackScore * 0.45;
        if (!best || combinedScore > best.combinedScore) best = { candidate, fit, combinedScore };
      }
      if (!best || best.fit.relativeError > 0.08) return;
      if (!item.catalogId && (best.candidate.score < 0.28 || best.fit.relativeError > 0.02)) return;
      item.catalogId = best.candidate.entry.id;
      item.mutation = best.fit.mutation;
      item.level = best.fit.level;
      item.limitBreak = best.fit.limitBreak;
      item.confidence = Math.max(item.confidence, best.candidate.score);
      item.attackVerified = true;
    });
  }

  function addCatalogOptions(select) {
    select.add(new Option('候補なし・手動で選択', ''));
    for (const category of ['normal', 'legend', 'illusion']) {
      const group = document.createElement('optgroup');
      group.label = CATEGORY_LABELS[category];
      for (const entry of api.catalog.filter(item => item.category === category)) {
        group.append(new Option(entry.label, entry.id));
      }
      select.append(group);
    }
  }

  function setMutationOptions(select, item) {
    const entry = api.catalog.find(candidate => candidate.id === item.catalogId);
    const options = api.mutations[entry?.category] || [{ id: 'normal', label: '—' }];
    select.replaceChildren();
    for (const option of options) select.add(new Option(option.label, option.id));
    select.value = options.some(option => option.id === item.mutation) ? item.mutation : options[0].id;
    item.mutation = select.value;
    select.disabled = options.length === 1;
  }

  function renderResults() {
    resultRows.replaceChildren();
    recognized.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'image-result-row';
      row.dataset.index = String(index);

      const number = document.createElement('span');
      number.className = 'slot-no';
      number.textContent = String(index + 1);

      const catalog = document.createElement('select');
      catalog.className = 'import-catalog';
      catalog.setAttribute('aria-label', `画像のキャラ${index + 1}`);
      addCatalogOptions(catalog);
      catalog.value = item.catalogId;

      const mutation = document.createElement('select');
      mutation.className = 'import-mutation';
      mutation.setAttribute('aria-label', `画像のキャラ${index + 1}の変異`);
      setMutationOptions(mutation, item);

      const level = document.createElement('input');
      level.className = 'import-level';
      level.type = 'number';
      level.min = '1';
      level.max = '150';
      level.value = String(item.level);
      level.setAttribute('aria-label', `画像のキャラ${index + 1}のレベル`);

      const limit = document.createElement('input');
      limit.className = 'import-limit';
      limit.type = 'number';
      limit.min = '0';
      limit.max = '10';
      limit.value = String(item.limitBreak);
      limit.setAttribute('aria-label', `画像のキャラ${index + 1}の凸数`);

      const raw = document.createElement('div');
      raw.className = 'raw';
      raw.textContent = `名前一致度 ${Math.round(item.confidence * 100)}%${item.attackVerified ? '｜表示攻撃力と照合済み' : ''}｜読取：${item.rawText || '文字を読み取れませんでした'}`;

      catalog.addEventListener('change', () => {
        item.catalogId = catalog.value;
        setMutationOptions(mutation, item);
        const entry = api.catalog.find(candidate => candidate.id === item.catalogId);
        limit.disabled = entry?.category === 'normal' || !entry;
        if (limit.disabled) limit.value = '0';
      });
      mutation.addEventListener('change', () => { item.mutation = mutation.value; });
      level.addEventListener('input', () => { item.level = level.value; });
      limit.addEventListener('input', () => { item.limitBreak = limit.value; });

      const initialEntry = api.catalog.find(candidate => candidate.id === item.catalogId);
      limit.disabled = initialEntry?.category === 'normal' || !initialEntry;
      row.append(number, catalog, mutation, level, limit, raw);
      resultRows.append(row);
    });
    resultsBox.hidden = false;
  }

  async function analyzeImage() {
    if (!sourceImage) return;
    analyzeButton.disabled = true;
    resultsBox.hidden = true;
    try {
      const worker = await getOcrWorker();
      recognized = [];
      for (let index = 0; index < 7; index += 1) {
        setStatus(`キャラ${index + 1}/7を読み取っています…`);
        const primaryText = await recognizeText(worker, makeOcrCanvas(preview, index));
        const nameTexts = [primaryText];
        let nameMatch = findBestCatalog(nameTexts);
        if (!nameMatch.entry || nameMatch.score < 0.78) {
          const retryText = await recognizeText(worker, makeNameCanvas(preview, index), { pageMode: '7' });
          nameTexts.push(retryText);
          nameMatch = findBestCatalog(nameTexts);
        }

        const levelText = await recognizeText(worker, makeLevelCanvas(preview, index), {
          pageMode: '7',
          whitelist: '0123456789LlVvIiOoYy',
        });

        let limitText = '';
        const needsLimitRead = nameMatch.entry
          && nameMatch.entry.category !== 'normal'
          && parseLimitBreak(primaryText) === 0;
        if (needsLimitRead) {
          limitText = await recognizeText(worker, makeLimitCanvas(preview, index), { pageMode: '7' });
        }

        let attackText = '';
        const attackFromPrimary = parseAttack(primaryText);
        const cropRatio = preview.width / preview.height;
        if (!attackFromPrimary && (cropRatio < 5.5 || !nameMatch.entry || nameMatch.score < 0.72)) {
          attackText = await recognizeText(worker, makeAttackCanvas(preview, index), {
            pageMode: '7',
            whitelist: '0123456789.,KMBTkmbt',
          });
        }
        recognized.push(inferResult(nameTexts, levelText, limitText, attackText, preview, index));
      }
      reconcileWithAttack(recognized);
      renderResults();
      setStatus('解析しました。名前・Lv・凸・変異を確認してから反映してください。切り取り画像ほど高精度になります。');
    } catch (error) {
      console.error(error);
      setStatus(`解析に失敗しました：${error.message}`);
    } finally {
      analyzeButton.disabled = false;
    }
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      sourceImage = await loadImage(file);
      workspace.hidden = false;
      resultsBox.hidden = true;
      analyzeButton.disabled = false;
      resetCrop();
      setStatus(`${effectiveMode() === 'party' ? '編成部分' : 'バッグ全体'}として判定しました。プレビューに7体が入っているか確認してください。`);
    } catch (error) {
      sourceImage = null;
      analyzeButton.disabled = true;
      setStatus(error.message);
    }
  });

  modeInput.addEventListener('change', () => {
    if (!sourceImage) return;
    resultsBox.hidden = true;
    resetCrop();
    setStatus('画像の種類を変更しました。プレビューを確認してください。');
  });

  Object.values(cropInputs).forEach(input => {
    input.addEventListener('input', () => {
      if (!sourceImage) return;
      resultsBox.hidden = true;
      drawPreview();
    });
  });

  analyzeButton.addEventListener('click', analyzeImage);
  applyButton.addEventListener('click', () => {
    const items = [...resultRows.querySelectorAll('.image-result-row')].map(row => ({
      catalogId: row.querySelector('.import-catalog').value,
      mutation: row.querySelector('.import-mutation').value,
      level: row.querySelector('.import-level').value,
      limitBreak: row.querySelector('.import-limit').value,
    }));
    api.applyImportedParty(items);
    setStatus('確認した7体を計算機へ反映しました。');
  });

  window.addEventListener('pagehide', () => {
    if (ocrWorker) ocrWorker.terminate();
  }, { once: true });
})();
