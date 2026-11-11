const {test}=require('node:test');const assert=require('node:assert/strict');
const L=require('../layout.js'),W=require('../model.js'),documents=require('../source-documents.js');
const content=s=>s.replace(/\s/gu,'');
test('compact layout preserves every non-whitespace character in all eleven full originals',()=>{
 for(const d of documents){const p=L.project(d.text,d);assert.equal(content(p.text),content(d.text),d.shortTitle);assert.equal(p.boundaries.length,p.text.length+1);assert.equal(p.text.includes('\t'),false);assert.equal(/ {2,}|\n{3}/.test(p.text),false);assert.equal(L.edit(d.text,p,p.text).raw,d.text);for(let i=1;i<p.boundaries.length;i++)assert.ok(p.boundaries[i]>=p.boundaries[i-1]);assert.ok(p.blocks.some(b=>b.heading));}
});
test('PDF hard wraps become paragraphs while article headings and subparagraph starts stay separate',()=>{
 const raw='ARTICLE 1\n\nOBJECTIVE\n\nThe objective is to protect\nhuman health and the environment.\n\nARTICLE 2\n\nMEASURES\n\n1. Each Party shall\ntake measures.\n(a) including [options];\n(b) retaining 2040.';const p=L.project(raw);
 assert.equal(p.blocks[0].kind,'heading');assert.equal(p.blocks[1].text,'The objective is to protect human health and the environment.');assert.ok(p.blocks.some(b=>b.text==='(a) including [options];'));assert.equal(content(p.text),content(raw));
});
test('editing the compact projection changes only the intended raw wording and preserves untouched source whitespace',()=>{
 const raw='\tARTICLE 1\n\n\tOBJECTIVE\n\n\t\tEach Party shall protect [human health] by 2040.\n\n[2] Footnote remains.';const p=L.project(raw),next=p.text.replace('shall','should');const edited=L.edit(raw,p,next);assert.equal(edited.raw,raw.replace('shall','should'));assert.equal(edited.projection.text,next);const again=L.edit(edited.raw,edited.projection,next.replace('2040','2050 📝'));assert.equal(again.raw,raw.replace('shall','should').replace('2040','2050 📝'));assert.equal(content(again.raw),content(again.projection.text));assert.equal(W.finalText(W.diff(raw,again.raw)),again.raw);
});
test('deletion, paragraph insertion, CJK and editing across headings round-trip without dropping text',()=>{
 const raw='\t第一条 目标\n\n保护[人类健康]。\n\n第二条 措施\n\nEach Party shall cooperate.';let p=L.project(raw),text=p.text.replace('保护[人类健康]。','保护环境。\n\n新增说明 📝');let result=L.edit(raw,p,text);assert.equal(content(result.raw),content(text));const restore=L.edit(result.raw,result.projection,p.text);assert.equal(content(restore.raw),content(raw));assert.ok(restore.raw.includes('Each Party shall cooperate.'));
});
test('raw clause locations map to their exact compact heading text in every source',()=>{
 for(const d of documents){const p=L.project(d.text,d);for(const b of p.blocks.filter(b=>b.heading)){const start=L.displayOffset(p,b.heading.start),end=L.displayOffset(p,b.heading.end);assert.equal(content(p.text.slice(start,end)),content(d.text.slice(b.heading.start,b.heading.end)),d.shortTitle);}}
});
test('paragraph-anchored comparison preserves full texts and keeps common article headings unchanged',()=>{
 const a=documents[6],b=documents[5],result=L.compare(a.text,b.text,a,b);assert.ok(result.count>1);assert.equal(result.segments.filter(s=>s.type!=='delete').map(s=>s.text).join(''),result.leftProjection.text);assert.equal(result.segments.filter(s=>s.type!=='insert').map(s=>s.text).join(''),result.rightProjection.text);assert.ok(result.segments.some(s=>s.type==='equal'&&s.text.includes('ARTICLE 2 PRINCIPLES AND APPROACHES')));for(const side of ['left','right'])for(const range of result[side+'Annotations']){assert.ok(range.start>=0);assert.ok(range.end>range.start);assert.ok(range.end<=(side==='left'?a.text.length:b.text.length));}
});
test('display-only indent and hard-wrap differences create no comparison changes',()=>{
 const a='\tARTICLE 1\n\n\tOBJECTIVE\n\n\tEach Party shall protect\nhuman health.\n\nARTICLE 2\n\nMEASURES',b='ARTICLE 1\n\nOBJECTIVE\n\nEach Party shall protect human health.\n\nARTICLE 2\n\nMEASURES';assert.equal(L.compare(a,b).count,0);
});
test('search finds phrases over PDF hard wraps and treats legal brackets literally',()=>{
 const text='Human\nhealth [plastic products] EPR 2040 📝';
 assert.deepEqual(L.findRanges(text,['human health']),[[0,12]]);
 const bracket=L.findRanges(text,['[plastic products]'])[0];assert.equal(text.slice(...bracket),'[plastic products]');
 assert.deepEqual(L.findRanges(text,['[missing]']),[]);assert.equal(L.findRanges(text,['📝']).length,1);
});
