const {test}=require('node:test'),assert=require('node:assert/strict');
const documents=require('../source-documents.js'),Language=require('../languages.js'),C=require('../clauses.js'),L=require('../layout.js'),W=require('../model.js');
test('four explicit bilingual pairs belong to the correct meetings and retain original English identities',()=>{
 assert.equal(documents.filter(d=>d.language==='en').length,7);assert.equal(documents.filter(d=>d.language==='zh-CN').length,4);
 for(const [group,meeting]of [['inc4-revised-zero','inc-5-1'],['inc5-compilation','inc-4'],['inc52-chair','inc-5-2'],['aid-to-negotiations-2026','inc-5-3']]){
  const pair=documents.filter(d=>d.bilingualGroup===group);assert.equal(pair.length,2);
  const english=pair.find(d=>d.language==='en'),chinese=Language.counterpart(documents,english.id,'zh-CN');
  assert.equal(chinese.meetingId,meeting);assert.equal(english.meetingId,meeting);assert.equal(chinese.publishedDate,english.publishedDate);assert.equal(Language.counterpart(documents,chinese.id,'en').id,english.id);
 }
 assert.equal(documents.find(d=>d.language==='en'&&d.meetingId==='inc-5-1').id,'src-inc4-revised-zero-700596364b1e');
});
test('English and Chinese research drafts and their undo bases remain independent across repeated switches and reloads',()=>{
 const english=documents.find(d=>d.bilingualGroup==='inc4-revised-zero'&&d.language==='en'),chinese=Language.counterpart(documents,english.id,'zh-CN');
 const store=new W.Store(documents);store.left=english.id;store.right=documents.find(d=>d.meetingId==='inc-3').id;
 store.edit(english.text+'\n\nEnglish research note 2040');const englishDraft=store.work().text;
 Language.select(store,'left','zh-CN');assert.equal(store.work().text,chinese.text);assert.equal(store.work().base,chinese.text);store.edit(chinese.text+'\n\n中文研究备注 2050');const chineseDraft=store.work().text;
 Language.select(store,'left','en');assert.equal(store.work().text,englishDraft);assert.equal(store.work().base,english.text);
 Language.select(store,'left','zh-CN');assert.equal(store.work().text,chineseDraft);
 const reloaded=new W.Store(documents,JSON.parse(store.snapshot()));assert.equal(reloaded.work().text,chineseDraft);Language.select(reloaded,'left','en');assert.equal(reloaded.work().text,englishDraft);assert.equal(W.finalText(reloaded.work().revision),englishDraft);
});
test('switching only the reference language leaves the research side, revisions, and view settings untouched',()=>{
 const en=documents.find(d=>d.bilingualGroup==='inc5-compilation'&&d.language==='en'),store=new W.Store(documents);
 store.left=documents.find(d=>d.meetingId==='inc-3').id;store.right=en.id;store.view='clean';store.scope='original';store.showEdits=false;store.edit(store.work().text+'\n用户自己的修订');const left=store.left,draft=store.work();
 const chosen=Language.select(store,'right','zh-CN');assert.equal(chosen.language,'zh-CN');assert.equal(store.left,left);assert.strictEqual(store.work(),draft);assert.equal(store.view,'clean');assert.equal(store.scope,'original');assert.equal(store.showEdits,false);
});
test('unpaired documents and coincidental conference membership never create a false translation button',()=>{
 const chair=documents.find(d=>d.meetingId==='inc-3');assert.equal(Language.counterpart(documents,chair.id,'zh-CN'),null);
 const fake={id:'local-cn',name:'中文导入',language:'zh-CN',meetingId:'inc-4',text:'用户文件'};assert.deepEqual(Language.variants([...documents,fake],fake),[]);
 const store=new W.Store(documents),snapshot=store.snapshot();assert.equal(Language.select(store,'invalid','en'),null);assert.equal(Language.select(store,'left','fr'),null);assert.equal(store.snapshot(),snapshot);
});
test('all 31 Chinese Aid articles have exact headings and language-independent article numbers',()=>{
 const zh=documents.find(d=>d.bilingualGroup==='aid-to-negotiations-2026'&&d.language==='zh-CN'),en=Language.counterpart(documents,zh.id,'en'),items=C.build(zh.text,zh),english=C.build(en.text,en);
 for(let number=1;number<=31;number++){const old=english.find(h=>Language.sectionKey(h)==='article:'+number),next=Language.equivalent(items,old);assert.ok(next,number);assert.equal(Language.sectionKey(next),'article:'+number);assert.ok(zh.text.slice(next.start,next.end).trim().length>2);}
 assert.ok(items.find(x=>x.parallelKey==='article:31').title.includes('第30条'));assert.equal(Language.sectionKey('第 10 条 财政资源'),'article:10');assert.equal(Language.sectionKey('第二编'),'part:2');
});
test('Chinese typography is compact without dropping content and original translation notices remain visible',()=>{
 for(const d of documents.filter(d=>d.language==='zh-CN')){const p=L.project(d.text,d);assert.equal(p.text.replace(/\s/g,''),d.text.replace(/\s/g,''));assert.equal(/[\p{Script=Han}] +[\p{Script=Han}]/u.test(p.text),false);assert.equal(L.edit(d.text,p,p.text).raw,d.text);}
 const d=documents.find(d=>d.translationStatus==='machine');assert.ok(d.translationNote.includes('机器翻译'));assert.ok(d.text.includes('机器翻译版本'));assert.ok(d.translationNote.includes('不含英文附件前置的主席说明'));
});
