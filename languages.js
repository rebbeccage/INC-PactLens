(function(root){
'use strict';
const supported=new Set(['en','zh-CN']);
const ready=d=>d?.textReady!==false&&typeof d?.text==='string';
function variants(docs,doc){return doc?.bilingualGroup?docs.filter(d=>d.bilingualGroup===doc.bilingualGroup&&supported.has(d.language)&&ready(d)).sort((a,b)=>a.language.localeCompare(b.language)):[];}
function counterpart(docs,id,language){const original=docs.find(d=>d.id===id);if(!supported.has(language))return null;return variants(docs,original).find(d=>d.language===language)||null;}
function syncReference(store,language=store.docs.find(d=>d.id===store.left)?.language){const next=counterpart(store.docs,store.right,language);if(next)store.right=next.id;return next;}
function select(store,side,language){if(!['left','right'].includes(side))return null;const next=counterpart(store.docs,store[side],language);if(!next)return null;store[side]=next.id;if(side==='left')syncReference(store,language);return next;}
function versionOptions(docs,{side='left',leftId,meetings=[]}={}){
 const language=docs.find(d=>d.id===leftId)?.language,order=new Map(meetings.map((m,i)=>[m.id,i]));
 return docs.filter(d=>ready(d)&&(side!=='right'||!supported.has(language)||!supported.has(d.language)||d.language===language)).sort((a,b)=>(order.get(a.meetingId)??Infinity)-(order.get(b.meetingId)??Infinity)||String(a.meetingId||'').localeCompare(String(b.meetingId||''))||String(a.publishedDate||'9999').localeCompare(String(b.publishedDate||'9999'))||String(a.bilingualGroup||a.shortTitle||a.name||'').localeCompare(String(b.bilingualGroup||b.shortTitle||b.name||''))||String(a.language||'').localeCompare(String(b.language||'')));
}
function versionLabel(d){return [(d.meetingId||'本地').replace(/^inc-/,'INC-').replace(/(INC-\d+)-(\d+)$/,'$1.$2'),d.shortTitle||d.name,d.language==='zh-CN'?'中文':''].filter(Boolean).join(' · ');}
function numeral(value){
 if(/^\d+$/.test(value))return Number(value);
 const digits={'零':0,'〇':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
 if(value==='十')return 10;if(value.includes('十')){const [a,b]=value.split('十');return (a?digits[a]:1)*10+(b?digits[b]:0);}return digits[value]??null;
}
function sectionKey(item){
 if(item&&typeof item==='object'&&item.parallelKey)return item.parallelKey;
 const title=typeof item==='string'?item:item?.title||'';
 let m=title.match(/^\[?ARTICLE\s+(\d+)\b/i);if(m)return 'article:'+Number(m[1]);
 m=title.match(/^\[?第\s*([一二三四五六七八九十百零〇\d]+)\s*条/);if(m)return 'article:'+numeral(m[1]);
 m=title.match(/^Part\s+(\d+|[IVX]+)\b/i);if(m)return 'part:'+(/^\d+$/.test(m[1])?Number(m[1]):({'I':1,'II':2,'III':3,'IV':4,'V':5,'VI':6}[m[1].toUpperCase()]||m[1]));
 m=title.match(/^第([一二三四五六七八九十\d]+)(?:编|部分|部)/);return m?'part:'+numeral(m[1]):null;
}
function equivalent(items,oldItem){const key=sectionKey(oldItem);return key?items.find(item=>sectionKey(item)===key)||null:null;}
const label=language=>language==='zh-CN'?'中文':language==='en'?'English':'';
const api={variants,counterpart,syncReference,select,versionOptions,versionLabel,numeral,sectionKey,equivalent,label};if(typeof module!=='undefined')module.exports=api;root.DocumentLanguage=api;
})(typeof window==='undefined'?globalThis:window);
