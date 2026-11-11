const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../clauses.js'),documents=require('../source-documents.js');
test('all eleven originals have precise body heading ranges including waste-management clauses or terms',()=>{
 for(const d of documents){const outline=C.build(d.text,d);assert.ok(outline.length>=10,d.shortTitle);assert.ok(C.filter(outline,d.language==='zh-CN'?'废':'waste').length,d.shortTitle);for(const h of outline){assert.ok(h.start>=0&&h.end>h.start&&h.end<=d.text.length);assert.ok(d.text.slice(h.start,h.end).trim());assert.ok(!/\.{4}/.test(h.title),'TOC leader must not become a clause');assert.ok(h.title.length<400,'body paragraphs must not become headings');}}
 const zero=documents.find(d=>d.documentSymbol==='UNEP/PP/INC.3/4');assert.ok(C.build(zero.text,zero)[0].start>zero.text.indexOf('Part VI [Final provisions (placeholder)]\t28'));
});
test('article numbers and titles combine into 31 unique navigable clauses',()=>{
 const d=documents.find(d=>d.originalUrl.includes('inc52-chair')),items=C.build(d.text,d);assert.equal(items.length,31);for(let n=1;n<=31;n++)assert.equal(items.filter(x=>new RegExp('^ARTICLE '+n+' · ').test(x.title)).length,1);const target=C.filter(items,'Article 7 waste')[0];assert.ok(target.title.includes('PLASTIC WASTE MANAGEMENT'));assert.ok(d.text.slice(target.start,target.end).includes('ARTICLE 7'));
});
test('heading locations follow edited text offsets, including wrapped headings and supplementary characters',()=>{
 for(const d of documents){const target=C.filter(C.build(d.text,d),d.language==='zh-CN'?'废':'waste')[0],prefix='研究备注 📝\n\n';const moved=C.build(prefix+d.text,d).find(h=>h.title===target.title);assert.ok(moved,d.shortTitle);assert.equal(moved.start,target.start+prefix.length);assert.equal(moved.end,target.end+prefix.length);}
 const d=documents.find(d=>d.originalUrl.includes('inc52-chair'));const changed=d.text.replace('JUST TRANSITION','JUST AND EQUITABLE TRANSITION');assert.ok(C.filter(C.build(changed,d),'equitable').some(h=>h.title==='ARTICLE 9 · JUST AND EQUITABLE TRANSITION'));
});
test('repeated titles keep distinct section positions and imported Chinese or Markdown headings work',()=>{
 const d=documents.find(d=>d.documentSymbol==='UNEP/PP/INC.3/4'),waste=C.build(d.text,d).filter(h=>h.title.startsWith('Waste management'));assert.ok(waste.length>=2);assert.equal(new Set(waste.map(x=>x.start)).size,waste.length);
 const text='说明文字\n\n第一条 目标\n\n正文。\n\n第二条 塑料产品\n\n内容。\n\n## 研究备注\n\n更多内容';const items=C.build(text);assert.equal(C.filter(items,'塑料产品')[0].start,text.indexOf('第二条'));assert.equal(C.filter(items,'研究备注')[0].title,'研究备注');assert.deepEqual(C.build('Each Party shall take measures.\n1. Each Party shall cooperate.'),[]);assert.deepEqual(C.filter(items,'不存在'),[]);
});
