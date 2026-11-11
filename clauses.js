(function(root){
'use strict';
const label=s=>s.replace(/\s+/g,' ').trim().replace(/([\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu,'$1');
const chineseNumbers='零〇一二三四五六七八九十百千万亿兩两壹贰叁肆伍陆柒捌玖拾佰仟萬億';
function numberValue(value){
 const s=value.normalize('NFKC').replace(/\s/g,'').replace(/[壹贰叁肆伍陆柒捌玖拾佰仟萬億兩两]/g,c=>({'壹':'一','贰':'二','叁':'三','肆':'四','伍':'五','陆':'六','柒':'七','捌':'八','玖':'九','拾':'十','佰':'百','仟':'千','萬':'万','億':'亿','兩':'二','两':'二'}[c]));
 if(/^\d+$/.test(s))return Number(s);
 const digits={'零':0,'〇':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9},units={'十':10,'百':100,'千':1000,'万':10000,'亿':100000000};
 if([...s].every(c=>c in digits))return Number([...s].map(c=>digits[c]).join(''));
 if(s&&[...s].every(c=>c in digits||c in units)){let total=0,section=0,n=0;for(const c of s){if(c in digits)n=digits[c];else if(units[c]<10000){section+=(n||1)*units[c];n=0;}else{total+=(section+n)*units[c];section=0;n=0;}}return total+section+n;}
 const roman=s.toUpperCase();if(!roman||!/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(roman))return null;
 const values={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};return [...roman].reduce((n,c,i)=>n+(values[c]<values[roman[i+1]]?-values[c]:values[c]),0);
}
const ordinalNumber='[0-9０-９'+chineseNumbers+'IVXLCDMivxlcdmⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+';
const chineseOrdinal=new RegExp('第\\s*('+ordinalNumber+')\\s*(条|章|节|编|部分|部)(?:\\s*之\\s*('+ordinalNumber+'))?','g');
function formatTitle(value){
 let s=label(value).replace(/\[(?:Footnote|Endnote|脚注|尾注)\s+\d+\]/gi,'').trim();
 s=s.replace(chineseOrdinal,(raw,n,unit,suffix)=>{const number=numberValue(n),extra=suffix&&numberValue(suffix);return number===null||suffix&&extra===null?raw:'第'+number+unit+(suffix?'之'+extra:'');});
 s=s.replace(/\bARTICLE\s+([\d０-９]+|[IVXLCDMⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+)(?=\b|\s|[·.:\]—-]|$)/gi,(raw,n)=>numberValue(n)===null?raw:'ARTICLE '+numberValue(n));
 s=s.replace(/\b(Part|Appendix)\s+([\d０-９]+|[IVXLCDMⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+)(?=\b|\s|\[|$)/gi,(raw,kind,n)=>numberValue(n)===null?raw:kind[0].toUpperCase()+kind.slice(1).toLowerCase()+' '+numberValue(n));
 s=s.replace(/^([IVX]+)\.\s+/,(raw,n)=>numberValue(n)>0&&numberValue(n)<=10?numberValue(n)+'. ':raw);
 s=s.replace(/^[０-９]+[.．、]?/,raw=>raw.normalize('NFKC'));
 s=s.replace(/^(\[?第\d+(?:条|章|节|编|部分|部)(?:之\d+)?\]?)[\s·:：]*(.*)$/u,(_,prefix,rest)=>prefix+(rest?' · '+rest:''));
 return label(s);
}
const normalize=s=>formatTitle(s).normalize('NFKC').replace(/[·]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
const articleOnly=s=>/^\[?article\s+\d+[a-z]?(?:\s*(?:bis|ter))?\s*\]?$/i.test(s);
const chineseArticleOnly=s=>new RegExp('^\\[?第\\s*'+ordinalNumber+'\\s*条(?:\\s*之\\s*'+ordinalNumber+')?\\s*\\]?$').test(s);
const chineseTitle=s=>s.length<120&&/[\p{Script=Han}]/u.test(s)&&!/[。；：;:]$/.test(s)&&!/^(?:\d+[.．]|机器翻译|第.+条)/.test(s);
const titleLine=s=>s.length<240&&/[A-Z]/.test(s)&&s===s.toUpperCase()&&!/[.;]$/.test(s);
function lines(text){const out=[];let start=0;for(const raw of text.split('\n')){const value=raw.trim();out.push({start:start+raw.indexOf(value),end:start+raw.trimEnd().length,value});start+=raw.length+1;}return out;}
const alternativePrefix=/^\s*(?:#{1,6}\s+)?[\[【(（]*\s*(?:(?:Alt(?:ernative)?\.?\s*(?:title|heading))|(?:(?:备选|替代|另选)(?:标题|题名)))\s*(?:\d+|[一二三四五六七八九十]+)?\s*[:：]\s*/i;
const isAlternativeTitle=value=>alternativePrefix.test(value.normalize('NFKC'));
function build(text,source={}){
 const items=[],rows=lines(text),original=source.text||'';
 // Heading ranges come from source styles/typography, never from the document's TOC.
 // In a research draft, find the entire original heading at a line boundary again.
 let cursor=0,sourceEnd=0;
 for(const heading of source.outline||[]){
  if(heading.start<sourceEnd)continue;sourceEnd=heading.end;
  const raw=original.slice(heading.start,heading.end);if(!raw)continue;
  let start=text===original?heading.start:text.indexOf(raw,cursor);
  const originalTail=original.slice(heading.end,original.indexOf('\n',heading.end)<0?original.length:original.indexOf('\n',heading.end)).trim();
  while(start>=0&&text!==original){const before=text.slice(text.lastIndexOf('\n',start-1)+1,start),end=start+raw.length,after=text.slice(end,text.indexOf('\n',end)<0?text.length:text.indexOf('\n',end));if(!before.trim()&&(heading.inline||!after.trim()||after.trim()===originalTail||/^\d+\s*$/.test(after)))break;start=text.indexOf(raw,start+1);}
  if(start<0)continue;
  items.push({...heading,start,end:start+raw.length});cursor=start+raw.length;
 }
 for(let i=0;i<rows.length;i++){
  const row=rows[i],s=row.value;if(!s||s.length>320||/\.{3}|\t\d+\s*$/.test(text.slice(row.start,row.end)))continue;
  // Prefer the full styled source heading over a shorter one-line fallback.
  const covered=items.find(item=>row.start>=item.start&&row.start<item.end);
  if(covered&&!(covered.end<=row.end&&(articleOnly(s)||chineseArticleOnly(s))))continue;
  let level=2,title=s;
  const markdown=s.match(/^(#{1,6})\s+(.+?)\s*#*$/);
  const structural=/^\[?(?:Part\s+[IVX\d]+(?:\s|$)|Annex\s+(?:[A-Z]|\[[A-Z]+\])(?:\s|$)|Appendix\b)/i.test(s)&&s.length<180;
  const article=/^\[?article\s+\d+[a-z]?(?:\s|[.\]:—-]|$)/i.test(s);
  const chinese=new RegExp('^\\[?第\\s*'+ordinalNumber+'\\s*[条章节](?:\\s|[、.．：:]|[^\\x00-\\x7f]|$)').test(s);
  const numbered=!source.outline?.length&&/^\[?\d+(?:\s*(?:bis|ter))?[.、．]\s*\[?[A-Z\u4e00-\u9fff]/.test(s)&&s.length<170&&!/[.;。；]$/.test(s)&&!/(?:\b(?:shall|should|must|may|Each|The|Parties|Party|For the|In the|At its|Where|When|This|It|A mechanism)\b)/.test(s);
  if(markdown){title=markdown[2];level=Math.min(3,markdown[1].length);}
  else if(structural){if(source.outline?.length)continue;level=1;}
  else if(!article&&!chinese&&!numbered)continue;
  let end=row.end;
  if(articleOnly(s)){let j=i+1;while(j<rows.length&&!rows[j].value)j++;if(j<rows.length&&titleLine(rows[j].value)){const styled=items.find(h=>h.start===rows[j].start&&h.end>=rows[j].end);title=label(s)+' · '+label(styled?.title||rows[j].value);end=styled?.end||rows[j].end;}}
  if(chineseArticleOnly(s)){let j=i+1;while(j<rows.length&&!rows[j].value)j++;if(j<rows.length&&chineseTitle(rows[j].value)){const styled=items.find(h=>h.start===rows[j].start&&h.end>=rows[j].end);title=label(s)+' '+label(styled?.title||rows[j].value);end=styled?.end||rows[j].end;}}
  items.push({start:row.start,end,title:label(title),level});
 }
 items.sort((a,b)=>a.start-b.start||b.end-a.end);
 const unique=[];
 for(let i=0;i<items.length;i++){
  const item={...items[i]};
  delete item.aliases;delete item.alternativeTitles;
  // A proposed title belongs to its preceding provision, never a separate section.
  if(isAlternativeTitle(item.title))continue;
  if(unique.at(-1)?.end>item.start)continue;
  const next=items.slice(i+1).find(n=>n.start>=item.end);
  if(articleOnly(item.title)&&next&&titleLine(next.title)&&!text.slice(item.end,next.start).trim()){item.end=next.end;item.title=label(item.title)+' · '+label(next.title);}
  if(chineseArticleOnly(item.title)&&next&&chineseTitle(next.title)&&!text.slice(item.end,next.start).trim()){item.end=next.end;item.title=label(item.title)+' '+label(next.title);}
  unique.push(item);
 }
 for(let i=0;i<rows.length;i++){
  const row=rows[i];if(!isAlternativeTitle(row.value)||/\.{3}|\t\d+\s*$/.test(text.slice(row.start,row.end)))continue;
  const owner=unique.findLast(h=>h.start<row.start);if(!owner||owner.level===1)continue;
  const next=unique.find(h=>h.start>row.start),styled=items.find(h=>h.start<=row.start&&h.end>row.start&&isAlternativeTitle(h.title));
  let end=row.end;
  for(let j=i+1;j<rows.length;j++){
   const line=rows[j];
   if(line.start>=(next?.start??text.length)||isAlternativeTitle(line.value)||!line.value||/^(?:(?:Sub[- ]?)?Option\b|OP\s*\d|No text\b|案文方案|次级案文方案|无案文|\[?\d+[.)、．]|\([a-z\d]+\))/i.test(line.value))break;
   if(styled?line.start>=styled.end:false)break;
   end=line.end;
  }
  const title=label(text.slice(row.start,end)),alias=title.replace(alternativePrefix,'').trim();
  if(!alias)continue;
  (owner.alternativeTitles??=[]).push({start:row.start,end,title});
  if(!(owner.aliases??=[]).includes(alias))owner.aliases.push(alias);
 }
 let part='',clause='';
 return unique.map(item=>{const sourceTitle=item.title;item.title=formatTitle(sourceTitle);if(item.level===1){part=item.title;clause='';}const context=item.level>2?[part,clause].filter(Boolean).join(' / '):part;if(item.level===2)clause=item.title;return {...item,sourceTitle,id:'clause-'+item.start+'-'+item.end,context:context===item.title?'':context};});
}
function filter(items,query){const words=normalize(query).split(' ').filter(Boolean);return items.filter(item=>words.every(word=>normalize([item.title,item.context,...item.aliases||[]].join(' ')).includes(word)));}
const api={build,filter,normalize,formatTitle,numberValue,isAlternativeTitle};if(typeof module!=='undefined')module.exports=api;root.ClauseNavigation=api;
})(typeof window==='undefined'?globalThis:window);
