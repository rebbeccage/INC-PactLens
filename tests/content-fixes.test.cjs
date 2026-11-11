const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm');
const W=require('../model.js'),L=require('../layout.js'),documents=require('../source-documents.js');
const zh=documents.filter(d=>d.language==='zh-CN');
function storage(value){let data=JSON.stringify(value);return {getItem:()=>data,setItem:(key,value)=>data=value};}
function load(disk){const context={window:{SourceDocuments:documents},Workbench:W,localStorage:disk};vm.runInNewContext(fs.readFileSync(require.resolve('../data.js'),'utf8'),context);return context.window.DocumentData;}
test('all four Chinese reading texts have no untranslated prose or English footnote labels',()=>{
 const identifiers=new Set(['UNEP','PP','INC','INF','XX','X39','K2412031','CMR1A','STOTRE','EDCHH','ENV','PBT','vPvB','OPOs','ii','iii','aa','bb','cc','dd','ee','xx']);
 for(const d of zh){const text=d.text.replace(/https?:\/\/[A-Za-z\d./_%#?=&:~+\-\n]+/g,'');for(const m of text.matchAll(/[A-Za-z][A-Za-z\d’'\-]*(?:[ \t]+[A-Za-z][A-Za-z\d’'\-]*)*/g)){assert.ok(/^[A-Za-z]$/.test(m[0])||identifiers.has(m[0]),d.originalUrl+': '+m[0]);}assert.ok(!/\[(?:Footnote|Endnote)\b|\b(?:FOOTNOTES|informal|cooperative|enterprises|pickers)\b|\dth\b/.test(d.text));}
 const chair=zh.find(d=>d.bilingualGroup==='inc52-chair');assert.ok(chair.text.includes('非正规 和 合作社 部门以及 中小企业'));assert.ok(chair.text.includes('拾荒者'));assert.ok(chair.text.includes('[90] [120]'));
});
test('approved reading corrections are reversible and source document identities remain stable',()=>{
 for(const d of zh.filter(d=>d.editorialRevision)){const original=W.uncorrected(d);assert.equal(crypto.createHash('sha256').update(original).digest('hex'),d.originalExtractedTextSha256);assert.equal(crypto.createHash('sha256').update(d.text).digest('hex'),d.textSha256);assert.ok(d.editorialCorrections.every(p=>original.slice(p.start,p.start+p.before.length)===p.before));}
});
test('existing untouched drafts migrate to corrected Chinese with zero false user revisions',()=>{
 for(const d of zh.filter(d=>d.editorialRevision)){const old=W.uncorrected(d),disk=storage({docs:[{...d,text:undefined,editorialRevision:0}],drafts:{[d.id]:{text:old}},left:d.id,right:d.id}),api=load(disk),store=api.load().store;assert.equal(store.work().text,d.text);assert.equal(store.work().revision.count,0);api.persist(store);assert.equal(api.load().store.work().revision.count,0);}
});
test('correction migration preserves user edits and English notes added outside source ranges',()=>{
 const d=zh.find(d=>d.bilingualGroup==='inc52-chair'),old=W.uncorrected(d),notes='\n\n研究备注：informal 与 cooperative 是我的检索词。';
 const draft=old.replace('cooperative','合作组织')+notes,expected=d.text.replace('合作社','合作组织')+notes;
 assert.equal(W.migrateDraft(d,draft),expected);
 const disk=storage({docs:[{...d,text:old,editorialRevision:0}],drafts:{[d.id]:{text:draft}},left:d.id,right:d.id}),api=load(disk),store=api.load().store;assert.equal(store.work().text,expected);assert.ok(store.work().revision.count>0);assert.equal(W.finalText(store.work().revision),expected);
});
test('large Chinese comparisons retain matching text inside paragraphs whose wrapping and lengths differ',()=>{
 const left=zh.find(d=>d.bilingualGroup==='inc4-revised-zero'),right=zh.find(d=>d.bilingualGroup==='inc5-compilation'),r=L.compare(left.text,right.text,left,right),kept='关切地注意到塑料污染数量巨大且迅速增加';
 assert.equal(r.degraded,false);assert.ok(r.segments.some(s=>s.type==='equal'&&s.text.includes(kept)));assert.ok(r.segments.filter(s=>s.type==='equal').reduce((n,s)=>n+s.text.length,0)>40000);
 const at=r.rightProjection.text.indexOf(kept),start=r.rightProjection.boundaries[at],end=r.rightProjection.boundaries[at+kept.length];assert.ok(at>0);assert.ok(!r.rightAnnotations.some(x=>x.start<end&&x.end>start));
 assert.equal(r.segments.filter(s=>s.type!=='delete').map(s=>s.text).join(''),r.leftProjection.text);assert.equal(r.segments.filter(s=>s.type!=='insert').map(s=>s.text).join(''),r.rightProjection.text);
});
test('anchored long-text diff preserves both input projections with insertions, deletions, repeated clauses and emoji',()=>{
 let seed=4821;const random=n=>((seed=Math.imul(seed,1664525)+1013904223>>>0)%n),alphabet=['甲','乙','丙','条','款','。',' ','\n','😀','shall','2030'];
 for(let n=0;n<100;n++){let a=Array.from({length:100},()=>alphabet[random(alphabet.length)]).join(''),b=a;for(let k=0;k<8;k++){const at=random(b.length+1);b=b.slice(0,at)+(k%2?'新增📝':b.slice(at,at+3))+b.slice(at+(k%2?0:7));}const r=W.diff(a,b,120);assert.equal(W.finalText(r),b);assert.equal(r.segments.filter(s=>s.type!=='insert').map(s=>s.text).join(''),a);}
});
test('every same-language source pair retains complete text and valid raw annotation bounds',()=>{
 for(let i=0;i<documents.length;i++)for(let j=i+1;j<documents.length;j++){const a=documents[i],b=documents[j];if(a.language!==b.language)continue;const r=L.compare(a.text,b.text,a,b);assert.equal(W.finalText(r),r.leftProjection.text,a.id+' / '+b.id);assert.equal(r.segments.filter(s=>s.type!=='insert').map(s=>s.text).join(''),r.rightProjection.text);for(const side of ['left','right'])for(const x of r[side+'Annotations'])assert.ok(x.start>=0&&x.end>x.start&&x.end<=(side==='left'?a.text.length:b.text.length));}
});
