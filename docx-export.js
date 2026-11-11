(function(root){
'use strict';
const W=typeof module!=='undefined'?require('./model.js'):root.Workbench;
const L=typeof module!=='undefined'?require('./layout.js'):root.DocumentLayout;
const R=typeof module!=='undefined'?require('./research.js'):root.PactResearch;
const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const xml=s=>String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function projection(text,source={}){const labels=R.listLabels(source,text);const blocks=L.project(text,source).blocks.map(block=>{const label=labels.find(x=>x.start>=block.rawStart&&x.start<block.rawEnd);return {...block,text:(label?label.label+' ':'')+block.text};});return {blocks,text:blocks.map(b=>b.text).join('\n')};}
function packageParts({source={},base=source.text||'',final=base,tracked=false,date=new Date().toISOString()}={}){
 const before=projection(base,source),after=projection(final,source),revision=tracked?W.diff(before.text,after.text):{segments:[{type:'equal',text:after.text}]};
 const styles=new Map([...before.blocks,...after.blocks].map(b=>[b.text,['heading','part'].includes(b.kind)?'Heading1':b.kind==='term'?'Term':'Normal']));
 const stamp=new Date(date).toISOString();let id=0;
 const attrs=()=>`w:id="${++id}" w:author="INC Lens" w:date="${stamp}"`;
 const paragraphs=[];let runs=[];
 function run(type,text){if(!text)return '';const tag=type==='delete'?'delText':'t',body=text.split('\t').map((part,i)=>(i?'<w:tab/>':'')+(part?`<w:${tag} xml:space="preserve">${xml(part)}</w:${tag}>`:'' )).join(''),r='<w:r>'+body+'</w:r>';return type==='equal'?r:`<w:${type==='insert'?'ins':'del'} ${attrs()}>${r}</w:${type==='insert'?'ins':'del'}>`;}
 function finish(breakType='equal'){
  const accepted=runs.filter(r=>r.type!=='delete').map(r=>r.text).join(''),rejected=runs.filter(r=>r.type!=='insert').map(r=>r.text).join(''),style=styles.get(accepted)||styles.get(rejected)||'Normal';
  const mark=tracked&&breakType!=='equal'?`<w:rPr><w:${breakType==='insert'?'ins':'del'} ${attrs()}/></w:rPr>`:'';
  paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="${style}"/>${mark}</w:pPr>${runs.map(r=>run(r.type,r.text)).join('')}</w:p>`);runs=[];
 }
 for(const segment of revision.segments){const pieces=segment.text.split('\n');for(let i=0;i<pieces.length;i++){if(pieces[i])runs.push({type:segment.type,text:pieces[i]});if(i<pieces.length-1)finish(segment.type);}}
 finish();
 const files={
  '[Content_Types].xml':declaration+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
  '_rels/.rels':declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
  'word/_rels/document.xml.rels':declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>',
  'word/document.xml':declaration+`<w:document xmlns:w="${ns}"><w:body>${paragraphs.join('')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`,
  'word/styles.xml':declaration+`<w:styles xmlns:w="${ns}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="SimSun"/><w:color w:val="000000"/><w:sz w:val="22"/><w:lang w:val="en-US" w:eastAsia="zh-CN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="000000"/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Term"><w:name w:val="Term"/><w:basedOn w:val="Normal"/><w:rPr><w:b/></w:rPr></w:style></w:styles>`,
  'word/settings.xml':declaration+`<w:settings xmlns:w="${ns}"><w:view w:val="print"/><w:zoom w:percent="100"/>${tracked?'<w:revisionView w:markup="1" w:insDel="1" w:formatting="0"/><w:trackRevisions/>':''}<w:defaultTabStop w:val="420"/></w:settings>`,
  'docProps/core.xml':declaration+'<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>INC Lens</dc:creator></cp:coreProperties>'
 };
 return {files,baseText:before.text,finalText:after.text,revisionCount:tracked?revision.count:0};
}
const crcTable=Uint32Array.from({length:256},(_,n)=>{let x=n;for(let k=0;k<8;k++)x=x&1?0xedb88320^(x>>>1):x>>>1;return x>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function zip(files){const encoder=new TextEncoder(),parts=[],central=[];let offset=0,centralLength=0;
 const write=(size,values)=>{const bytes=new Uint8Array(size),view=new DataView(bytes.buffer);for(const [at,value,length]of values)length===2?view.setUint16(at,value,true):view.setUint32(at,value,true);return bytes;};
 for(const [path,xml]of Object.entries(files)){const name=encoder.encode(path),data=encoder.encode(xml),crc=crc32(data),local=write(30,[[0,0x04034b50,4],[4,20,2],[6,0x800,2],[10,0,2],[12,33,2],[14,crc,4],[18,data.length,4],[22,data.length,4],[26,name.length,2]]);parts.push(local,name,data);const entry=write(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[12,0,2],[14,33,2],[16,crc,4],[20,data.length,4],[24,data.length,4],[28,name.length,2],[42,offset,4]]);central.push(entry,name);centralLength+=entry.length+name.length;offset+=local.length+name.length+data.length;}
 const end=write(22,[[0,0x06054b50,4],[8,Object.keys(files).length,2],[10,Object.keys(files).length,2],[12,centralLength,4],[16,offset,4]]),out=new Uint8Array(offset+centralLength+end.length);let cursor=0;for(const bytes of [...parts,...central,end]){out.set(bytes,cursor);cursor+=bytes.length;}return out;
}
const mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const filename=(name,tracked=false)=>(String(name||'案文').replace(/\.(?:pdf|docx?|txt|md)$/i,'').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,100)||'案文')+(tracked?'-修订版':'-清理版')+'.docx';
const api={mime,filename,projection,packageParts,build:options=>zip(packageParts(options).files)};if(typeof module!=='undefined')module.exports=api;root.WordExport=api;
})(typeof window==='undefined'?globalThis:window);
