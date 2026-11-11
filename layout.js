(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./clauses.js'):root.ClauseNavigation;
const D=typeof module!=='undefined'?require('./model.js').diff:root.Workbench.diff;
function normalizeRange(raw,start,end){
 const chars=[],starts=[];let lastEnd=start;
 const value=raw.slice(start,end),matches=[...value.matchAll(/\S+|\s+/gu)];
 for(let n=0;n<matches.length;n++){const m=matches[n],at=start+m.index;
  if(/^\s/u.test(m[0])){if(!chars.length||n===matches.length-1)continue;const prev=chars.at(-1),next=matches[n+1]?.[0][0],han=/\p{Script=Han}/u,punctuation=/[，。；：！？、（）《》“”‘’]/u;if(han.test(prev)&&(han.test(next)||punctuation.test(next))||punctuation.test(prev)&&han.test(next))continue;chars.push(' ');starts.push(at);lastEnd=at+m[0].length;}
  else for(let i=0;i<m[0].length;i++){chars.push(m[0][i]);starts.push(at+i);lastEnd=at+i+1;}
 }
 return {text:chars.join(''),starts,end:lastEnd};
}
const numbered=s=>/^(?:\[?\d+(?:\]\[\d+)*\]?\s*[.)、．]|\([a-z\d]+\)|\[?[a-z]{1,3}[.)]|[•●]|[-–]\s)/i.test(s);
const option=s=>/^(?:(?:Sub[- ]?)?Option\s+\d|OP\s*\d|Provisions common|Additional options|案文方案\s*\d|第\s*\d+\s*款备选案文)/i.test(s)&&s.length<180;
const metadata=s=>/^(?:UNEP\/PP\/\S+|\d{1,3}|UNITED|NATIONS|UNITED NATIONS|Distr\.:.*|Original:.*|机器翻译版本.*|联合国|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\s*$/.test(s);
function project(raw,source={}){
 const headings=C.build(raw,source),blocks=[];
 function add(start,end,kind='paragraph',heading=null){const p=normalizeRange(raw,start,end);if(!p.text)return;blocks.push({rawStart:start,rawEnd:end,kind,heading,...p});}
 function body(start,end){
  let a=null,b=null,kind='paragraph',cursor=start;
  const flush=()=>{if(a!==null)add(a,b,kind);a=b=null;kind='paragraph';};
  for(const line of raw.slice(start,end).split('\n')){
   const trimmed=line.trim(),leading=line.length-line.trimStart().length,x=cursor+leading,y=cursor+line.trimEnd().length;
   cursor+=line.length+1;
   if(!trimmed){flush();continue;}
   const meta=metadata(trimmed),toc=/\.{4}|\t\d+\s*$/.test(line),newItem=numbered(trimmed)||option(trimmed),footnote=/^\[\d+\]\s/.test(trimmed);
   if(meta||toc){flush();add(x,y,meta?'metadata':'contents');continue;}
   if(newItem||footnote)flush();
   if(a===null){a=x;kind=option(trimmed)?'option':footnote?'footnote':/^(?:\([a-z\d]+\)|\[?[a-z]{1,3}[.)])/i.test(trimmed)?'subparagraph':numbered(trimmed)?'numbered':'paragraph';}
   b=y;
  }
  flush();
 }
 let cursor=0;
 for(const h of headings){if(h.start<cursor)continue;body(cursor,h.start);add(h.start,h.end,h.inline?'term':h.level===1?'part':'heading',h);cursor=h.end;}
 body(cursor,raw.length);
 const text=[],boundaries=[];let displayLength=0;
 for(const block of blocks){
  if(text.length){const from=boundaries.at(-1),to=block.starts[0],mid=from+Math.floor((to-from)/2);boundaries.pop();boundaries.push(from,mid);text.push('\n\n');displayLength+=2;}
  block.displayStart=displayLength;
  boundaries.push(...block.starts,block.end);text.push(block.text);displayLength+=block.text.length;block.displayEnd=displayLength;
 }
 return {raw,text:text.join(''),boundaries:boundaries.length?boundaries:[0],blocks};
}
function displayOffset(projection,rawOffset){
 let a=0,b=projection.boundaries.length-1;
 while(a<b){const m=(a+b)>>1;if(projection.boundaries[m]<rawOffset)a=m+1;else b=m;}
 return a;
}
function edit(raw,projection,next){
 if(next===projection.text)return {raw,projection};
 const result=D(projection.text,next),parts=[raw.slice(0,projection.boundaries[0])],boundaries=[];let old=0,size=parts[0].length;
 for(const segment of result.segments){
  if(segment.type==='delete'){old+=segment.text.length;continue;}
  if(segment.type==='insert'){for(let i=0;i<segment.text.length;i++)boundaries.push(size+i);parts.push(segment.text);size+=segment.text.length;continue;}
  const start=projection.boundaries[old],end=projection.boundaries[old+segment.text.length];
  for(let i=0;i<segment.text.length;i++)boundaries.push(size+projection.boundaries[old+i]-start);
  parts.push(raw.slice(start,end));size+=end-start;old+=segment.text.length;
 }
 boundaries.push(size);parts.push(raw.slice(projection.boundaries.at(-1)));
 return {raw:parts.join(''),projection:{text:next,boundaries}};
}
function compare(left,right,leftSource={},rightSource={}){
 const a=project(right,rightSource),b=project(left,leftSource),x=a.blocks.map((p,i)=>p.text+(i<a.blocks.length-1?'\n\n':'')),y=b.blocks.map((p,i)=>p.text+(i<b.blocks.length-1?'\n\n':''));
 const segments=[];let degraded=false;
 const push=(type,text)=>{if(!text)return;if(segments.at(-1)?.type===type)segments.at(-1).text+=text;else segments.push({type,text});};
 const flush=(oldText,newText)=>{const part=D(oldText,newText);degraded||=part.degraded;for(const s of part.segments)push(s.type,s.text);};
 if(x.length*y.length>5000000)flush(a.text,b.text);
 else{
  // Exact paragraph anchors bound word comparison to the text between anchors.
  // Unlike a whole-document fallback, shared articles stay ordinary readable text.
  const dp=Array.from({length:x.length+1},()=>new Uint16Array(y.length+1));
  for(let i=x.length-1;i>=0;i--)for(let j=y.length-1;j>=0;j--)dp[i][j]=x[i]===y[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
  let i=0,j=0,old=[],next=[];
  const pending=()=>{flush(old.join(''),next.join(''));old=[];next=[];};
  while(i<x.length||j<y.length){if(i<x.length&&j<y.length&&x[i]===y[j]){pending();push('equal',x[i]);i++;j++;}else if(j<y.length&&(i===x.length||dp[i][j+1]>dp[i+1][j]))next.push(y[j++]);else old.push(x[i++]);}pending();
 }
 let oldOffset=0,newOffset=0,group=-1,changed=false;const leftAnnotations=[],rightAnnotations=[];
 for(const s of segments){if(s.type==='equal'){changed=false;oldOffset+=s.text.length;newOffset+=s.text.length;}else{if(!changed)group++;changed=true;s.change=group;if(s.type==='insert'){leftAnnotations.push({start:b.boundaries[newOffset],end:b.boundaries[newOffset+s.text.length],type:s.type,change:group});newOffset+=s.text.length;}else{rightAnnotations.push({start:a.boundaries[oldOffset],end:a.boundaries[oldOffset+s.text.length],type:s.type,change:group});oldOffset+=s.text.length;}}}
 return {segments,count:group+1,degraded,leftAnnotations,rightAnnotations,leftProjection:b,rightProjection:a};
}
function findRanges(text,queries){
 const found=[];
 for(const query of queries){if(!query.trim())continue;const pattern=query.trim().split(/\s+/u).map(word=>Array.from(word,ch=>'\\u{'+ch.codePointAt(0).toString(16)+'}').join('')).join('\\s+');for(const match of text.matchAll(new RegExp(pattern,'giu')))found.push([match.index,match.index+match[0].length]);}
 return found.sort((a,b)=>a[0]-b[0]).filter((r,i,all)=>!i||r[0]>=all[i-1][1]);
}
const api={project,displayOffset,edit,compare,findRanges};if(typeof module!=='undefined')module.exports=api;root.DocumentLayout=api;
})(typeof window==='undefined'?globalThis:window);
