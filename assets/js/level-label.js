/* Small binary glyphs sampled from white, outlined game labels (8 x 10).
   Works on ImageData without loading OCR libraries or character artwork. */
(() => {
  'use strict';
  const shapes = [
    ['L', .65, 'e0e0e0e0e0e0e0e0ffff'], ['v', 1, 'e7e76766767e3e3e3c3c'],
    ['0', .88, '3c7ee7e7c7c7e7e67e3c'], ['1', .48, '1fffff5f1f1f1f1f1f1f'],
    ['2', .79, '3c7fe7e7070e3cf0ffff'], ['3', .82, '3c7f67071e1e07e77f3e'],
    ['4', .89, '1e3e367666e6ffff0606'], ['5', .85, 'fefee0ecfe6707e7ff3e'],
    ['6', .85, '3c7e66e0fef7e7677e3c'], ['7', .76, 'ffff070e1c1c38383838'],
    ['8', .85, '3c7fe7e77e7ee7e7ff3c'], ['9', .83, '7cfee7e7ef7f07e77e3c'],
  ].map(([char, ratio, hex]) => ({char, ratio, rows:hex.match(/../g).map(row => parseInt(row,16))}));
  const bitCount = Array.from({length:256}, (_, value) => value.toString(2).replace(/0/g,'').length);

  function findLabels(image, minHeight, maxHeight, threshold = 210) {
    const { width, height, data } = image;
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < mask.length; i++) {
      mask[i] = Math.min(data[4*i], data[4*i+1], data[4*i+2]) >= threshold ? 1 : 0;
    }
    const queue = new Int32Array(mask.length);
    const parts = [];
    for (let start = 0; start < mask.length; start++) {
      if (mask[start] !== 1) continue;
      let x0 = width, y0 = height, x1 = 0, y1 = 0, count = 1;
      queue[0] = start;
      mask[start] = 2;
      function visit(i) {
        if (mask[i] === 1) { mask[i] = 2; queue[count++] = i; }
      }
      for (let head = 0; head < count; head++) {
        const i = queue[head], x = i % width, y = Math.floor(i / width);
        x0 = Math.min(x0,x); x1 = Math.max(x1,x);
        y0 = Math.min(y0,y); y1 = Math.max(y1,y);
        if (x > 0) visit(i-1);
        if (x+1 < width) visit(i+1);
        if (y > 0) visit(i-width);
        if (y+1 < height) visit(i+width);
      }
      const w = x1-x0+1, h = y1-y0+1;
      if (h < minHeight*.65 || h > maxHeight*1.12 || w/h < .25 || w/h > 1.38) continue;
      if (count < w*h*.28 || y0 === 0 || y1 === height-1) continue;
      const sampled = Array(10).fill(0);
      for (let j=0; j<10; j++) {
        for (let k=0; k<8; k++) {
          let ink = 0;
          for (const dy of [.2,.5,.8]) {
            const y = y0 + Math.floor((j+dy)*h/10);
            for (const dx of [.2,.5,.8]) {
              const x = x0 + Math.floor((k+dx)*w/8);
              if (mask[y*width+x]) ink++;
            }
          }
          sampled[j] = (sampled[j]<<1) | Number(ink>=5);
        }
      }
      const errors = shapes.map(({char, ratio, rows}) => {
        const mismatch = rows.reduce((n,row,j) => n + bitCount[row ^ sampled[j]], 0);
        return {char, error:mismatch/80 + .32*Math.abs(Math.log((w/h)/ratio))};
      }).sort((a,b) => a.error-b.error);
      parts.push({x0,x1,y1,h,errors});
    }
    parts.sort((a,b) => a.x0-b.x0);
    const labels = [];
    for (let i=0; i<parts.length; i++) {
      const l = parts[i];
      if (l.errors[0].char !== 'L' || l.errors[0].error > .24 || l.h < minHeight || l.h > maxHeight) continue;
      const adjacent = (last, minRatio, maxRatio) => {
        for (let j=i+1; j<parts.length; j++) {
          const p = parts[j], gap = p.x0-last.x1-1;
          if (gap > l.h*.35) break;
          if (gap >= 0 && Math.abs(p.y1-l.y1) <= Math.max(2,l.h*.15)
              && p.h >= l.h*minRatio && p.h <= l.h*maxRatio) return p;
        }
        return null;
      };
      const v = adjacent(l,.55,.91);
      if (!v || v.errors[0].char !== 'v' || v.errors[0].error > .25) continue;
      let digits = '', last = v, valid = true;
      for (let p; (p = adjacent(last,.72,1.15)); last = p) {
        const [best, next] = p.errors;
        if (!/^[0-9]$/.test(best.char) || best.error > .21 || next.error-best.error < .019 || digits.length === 3) { valid = false; break; }
        digits += best.char;
      }
      // A run touching the right crop edge may be a truncated 100/120/150.
      if (valid && /^[1-9]\d{0,2}$/.test(digits) && +digits <= 150 && last.x1 < width-2) {
        labels.push({level:+digits, end:last.x1, baseline:l.y1, h:l.h});
      }
    }
    return labels;
  }

  function readRow(canvas) {
    const pitch = canvas.width/7, top = Math.floor(canvas.height*.43);
    const pixels = canvas.getContext('2d').getImageData(0,top,canvas.width,canvas.height-top);
    const levels = Array(7).fill(null);
    for (const threshold of [210,175,235]) {
      const found = findLabels(pixels, Math.max(5,pitch*.045), pitch*.17, threshold);
      for (let slot=0; slot<7; slot++) {
        if (levels[slot] !== null) continue;
        const matches = found.filter(label => {
          const pos = label.end/pitch-slot;
          return pos >= .61 && pos <= 1.06;
        });
        if (matches.length === 1) levels[slot] = matches[0].level;
      }
      if (levels.every(Boolean)) break;
    }
    return levels;
  }

  function findPartyCrop(canvas) {
    const {width,height} = canvas, top = Math.floor(height*.13);
    const pixels = canvas.getContext('2d').getImageData(0,top,width,Math.round(height*.43));
    const found = findLabels(pixels, Math.max(5,width*.004), width*.023).sort((a,b) => a.baseline-b.baseline);
    for (const anchor of found) {
      const row = found.filter(l => Math.abs(l.baseline-anchor.baseline) <= Math.max(2,anchor.h*.2))
        .sort((a,b) => a.end-b.end);
      if (row.length !== 7) continue;
      const pitch = (row[6].end-row[0].end)/6;
      if (pitch < width*.047 || pitch > width*.14 || row.some((l,i) => Math.abs(l.end-row[0].end-i*pitch)>pitch*.07)) continue;
      const x = row[0].end-pitch*.90, y = top+anchor.baseline-pitch;
      if (x<0 || y<0 || x+7*pitch>width || y+1.38*pitch>height) continue;
      return {x:100*x/width, y:100*y/height, width:700*pitch/width, height:138*pitch/height};
    }
    return null;
  }
  const reader = {readRow, findPartyCrop};
  if (typeof module !== 'undefined' && module.exports) module.exports = reader;
  else window.moncolleLevelLabels = reader;
})();
