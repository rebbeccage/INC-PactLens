(function(root){
'use strict';
// All projections derive from immutable originals and a complete final-text model.
function diff(oldText,newText,limit=1800000){
 const tokenize=text=>text.match(/[A-Za-z]+|[0-9]+|[\s\S]/gu)||[],a=tokenize(oldText),b=tokenize(newText),out=[];let degraded=false;
 const push=(type,text)=>{if(!text)return;if(out.at(-1)?.type===type)out.at(-1).text+=text;else out.push({type,text});};
 const tokens=new Map();let nextId=1;const ids=list=>Uint32Array.from(list,t=>{if(!tokens.has(t))tokens.set(t,nextId++);return tokens.get(t);}),ai=ids(a),bi=ids(b);
 function windows(values,start,end,width){
  const map=new Map(),base=16777619;let power=1,hash=0;
  for(let n=1;n<width;n++)power=Math.imul(power,base)>>>0;
  for(let n=start;n<start+width;n++)hash=(Math.imul(hash,base)+values[n])>>>0;
  for(let n=start;n<=end-width;n++){
   map.set(hash,map.has(hash)?-1:n);
   if(n<end-width)hash=(Math.imul((hash-Math.imul(values[n],power))>>>0,base)+values[n+width])>>>0;
  }
  return map;
 }
 function anchors(a0,a1,b0,b1){
  for(const width of [16,8,4]){
   if(Math.min(a1-a0,b1-b0)<width)continue;
   const x=windows(ai,a0,a1,width),y=windows(bi,b0,b1,width),candidates=[];
   for(const [hash,i]of x){const j=y.get(hash);if(i<0||j===undefined||j<0)continue;let same=true,letters=false;for(let k=0;k<width;k++){if(a[i+k]!==b[j+k]){same=false;break;}letters||=/[\p{L}\p{N}]/u.test(a[i+k]);}if(same&&letters)candidates.push({a:i,b:j,length:width});}
   if(!candidates.length)continue;
   candidates.sort((x,y)=>x.a-y.a);const tails=[],parents=new Int32Array(candidates.length).fill(-1);
   for(let n=0;n<candidates.length;n++){let lo=0,hi=tails.length;while(lo<hi){const mid=(lo+hi)>>1;if(candidates[tails[mid]].b<candidates[n].b)lo=mid+1;else hi=mid;}if(lo)parents[n]=tails[lo-1];tails[lo]=n;}
   const chain=[];for(let n=tails.at(-1);n>=0;n=parents[n])chain.push(candidates[n]);chain.reverse();
   const runs=[];for(const item of chain){const last=runs.at(-1);if(last&&item.a<=last.a+last.length&&item.b-item.a===last.b-last.a)last.length=Math.max(last.length,item.a+width-last.a);else if(!last||item.a>=last.a+last.length&&item.b>=last.b+last.length)runs.push({...item});}
   if(runs.length)return runs;
  }
  return [];
 }
 function walk(a0,a1,b0,b1,depth=0){
  const prefix=a0;while(a0<a1&&b0<b1&&a[a0]===b[b0]){a0++;b0++;}push('equal',a.slice(prefix,a0).join(''));
  let suffix=0;while(a0<a1-suffix&&b0<b1-suffix&&a[a1-1-suffix]===b[b1-1-suffix])suffix++;
  const end=a1;a1-=suffix;b1-=suffix;const nx=a1-a0,ny=b1-b0;
  if(!nx)push('insert',b.slice(b0,b1).join(''));
  else if(!ny)push('delete',a.slice(a0,a1).join(''));
  else if(nx*ny<=limit){
   const stride=ny+1,dp=new Uint32Array((nx+1)*stride);
   for(let i=nx-1;i>=0;i--)for(let j=ny-1;j>=0;j--)dp[i*stride+j]=a[a0+i]===b[b0+j]?dp[(i+1)*stride+j+1]+1:Math.max(dp[(i+1)*stride+j],dp[i*stride+j+1]);
   let i=0,j=0;while(i<nx||j<ny){if(i<nx&&j<ny&&a[a0+i]===b[b0+j]){push('equal',a[a0+i++]);j++;}else if(j<ny&&(i===nx||dp[i*stride+j+1]>dp[(i+1)*stride+j]))push('insert',b[b0+j++]);else push('delete',a[a0+i++]);}
  }else{
   const runs=depth<24?anchors(a0,a1,b0,b1):[];
   if(runs.length){let x=a0,y=b0;for(const run of runs){walk(x,run.a,y,run.b,depth+1);push('equal',a.slice(run.a,run.a+run.length).join(''));x=run.a+run.length;y=run.b+run.length;}walk(x,a1,y,b1,depth+1);}
   else{degraded=true;push('delete',a.slice(a0,a1).join(''));push('insert',b.slice(b0,b1).join(''));}
  }
  push('equal',suffix?a.slice(a1,end).join(''):'');
 }
 walk(0,a.length,0,b.length);
 let group=-1,changed=false;for(const seg of out){if(seg.type==='equal')changed=false;else{if(!changed)group++;changed=true;seg.change=group;}}return {segments:out,count:group+1,degraded};
}
function uncorrected(source){let text=source.text;for(const patch of [...(source.editorialCorrections||[])].reverse())text=text.slice(0,patch.updatedStart)+patch.before+text.slice(patch.updatedStart+patch.after.length);return text;}
function migrateDraft(source,text){
 const before=uncorrected(source);if(text===before)return source.text;if(!source.editorialCorrections?.length)return text;
 const result=diff(before,text),edits=[];let old=0,next=0;
 for(const segment of result.segments){if(segment.type==='equal'){for(const p of source.editorialCorrections)if(p.start>=old&&p.start+p.before.length<=old+segment.text.length)edits.push({start:next+p.start-old,before:p.before,after:p.after});old+=segment.text.length;next+=segment.text.length;}else if(segment.type==='delete')old+=segment.text.length;else next+=segment.text.length;}
 for(const patch of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,patch.start)+patch.after+text.slice(patch.start+patch.before.length);
 return text;
}
const finalText=result=>result.segments.filter(x=>x.type!=='delete').map(x=>x.text).join('');
class Store{
 constructor(docs,saved){this.docs=docs.map(d=>Object.freeze({...d}));this.drafts={};this.left=docs[0]?.id;this.right=docs[1]?.id||docs[0]?.id;this.view='research';this.scope='draft';this.showEdits=true;
 if(saved){if(Array.isArray(saved.docs)&&saved.docs.length&&saved.docs.every(d=>typeof d.id==='string'&&typeof d.name==='string'&&typeof d.text==='string'))this.docs=saved.docs.map(d=>Object.freeze({...d}));for(const d of this.docs){const w=saved.drafts?.[d.id];if(typeof w==='string')this.drafts[d.id]={base:d.text,text:w,revision:diff(d.text,w)};else if(w&&typeof w.text==='string')this.drafts[d.id]={base:d.text,text:w.text,revision:diff(d.text,w.text)};}this.left=this.doc(saved.left)?saved.left:this.docs[0].id;this.right=this.doc(saved.right)?saved.right:this.docs[1]?.id||this.docs[0].id;if(['research','compare','clean'].includes(saved.view))this.view=saved.view;if(['draft','original'].includes(saved.scope))this.scope=saved.scope;this.showEdits=saved.showEdits!==false;}
 }
 doc(id){return this.docs.find(d=>d.id===id);} work(){return this.drafts[this.left]??=( {base:this.doc(this.left).text,text:this.doc(this.left).text,revision:diff('','')} );}
 edit(text){const w=this.work();w.text=text;w.revision=diff(w.base,text);return w;}
 compare(){return diff(this.doc(this.right).text,this.scope==='original'?this.doc(this.left).text:this.work().text);}
 snapshot(){return JSON.stringify({docs:this.docs,drafts:this.drafts,left:this.left,right:this.right,view:this.view,scope:this.scope,showEdits:this.showEdits});}
}
class CopyGuard{constructor(){this.sequence=0;this.timer=null;}invalidate(){this.sequence++;clearTimeout(this.timer);}async run(write,text,isCurrent,onSuccess,onReset,onFailure){const ticket=++this.sequence;clearTimeout(this.timer);onReset();try{await write(text);if(ticket!==this.sequence||!isCurrent())return;onSuccess();this.timer=setTimeout(()=>{if(ticket===this.sequence)onReset();},2500);}catch{if(ticket===this.sequence&&isCurrent())onFailure();}}}
const api={diff,finalText,Store,CopyGuard,uncorrected,migrateDraft};if(typeof module!=='undefined')module.exports=api;root.Workbench=api;
})(typeof window==='undefined'?globalThis:window);
