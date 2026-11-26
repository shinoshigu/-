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

  function makeTextCanvas(rowCanvas, index, topRatio = 0, bottomRatio = 1) {
    const slotWidth = rowCanvas.width / 7;
    const sourceX = Math.round(slotWidth * index);
    const sourceWidth = Math.max(1, Math.round(slotWidth));
    const sourceY = Math.max(0, Math.round(rowCanvas.height * topRatio));
    const sourceHeight = Math.max(1, Math.round(rowCanvas.height * (bottomRatio - topRatio)));
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
      const isWhiteText = luminance >= 150 && saturation <= 0.34;
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
    return makeTextCanvas(rowCanvas, index, 0, 1);
  }

  function makeLevelCanvas(rowCanvas, index) {
    return makeTextCanvas(rowCanvas, index, 0.38, 0.88);
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

  function findBestCatalog(text) {
    const sources = String(text || '')
      .split(/[\r\n|]+/)
      .map(line => normalizeText(line)
        .replace(/[LI1][VY][0-9]{1,3}/g, '')
        .replace(/[0-9]{1,3}凸/g, '')
        .replace(/[0-9]+/g, ''))
      .filter(Boolean);
    if (!sources.length) sources.push(normalizeText(text).replace(/[0-9]+/g, ''));
    let best = { entry: null, mutation: 'normal', score: 0 };
    for (const entry of api.catalog) {
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
    }
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
    const image = context.getImageData(startX, 0, Math.min(width, rowCanvas.width - startX), rowCanvas.height);
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
        const border = x < sampleWidth * 0.18 || x > sampleWidth * 0.82 || y < sampleHeight * 0.15 || y > sampleHeight * 0.85;
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
    if (hueBins.size >= 7 && saturatedRatio >= 0.23) return 'rainbow';
    if (yellow / samples >= 0.16 && brightRatio >= 0.34) return 'shiny';
    if (averageValue <= 0.34 || (purple / samples >= 0.17 && brightRatio < 0.3)) return 'dark';
    return 'normal';
  }

  function parseLevelDirect(text) {
    const cleaned = normalizeText(text).replace(/[OＯ]/g, '0');
    const direct = cleaned.match(/[LI1][VY][^0-9]{0,3}([0-9]{1,3})/);
    return direct ? Math.min(150, Math.max(1, Number(direct[1]))) : null;
  }

  function parseLevel(text, levelText = '') {
    const direct = parseLevelDirect(text) || parseLevelDirect(levelText);
    if (direct) return direct;
    const cleaned = normalizeText(levelText || text).replace(/[OＯ]/g, '0');
    const candidates = [...cleaned.matchAll(/[0-9]{1,3}/g)]
      .map(match => Number(match[0]))
      .filter(value => value >= 1 && value <= 150);
    return candidates.at(-1) || 1;
  }

  function parseLimitBreak(text) {
    const cleaned = normalizeText(text);
    const match = cleaned.match(/([0-9]{1,2})凸/);
    return match ? Math.min(10, Math.max(0, Number(match[1]))) : 0;
  }

  function inferResult(text, levelText, rowCanvas, index) {
    const match = findBestCatalog(text);
    let mutation = match.mutation;
    if (match.entry?.category === 'normal') mutation = classifyNormalMutation(rowCanvas, index);
    return {
      catalogId: match.entry?.id || '',
      mutation,
      level: parseLevel(text, levelText),
      limitBreak: parseLimitBreak(text),
      confidence: match.score,
      rawText: [text, levelText].filter(Boolean).join(' / ').replace(/\s+/g, ' ').trim(),
    };
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
      raw.textContent = `一致度 ${Math.round(item.confidence * 100)}%｜読取：${item.rawText || '文字を読み取れませんでした'}`;

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
        const canvas = makeOcrCanvas(preview, index);
        const result = await worker.recognize(canvas);
        let levelText = '';
        if (!parseLevelDirect(result.data.text)) {
          const levelResult = await worker.recognize(makeLevelCanvas(preview, index));
          levelText = levelResult.data.text;
        }
        recognized.push(inferResult(result.data.text, levelText, preview, index));
      }
      renderResults();
      setStatus('解析しました。候補・Lv・凸・変異を確認してから反映してください。');
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
