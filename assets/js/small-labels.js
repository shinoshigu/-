// White glyphs sampled from high-resolution game labels. The JPEG import path
// compares the whole word, including the Lv prefix, at several small scales.
(() => {
  'use strict';
  const glyphs = {
    'L':[10,16,'9vb2+CoABhQpD/////8rAA8yEQf/////KwARHgYC/////ywAERkBAP////8uABEXAAD/////LwAHBQAA/////zIAAAECAP////81AAAEBwH/////OQACCA0G/////zsAAQYJBv////89AAAAAAD/////VBkYFxcX//////fy7+zr6///////////////////////////1dbX2tzd3d7h5Q=='],
    'v':[13,12,'kpacqJANABLN////y9D////ZFwAf5v///omG/v//7DAAQPD///dNSPb///VVAGX5///nHBfb///9eQKK/v//tQkGof///6MItf//+3oBAGH2///PEN///+1FAAAs3///8jr3///RHAAADq7///qV+///ogsAAAF1+f/+5/7/+G8BAAAAPeb//////+c+AAAAABe+///////GGwAD'],
    '0':[14,16,'AAAFQJvW7u3UmT4FAAUAFJj2////////9ZERAAWT/P//////////+4cEPvP////ijpns////8TGh////8EUCA2/7///+huL////ADAAAHt/////B/////6AAAAAOw////+X/////kQAAAAi4////9P////+TAAAACbr////v/f///6YCAAAQx////9vc////yhIAACHj////sJD+///3VAMEc/z///1mMfD////qoKfu////4B0DfPj///////////RoAgAMg/L////////vdgcABQAEPKLl/fzgmzQDAAg='],
    '1':[8,16,'AAEPc+f///wVeef//////+r/////////5v////////+U///4/////z7ojZf/////BSYAev////8AAAB6/////wIAAHr/////CwAAev////8MAAB6/////wwAAHv/////CQAAf/////8DAACC/////wIAAIX/////BgAAhPn7+vU='],
    '2':[12,16,'EwIojdr7/uqwTwcJAkrl////////+pkLJub///////////5yh////+hybeb////Z2P///YgCApL+///+/v//+U8EAoP9///9aYWguTYBC7P////YBAMBAAABW/T///55GxkNAgNW5v///84YFQkCIJn3///+1CcEASaL5P////mhIAELs/H///zqqEIMCQwM8P////bLvcDGzNOn6v////////////+74v/////////////ButDQ1Nnf4+fp7fLC'],
    '3':[14,16,'FwQVa8Hw///504QmAhIEIsr9/////////uZRAQ/F//////Ls/f///+w1Uvn////BMSKC+P///pFewtvv9lABASLd////rQABDyM7FwEBR+7///1+GhcRA0CLiK/z///9vRQdHRsGaPr////2w2oQAB0dGwZe9//////+3V4EEg8JAS9hYoba////9loQIDNTZBMBASne////y87s/P/tPQEBGtL////qqP/////FSDaQ+P///8o37P/////9/P/////6ZQFK4v7/////////8X4FEgIifc74///83JY5Ags='],
    '4':[14,16,'HR0dDg+8///////8UgYdHRkEYPj///////xSBh0cCxzN///r7v//+1AGHRUFf/7//J7e///6TQccCCbq///YQNr///pMBxIGnv//+XAb2v//+UkHA0X0///MFBfX///5SQcMu///+mMAF9f///pLBmj////CEQAZ2f//+k0A4///+ZRKSlvk///7g034///+/Pz8/P7////+8vT////////////////y7P////////////////I+Ozc0Mi4qPuD///tjIQcICAgICAMf3v//+08BHR0dHR0dDiDc+/r0UQU='],
    '5':[14,16,'YLW3ur3Aw8fM0NXczA2J///////////////YDI3//////////////9cMkP///+GSh4N+eXVxZwaU////uQ0AAAAAAAAAAJ3///+4KXO4zsGNMgIAo////+Pn///////zdAOs//////3m6v7////zPqvz/f/7kSQsq/////+eFh8lNEQVAABB7////9QBAwQJGwYAADLk////5qK71vTlOAABVPf////KxP/////GYGzU/////oBE7v/////////////UGQJT3P7////////9xzUAAAEWYqnQ5OPPnVEPAAA='],
    '6':[14,16,'HA8DLIzP8fjnvGoWBBcQAXHq/////////ssiBQFr+v///////////sAMHeD////ufG3n////90Fv/f///HACAm3WwKeINK/////mMgAADBEAAAAD3f///9ctcMj3/eCUJAHw////48/9///////WJfP//////d/K7P////6b5P////yPFwNJ7P///+DB////6jgDBxbM////94b+///9eQMCJNz////iNO/////veEum/f///58El/3////////////sNgoNq/n////////+5EwBGggKVbvz///40IAkAhI='],
    '7':[12,16,'3//////////////t3//////////////p4P/////////////t2Onl4uDd3e3////1JCAcGRYUSN/////DCA0ODAIlz////8gZFx0dEgmc/v//6TQEHR0bBz30////eQMVHR0VCKb////bHAwdHR0MKeT///+UBxgdHRwGXvv///hWBxwdHBoHkf///+otDR0cGhYKtv///9kYER0UGxQRy////8gRFB0RGhIW1P///78OFh0UGRIY1v///70NFh0b'],
    '8':[14,16,'DAI5jtT3///41JI6AwoEfPL///////////OLB1D4/////Ojq/P////xmo/////VyHR979////8Cx////1RoDAxrW////0n79///vRwEBOur///6fGM/////rgWTX////1SYAJbH6////////7pYgAAl25f////f7////73sJh/v///yiNEvJ////+4T4////xBYFBCne////9/////+vDQcFE8X/////9f////JwISN79v///++b/v////3s7v7////+jw6k+v//////////+JoMBwhKn9f2///315xGBgk='],
    '9':[14,16,'DgE7rPT/////2nMOBhoAX/H//////////rgPBzz0//////Hz/////6UEoP////+lJy7A////9zjX////9iMEAjH4////kN7////zFQkHBez////Ksf////xcAgNP9v///+xO+v////C3vvT/////+wN18P//////1tb////4AgAte6q3pmcX1f///+cJFSQ6XwYAAA7w////wpHh8P36RwAAV/z///+GV/3////jgonv////8S0Mv/////////////6HAwQVvP3////////5lQYKAgAMW7Xq/v7nrEoECRs='],
    '凸':[20,20,'HR0aBUHy///////////3UgQZHR0dHRoFQfL///////////dSBBkdHR0dGgVB8v61Xl5eXrb+91IEGR0dHR0aBUHy/owAAgIAjf73UgQZHR0dHRoFQfL+jAEREQGN/vdSBBkdHQoKCQJB8v6MAhQUAo3+91IBCAoKBQUFBUXy/owCFBQCjf73VgUFBQXs8vLy8/3+jAIUFAKN/v718vLy7/T///////6MAhQUAo3+///////69P/upqKioV4CFBQCX6Gioqfu//r0/9EOAAAAAAYZGQYAAAAAEtT/+vT/0Q4IExQVGh0dGhUUEwgS1P/69P/RDgwcHR0dHR0dHR0cDBLU//r0/9EODBwcHB0dHRwcHRwLEtT/+vT/0Q4DCAgICAgICAgICAMS1P/69P/XLiMjIyMjIyMjIyMjIzLa//r0//zt7Ozs7Ozs7Ozs7Ozs7fz/+vT////////////////////////69P/qj4mJiYmJiYmJiYmJiZXu//r0/9AOAAAAAAAAAAAAAAAAEbjc2Q==']
  };
  const pitch = 84;
  function word(text) {
    const parts=[...text].map(c=>glyphs[c]);
    const h=Math.max(...parts.map(p=>p[1]));
    const width=Math.ceil(4+parts.reduce((n,p)=>n+p[0]+1.5,0));
    const data=new Uint8Array(width*(h+5));
    let x=2.5;
    for (const [w,height,encoded] of parts) {
      const ink=atob(encoded);
      for(let y=0;y<height;y++) for(let col=0;col<w;col++) {
        data[(h-height+2+y)*width+Math.round(x)+col]=ink.charCodeAt(y*w+col);
      }
      x+=w+1.5;
    }
    return {data,width,height:h+5};
  }

  // Area sampling preserves partial strokes when the photographed digit is only 5–8 pixels tall.
  function kernel(ref,w,h) {
    const offsets=[], weights=[];
    let sum=0, squares=0;
    const sx=ref.width/w, sy=ref.height/h;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
      let ink=0;
      for(let j=Math.floor(y*sy); j<Math.min(ref.height,Math.ceil((y+1)*sy)); j++) {
        const wy=Math.min(j+1,(y+1)*sy)-Math.max(j,y*sy);
        for(let k=Math.floor(x*sx); k<Math.min(ref.width,Math.ceil((x+1)*sx)); k++) {
          ink+=ref.data[j*ref.width+k]*wy*(Math.min(k+1,(x+1)*sx)-Math.max(k,x*sx));
        }
      }
      const v=Math.round(ink/(sx*sy));
      if(v>2) {offsets.push(y*pitch+x); weights.push(v);sum+=v;squares+=v*v;}
    }
    return {offsets:Int16Array.from(offsets),weights:Uint8Array.from(weights),sum,norm:Math.sqrt(squares-sum*sum/(w*h))};
  }

  function makeCell(pixels,i) {
    const data=new Uint8Array(pitch*118), stride=pitch+1;
    const integral=new Float64Array(stride*119), square=new Float64Array(integral.length);
    for(let y=0;y<118;y++) {
      let total=0,ss=0;
      for(let x=0;x<pitch;x++) {
        const j=4*((7*y+i)*pitch+x), v=Math.min(pixels[j],pixels[j+1],pixels[j+2]);
        data[y*pitch+x]=v;total+=v;ss+=v*v;
        const pos=(y+1)*stride+x+1;
        integral[pos]=integral[pos-stride]+total;square[pos]=square[pos-stride]+ss;
      }
    }
    function area(table,x,y,w,h) {
      const pos=y*stride+x, end=pos+h*stride;
      return table[end+w]-table[end]-table[pos+w]+table[pos];
    }
    const cache=new Map();
    function windows(w,h,badge) {
      const key=w*100+h+(badge?10000:0);
      if(cache.has(key))return cache.get(key);
      const positions=[];
      const xMin=badge?Math.max(10,Math.floor(pitch*.35-w/2)):Math.max(15,Math.round(pitch*.89)-w);
      const xMax=badge?Math.min(pitch-w,Math.ceil(pitch*.64-w/2)):pitch-w;
      for(let y=badge?0:70;y<=(badge?22:98)-h;y++) for(let x=xMin;x<=xMax;x++) {
        const sum=area(integral,x,y,w,h), variance=area(square,x,y,w,h)-sum*sum/(w*h);
        if(variance>w*h*100) positions.push({pos:y*pitch+x,mean:sum/(w*h),scale:1/Math.sqrt(variance)});
      }
      cache.set(key,positions);
      return positions;
    }
    return {data,windows};
  }

  function rank(cells,badge) {
    const result=cells.map(()=>[]);
    for(let value=1;value<=(badge?10:150);value++) {
      const ref=word(badge?value+'凸':'Lv'+value);
      const best=cells.map(()=>0);
      for(const h of [8,9,10,11,12,13]) for(const stretch of [.85,1,1.15]) {
        const w=Math.round(ref.width/ref.height*h*stretch), k=kernel(ref,w,h);
        for(let i=0;i<cells.length;i++) {
          const {data,windows}=cells[i];
          for(const {pos,mean,scale} of windows(w,h,badge)) {
            let dot=0;
            for(let j=0;j<k.offsets.length;j++) dot+=data[pos+k.offsets[j]]*k.weights[j];
            const score=(dot-mean*k.sum)*scale/k.norm;
            if(score>best[i])best[i]=score;
          }
        }
      }
      best.forEach((score,i)=>result[i].push({value,score}));
    }
    return result.map(list=>list.sort((a,b)=>b.score-a.score));
  }

  function read({readings,badgeVisible}) {
    const ctx=readings.getContext('2d');
    const rgba=ctx.getImageData(0,0,readings.width,readings.height).data;
    const cells=Array.from({length:7},(_,i)=>makeCell(rgba,i));
    const lv=rank(cells,false),limit=rank(cells,true);
    return cells.map(({data},i)=>{
      let ink=0;
      for(let y=5;y<20;y++) for(let x=25;x<59;x++) if(data[y*pitch+x]>109) ink++;
      return {levels:lv[i],badges:limit[i],blank:badgeVisible[i] && ink<3};
    });
  }
  window.moncolleSmallLabels={read};
})();
