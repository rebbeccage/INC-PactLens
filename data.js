'use strict';
window.DocumentData=(()=>{
const intro='第一条　目标\n\n本公约的目标是保护人类健康和环境免受塑料污染的危害，包括海洋环境中的塑料污染。';
const end='\n\n第五条　国际合作\n\n缔约方应开展合作，交流信息、科学知识和最佳实践。\n\n第六条　实施与审查\n\n缔约方应定期提交实施进展报告。';
const demos=[{id:'demo-a',name:'方案 A · 全生命周期措施',note:'综合措施研究示例',demo:true,text:intro+'\n\n第二条　原则与方法\n\n各缔约方应当考虑各自的国情和能力，采用覆盖塑料全生命周期的综合方法。\n\n第三条　塑料产品\n\nEach Party shall take measures to eliminate [problematic and avoidable] plastic products by 2040.\n\n各缔约方应采取必要措施，逐步淘汰有问题和可避免的塑料产品的生产和使用。\n\n第四条　生产者责任延伸\n\n各缔约方应建立生产者责任延伸（EPR）制度，加强废物收集、回收和无害环境管理。'+end},{id:'demo-b',name:'方案 B · 基础条款',note:'基础义务研究示例',demo:true,text:intro+'\n\n第二条　原则与方法\n\n各缔约方在履行本公约义务时，应当考虑各自的国情和能力。\n\n第三条　塑料产品\n\nEach Party should take measures to reduce problematic plastic products by 2050.\n\n各缔约方应采取适当措施，减少有问题和可避免的塑料产品的生产和使用。\n\n第四条　生产者责任延伸\n\n各缔约方可考虑建立 extended producer responsibility 制度，加强废物收集和回收。'+end},{id:'demo-c',name:'方案 C · 替代措辞',note:'可选措辞研究示例',demo:true,text:intro+'\n\n第二条　原则与方法\n\n各缔约方应当遵循预防原则，并考虑各自的国情和能力。\n\n第三条　塑料产品\n\nEach Party shall take measures to reduce [avoidable] plastic products by 2045.\n\n各缔约方应制定适合本国情况的行动计划。\n\n第四条　生产者责任延伸\n\n各缔约方应促进生产者责任延伸（EPR），并鼓励产品重复使用。'+end}];
const sources=window.SourceDocuments||[];
const bySourceId=new Map(sources.map(d=>[d.id,d]));
function hydrate(saved){
 if(!saved?.docs)return saved;
 const drafts={...saved.drafts};
 return {...saved,drafts,docs:saved.docs.map(d=>{
  const original=bySourceId.get(d.id);
  if(original?.editorialRevision>(d.editorialRevision||0)&&drafts[d.id]){
   const draft=drafts[d.id],text=typeof draft==='string'?draft:draft.text;
   if(typeof text==='string')drafts[d.id]=typeof draft==='string'?Workbench.migrateDraft(original,text):{...draft,text:Workbench.migrateDraft(original,text)};
  }
  return original?{...d,...original}:d;
 })};
}
function load(){
 let saved,restoreNotice='';try{const raw=localStorage.getItem('plastic-workbench-v2')||localStorage.getItem('plastic-workbench-v1');if(raw)saved=hydrate(JSON.parse(raw));}catch{restoreNotice='存储读取失败，当前仅在会话内保存；可下载 TXT 备份。';}
 if(saved?.docs)saved.docs=saved.docs.map(d=>['a','b'].includes(d.id)&&/（演示）$/.test(d.name)?{...d,demo:true,note:'早期演示 · 已保留原件及研究稿'}:d);
 const seeds=sources.length?sources:demos;
 const store=new Workbench.Store(seeds,saved);
 for(const d of seeds)if(!store.doc(d.id))store.docs.push(Object.freeze({...d}));
 return {store,restoreNotice};
}
function persist(store){try{
 const snapshot=JSON.parse(store.snapshot());
 // Bundled originals are immutable and versioned by content hash. Store only their
 // metadata locally; full text is restored from the matching offline catalog.
 snapshot.docs=snapshot.docs.map(d=>{const original=bySourceId.get(d.id);if(!original||original.sourceSha256!==d.sourceSha256)return d;const {text,...metadata}=d;return metadata;});
 localStorage.setItem('plastic-workbench-v2',JSON.stringify(snapshot));return true;
 }catch{return false;}}
function library(store){return store.docs.filter(d=>!d.demo&&!/^本地研究样例\.(txt|md)$/i.test(d.name)).sort((a,b)=>Number(!a.bundledSource)-Number(!b.bundledSource));}
return {load,persist,demos,sources,library};
})();
