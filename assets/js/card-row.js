// Locate the seven card illustrations in a small, already cropped party photo.
// The gaps and the space between the cards and their attack labels are usually flat.
(() => {
  'use strict';
  function ranges(bits, gap) {
    const result = [];
    let start = -1, end = -1;
    for (let i = 0; i < bits.length; i++) {
      if (!bits[i]) continue;
      if (start < 0 || i - end > gap + 1) {
        if (start >= 0) result.push([start, end + 1]);
        start = i;
      }
      end = i;
    }
    if (start >= 0) result.push([start,end+1]);
    return result;
  }

  function measure(canvas) {
    const {width:w, height:h} = canvas;
    const {data} = canvas.getContext('2d').getImageData(0, 0, w, h);
    const delta = (a,b) => Math.max(Math.abs(data[a]-data[b]), Math.abs(data[a+1]-data[b+1]), Math.abs(data[a+2]-data[b+2]));
    const cols = new Uint8Array(w);
    for (let x=0; x<w; x++) {
      let n=0, active=0;
      for (let y=Math.round(h*.35); y<Math.round(h*.65); y++) {
        const i=(y*w+x)*4;
        if (delta(i,i+w*4)>9) active++;
        n++;
      }
      cols[x] = active > n*.2;
    }
    const boxes = ranges(cols,Math.max(2,Math.round(w*.007)-1)).filter(([a,b])=>b-a > w*.055 && b-a < w*.16);
    if (boxes.length !== 7) return null;
    const centers=boxes.map(([a,b])=>(a+b-1)/2);
    const pitch=(centers[6]-centers[0])/6;
    if (pitch < w*.085 || pitch > w*.153) return null;
    const cards=[];
    for (let i=0; i<7; i++) {
      const [left,right]=boxes[i];
      const localPitch=((centers[i+1] ?? centers[i]+centers[i]-centers[i-1]) -
        (centers[i-1] ?? centers[i]-(centers[i+1]-centers[i])))/2;
      if (Math.abs(localPitch-pitch)>pitch*.16) return null;
      const rows=new Uint8Array(h);
      const inset=Math.max(2,Math.round((right-left)*.06));
      for (let y=0; y<h; y++) {
        let active=0;
        for (let x=left+inset; x<right-inset-1; x++) {
          const offset=(y*w+x)*4;
          if (delta(offset,offset+4)>13) active++;
        }
        rows[y]=active>(right-left-2*inset-1)*.16;
      }
      const body=ranges(rows,Math.max(1,Math.floor(pitch*.03))).find(([a,b])=>a<h*.53 && b>h*.54 && b-a>localPitch*.64);
      if (!body || body[1]-body[0]>localPitch*1.24) return null;
      cards.push({center:centers[i], pitch:localPitch, top:body[0], bodyTop:body[0], bottom:body[1]});
    }
    const median=xs=>xs.slice().sort((a,b)=>a-b)[Math.floor(xs.length/2)];
    const slopes=[];
    for(let i=0;i<6;i++) for(let j=i+1;j<7;j++) {
      slopes.push((cards[j].top-cards[i].top)/(centers[j]-centers[i]));
    }
    const tilt=median(slopes);
    if(Math.abs(tilt)>.12) return null;
    if(Math.abs(tilt)<.008) {
      for(const c of cards) {c.tilt=0;c.scale=(c.bottom-c.top)/.90;}
      return cards;
    }
    const intercept=median(cards.map(c=>c.top-tilt*c.center));
    const statOffsets=[];
    for(const c of cards) {
      c.top=intercept+tilt*c.center;
      c.tilt=tilt;
      const left=Math.max(0,Math.round(c.center-c.pitch*.32)), right=Math.min(w,Math.round(c.center+c.pitch*.45));
      const first=Math.max(0,Math.round(c.top+c.pitch*.98)),last=Math.min(h-1,Math.round(c.top+c.pitch*1.25));
      const active=[];
      for(let y=first;y<=last;y++) {
        let count=0;
        for(let x=left;x<right;x++) {
          const k=4*(y*w+x);
          if(Math.min(data[k],data[k+1],data[k+2])>115) count++;
        }
        active.push(count>(right-left)*.12);
      }
      const band=ranges(active,1).find(([a,b])=>a>0 && b<active.length && b-a>=c.pitch*.055 && b-a<=c.pitch*.18);
      if(band)statOffsets.push((first+(band[0]+band[1]-1)/2-c.top)/c.pitch);
    }
    const statOffset=statOffsets.length>=4 ? median(statOffsets) : null;
    for(const c of cards) c.scale=statOffset ? c.pitch*statOffset/1.05 : (c.bottom-c.top)/.90;
    return cards;
  }

  function normalize(source, output) {
    const cards=measure(source);
    if (!cards) return false;
    const p=200;
    output.width=p*7;
    output.height=Math.round(p*1.40);
    const ctx=output.getContext('2d',{alpha:false});
    ctx.fillStyle='#1c1d28'; ctx.fillRect(0,0,output.width,output.height);
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    const readings=document.createElement('canvas');
    readings.width=7*84; readings.height=118;
    const readCtx=readings.getContext('2d',{willReadFrequently:true});
    readCtx.fillStyle='#1c1d28';readCtx.fillRect(0,0,readings.width,readings.height);
    function draw(ctx,step) {
      cards.forEach(({center,pitch,top,scale,tilt},i)=>{
        ctx.save();
        ctx.beginPath();ctx.rect(i*step,0,step,ctx.canvas.height);ctx.clip();
        ctx.transform(step/pitch,-tilt*step/scale,0,step/scale,
          (i+.5)*step-center*step/pitch,.24*step-(top-tilt*center)*step/scale);
        ctx.drawImage(source,0,0);
        ctx.restore();
      });
    }
    draw(ctx,p);draw(readCtx,84);
    const local=document.createElement('canvas');local.width=output.width;local.height=output.height;
    const localCtx=local.getContext('2d');localCtx.fillStyle='#1c1d28';localCtx.fillRect(0,0,local.width,local.height);
    cards.forEach(({center,pitch,bodyTop,bottom},i)=>{
      const scale=(bottom-bodyTop)/.9;
      localCtx.drawImage(source,center-pitch/2,bodyTop-scale*.24,pitch,scale*1.40,i*p,0,p,output.height);
    });
    return {readings,local,badgeVisible:cards.map(c => c.top >= (c.bottom-c.top)*.20)};
  }

  let gallery;
  function matchArt(canvas) {
    if (!window.moncolleCardSignatures) return [];
    gallery ||= Object.entries(window.moncolleCardSignatures).map(([name,encoded])=>{
      const bytes=Int8Array.from(atob(encoded),c=>c.charCodeAt(0));
      return {name,bytes,norm:Math.sqrt(bytes.reduce((sum,v)=>sum+v*v,0))};
    });
    const small=document.createElement('canvas');small.width=18;small.height=20;
    const ctx=small.getContext('2d',{willReadFrequently:true});
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    return Array.from({length:7},(_,slot)=>{
      const scores=new Float32Array(gallery.length), feature=new Float32Array(18*20*3);
      for(const ox of [-3,0,3]) for(const oy of [-3,0,3]) for(const scale of [.94,1,1.06]) {
        const w=84*.84*.64*scale,h=84*.90*.61*scale;
        ctx.drawImage(canvas,(slot+.5)*84+ox-w/2,84*.69+oy-h/2,w,h,0,0,18,20);
        const raw=ctx.getImageData(0,0,18,20).data;
        let norm=0;
        for(let y=0;y<20;y++) for(let x=0;x<18;x++) for(let ch=0;ch<3;ch++) {
          let sum=0;
          for(let j=-2;j<=2;j++) for(let k=-2;k<=2;k++) {
            sum+=raw[4*(18*Math.max(0,Math.min(19,y+j))+Math.max(0,Math.min(17,x+k)))+ch];
          }
          const p=18*y+x,v=raw[4*p+ch]-sum/25;
          feature[3*p+ch]=v;norm+=v*v;
        }
        norm=Math.sqrt(norm);
        gallery.forEach(({bytes,norm:refNorm},i)=>{
          let product=0;for(let j=0;j<bytes.length;j++) product+=bytes[j]*feature[j];
          scores[i]=Math.max(scores[i],product/(1+norm*refNorm));
        });
      }
      const sorted=gallery.map(({name},i)=>({name,score:scores[i]})).sort((a,b)=>b.score-a.score);
      return {...sorted[0],margin:sorted[0].score-sorted[1].score};
    });
  }
  window.moncolleCardRow={normalize,matchArt};
})();
