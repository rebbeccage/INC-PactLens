const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../clauses.js'),R=require('../research.js'),L=require('../layout.js'),docs=require('../source-documents.js');
const source=(id,text,outline)=>({id,text,outline,language:'en'});
test('all catalog alternative titles are owned by a primary heading and never split a provision or lose content',()=>{
 let count=0;
 for(const d of docs){const headings=C.build(d.text,d),entries=R.structure(d).entries,projection=L.project(d.text,d);
  assert.ok(headings.every(h=>!C.isAlternativeTitle(h.title)));
  assert.ok(entries.every(h=>!C.isAlternativeTitle(h.title)));
  assert.equal(projection.text.replace(/\s/gu,''),d.text.replace(/\s/gu,''));
  for(const h of headings)for(const alt of h.alternativeTitles||[]){count++;assert.ok(alt.start>h.start);assert.equal(alt.title.replace(/\s/gu,''),d.text.slice(alt.start,alt.end).replace(/\s/gu,''));const primary=entries.find(a=>h.start>=a.start&&h.start<a.rangeEnd);assert.ok(primary);assert.ok(alt.end<=primary.rangeEnd);}
 }
 assert.ok(count>=35,'both languages and multiple alternate titles must be covered');
});
test('plastic polymers searches and the complete Option 0/1 text resolve to Primary plastic polymers',()=>{
 const d=docs.find(d=>d.bilingualGroup==='inc4-revised-zero'&&d.language==='en'),entries=R.structure(d).entries,primary=entries.find(a=>a.title==='1. Primary plastic polymers');
 assert.ok(primary.aliases.includes('Plastic polymers'));
 assert.ok(d.text.slice(primary.start,primary.rangeEnd).includes('Option 1'));
 assert.ok(R.search([d],'Plastic polymers').every(r=>!C.isAlternativeTitle(r.article.title)));
 assert.equal(C.filter(entries,'Plastic polymers').find(h=>h.articleId===primary.articleId).title,primary.title);
 const hits=R.search([d],'taking into consideration their respective capabilities');assert.ok(hits.some(h=>h.articleId===primary.articleId));
 const target=source('target','ARTICLE 8\nPLASTIC POLYMERS\nA different draft.');
 assert.equal(R.matchArticle(d,target,primary).items[0].number,'8');
});
test('numbered, bracketed, wrapped and Chinese alternate titles remain aliases after editing',()=>{
 for(const [title,alts] of [['PRIMARY POLYMERS',['[Alt title: Plastic\npolymers]','Alternative title 2: Resin materials']],['初级聚合物',['[备选标题：塑料\n聚合物]','备选标题 2：树脂材料']]]){
  const text='ARTICLE 1\n'+title+'\n\n'+alts.join('\n\n')+'\n\n1. Each Party shall cooperate.\n\nARTICLE 2\nFINANCE\n\nResources.';
  const d=source(title,text,C.build(text)),prefix='Research note 📝\n\n',items=R.structure(d,prefix+text).entries;
  assert.equal(items.length,2);assert.equal(items[0].aliases.length,2);assert.ok(items[0].start>=prefix.length);
  assert.ok(items[0].alternativeTitles.every(a=>a.start>items[0].start&&a.end<items[0].rangeEnd));
  assert.ok((prefix+text).slice(items[0].start,items[0].rangeEnd).includes('shall cooperate'));
 }
});
test('ambiguous aliases require confirmation and an orphan alternate title never becomes an article',()=>{
 const d=source('source','ARTICLE 1\nPRIMARY\n\nAlt title: Plastic polymers\n\nBody.'),a=R.structure(d).entries[0];
 const target=source('target','ARTICLE 2\nPLASTIC POLYMERS\n\nOne.\n\nARTICLE 3\nPLASTIC POLYMERS\n\nTwo.');
 assert.equal(R.matchArticle(d,target,a).status,'pending');
 assert.deepEqual(C.build('## Alt title: Orphan title\n\nText.'),[]);
});
