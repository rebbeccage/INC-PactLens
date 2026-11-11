(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./clauses.js'):root.ClauseNavigation;
const L=typeof module!=='undefined'?require('./layout.js'):root.DocumentLayout;
const W=typeof module!=='undefined'?require('./model.js'):root.Workbench;
const numbering=typeof module!=='undefined'?require('./source-numbering.js'):root.SourceNumbering||{};
const sourcePages=typeof module!=='undefined'?require('./source-pages.js'):root.SourcePages||{};
const vocabulary=typeof module!=='undefined'?require('./topics.js'):root.PactTopics,topics=vocabulary.topics;
const indexCache=new Map(),compareCache=new Map(),blockCache=new Map(),labelCache=new Map();
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(36)+':'+s.length;};
const flat=s=>s.normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
const titleKey=s=>flat(C.formatTitle(s)).replace(/^\[?(?:article\s+\d+|第\d+条|\d+[.、．])\s*[·.:：\]]*\s*/i,'').replace(/\[(?:footnote|脚注)\s*\d+\]/gi,'').replace(/[^\p{L}\p{N}]/gu,'');
function topicForTitle(title){const key=titleKey(title);return topics.find(t=>[t.zh,t.en,...t.terms.filter(x=>x.type==='synonym').map(x=>x.text)].some(s=>titleKey(s)===key));}
function structure(doc,text=doc.text){
 const key=doc.id+':'+hash(text);if(indexCache.has(key))return indexCache.get(key);
 const outline=C.build(text,doc),main=outline.filter(h=>/^\[?(?:ARTICLE\s+\d+|第\d+条)/i.test(h.title)||h.level===2&&!/^\[?(?:ARTICLE|第.+条)/i.test(h.context||''));
 const entries=main.map((h,i)=>({...h,articleId:doc.id+':'+h.id,rangeEnd:main[i+1]?.start??text.length,number:(h.title.match(/ARTICLE\s+(\d+)|第(\d+)条/i)||[]).slice(1).find(Boolean)||null,topicId:[h.title,...h.aliases||[]].map(topicForTitle).find(Boolean)?.topicId||null}));
 // Retain unstructured imports as a searchable, explicitly unnumbered section.
 if(!entries.length)entries.push({articleId:doc.id+':text',id:'text',title:'全文',start:0,end:0,rangeEnd:text.length,level:2,number:null});
 const result={document:doc,text,entries,searchRows:entries.map(a=>({article:a,normalized:normalize(text.slice(a.start,a.rangeEnd),true).text.toLowerCase()}))};
 indexCache.set(key,result);if(indexCache.size>40)indexCache.delete(indexCache.keys().next().value);return result;
}
function filterArticles(items,query){const q=C.formatTitle(query.normalize('NFKC').replace(/article\s*(\d+)/gi,'ARTICLE $1')),m=q.match(/^(?:ARTICLE\s*|第\s*)?(\d+)(?:条)?$/i);return m?items.filter(a=>Number(a.number)===Number(m[1])):C.filter(items,q);}
function expand(query){
 const q=flat(query),contains=text=>{const n=flat(text);return n===q||q.length>3&&n.length>=(/[\p{Script=Han}]/u.test(n)?2:5)&&q.includes(n);},found=topics.filter(t=>t.terms.some(x=>contains(x.text)));
 return {query:q,topics:found,terms:[{text:query,type:'direct',weight:100},...found.flatMap(t=>{const onlyRelated=!t.terms.some(x=>x.type==='synonym'&&contains(x.text));return t.terms.map(term=>({...term,type:onlyRelated?'related':term.type}));}),...(vocabulary.aliases||[]).filter(terms=>terms.some(contains)).flatMap(terms=>terms.map(text=>({text,type:'synonym',weight:1})))]};
}
function search(documents,query,{drafts={}}={}){
 if(!query.trim())return [];const expanded=expand(query),number=query.match(/^(?:article\s*|第\s*)([\d一二三四五六七八九十]+)(?:\s*条)?$/i),wanted=number?C.numberValue(number[1]):null,results=[];
 for(const doc of documents){for(const variant of [{scope:'original',text:doc.text},...(typeof drafts[doc.id]==='string'&&drafts[doc.id]!==doc.text?[{scope:'draft',text:drafts[doc.id]}]:[])]){
  const idx=structure(doc,variant.text);
  for(const row of idx.searchRows){let best=null;
   if(wanted!==null&&Number(row.article.number)===wanted)best={type:'direct',weight:3,text:row.article.title,offset:0};
   for(const term of expanded.terms){const n=flat(term.text);if(!n)continue;let offset=row.normalized.indexOf(n);if(offset<0)continue;const score=term.weight+(flat(row.article.title).includes(n)?2:0)+(row.article.topicId&&expanded.topics.some(t=>t.topicId===row.article.topicId)?3:0);if(!best||score>best.weight)best={...term,weight:score,offset};}
   if(!best)continue;
   const range=normalize(variant.text.slice(row.article.start,row.article.rangeEnd),true),at=Math.max(0,best.offset),start=range.starts[Math.max(0,at-45)]??0,end=range.ends[Math.min(range.ends.length-1,at+110)]??range.ends.at(-1)??0;
   results.push({documentId:doc.id,articleId:row.article.articleId,article:row.article,scope:variant.scope,type:best.type,term:best.text,score:best.weight,snippet:variant.text.slice(row.article.start+start,row.article.start+end).replace(/\s+/g,' '),publishedDate:doc.publishedDate||null,publishedTime:doc.publishedTime||null,language:doc.language});
  }
 }}return results.sort((a,b)=>b.score-a.score||String(b.publishedDate||'').localeCompare(a.publishedDate||''));
}
const mapKey=(a,b,id)=>a.id+'@'+(a.textSha256||hash(a.text))+'>'+b.id+'@'+(b.textSha256||hash(b.text))+':'+id;
function matchArticle(source,target,article,manual={},options={}){
 const entries=structure(target,options.targetText??target.text).entries,saved=manual[mapKey(source,target,article.articleId)];
 if(Array.isArray(saved)){if(!saved.length)return {status:'missing',items:[],reason:'用户确认无对应条款'};const items=entries.filter(x=>saved.includes(x.articleId));if(items.length===saved.length)return {status:'confirmed',items,reason:'用户确认的对应关系'};}
 let candidates=entries.filter(x=>titleKey(x.title)===titleKey(article.title)&&titleKey(article.title));
 if(candidates.length===1)return {status:'confirmed',items:candidates,reason:'条款标题一致；非单凭编号匹配'};
 const sourceTitles=new Set([article.title,...article.aliases||[]].map(titleKey).filter(Boolean));
 candidates=entries.filter(x=>[x.title,...x.aliases||[]].some(t=>sourceTitles.has(titleKey(t))));
 if(candidates.length===1)return {status:'confirmed',items:candidates,reason:'条款标题或备选标题一致'};
 const isScope=a=>/^(?:placeholder)?scope$|^(?:适用)?范围(?:占位符|占位说明)?$/.test(titleKey(a.title));
 if(isScope(article)&&['inc52-chair','aid-to-negotiations-2026'].includes(target.bilingualGroup)&&(options.targetText??target.text)===target.text&&!entries.some(isScope))return {status:'missing',items:[],reason:'该版本无 Scope 条款'};
 // Reviewed topic links: the 2025 Chair and 2026 Aid share this article's title and subject.
 const reviewed=new Set(['inc52-chair','aid-to-negotiations-2026']);
 if(reviewed.has(source.bilingualGroup)&&reviewed.has(target.bilingualGroup)&&article.topicId){candidates=entries.filter(x=>x.topicId===article.topicId);if(candidates.length===1)return {status:'confirmed',items:candidates,reason:'已核对的主席案文／辅助文件主题对应'};}
 const words=s=>new Set(flat(s).match(/[a-z]{3,}|[\p{Script=Han}]{2}/gu)||[]),a=words((options.sourceText??source.text).slice(article.start,article.rangeEnd));
 const scored=entries.map(x=>{const b=words((options.targetText??target.text).slice(x.start,x.rangeEnd));let common=0;for(const w of a)if(b.has(w))common++;return {item:x,score:common/Math.max(1,a.size+b.size-common)};}).sort((a,b)=>b.score-a.score);
 return {status:'pending',items:[],candidates:scored.slice(0,4),reason:'对应条款待确认'};
}
function normalize(raw,ignore=true,peer=''){
 const starts=[],ends=[],out=[],uncertain=[];let i=0;
 while(i<raw.length){let m;
  if(ignore&&(m=raw.slice(i).match(/^(exis\s+ting|i\s+dentified|paragraph\s+s)\b/))&&peer.includes(m[0].replace(/\s/g,''))){for(let j=0;j<m[0].length;j++)if(!/\s/.test(m[0][j])){out.push(m[0][j]);starts.push(i+j);ends.push(i+j+1);}i+=m[0].length;continue;}
  if(ignore&&(!i||!/[A-Za-z]/.test(raw[i-1]))&&(m=raw.slice(i).match(/^([A-Za-z]{2,})-\r?\n[ \t]*([a-z]{2,})/))){const joined=m[1]+m[2],safe=new RegExp('\\b'+joined+'\\b','i').test(peer)&&!new RegExp('\\b'+m[1]+'-'+m[2]+'\\b','i').test(peer);if(safe){for(let j=0;j<m[1].length;j++){out.push(raw[i+j]);starts.push(i+j);ends.push(i+j+1);}const second=m[0].length-m[2].length;for(let j=0;j<m[2].length;j++){out.push(raw[i+second+j]);starts.push(i+second+j);ends.push(i+second+j+1);}i+=m[0].length;continue;}uncertain.push({start:i,end:i+m[0].length});}
  if(ignore&&/\s/u.test(raw[i])){let end=i+1;while(end<raw.length&&/\s/u.test(raw[end]))end++;const prev=out.at(-1),next=raw[end],han=/\p{Script=Han}/u,mark=/[\[\]()，。；：！？、,.;:]/u;if(prev&&next&&!(han.test(prev)&&han.test(next))&&!mark.test(prev)&&!mark.test(next)){out.push(' ');starts.push(i);ends.push(end);}i=end;continue;}
  out.push(raw[i]);starts.push(i);ends.push(i+1);i++;
 }return {text:out.join(''),starts,ends,uncertain};
}
function listLabels(source,text=source.text){
 if(numbering.__hashes?.[source.id]&&numbering.__hashes[source.id]!==source.textSha256)return [];
 if(text===source.text)return numbering[source.id]||[];const key=source.id+':'+hash(text);if(labelCache.has(key))return labelCache.get(key);const labels=numbering[source.id]||[],out=[];if(labels.length){let old=0,next=0;for(const s of W.diff(source.text,text).segments){if(s.type==='equal'){for(const label of labels)if(label.start>=old&&label.start<old+s.text.length)out.push({...label,start:next+label.start-old});old+=s.text.length;next+=s.text.length;}else if(s.type==='delete')old+=s.text.length;else next+=s.text.length;}}labelCache.set(key,out);if(labelCache.size>15)labelCache.delete(labelCache.keys().next().value);return out;
}
// Only the comparison projection omits structural labels. Originals, display,
// evidence coordinates and the user's own edit history retain every character.
function structuralLabels(text,source){
 const removed=[],ordinal='[0-9０-９一二三四五六七八九十百零〇壹贰叁肆伍陆柒捌玖拾佰IVXLCDMⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+',heading=new RegExp('^(?:ARTICLE\\s*'+ordinal+'(?:[a-z]|\\s+(?:bis|ter))?\\b|第\\s*'+ordinal+'\\s*条(?:之\\s*'+ordinal+')?)','i');
 for(const block of L.project(text,source).blocks){
  const raw=text.slice(block.rawStart,block.rawEnd),bracket=raw[0]==='['?1:0,h=raw.slice(bracket).match(heading);
  if(h){const tail=raw.slice(bracket+h[0].length),firstLine=tail.split('\n')[0].trim(),styled=text===source.text&&source.outline?.some(x=>x.start===block.rawStart),sentence=/\b(?:shall|should|must|may|applies|apply|refers|requires|provides|sets|is|are)\b|所指|所列|所述|规定|根据|适用于|项下|提及|要求|涉及|第\s*\d+条/i.test(firstLine)||/[。；;.!?]$/.test(firstLine);
   if(styled||!firstLine||block.heading&&!sentence){removed.push({start:block.rawStart+bracket,end:block.rawStart+bracket+h[0].length,kind:'heading-label'});continue;}
  }
  // A decimal quantity or a four-digit year is never treated as a list label.
  // Square brackets are deliberately outside this pattern: they remain material.
  const p=raw.match(/^(?:\d{1,3}(?:\.\d{1,3})*[.)、．](?!\d)|\((?:\d{1,3}|[a-z]|[ivxlcdm]{1,5})\)|[a-z][.)])[ \t]*(?=\S)/);
  if(p&&raw.slice(p[0].length).trim())removed.push({start:block.rawStart,end:block.rawStart+p[0].length,kind:'paragraph-label'});
 }
 // Only page labels verified against the physical PDF page can be omitted.
 if(text===source.text&&sourcePages.__hashes?.[source.id]===source.textSha256){for(const page of sourcePages[source.id]||[]){const lines=[...text.slice(page.start,page.end).matchAll(/[^\n]+/g)].filter(m=>m[0].trim());for(const line of [lines[0],lines.at(-1)])if(line&&/^\s*\d{1,3}\s*$/.test(line[0])&&Number(line[0])===page.page)removed.push({start:page.start+line.index,end:page.start+line.index+line[0].length,kind:'page-label'});}}
 removed.sort((a,b)=>a.start-b.start||b.end-a.end);const merged=[];for(const r of removed){const last=merged.at(-1);if(last&&r.start<=last.end)last.end=Math.max(last.end,r.end);else merged.push({...r});}return merged;
}
function remainingRanges(ranges,omitted){const result=[];for(const range of ranges){let start=range.start;for(const r of omitted){if(r.end<=start||r.start>=range.end)continue;if(r.start>start)result.push({start,end:Math.min(r.start,range.end)});start=Math.max(start,r.end);}if(start<range.end)result.push({start,end:range.end});}return result;}
function projectRanges(text,ranges,ignore,peer,source,ignoreNumbering){
 const omitted=ignoreNumbering?structuralLabels(text,source):[],out={text:'',starts:[],ends:[],uncertain:[],visibleRanges:remainingRanges(ranges,omitted)};
 for(const r of ranges){let value='',positions=[];for(const span of remainingRanges([r],omitted)){value+=text.slice(span.start,span.end);for(let i=span.start;i<span.end;i++)positions.push(i);}
  const p=normalize(value,ignore,peer);p.starts=p.starts.map(n=>positions[n]??r.end);p.ends=p.ends.map(n=>positions[n-1]===undefined?r.end:positions[n-1]+1);p.uncertain=p.uncertain.map(x=>({start:positions[x.start],end:(positions[x.end-1]??r.end-1)+1}));
  if(!ignoreNumbering){for(const label of [...listLabels(source,text)].reverse()){if(label.start<r.start||label.start>=r.end)continue;let at=p.starts.findIndex(n=>n>=label.start);if(at<0)continue;const prefix=normalize(label.label,ignore).text;if(ignore&&/[\[\]()，。；：！？、,.;:]/.test(prefix[0])&&p.text[at-1]===' '){p.text=p.text.slice(0,at-1)+p.text.slice(at);p.starts.splice(at-1,1);p.ends.splice(at-1,1);at--;}p.text=p.text.slice(0,at)+prefix+p.text.slice(at);p.starts.splice(at,0,...Array(prefix.length).fill(label.start));p.ends.splice(at,0,...Array(prefix.length).fill(label.start));}}
  if(out.text){out.text+='\n';out.starts.push(r.start);out.ends.push(r.start);}out.text+=p.text;for(const n of p.starts)out.starts.push(n);for(const n of p.ends)out.ends.push(n);out.uncertain.push(...p.uncertain);
 }return out;
}
function compare(left,right,{leftText=left.text,rightText=right.text,leftRanges=[{start:0,end:leftText.length}],rightRanges=[{start:0,end:rightText.length}],ignoreFormatting=true,ignoreNumbering=true}={}){
 const key=['three-kinds-1',left.id,right.id,hash(leftText),hash(rightText),JSON.stringify(leftRanges),JSON.stringify(rightRanges),ignoreFormatting,ignoreNumbering].join('|');if(compareCache.has(key))return compareCache.get(key);
 const a=projectRanges(rightText,rightRanges,ignoreFormatting,leftText,right,ignoreNumbering),b=projectRanges(leftText,leftRanges,ignoreFormatting,rightText,left,ignoreNumbering),result=W.diff(a.text,b.text),leftAnnotations=[],rightAnnotations=[],groups=[];let x=0,y=0;
 const add=(list,p,start,end,type,change,ranges)=>{const from=p.starts[start]??p.ends.at(-1)??0,to=p.ends[end-1]??from;for(const r of ranges){const s=Math.max(from,r.start),e=Math.min(to,r.end);if(e>s)list.push({start:s,end:e,type,change});}};
 for(const s of result.segments){if(s.type==='equal'){x+=s.text.length;y+=s.text.length;continue;}if(!groups[s.change])groups[s.change]={change:s.change,leftAnchor:b.ends[y-1]??b.starts[y]??0,rightAnchor:a.ends[x-1]??a.starts[x]??0,leftStart:b.starts[y]??b.ends.at(-1)??0,rightStart:a.starts[x]??a.ends.at(-1)??0,leftEnd:b.starts[y]??b.ends.at(-1)??0,rightEnd:a.starts[x]??a.ends.at(-1)??0,inserted:'',deleted:''};const g=groups[s.change];if(s.type==='insert'){add(leftAnnotations,b,y,y+s.text.length,'insert',s.change,b.visibleRanges);g.inserted+=s.text;g.leftEnd=b.ends[y+s.text.length-1]??g.leftStart;y+=s.text.length;}else{add(rightAnnotations,a,x,x+s.text.length,'delete',s.change,a.visibleRanges);g.deleted+=s.text;g.rightEnd=a.ends[x+s.text.length-1]??g.rightStart;x+=s.text.length;}}
 for(const g of groups){if(!g.inserted)g.leftStart=g.leftEnd=Math.max(0,g.leftAnchor-1);if(!g.deleted)g.rightStart=g.rightEnd=Math.max(0,g.rightAnchor-1);}
 const output={count:result.count,degraded:result.degraded,leftAnnotations,rightAnnotations,groups,uncertain:[...a.uncertain.map(x=>({...x,side:'right'})),...b.uncertain.map(x=>({...x,side:'left'}))]};compareCache.set(key,output);if(compareCache.size>30)compareCache.delete(compareCache.keys().next().value);return output;
}
function paragraph(text,at,source){
 const key=source.id+':'+hash(text);let blocks=blockCache.get(key);
 if(!blocks){
  const projected=L.project(text,source).blocks,sections=structure(source,text).entries;
  blocks=projected.map(block=>{const article=sections.find(a=>block.rawStart>=a.start&&block.rawStart<a.rangeEnd);if(!article)return block;
   const explicit=[...text.slice(article.end,article.rangeEnd).matchAll(/^[ \t]*(\d{1,3})[.．](?!\d)[ \t]*/gm)].map(m=>({start:article.end+m.index+m[0].length-m[0].trimStart().length,number:m[1]}));
   const automatic=listLabels(source,text).filter(x=>x.format==='decimal'&&x.start>=article.end&&x.start<article.rangeEnd).map(x=>({start:x.start,number:x.label.match(/\d+/)?.[0]}));
   const items=[...explicit,...automatic].sort((a,b)=>a.start-b.start),current=items.filter(x=>x.start<=block.rawStart).at(-1);if(!current)return block;const next=items.find(x=>x.start>current.start),end=next?.start||article.rangeEnd;
   return {rawStart:current.start,rawEnd:end,text:text.slice(current.start,end),paragraphNumber:current.number};
  });
  blockCache.set(key,blocks);if(blockCache.size>12)blockCache.delete(blockCache.keys().next().value);
 }
 return blocks.find(x=>at>=x.rawStart&&at<x.rawEnd)||blocks.find(x=>x.rawStart>=at)||blocks.at(-1)||{rawStart:0,rawEnd:0,text:''};
}
function pageAt(doc,start,end,pages){if(pages?.__hashes?.[doc.id]&&pages.__hashes[doc.id]!==doc.textSha256)return null;const ranges=pages?.[doc.id];if(!ranges)return null;const first=ranges.find(p=>start>=p.start&&start<p.end),last=ranges.find(p=>Math.max(start,end-1)>=p.start&&Math.max(start,end-1)<p.end);return first&&last?{start:first.page,end:last.page}:null;}
const withoutNoteTags=s=>s.replace(/\[(?:Footnote|Endnote|脚注|尾注)\s*\d+\]/gi,'');
const changeKinds=[{id:'delete',label:'删除'},{id:'insert',label:'新增'},{id:'replace',label:'表述替换'}];
const payload=s=>withoutNoteTags(s).replace(/\s+/g,' ').trim();
function quotedBrief(text,limit=24){const s=payload(text),chars=Array.from(s);return '“'+(chars.length>limit?chars.slice(0,limit).join('')+'…':s)+'”';}
function classifyChange(inserted,deleted){const a=payload(inserted),b=payload(deleted);return a&&b?'replace':a?'insert':b?'delete':null;}
function changeDescription(kind,groups){
 const label=changeKinds.find(k=>k.id===kind).label;
 if(kind==='replace'){
  const pairs=[...new Set(groups.map(g=>quotedBrief(g.deleted,20)+' → '+quotedBrief(g.inserted,20)))];
  return label+pairs[0]+(pairs.length>1?'等'+pairs.length+'处':'');
 }
 const values=groups.map(g=>payload(kind==='insert'?g.inserted:g.deleted)),symbols=new Set(values.join('').match(/[\[\]]/g)||[]);
 const words=[...new Set(values.map(s=>s.replace(/\]\[/g,'] [').replace(/[\[\]]/g,'').trim()).filter(Boolean))];
 const bracket=symbols.size?'方括号'+(words.length?'':quotedBrief(['[',']'].filter(s=>symbols.has(s)).join(' '))):'';
 return label+words.slice(0,2).map(s=>quotedBrief(s,22)).join('、')+(words.length>2?'等':'')+(words.length&&bracket?'及':'')+bracket;
}
function summaries(result,left,right,{leftText=left.text,rightText=right.text,leftArticle=null,leftArticles=[],rightArticles=[],pages={}}={}){
 // One diff group can contain a paragraph's closing bracket followed by the
 // next paragraph's opening bracket. Preserve their two distinct evidence anchors.
 const events=[];
 const startOf=(text,p,at)=>!text.slice(p.rawStart,at).replace(/^[ \t]*(?:\d{1,3}[.)、．]|\([a-z\d]+\))[ \t]*/,'').trim();
 const nextText=(text,at)=>at+(text.slice(at).match(/^\s*/)?.[0].length||0);
 for(const g of result.groups||[]){const l=paragraph(leftText,g.leftStart,left),r=paragraph(rightText,g.rightStart,right);if(g.inserted&&g.deleted&&/^[\[\]\s]+$/.test(g.inserted+g.deleted)&&l.paragraphNumber!==r.paragraphNumber){
  if(startOf(leftText,l,g.leftStart)&&!rightText.slice(g.rightEnd,r.rawEnd).trim()){
   events.push({...g,inserted:'',leftStart:Math.max(0,g.leftAnchor-1),leftEnd:Math.max(0,g.leftAnchor-1)},{...g,deleted:'',rightStart:nextText(rightText,g.rightEnd),rightEnd:nextText(rightText,g.rightEnd)});continue;
  }
  if(startOf(rightText,r,g.rightStart)&&!leftText.slice(g.leftEnd,l.rawEnd).trim()){
   events.push({...g,deleted:'',rightStart:Math.max(0,g.rightAnchor-1),rightEnd:Math.max(0,g.rightAnchor-1)},{...g,inserted:'',leftStart:nextText(leftText,g.leftEnd),leftEnd:nextText(leftText,g.leftEnd)});continue;
  }
 }events.push(g);}
 // Join nearby Chinese edits into readable phrases, within the same paragraph.
 // Shared words are context only; original annotations and edit history stay intact.
 const joined=[],span=(g,side)=>({start:g[side==='left'?'inserted':'deleted']?g[side+'Start']:g[side+'Anchor'],end:g[side==='left'?'inserted':'deleted']?g[side+'End']:g[side+'Anchor']});
 for(const event of events){if(!classifyChange(event.inserted,event.deleted))continue;const g={...event,changes:[event.change]},last=joined.at(-1);
  if(last&&/\p{Script=Han}/u.test(last.inserted+last.deleted)&&/\p{Script=Han}/u.test(g.inserted+g.deleted)){
   const gaps=[],ranges=[];let safe=true;
   for(const [side,text,doc]of [['left',leftText,left],['right',rightText,right]]){const a=span(last,side),b=span(g,side),p=paragraph(text,a.start,doc),q=paragraph(text,b.start,doc),gap=normalize(text.slice(a.end,b.start),true).text.trim();if(b.start<a.end||p.rawStart!==q.rawStart||Array.from(gap).length>3||/[.!?;:，。；：！？()[\]]/.test(gap)||Array.from(normalize(text.slice(a.start,b.end),true).text).length>28)safe=false;gaps.push(gap);ranges.push({start:a.start,end:b.end});}
   if(safe&&gaps[0]===gaps[1]){last.inserted=normalize(leftText.slice(ranges[0].start,ranges[0].end),true,rightText).text;last.deleted=normalize(rightText.slice(ranges[1].start,ranges[1].end),true,leftText).text;for(const [i,side]of ['left','right'].entries()){last[side+'Start']=ranges[i].start;last[side+'End']=ranges[i].end;}last.changes.push(...g.changes);continue;}
  }
  joined.push(g);
 }
 const buckets=new Map();for(const g of joined){let l=paragraph(leftText,g.leftStart,left),r=paragraph(rightText,g.rightStart,right);
  const alignEmpty=(doc,text,at,reference,current)=>{if(!reference.paragraphNumber||current.paragraphNumber===reference.paragraphNumber)return current;const clause=structure(doc,text).entries.find(a=>at>=a.start&&at<a.rangeEnd),blocks=blockCache.get(doc.id+':'+hash(text))||[];const plain=s=>s.replace(/^[ \t]*\d+[.．]/,'').replace(/\[(?:Footnote|Endnote|脚注|尾注)\s*\d+\]/gi,'').replace(/[^\p{L}]/gu,'').toLowerCase();const wanted=plain(reference.text);return blocks.find(b=>b.paragraphNumber===reference.paragraphNumber&&clause&&b.rawStart>=clause.start&&b.rawEnd<=clause.rangeEnd&&(wanted.slice(0,70)===plain(b.text).slice(0,70)||/\p{Script=Han}/u.test(wanted)&&wanted.slice(0,6)===plain(b.text).slice(0,6)))||current;};
  if(!payload(g.inserted))l=alignEmpty(left,leftText,g.leftStart,r,l);if(!payload(g.deleted))r=alignEmpty(right,rightText,g.rightStart,l,r);
  const kind=classifyChange(g.inserted,g.deleted);if(!kind)continue;const key=l.rawStart+':'+r.rawStart+':'+kind;if(!buckets.has(key))buckets.set(key,{l,r,kind,groups:[]});buckets.get(key).groups.push(g);
 }
 const evidence=[],pair=hash(left.id+'|'+right.id+'|'+hash(leftText)+'|'+hash(rightText)).replace(':','-');
 for(const {l,r,kind,groups}of buckets.values()){
  function ref(doc,text,block,side){const relevant=groups.filter(g=>payload(g[side==='left'?'inserted':'deleted'])),start=Math.min(block.rawStart,...relevant.map(g=>g[side+'Start'])),end=Math.max(block.rawEnd,...relevant.map(g=>g[side+'End']));return {start,end,text:text.slice(start,end),paragraphId:'text:'+block.rawStart,paragraphNumber:block.paragraphNumber||block.text.match(/^\s*(\d{1,3})[.．](?!\d)/)?.[1]||null,page:text===doc.text?pageAt(doc,start,end,pages):null};}
  const le=ref(left,leftText,l,'left'),re=ref(right,rightText,r,'right'),leftResolved=leftArticles.find(a=>le.start>=a.start&&le.start<a.rangeEnd)||leftArticle,rightArticle=rightArticles.find(a=>re.start>=a.start&&re.start<a.rangeEnd)||rightArticles[0],label=changeKinds.find(k=>k.id===kind).label;
  evidence.push({evidenceId:'ev-'+pair+'-'+l.rawStart+'-'+r.rawStart+'-'+kind,kind,leftDocumentId:left.id,rightDocumentId:right.id,leftArticleId:leftResolved?.articleId||null,rightArticleId:rightArticle?.articleId||null,leftParagraphId:le.paragraphId,rightParagraphId:re.paragraphId,leftText:le.text,rightText:re.text,leftPage:le.page,rightPage:re.page,leftLocation:le,rightLocation:re,changeType:[label],description:changeDescription(kind,groups),operations:groups.map(g=>({inserted:payload(g.inserted),deleted:payload(g.deleted),changes:g.changes})),verificationStatus:le.page&&re.page?'page-mapped':'text-verified-pages-incomplete',changes:[...new Set(groups.flatMap(g=>g.changes))]});
 }
 return evidence.sort((a,b)=>changeKinds.findIndex(k=>k.id===a.kind)-changeKinds.findIndex(k=>k.id===b.kind)||Number(b.operations.some(op=>/[\p{L}\p{N}]/u.test(op.inserted+op.deleted)))-Number(a.operations.some(op=>/[\p{L}\p{N}]/u.test(op.inserted+op.deleted)))||a.leftLocation.start-b.leftLocation.start||a.rightLocation.start-b.rightLocation.start);
}
const api={changeKinds,classifyChange,structuralLabels,filterArticles,listLabels,hash,structure,search,expand,matchArticle,mapKey,normalize,compare,summaries,pageAt,titleKey,topicForTitle};if(typeof module!=='undefined')module.exports=api;root.PactResearch=api;
})(typeof window==='undefined'?globalThis:window);
