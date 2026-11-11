const {test}=require('node:test'),assert=require('node:assert/strict');
const documents=require('../source-documents.js'),C=require('../clauses.js'),Language=require('../languages.js');
test('directory numbers use ASCII digits across Chinese numerals, financial numerals, full-width digits, and Roman parts',()=>{
 for(const text of ['第八条','第 八 条','第捌条','第８条','第Ⅷ条'])assert.equal(C.formatTitle(text),'第8条');
 assert.equal(C.formatTitle('第二十一条 争端解决'),'第21条 · 争端解决');
 assert.equal(C.formatTitle('第贰拾条之二 原则'),'第20条之2 · 原则');
 assert.equal(C.formatTitle('Part IV [Footnote 18]'),'Part 4');
 assert.equal(C.formatTitle('Appendix Ⅲ'),'Appendix 3');
 assert.equal(C.formatTitle('ARTICLE viii · OBJECTIVE'),'ARTICLE 8 · OBJECTIVE');
 assert.equal(C.formatTitle('Annex X'),'Annex X');
 assert.equal(C.numberValue('IC'),null);assert.equal(Language.sectionKey('Part 4'),'part:4');
});
test('every document directory and its context have canonical number formatting without moving raw heading ranges',()=>{
 let checked=0;
 for(const d of documents){for(const h of C.build(d.text,d)){
  checked++;assert.equal(C.formatTitle(h.title),h.title,d.name+': '+h.title);
  assert.ok(!/第\s*[一二三四五六七八九十百壹贰叁肆伍陆柒捌玖拾佰仟０-９]+\s*[条章节编部]/.test(h.title+' '+h.context),h.title);
  assert.ok(!/\b(?:Part|Appendix)\s+[IVXLCDM]+\b/.test(h.title+' '+h.context),h.title);
  assert.ok(!/\[(?:Footnote|Endnote)\s+\d+\]/.test(h.title),h.title);
  assert.ok(h.start>=0&&h.end>h.start&&h.end<=d.text.length);assert.ok(d.text.slice(h.start,h.end).trim());
 }}
 assert.ok(checked>500,'all full document directories remain covered after grouping alternative headings');
 const d=documents.find(d=>d.id.startsWith('src-inc52-chair-zh')),items=C.build(d.text,d);
 assert.deepEqual(C.filter(items,'第八条').map(h=>h.id),C.filter(items,'第8条').map(h=>h.id));
 assert.equal(C.filter(items,'第捌条')[0].title,'第8条 · 现有和历史塑料污染');
});
test('audit retains wrapped article titles and all six parts of the Chinese compilation',()=>{
 const en=documents.find(d=>d.bilingualGroup==='aid-to-negotiations-2026'&&d.language==='en');
 assert.ok(C.build(en.text,en).find(h=>h.title.startsWith('ARTICLE 11 · ')).title.endsWith('TRANSFER, INCLUDING INTERNATIONAL COOPERATION'));
 const zh=documents.find(d=>d.id.startsWith('src-inc52-chair-zh')),items=C.build(zh.text,zh);
 assert.equal(items.find(h=>h.title.startsWith('第25条')).title,'第25条 · 签署');
 const compilation=documents.find(d=>d.bilingualGroup==='inc5-compilation'&&d.language==='zh-CN'),parts=C.build(compilation.text,compilation).filter(h=>h.level===1&&/^第\d编/.test(h.title));
 assert.deepEqual(parts.map(h=>h.title.match(/^第(\d)编/)[1]),['1','2','3','4','5','6']);assert.equal(parts.at(-1).title,'第6编 · 最后条款');
});
test('replacement is the 15 August 00:48 Chinese PDF and all 31 articles match the English version',()=>{
 const zh=documents.find(d=>d.id.startsWith('src-inc52-chair-zh')),en=Language.counterpart(documents,zh.id,'en');
 assert.equal(zh.name,'0815 主席修订版案文（中文）.pdf');assert.equal(zh.fileType,'PDF');assert.equal(zh.pageCount,14);assert.equal(zh.publishedDate,'2025-08-15');assert.equal(zh.publishedTime,'00:48');assert.equal(zh.meetingId,'inc-5-2');assert.ok(zh.text.includes('2025年8月15日 00:48'));
 assert.ok(!documents.some(d=>d.name.includes('Chairs_Text_C.docx')));
 const items=C.build(zh.text,zh),english=C.build(en.text,en);
 for(let n=1;n<=31;n++){const h=items.find(h=>Language.sectionKey(h)==='article:'+n);assert.ok(h,n);assert.ok(Language.equivalent(english,h),n);}
 assert.equal(items.filter(h=>/^第\d+条/.test(h.title)).length,31);
});
