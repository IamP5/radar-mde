// Validates /dados/csv/<uf> files: header, field counts, numeric columns, row counts vs dataset.
import fs from 'node:fs';
const B=process.env.BASE??'http://localhost:3210';
const cities=JSON.parse(fs.readFileSync(new URL('../../../web/src/data/cities.json',import.meta.url)));
const parse=(line)=>{const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(q){if(ch=='"'&&line[i+1]=='"'){cur+='"';i++}else if(ch=='"')q=false;else cur+=ch}else if(ch=='"')q=true;else if(ch==','){out.push(cur);cur=''}else cur+=ch}out.push(cur);return out};
let fail=0;
for (const uf of ['brasil','sp','df','mt','pa','ro','ac']) {
  const r=await fetch(`${B}/dados/csv/${uf}`); const buf=new Uint8Array(await r.arrayBuffer()); const bom=buf[0]===0xef&&buf[1]===0xbb&&buf[2]===0xbf; const t=new TextDecoder().decode(buf);
  const lines=t.replace(/^﻿/,'').split('\n'); const head=parse(lines[0]);
  const bad=lines.slice(1).filter(l=>parse(l).length!==head.length);
  const rows=lines.slice(1).map(parse); const ix=k=>head.indexOf(k);
  const nonnum=rows.filter(r=>['mde_pct','populacao','ano','faltou_rs'].some(k=>r[ix(k)]!==''&&isNaN(Number(r[ix(k)]))));
  const cs=uf==='brasil'?cities:cities.filter(c=>c.uf.toLowerCase()===uf);
  const expected=cs.reduce((s,c)=>s+Object.keys(c.years).length,0);
  const ids=new Set(rows.map(r=>r[0]));
  const nd=rows.filter(r=>r[ix('situacao')]==='nao_declarou').length;
  const emptyInter=rows.filter(r=>r[ix('regiao_intermediaria')]==='').length;
  const zeroUnknown=rows.filter(r=>r[ix('faltou_rs')]==='0'&&(r[ix('situacao')]==='nao_declarou'||(Number(r[ix('mde_pct')])<25&&r[ix('mde_pct')]!==''&&r[ix('receita_impostos_rs')]===''))).length;
  const nan=/NaN|undefined|null/.test(t);
  const ok=r.status===200&&bom&&!bad.length&&!nonnum.length&&rows.length===expected&&ids.size===cs.length&&!nan;
  if(!ok)fail++;
  console.log(`${ok?'PASS':'FAIL'} /dados/csv/${uf}: ${r.status} ${r.headers.get('content-disposition')} rows=${rows.length}/${expected} cities=${ids.size}/${cs.length} badFieldCount=${bad.length} nonNumeric=${nonnum.length} nd=${nd} emptyInter=${emptyInter} NaN=${nan} faltou=0-but-unknown=${zeroUnknown}`);
}
console.log(fail?'RESULT: FAIL':'RESULT: PASS');
