'use strict';
const $=id=>document.getElementById(id),{diff}=Workbench;
const {store,restoreNotice}=DocumentData.load();
const params=new URLSearchParams(location.search);
for(const side of ['left','right'])if(store.doc(params.get(side)))store[side]=params.get(side);
if(['research','compare','clean'].includes(params.get('view')))store.view=params.get('view');
store.scope='original';
DocumentLanguage.syncReference(store);

let comparison,revision,current=-1,hits=[],hitIndex=-1,composing=false,scrollLock=false,ratio=50,targetRatio=50,velocity=0,springFrame=0,editTimer;
const histories=new Map();
function draftHistory(){if(!histories.has(store.left))histories.set(store.left,{items:[store.work().text],index:0});return histories.get(store.left);}
function save(){$('saveStatus').textContent=DocumentData.persist(store)?'已保存':'仅本次会话';}
function notice(text){$('notice').hidden=!text;$('notice').dataset.hint=text||'';$('statusMessage').textContent=text||'';}
function el(tag,text,cls){const n=document.createElement(tag);n.textContent=text??'';if(cls)n.className=cls;return n;}
let searchHighlightTerms=[];
const terms=['epr','生产者责任延伸','extended producer responsibility'];
function queryTerms(){if(searchHighlightTerms.length)return searchHighlightTerms;const q=$('search').value.trim().toLowerCase();return !q?[]:terms.includes(q)?terms:[q];}
function ranges(text){return DocumentLayout.findRanges(text,queryTerms());}
const paperLayouts=new WeakMap();
let editorProjection=null,editorDirty=false;
function readEditor(){return [...$('editor').childNodes].map(n=>n.nodeType===Node.TEXT_NODE?n.data:n.innerText??n.textContent).join('\n\n');}
function renderPaper(parent,text,source,annotations=[],searchable=true,editable=false){
 parent.lang=source.language||'zh-CN';
 const selectedRanges=store.view==='compare'&&activeSelection?activeRanges(parent.id==='reference'?'right':'left'):null;
 parent.replaceChildren();delete parent.dataset.textStart;
 if(selectedRanges&&!selectedRanges.length){paperLayouts.delete(parent);parent.append(el('p','无对应结果','no-counterpart'));return;}
 const projection=DocumentLayout.project(text,source),found=searchable?ranges(text):[],seen=new Set(),nodes=[];
 for(const block of projection.blocks){
  if(selectedRanges&&!selectedRanges.some(r=>block.rawEnd>r.start&&block.rawStart<r.end))continue;
  const p=el('p',null,'layout-block '+block.kind);p.dataset.layoutStart=block.displayStart;p.dataset.layoutEnd=block.displayEnd;p.dataset.rawStart=block.rawStart;p.dataset.rawEnd=block.rawEnd;
  if(block.heading&&!editable){p.setAttribute('role','heading');p.setAttribute('aria-level',block.kind==='part'?'3':'4');}
  const local=(a,b)=>[Math.max(0,DocumentLayout.displayOffset(projection,a)-block.displayStart),Math.min(block.text.length,DocumentLayout.displayOffset(projection,b)-block.displayStart)];
  const label=PactResearch.listLabels(source,text).find(x=>x.start>=block.rawStart&&x.start<block.rawEnd);if(label)p.dataset.listLabel=label.label;
  const edits=annotations.filter(x=>x.end>block.rawStart&&x.start<block.rawEnd).map(x=>{const [a,b]=local(x.start,x.end);return {...x,a,b};}).filter(x=>x.b>x.a);
  const matches=found.map(([start,end],index)=>({start,end,index})).filter(x=>x.end>block.rawStart&&x.start<block.rawEnd).map(x=>{const [a,b]=local(x.start,x.end);return {...x,a,b};}).filter(x=>x.b>x.a);
  const cuts=[...new Set([0,block.text.length,...edits.flatMap(x=>[x.a,x.b]),...matches.flatMap(x=>[x.a,x.b])])].sort((a,b)=>a-b);
  for(let i=0;i<cuts.length-1;i++){
   const a=cuts[i],b=cuts[i+1],change=edits.find(x=>x.a<=a&&x.b>=b),match=matches.find(x=>x.a<=a&&x.b>=b);
   let node=document.createTextNode(block.text.slice(a,b));
   if(match){const mark=el('mark');mark.append(node);node=mark;if(!seen.has(match.index)){hits.push({node:mark});seen.add(match.index);}}
   if(change){const wrap=el(change.type==='insert'?'ins':'del');wrap.dataset.change=change.change;wrap.append(node);node=wrap;}
   p.append(node);
  }
  nodes.push({node:p,block,changed:edits.length>0});
 }
 function appendGroup(group){if(!group.length)return;if(!editable&&store.view==='compare'&&!comparison.bilingual&&$('onlyChanges').checked&&group.every(x=>!x.changed)&&!group.some(x=>x.node.querySelector('mark'))){
  const wrapper=el('div',null,'context-fold'),button=el('button',`展开 ${group.length} 段原文`),collapse=el('div',null,'collapse'),inner=el('div',null,'collapse-inner');
  inner.append(...group.map(x=>x.node));collapse.append(inner);collapse.inert=true;button.setAttribute('aria-expanded','false');button.onclick=()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));collapse.classList.toggle('open',open);collapse.inert=!open;};wrapper.append(button,collapse);parent.append(wrapper);
 }else parent.append(...group.map(x=>x.node));}
 let group=[];for(const node of nodes){if(group.length&&group[0].changed!==node.changed){appendGroup(group);group=[];}group.push(node);}appendGroup(group);
 paperLayouts.set(parent,{projection,nodes});
 if(editable){editorProjection=projection;editorDirty=false;}
}
function renderPlain(parent,text,searchable=true){renderPaper(parent,text,store.doc(parent.id==='reference'?store.right:store.left),[],searchable);}
function renderSegments(parent,result,side,editableRevision=false){
 const visible=result.segments.filter(segment=>editableRevision||!(side==='left'&&segment.type==='delete'||side==='right'&&segment.type==='insert'));
 let text='',annotations=[];for(const segment of visible){const start=text.length;text+=segment.text;if(segment.type!=='equal')annotations.push({start,end:text.length,type:segment.type,change:segment.change});}
 renderPaper(parent,text,store.doc(side==='left'?store.left:store.right),annotations,!editableRevision);
}
function finalizeEditor(){if(!editorDirty||composing)return;const scroll=$('leftDoc').scrollTop;renderPaper($('editor'),store.work().text,store.doc(store.left),[],false,true);$('leftDoc').scrollTop=scroll;}
function compute(){revision=diff(store.work().base,store.work().text);const left=store.doc(store.left),right=store.doc(store.right),bilingual=left.language&&right.language&&left.language!==right.language;comparison=store.view==='compare'?(bilingual&&(!activeSelection||selectionResolution?.status==='confirmed')?{count:0,degraded:false,bilingual:true,leftAnnotations:[],rightAnnotations:[]}:computeScopedComparison(left,right)):{count:0,degraded:false};$('differenceNav').hidden=store.view!=='compare'||!!comparison.bilingual||!!comparison.missing;$('onlyChanges').disabled=!!comparison.bilingual||!!comparison.missing||!!comparison.pending;$('revisionCount').textContent=revision.count+' 处修订';$('revisionCount').hidden=store.view!=='research'||!revision.count;$('wordCount').textContent=Array.from(store.view==='compare'&&store.scope==='original'?left.text:store.work().text).length+' 字符';$('refCount').textContent=Array.from(right.text).length+' 字符';$('prev').disabled=$('next').disabled=store.view!=='compare'||!comparison.count;if(current>=comparison.count)current=-1;$('position').textContent=comparison.loading?'计算中':comparison.missing?'无对应结果':comparison.pending?'待确认':!comparison.count?'无正文差异':(current+1)+' / '+(store.view==='compare'?comparison.count:0);
 for(const side of ['left','right']){const d=store.doc(store[side]);$(side+'Name').title=[d.name,[d.publishedDate,d.publishedTime].filter(Boolean).join(' '),[DocumentLanguage.label(d.language),d.fileType,$(side==='left'?'wordCount':'refCount').textContent].filter(Boolean).join(' · '),d.editorialNote].filter(Boolean).join('\n');}
 if(comparison.bilingual)notice('不同语言按条款并排阅读，不将译文的语言差异标为增删。查看版本增删时，请将两侧切换为同一语言。');else if(comparison.degraded&&store.view==='compare')notice('部分长段落采用整段差异显示，完整正文均已保留。');else if(revision.degraded&&store.view==='research')notice('修订核查已降级为整块显示，完整研究稿与原件仍然保留。');else notice(restoreNotice);
}
function renderText(){const scrolls=[$('leftDoc').scrollTop,$('rightDoc').scrollTop];hits=[];hitIndex=-1;selectionResolution=resolveSelection();compute();const research=store.view==='research',compare=store.view==='compare';$('editor').hidden=!research;$('leftPreview').hidden=research;$('revisionPanel').hidden=!research||!store.showEdits||!revision.count;
 if(research){if(!editorDirty)renderPaper($('editor'),store.work().text,store.doc(store.left),[],false,true);if(revision.count)renderSegments($('revisionContent'),revision,'left',true);else $('revisionContent').replaceChildren();for(const [start,end]of ranges(store.work().text))hits.push({editor:true,start,end});}
 else if(compare)renderPaper($('leftPreview'),store.scope==='original'?store.doc(store.left).text:store.work().text,store.doc(store.left),comparison.leftAnnotations);else renderPaper($('leftPreview'),store.work().text,store.doc(store.left),[],false);
 if(compare)renderPaper($('reference'),store.doc(store.right).text,store.doc(store.right),comparison.rightAnnotations);else renderPlain($('reference'),store.doc(store.right).text);searchCount();refreshOutlines();refreshTools();$('leftDoc').scrollTop=scrolls[0];$('rightDoc').scrollTop=scrolls[1];}
function render(){
 
 for(const b of document.querySelectorAll('[data-view]')){const active=b.dataset.view===(store.view==='compare'?'compare':'research');b.setAttribute('aria-selected',active);b.classList.toggle('active',active);}
 $('revisionActions').hidden=store.view==='compare';$('cleanPreview').setAttribute('aria-pressed',String(store.view==='clean'));$('operationbar').hidden=store.view!=='compare';$('workspace').classList.toggle('clean-preview',store.view==='clean');$('sync').closest('label').hidden=store.view==='clean';$('reset').hidden=store.view==='clean';
 $('researchControls').hidden=store.view!=='research';$('compareControls').hidden=store.view!=='compare';$('differenceNav').hidden=store.view!=='compare';
 $('revisionCount').hidden=store.view!=='research';$('showEdits').checked=store.showEdits;
 $('leftName').textContent=store.doc(store.left).shortTitle||store.doc(store.left).name;$('rightName').textContent=store.doc(store.right).shortTitle||store.doc(store.right).name;
 for(const side of ['left','right'])$(side+'Meeting').textContent=(store.doc(store[side]).meetingId||'本地').replace(/^inc-/,'INC-').replace(/(INC-\d+)-(\d+)$/,'$1.$2');
 renderLanguageControls();
 renderText();
}
function changeView(view){if(composing)return;commitEdit();finalizeEditor();const positions={left:rememberReading('left'),right:store.view==='clean'?(readingStates.get(readingKey('right',view))||rememberReading('right')):rememberReading('right')};clearTimeout(searchTimer);dismissTools();closeExportMenu();$('settings').hidden=true;store.scope='original';store.view=view;params.set('view',view);try{window.history.replaceState(null,'','workspace.html?'+params.toString());}catch{}current=-1;render();for(const side of ['left','right']){if(view==='clean'&&side==='right')continue;const prior=positions[side],items=clauseState[side].items,target=view==='compare'&&activeSelection?selectionResolution?.[side]?.[0]:items.find(item=>prior.sectionKey&&DocumentLanguage.sectionKey(item)===prior.sectionKey);scrollProseTo(side,target||{start:prior.raw,end:prior.raw+1});clauseState[side].current=target?.id||null;renderOutline(side);}save();}
function searchCount(){$('searchCount').textContent=queryTerms().length?`${hitIndex+1} / ${hits.length}`:'';$('searchPrev').disabled=$('searchNext').disabled=!hits.length;}
function navigateSearch(step){if(!hits.length)return;hitIndex=(hitIndex+step+hits.length)%hits.length;document.querySelectorAll('mark.current').forEach(n=>n.classList.remove('current'));const hit=hits[hitIndex];if(hit.editor){scrollEditorTo(hit.start,hit.end);}else{hit.node.classList.add('current');hit.node.scrollIntoView({block:'center',behavior:'instant'});}searchCount();}
function navigate(step){if(store.view!=='compare'||!comparison.count)return;current=(current+step+comparison.count)%comparison.count;document.querySelectorAll('.change-current').forEach(n=>n.classList.remove('change-current'));document.querySelectorAll(`[data-change="${current}"]`).forEach(n=>{n.classList.add('change-current');n.scrollIntoView({block:'center',behavior:'instant'});});$('position').textContent=(current+1)+' / '+comparison.count;}
function commitEdit(){const visible=readEditor();if(!editorProjection||visible===editorProjection.text)return;const updated=DocumentLayout.edit(store.work().text,editorProjection,visible),value=updated.raw;editorProjection=updated.projection;editorDirty=true;if(value===store.work().text)return;store.edit(value);const h=draftHistory();h.items=h.items.slice(0,h.index+1);h.items.push(value);h.index++;save();clearTimeout(editTimer);editTimer=setTimeout(()=>{renderText();},120);}
$('editor').addEventListener('blur',()=>{if(!composing)finalizeEditor();});
$('editor').oncompositionstart=()=>composing=true;$('editor').oncompositionend=()=>{composing=false;commitEdit();};$('editor').oninput=()=>{if(!composing)commitEdit();};
function undo(redo){const h=draftHistory(),next=h.index+(redo?1:-1);if(next<0||next>=h.items.length)return;h.index=next;store.edit(h.items[next]);editorDirty=false;save();renderText();}
$('editor').onkeydown=e=>{if(!composing&&(e.metaKey||e.ctrlKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();undo(e.shiftKey||e.key.toLowerCase()==='y');}};
$('editor').addEventListener('beforeinput',e=>{if(e.inputType==='historyUndo'||e.inputType==='historyRedo'){e.preventDefault();undo(e.inputType==='historyRedo');}});

for(const btn of document.querySelectorAll('[data-view]'))btn.onclick=()=>changeView(btn.dataset.view);
$('cleanPreview').onclick=()=>changeView(store.view==='clean'?'research':'clean');
function closeExportMenu(focus=false){$('exportMenu').hidden=true;$('exportWord').setAttribute('aria-expanded','false');if(focus)$('exportWord').focus({preventScroll:true});}
function positionExportMenu(){const r=$('exportWord').getBoundingClientRect(),menu=$('exportMenu');menu.style.top=r.bottom+8+'px';menu.style.left=Math.max(12,Math.min(innerWidth-menu.offsetWidth-12,r.right-menu.offsetWidth))+'px';}
$('exportWord').onclick=()=>{const open=$('exportMenu').hidden;dismissTools();$('settings').hidden=true;closeExportMenu();if(open){$('exportMenu').hidden=false;$('exportWord').setAttribute('aria-expanded','true');positionExportMenu();$('exportTracked').focus();}};
function exportWord(tracked){if(composing){notice('请完成当前输入后再导出。');return;}try{commitEdit();finalizeEditor();save();const source=store.doc(store.left),work=store.work(),bytes=WordExport.build({source,base:work.base,final:work.text,tracked}),url=URL.createObjectURL(new Blob([bytes],{type:WordExport.mime})),a=el('a');a.href=url;a.download=WordExport.filename([source.meetingId?.replace('inc-','INC-').replace(/(INC-\d+)-(\d+)$/,'$1.$2'),source.shortTitle||source.name,source.language==='zh-CN'?'中文':source.language==='en'?'EN':''].filter(Boolean).join('-'),tracked);a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);closeExportMenu(true);$('saveStatus').textContent=tracked?'已生成 Word 修订版':'已生成 Word 清理版';}catch{notice('Word 导出失败，请重试。');}}
$('exportTracked').onclick=()=>exportWord(true);$('exportClean').onclick=()=>exportWord(false);
$('exportMenu').onkeydown=e=>{if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();const options=[...$('exportMenu').querySelectorAll('button')],at=options.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?options.length-1:(at+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;options[next].focus();}else if(e.key==='Escape'){e.preventDefault();closeExportMenu(true);}};
document.addEventListener('pointerdown',e=>{if(!$('exportMenu').contains(e.target)&&!$('exportWord').contains(e.target))closeExportMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('exportMenu').hidden)closeExportMenu(true);});
window.addEventListener('resize',()=>{if(!$('exportMenu').hidden)positionExportMenu();});
$('showEdits').onchange=e=>{store.showEdits=e.target.checked;renderText();save();};
$('onlyChanges').onchange=()=>renderText();
$('search').onkeydown=e=>{if(e.key==='Enter')navigateSearch(e.shiftKey?-1:1);};
$('searchPrev').onclick=()=>navigateSearch(-1);$('searchNext').onclick=()=>navigateSearch(1);$('prev').onclick=()=>navigate(-1);$('next').onclick=()=>navigate(1);
$('revisionCount').onclick=()=>{store.showEdits=true;$('showEdits').checked=true;renderText();if(revision.count)$('revisionPanel').scrollIntoView({block:'start',behavior:'instant'});save();};
function togglePopover(id,button){const open=$(id).hidden;$('settings').hidden=$('searchPanel').hidden=true;for(const b of ['settingsToggle','searchToggle'])$(b).setAttribute('aria-expanded','false');$(id).hidden=!open;$(button).setAttribute('aria-expanded',open);if(open&&id==='searchPanel')$('search').focus();if(open&&id==='settings'){const r=$(button).getBoundingClientRect();$(id).style.top=r.bottom+8+'px';$(id).style.right=Math.max(12,innerWidth-r.right)+'px';}}
$('searchToggle').onclick=()=>togglePopover('searchPanel','searchToggle');$('settingsToggle').onclick=()=>togglePopover('settings','settingsToggle');
document.addEventListener('pointerdown',e=>{for(const [id,b]of [['settings','settingsToggle'],['searchPanel','searchToggle']])if(!$(id).contains(e.target)&&!$(b).contains(e.target)){$(id).hidden=true;$(b).setAttribute('aria-expanded','false');}});
$('theme').onclick=()=>{const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';$('theme').textContent=dark?'切换浅色外观':'切换深色外观';};
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function applyRatio(){ratio=Math.max(25,Math.min(75,ratio));$('workspace').style.gridTemplateColumns=`minmax(0,${ratio}fr) 16px minmax(0,${100-ratio}fr)`;$('splitter').setAttribute('aria-valuenow',Math.round(ratio));}
function setRatio(value){targetRatio=Math.max(25,Math.min(75,value));if(reduced()){ratio=targetRatio;applyRatio();return;}if(springFrame)return;let last;function tick(t){const dt=Math.min((t-(last||t-8))/1000,.016);last=t;velocity+=(1200*(targetRatio-ratio)-80*velocity)*dt;const next=ratio+velocity*dt;if((targetRatio-ratio)*(targetRatio-next)<=0){ratio=targetRatio;velocity=0;}else ratio=next;applyRatio();if(Math.abs(targetRatio-ratio)>.01||Math.abs(velocity)>.1)springFrame=requestAnimationFrame(tick);else{ratio=targetRatio;velocity=0;springFrame=0;applyRatio();}}springFrame=requestAnimationFrame(tick);}
$('splitter').onpointerdown=e=>{e.preventDefault();$('splitter').setPointerCapture(e.pointerId);};$('splitter').onpointermove=e=>{if(!$('splitter').hasPointerCapture(e.pointerId))return;const bounds=$('workspace').getBoundingClientRect();setRatio((e.clientX-bounds.left-8)/(bounds.width-16)*100);};$('splitter').onpointerup=e=>$('splitter').releasePointerCapture(e.pointerId);$('splitter').ondblclick=()=>setRatio(50);$('splitter').onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home'].includes(e.key)){e.preventDefault();setRatio(e.key==='Home'?50:targetRatio+(e.key==='ArrowRight'?2:-2));}};$('reset').onclick=()=>setRatio(50);

// Independent scrolling is the default. Synchronization is an explicit reader choice.
for(const [a,b]of [['leftDoc','rightDoc'],['rightDoc','leftDoc']])$(a).onscroll=()=>{if(scrollLock||!$('sync').checked)return;scrollLock=true;const max=$(a).scrollHeight-$(a).clientHeight;$(b).scrollTop=max?$(a).scrollTop/max*($(b).scrollHeight-$(b).clientHeight):0;requestAnimationFrame(()=>scrollLock=false);};
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(composing)commitEdit();save();}});
window.addEventListener('pagehide',()=>{if(composing)commitEdit();save();});
$('backHome').onclick=()=>{if(composing)commitEdit();save();};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){for(const [id,b]of [['settings','settingsToggle'],['searchPanel','searchToggle']]){$(id).hidden=true;$(b).setAttribute('aria-expanded','false');}}});
const clauseState={left:{items:[],text:null,source:null,current:null},right:{items:[],text:null,source:null,current:null}};
function clauseText(side){return side==='right'?store.doc(store.right).text:store.view==='compare'&&store.scope==='original'?store.doc(store.left).text:store.work().text;}
function refreshOutlines(){for(const side of ['left','right'])renderOutline(side);if(window.CSS?.highlights){CSS.highlights.delete('left-clause');CSS.highlights.delete('right-clause');}}
function renderOutline(side){
 const state=clauseState[side],source=store.doc(store[side]),text=clauseText(side);
 if(state.text!==text||state.source!==source.id){state.items=ClauseNavigation.build(text,source);state.text=text;state.source=source.id;state.current=null;}
 if(store.view==='compare'&&activeSelection)state.current=selectionResolution?.[side]?.[0]?.id??null;
 const filtered=ClauseNavigation.filter(state.items,$(side+'ClauseSearch').value),list=$(side+'ClauseList');
 $(side+'ClauseCount').textContent=filtered.length===state.items.length?`${state.items.length} 条`:`${filtered.length} / ${state.items.length}`;
 const active=state.items.find(item=>item.id===state.current);$(side+'ClauseStatus').textContent=active?.title.split(' · ')[0]||'';
 list.replaceChildren(...filtered.map(item=>{const button=el('button',null,'outline-item');button.dataset.level=item.level;button.dataset.start=item.start;button.dataset.end=item.end;button.setAttribute('aria-current',String(item.id===state.current));button.append(el('span',item.title));if(item.context)button.append(el('small',item.context));button.onclick=()=>jumpToClause(side,item);return button;}));
 if(!filtered.length){const empty=el('div',null,'outline-empty'),button=el('button',state.items.length?'清空搜索':'搜索正文');empty.append(el('p',state.items.length?'未找到条款。':'暂无条款目录。'),button);button.onclick=()=>{if(state.items.length){$(side+'ClauseSearch').value='';renderOutline(side);$(side+'ClauseSearch').focus();}else{closeOutline(side);togglePopover('searchPanel','searchToggle');}};list.append(empty);}
}
function closeOutline(side,focus=false){$(side+'Outline').hidden=true;$(side+'ClauseToggle').setAttribute('aria-expanded','false');if(focus)$(side+'ClauseToggle').focus({preventScroll:true});}
function pauseSync(){scrollLock=true;requestAnimationFrame(()=>requestAnimationFrame(()=>scrollLock=false));}
function textRange(container,start,end){
 const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT),range=document.createRange();let node,offset=0,started=false;
 while(node=walker.nextNode()){const next=offset+node.data.length;if(!started&&start<next){range.setStart(node,Math.max(0,start-offset));started=true;}if(started&&end<=next){range.setEnd(node,Math.max(0,end-offset));return range;}offset=next;}
 return null;
}
function scrollEditorTo(start,end){finalizeEditor();return locateOnPaper($('editor'),$('leftDoc'),{start,end},true,'left');}
function locateOnPaper(root,doc,item,select=false,side='left'){
 const layout=paperLayouts.get(root);if(!layout)return false;
 const start=DocumentLayout.displayOffset(layout.projection,item.start),end=DocumentLayout.displayOffset(layout.projection,item.end);
 const target=layout.nodes.find(x=>start>=x.block.displayStart&&start<x.block.displayEnd)||layout.nodes.find(x=>x.block.displayStart>=start);if(!target)return false;
 const fold=target.node.closest('.context-fold');if(fold){fold.querySelector('.collapse').classList.add('open');fold.querySelector('.collapse').inert=false;fold.querySelector('button').setAttribute('aria-expanded','true');}
 const a=Math.max(0,start-target.block.displayStart),b=Math.min(target.block.text.length,Math.max(a+1,end-target.block.displayStart)),range=textRange(target.node,a,b);
 const rect=range?.getClientRects()[0];if(!rect)return false;
 pauseSync();doc.scrollTop+=rect.top-doc.getBoundingClientRect().top-20;
 if(select){root.focus({preventScroll:true});const selection=getSelection();selection.removeAllRanges();selection.addRange(range);}
 else if(!target.block.heading&&window.CSS?.highlights&&window.Highlight)CSS.highlights.set(side+'-clause',new Highlight(range));
 return true;
}
function scrollProseTo(side,item){return locateOnPaper($(side==='left'?(store.view==='research'?'editor':'leftPreview'):'reference'),$(side+'Doc'),item,false,side);}
function jumpToClause(side,item){
 if(store.view==='compare'){selectArticle(side,item.id);closeOutline(side);return;}
 if(side==='left'&&store.view==='research')scrollEditorTo(item.start,item.end);
 else if(!scrollProseTo(side,item))return;
 clauseState[side].current=item.id;closeOutline(side);renderOutline(side);
}
for(const side of ['left','right']){
 $(side+'ClauseToggle').onclick=()=>{const open=$(side+'Outline').hidden;closeOutline(side==='left'?'right':'left');$(side+'Outline').hidden=!open;$(side+'ClauseToggle').setAttribute('aria-expanded',String(open));if(open){renderOutline(side);$(side+'ClauseSearch').focus({preventScroll:true});}};
 $(side+'ClauseSearch').oninput=()=>renderOutline(side);
 $(side+'ClauseSearch').onkeydown=e=>{if(e.key==='Enter'){const first=ClauseNavigation.filter(clauseState[side].items,e.target.value)[0];if(first){e.preventDefault();jumpToClause(side,first);}}if(e.key==='ArrowDown'){$(side+'ClauseList').querySelector('button')?.focus();e.preventDefault();}};
 $(side+'ClauseList').onkeydown=e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;const buttons=[...$(side+'ClauseList').querySelectorAll('button')],index=buttons.indexOf(document.activeElement);if(index<0)return;e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,index+(e.key==='ArrowDown'?1:-1)))].focus();};
 $(side+'OutlineClose').onclick=()=>closeOutline(side,true);
 $(side+'DocTop').onclick=()=>{pauseSync();$(side+'Doc').scrollTop=0;clauseState[side].current=null;closeOutline(side);renderOutline(side);};
}
document.addEventListener('pointerdown',e=>{for(const side of ['left','right'])if(!$(side+'Outline').contains(e.target)&&!$(side+'ClauseToggle').contains(e.target))closeOutline(side);});
document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const side of ['left','right'])if(!$(side+'Outline').hidden)closeOutline(side,true);});
const readingStates=new Map();
try{for(const [key,value] of Object.entries(JSON.parse(sessionStorage.getItem('plastic-language-reading-v1'))||{}))readingStates.set(key,value);}catch{}
function readingKey(side,view=store.view){return [side,store[side],view,store.scope].join(':');}
function readingRoot(side){return $(side==='left'?(store.view==='research'?'editor':'leftPreview'):'reference');}
function rememberReading(side){
 const doc=$(side+'Doc'),layout=paperLayouts.get(readingRoot(side)),top=doc.getBoundingClientRect().top;
 const first=layout?.nodes.find(x=>{const r=x.node.getBoundingClientRect();return r.height>0&&r.bottom>top+20;});
 const raw=first?.block.rawStart||0,items=clauseState[side].items,currentItem=items.filter(x=>x.start<=raw).at(-1)||items[0];
 const value={scroll:doc.scrollTop,width:doc.clientWidth,raw,currentId:clauseState[side].current,sectionKey:DocumentLanguage.sectionKey(currentItem)||DocumentLanguage.sectionKey(currentItem?.context)};
 readingStates.set(readingKey(side),value);return value;
}
function persistReadings(){try{sessionStorage.setItem('plastic-language-reading-v1',JSON.stringify(Object.fromEntries(readingStates)));}catch{}}
function renderLanguageControls(){
 for(const side of ['left','right']){const d=store.doc(store[side]),variants=DocumentLanguage.variants(store.docs,d),group=$(side+'LanguageSwitch');group.hidden=new Set(variants.map(x=>x.language)).size<2;
  for(const button of group.querySelectorAll('[data-language]')){button.setAttribute('aria-pressed',String(button.dataset.language===d.language));button.disabled=!variants.some(x=>x.language===button.dataset.language);}
  $(side+'Name').lang=d.language||'zh-CN';
 }
 const notes=[...new Set(['left','right'].map(side=>store.doc(store[side])).filter(d=>d.translationStatus==='machine').map(d=>d.translationNote))];
 $('legalInfo').dataset.hint=['左侧编辑研究稿，右侧查看原文。稿件保存在当前浏览器。',...notes].join('\n');
}
function initialClause(items){return items.find(item=>DocumentLanguage.sectionKey(item)==='article:1')||items[0];}
function restoreReadingPositions(){for(const side of ['left','right']){const items=clauseState[side].items,remembered=readingStates.get(readingKey(side)),first=initialClause(items);if(remembered){pauseSync();if(remembered.width===$(side+'Doc').clientWidth)$(side+'Doc').scrollTop=remembered.scroll;else scrollProseTo(side,{start:remembered.raw,end:remembered.raw+1});clauseState[side].current=items.some(x=>x.id===remembered.currentId)?remembered.currentId:null;}else if(first){scrollProseTo(side,first);clauseState[side].current=first.id;}renderOutline(side);}}
function switchLanguage(side,language){
 const next=DocumentLanguage.counterpart(store.docs,store[side],language);if(!next||next.id===store[side])return;
 $('editor').blur();if(composing){commitEdit();composing=false;}finalizeEditor();
 const previous={},before={left:store.left,right:store.right};for(const s of ['left','right'])previous[s]=rememberReading(s);save();
 const priorSelection=activeSelection;DocumentLanguage.select(store,side,language);activeSelection=null;selectionResolution=null;clearSectionAddress();current=-1;editorDirty=false;if(before.left!==store.left)draftHistory();
 let anchor=null;if(priorSelection){const s=priorSelection.side,key=DocumentLanguage.sectionKey({title:priorSelection.title})||previous[s].sectionKey;anchor=PactResearch.structure(store.doc(store[s]),s==='left'?originalLeftText():store.doc(store.right).text).entries.find(a=>a.articleId===priorSelection.articleId||(key&&DocumentLanguage.sectionKey(a)===key)||PactResearch.titleKey(a.title)===priorSelection.titleKey);if(anchor)activeSelection={side:s,articleId:anchor.articleId,titleKey:PactResearch.titleKey(anchor.title),title:anchor.title};}
 render();
 for(const s of ['left','right']){if(before[s]===store[s]){pauseSync();$(s+'Doc').scrollTop=previous[s].scroll;continue;}const remembered=readingStates.get(readingKey(s)),items=clauseState[s].items,destination=remembered?items.find(x=>x.id===remembered.currentId):items.find(item=>previous[s].sectionKey&&DocumentLanguage.sectionKey(item)===previous[s].sectionKey);if(remembered){pauseSync();if(remembered.width===$(s+'Doc').clientWidth)$(s+'Doc').scrollTop=remembered.scroll;else scrollProseTo(s,{start:remembered.raw,end:remembered.raw+1});}else if(destination||initialClause(items))scrollProseTo(s,destination||initialClause(items));clauseState[s].current=destination?.id||(!remembered?initialClause(items)?.id:null);renderOutline(s);}
 if(anchor)selectArticle(priorSelection.side,anchor.id);updateAddress();for(const s of ['left','right'])rememberReading(s);persistReadings();save();
}
for(const button of document.querySelectorAll('[data-language-side]'))button.onclick=()=>switchLanguage(button.dataset.languageSide,button.dataset.language);
window.addEventListener('pagehide',()=>{rememberReading('left');rememberReading('right');persistReadings();});
window.addEventListener('pageshow',e=>{if(e.persisted){Object.assign(store,DocumentData.load().store);for(const side of ['left','right'])if(store.doc(params.get(side)))store[side]=params.get(side);histories.clear();editorDirty=false;draftHistory();render();save();requestAnimationFrame(restoreReadingPositions);}});
// Shared raw coordinates drive search, article selection, comparison and evidence.
let resultLimit=6;
let activeSelection=null,selectionResolution=null,manualMappings={},comparisonWorker=null,workerTicket=0,workerKey='',searchTimer,resultIndex=-1,topicResults=[],currentEvidence=[];
const asyncComparisons=new Map(),pendingComparisons=new Set(),evidenceCaches=new Map();
try{manualMappings=JSON.parse(localStorage.getItem('pactlens-article-links-v1'))||{};}catch{}
function originalLeftText(){return store.doc(store.left).text;}
function resolveSelection(){
 if(!activeSelection)return null;
 const side=activeSelection.side,source=store.doc(store[side]),text=side==='left'?originalLeftText():source.text,items=PactResearch.structure(source,text).entries;
 const anchor=items.find(a=>a.articleId===activeSelection.articleId)||items.find(a=>PactResearch.titleKey(a.title)===activeSelection.titleKey);
 if(!anchor)return {status:'pending',reason:'条款位置待核查',left:[],right:[]};
 const target=store.doc(store[side==='left'?'right':'left']),match=PactResearch.matchArticle(source,target,anchor,manualMappings,{sourceText:text,targetText:side==='right'?originalLeftText():target.text});
 return {...match,anchor,left:side==='left'?[anchor]:match.items,right:side==='right'?[anchor]:match.items};
}
function activeRanges(side){const r=selectionResolution||resolveSelection();if(!r)return null;return (r[side]||[]).map(a=>({start:a.start,end:a.rangeEnd}));}
function computeScopedComparison(left,right){
 selectionResolution=resolveSelection();
 if(selectionResolution?.status==='missing')return {count:0,missing:true,leftAnnotations:[],rightAnnotations:[]};
 if(selectionResolution?.status!=='confirmed')if(activeSelection)return {count:0,pending:true,leftAnnotations:[],rightAnnotations:[]};
 const leftText=originalLeftText(),options={leftText,rightText:right.text,ignoreFormatting:true,ignoreNumbering:true};
 if(activeSelection){options.leftRanges=activeRanges('left');options.rightRanges=activeRanges('right');}
 const key=['revision-word-1',left.id,right.id,PactResearch.hash(leftText),right.textSha256||PactResearch.hash(right.text),JSON.stringify(options.leftRanges),JSON.stringify(options.rightRanges),options.ignoreFormatting,options.ignoreNumbering].join('|');workerKey=key;
 if(asyncComparisons.has(key))return asyncComparisons.get(key);
 if(!comparisonWorker){const result=PactResearch.compare(left,right,options);asyncComparisons.set(key,result);return result;}
 if(!pendingComparisons.has(key)){pendingComparisons.add(key);comparisonWorker.postMessage({ticket:++workerTicket,key,left,right,options});}
 return {count:0,loading:true,leftAnnotations:[],rightAnnotations:[]};
}
function panel(id,open,returnFocus=false){const node=$(id),trigger={articlePanel:'articleToggle',summaryPanel:'summaryToggle',searchPanel:'search'}[id];node.hidden=!open;node.classList.toggle('open',open);if(open&&['searchPanel','articlePanel'].includes(id)){const anchor=id==='searchPanel'?$('search').closest('.topic-field'):$(trigger),r=anchor.getBoundingClientRect(),width=node.getBoundingClientRect().width;node.style.left=Math.max(12,Math.min(r.left,innerWidth-width-12))+'px';node.style.top=(document.querySelector('.operationbar').getBoundingClientRect().bottom-2)+'px';}if(trigger)$(trigger).setAttribute('aria-expanded',String(open));if(!open&&returnFocus&&trigger)$(trigger).focus({preventScroll:true});}
function dismissTools(except){for(const id of ['articlePanel','summaryPanel','searchPanel'])if(id!==except)panel(id,false);}
function clearCoordinates(){current=-1;hitIndex=-1;hits=[];document.querySelectorAll('.change-current').forEach(n=>n.classList.remove('change-current'));if(window.CSS?.highlights){CSS.highlights.delete('left-clause');CSS.highlights.delete('right-clause');}}
function selectArticle(side,id,preserveSearch=false){
 if(!preserveSearch)searchHighlightTerms=[];
 if(composing)return;finalizeEditor();const source=store.doc(store[side]),text=side==='left'?originalLeftText():source.text,article=PactResearch.structure(source,text).entries.find(a=>a.id===id||a.articleId===id);if(!article)return;
 activeSelection={side,articleId:article.articleId,titleKey:PactResearch.titleKey(article.title),title:article.title};clearCoordinates();dismissTools();if(store.view!=='compare')changeView('compare');else renderText();
 for(const s of ['left','right']){const first=selectionResolution?.[s]?.[0];if(first){scrollProseTo(s,{start:first.start,end:first.end});clauseState[s].current=first.id;renderOutline(s);}}
 if(article.number){params.set('article',article.number);params.delete('section');}else{params.delete('article');params.set('section',article.id);}if(side==='right')params.set('sectionSide','right');else params.delete('sectionSide');updateAddress();
}
function clearSectionAddress(){for(const key of ['article','section','sectionSide'])params.delete(key);}
function selectFullText(){searchHighlightTerms=[];$('search').value='';activeSelection=null;selectionResolution=null;clearCoordinates();clearSectionAddress();updateAddress();dismissTools();renderText();}
function updateAddress(){for(const s of ['left','right'])params.set(s,store[s]);params.set('view',store.view);try{history.replaceState(null,'','workspace.html?'+params.toString());}catch{}}
function fileNature(d){return !d.bundledSource?'用户导入文本':d.bilingualGroup==='aid-to-negotiations-2026'?'非正式参考文件':d.bilingualGroup==='inc52-chair'?'主席修订提案':d.bilingualGroup==='inc5-compilation'?'案文汇编':d.meetingId==='inc-1'?'术语表':'草案或谈判材料';}
function sourceLabel(d){return DocumentLanguage.versionLabel(d);}
function refreshTools(){
 $('articleToggle').textContent=activeSelection?(selectionResolution?.anchor?.title.split(' · ')[0]||activeSelection.title)+' ⌄':'全文 ⌄';
 $('summaryToggle').disabled=store.view!=='compare';
 for(const side of ['left','right']){const select=$(side+'Version'),docs=DocumentLanguage.versionOptions(DocumentData.library(store),{side,leftId:store.left,meetings:MeetingData.meetings}),key=docs.map(d=>d.id).join('|')+'@'+store[side];if(select.dataset.options!==key){select.replaceChildren();if(!docs.some(d=>d.id===store[side])){const option=el('option',sourceLabel(store.doc(store[side])));option.value=store[side];option.hidden=true;option.disabled=true;select.append(option);}for(const doc of docs){const option=el('option',sourceLabel(doc));option.value=doc.id;select.append(option);}select.dataset.options=key;}select.value=store[side];}
 if(!$('summaryPanel').hidden)renderSummary();
}
function renderArticlePicker(){const list=$('articleResults');list.replaceChildren();const full=el('button','全文');full.onclick=selectFullText;list.append(full);const doc=store.doc(store.left),items=PactResearch.structure(doc,originalLeftText()).entries,query=$('articleSearch').value;
 for(const a of PactResearch.filterArticles(items,query)){const button=el('button',a.title);button.onclick=()=>selectArticle('left',a.articleId);list.append(button);}if(list.children.length===1&&query)list.append(el('p','未找到条款。','empty-line'));
}
function switchVersion(side,id){if(composing)return;clearTimeout(editTimer);finalizeEditor();save();store[side]=id;if(side==='left')DocumentLanguage.syncReference(store);editorDirty=false;activeSelection=null;selectionResolution=null;searchHighlightTerms=[];clearCoordinates();clearSectionAddress();draftHistory();render();updateAddress();save();restoreReadingPositions();dismissTools();}
function showTopicResults(preserveLimit=false){
 if(preserveLimit!==true)resultLimit=6;clearTimeout(searchTimer);
 const q=$('search').value.trim();resultIndex=-1;$('search').removeAttribute('aria-activedescendant');if(!q){panel('searchPanel',false);return;}
 topicResults=PactResearch.search(DocumentData.library(store),q,{}).sort((a,b)=>Number([store.left,store.right].includes(b.documentId))-Number([store.left,store.right].includes(a.documentId))||b.score-a.score||Number(store.doc(b.documentId).language===store.doc(store.left).language)-Number(store.doc(a.documentId).language===store.doc(store.left).language));const results=$('topicResults');results.replaceChildren();$('resultCount').textContent=topicResults.length+' 条';
 const type={direct:'直接命中',synonym:'双语术语匹配',related:'议题关联'};
 for(const [index,result]of topicResults.slice(0,resultLimit).entries()){
  const d=store.doc(result.documentId),button=el('button',null,'topic-result');button.id='topic-result-'+index;button.setAttribute('role','option');button.setAttribute('aria-selected','false');
  button.append(el('strong',result.article.title),el('small',sourceLabel(d)+(result.scope==='draft'?' · 研究稿':'')+(result.type==='related'?' · 关联':'')));button.title=type[result.type]+'：'+result.term+'\n'+result.snippet+'\n'+fileNature(d);button.onclick=()=>chooseSearchResult(result);results.append(button);
 }
 if(topicResults.length>resultLimit){const more=el('button','显示更多');more.onclick=()=>{resultLimit+=6;showTopicResults(true);$('search').focus({preventScroll:true});};results.append(more);}
 if(!topicResults.length){results.append(el('p','未找到相关条款。','empty-line'));const clear=el('button','清空搜索');clear.onclick=()=>{$('search').value='';panel('searchPanel',false);$('search').focus();};results.append(clear);}
 dismissTools('searchPanel');panel('searchPanel',true);
}
function chooseSearchResult(result){
 clearTimeout(searchTimer);
 if(composing)return;finalizeEditor();save();let side=result.documentId===store.right?'right':'left';if(store[side]!==result.documentId){store[side]=result.documentId;editorDirty=false;draftHistory();}
 const peerSide=side==='left'?'right':'left',chosen=store.doc(store[side]),peer=store.doc(store[peerSide]);if(chosen.language&&peer.language&&chosen.language!==peer.language){const parallel=DocumentLanguage.counterpart(store.docs,peer.id,chosen.language);if(parallel){store[peerSide]=parallel.id;if(peerSide==='left'){editorDirty=false;draftHistory();}}}
 store.scope='original';searchHighlightTerms=PactResearch.expand($('search').value).terms.map(t=>t.text);activeSelection=null;clearCoordinates();if(store.view!=='compare')changeView('compare');else render();selectArticle(side,result.articleId,true);updateAddress();save();
}
function pageLabel(page){return page?'p.'+page.start+(page.end!==page.start?'–'+page.end:''):'页码未提供';}
function renderMapping(container){
 container.append(el('p',selectionResolution?.reason||'对应条款待确认','empty-line'));const side=activeSelection?.side||'left',other=side==='left'?'right':'left',target=store.doc(store[other]),choices=el('div',null,'mapping-options');
 for(const a of PactResearch.structure(target,other==='left'?originalLeftText():target.text).entries){const label=el('label'),box=document.createElement('input');box.type='checkbox';box.value=a.articleId;box.checked=selectionResolution?.[other]?.some(x=>x.articleId===a.articleId)||false;label.append(box,document.createTextNode(a.title));choices.append(label);}container.append(choices);const confirm=el('button','确认对应条款');confirm.onclick=()=>{const chosen=[...choices.querySelectorAll('input:checked')].map(x=>x.value);if(!chosen.length)return;const source=store.doc(store[side]),anchor=selectionResolution?.anchor;if(!anchor)return;for(const entry of PactResearch.structure(target,other==='left'?originalLeftText():target.text).entries){const reverse=PactResearch.mapKey(target,source,entry.articleId);if(manualMappings[reverse]){manualMappings[reverse]=manualMappings[reverse].filter(id=>id!==anchor.articleId);if(!manualMappings[reverse].length)delete manualMappings[reverse];}}manualMappings[PactResearch.mapKey(source,target,anchor.articleId)]=chosen;for(const id of chosen)manualMappings[PactResearch.mapKey(target,source,id)]=[...new Set([...(manualMappings[PactResearch.mapKey(target,source,id)]||[]),anchor.articleId])];try{localStorage.setItem('pactlens-article-links-v1',JSON.stringify(manualMappings));}catch{notice('对应关系仅在本次会话中保存。');}clearCoordinates();renderText();for(const s of ['left','right']){const a=selectionResolution?.[s]?.[0];if(a)scrollProseTo(s,a);}};container.append(confirm);
}
function evidenceQuote(text,source,location,modelText){const quote=el('blockquote');const labels=PactResearch.listLabels(source,modelText);for(const block of DocumentLayout.project(text).blocks){const label=labels.find(x=>x.start>=location.start+block.rawStart&&x.start<location.start+block.rawEnd);quote.append(el('p',(label?label.label+' ':'')+block.text));}return quote;}
function renderSummary(){
 const box=$('summaryContent');box.replaceChildren();currentEvidence=[];$('summaryTitle').textContent='有什么区别';$('summaryDirection').hidden=!activeSelection||!!comparison.pending;
 if(!activeSelection){box.append(el('p','选择条款后查看区别。','empty-line'));const b=el('button','选择条款');b.onclick=()=>{dismissTools('articlePanel');renderArticlePicker();panel('articlePanel',true);$('articleSearch').focus();};box.append(b);return;}
 if(comparison.missing){box.append(el('h3',(activeSelection.side==='left'?'新增':'删除')+'“'+selectionResolution.anchor.title+'”','missing-change'));const locate=el('button','定位原文');locate.onclick=()=>{panel('summaryPanel',false);scrollProseTo(activeSelection.side,selectionResolution.anchor);};const b=el('button','调整对应条款');b.onclick=()=>{box.replaceChildren();renderMapping(box);};box.append(locate,b);return;}
 if(comparison.pending){renderMapping(box);return;}if(comparison.loading){box.append(el('p','正在核对文字变化…','empty-line'));return;}if(comparison.error){box.append(el('p','比较未完成，请重新选择条款。','empty-line'));return;}
 if(comparison.bilingual){box.append(el('p','两侧语言不同，请切换为同一语言核对版本变化。','empty-line'));return;}
 if(!comparison.count){box.append(el('p','当前条款无文字变化。','empty-line'));return;}
 const left=store.doc(store.left),right=store.doc(store.right);currentEvidence=evidenceCaches.get(workerKey);if(!currentEvidence){currentEvidence=PactResearch.summaries(comparison,left,right,{leftText:originalLeftText(),leftArticle:selectionResolution?.left?.[0],leftArticles:selectionResolution?.left||[],rightArticles:selectionResolution?.right||[],pages:window.SourcePages||{}});evidenceCaches.set(workerKey,currentEvidence);if(evidenceCaches.size>24)evidenceCaches.delete(evidenceCaches.keys().next().value);}
 if(!currentEvidence.length){box.append(el('p','原文位置待核查，暂不生成摘要。','empty-line'));return;}
 if(selectionResolution?.left?.length>1||selectionResolution?.right?.length>1)box.append(el('p','已确认：左 '+selectionResolution.left.length+' 条 ↔ 右 '+selectionResolution.right.length+' 条','summary-meta'));
 const grouped=PactResearch.changeKinds.map(kind=>({...kind,items:currentEvidence.filter(ev=>ev.kind===kind.id),limit:0}));let budget=5;while(budget&&grouped.some(g=>g.limit<g.items.length))for(const group of grouped)if(budget&&group.limit<group.items.length){group.limit++;budget--;}
 function evidenceItem(ev){const item=el('article',null,'evidence-item'),heading=el('h4'),actions=el('div',null,'evidence-actions'),locate=el('button','定位原文'),toggle=el('button','查看原文'),collapse=el('div',null,'collapse'),inner=el('div',null,'collapse-inner'),content=el('div',null,'evidence-text');item.dataset.changeKind=ev.kind;if(ev.leftLocation.paragraphNumber)heading.append(el('span','第'+ev.leftLocation.paragraphNumber+'款 · ','evidence-location'));heading.append(document.createTextNode(ev.description));locate.onclick=()=>locateEvidence(ev);collapse.id=ev.evidenceId;collapse.inert=true;toggle.setAttribute('aria-controls',collapse.id);toggle.setAttribute('aria-expanded','false');toggle.onclick=()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'收起原文':'查看原文';collapse.classList.toggle('open',open);collapse.inert=!open;};
  const operations=el('div',null,'operation-list');for(const op of ev.operations){const line=el('p',null,'operation-line');if(op.deleted)line.append(el('del',op.deleted));if(op.deleted&&op.inserted)line.append(document.createTextNode(' → '));if(op.inserted)line.append(el('ins',op.inserted));operations.append(line);}content.append(operations);
  for(const side of ['left','right']){const d=side==='left'?left:right,location=ev[side+'Location'],article=selectionResolution?.[side]?.find(a=>a.articleId===ev[side+'ArticleId']),tag=side==='left'?'左':'右',label=(article?.title.split(' · ')[0]||'条款待核查')+' · '+(location.paragraphNumber?'第'+location.paragraphNumber+'款':'款号未解析');content.append(el('p',tag+' · '+label+' · '+pageLabel(location.page),'summary-meta'),evidenceQuote(ev[side+'Text'],d,location,side==='left'?originalLeftText():d.text));if(location.page&&d.fileType==='PDF'){const a=el('a','打开'+tag+'侧 PDF '+pageLabel(location.page));a.href=d.originalUrl+'#page='+location.page.start;a.target='_blank';a.rel='noopener';content.append(a);}}
  content.append(el('small',ev.verificationStatus==='page-mapped'?'文本及 PDF 页码已映射':'文本位置已核对；缺失页码不作推测'));inner.append(content);collapse.append(inner);actions.append(toggle,locate);item.append(heading,actions,collapse);return item;
 }
 for(const group of grouped){const section=el('section',null,'summary-group');section.dataset.changeKind=group.id;const heading=el('h3',group.label,'summary-group-title');heading.append(el('span',group.items.length+' 项'));section.append(heading);const entries=el('div');entries.append(...group.items.slice(0,group.limit).map(evidenceItem));section.append(entries);if(group.items.length>group.limit){const more=el('button','显示其余 '+(group.items.length-group.limit)+' 项','summary-more');more.onclick=()=>{entries.append(...group.items.slice(group.limit).map(evidenceItem));more.remove();};section.append(more);}box.append(section);}
 const remap=el('button','调整对应条款');remap.onclick=()=>{box.replaceChildren();renderMapping(box);};box.append(remap);
 if(comparison.uncertain?.length){const review=el('button','核查疑似断行连字符（'+comparison.uncertain.length+'）');review.onclick=()=>{panel('summaryPanel',false);const r=comparison.uncertain[0];scrollProseTo(r.side,r);};box.append(review);}
}
function locateEvidence(ev){
 panel('summaryPanel',false);const results=[];for(const side of ['left','right']){const loc=ev[side+'Location'],raw=side==='left'?originalLeftText():store.doc(store.right).text;if(raw.slice(loc.start,loc.end)!==ev[side+'Text']){results.push((side==='left'?'左':'右')+'侧位置已改变，需重新核查');continue;}if(!scrollProseTo(side,loc))results.push((side==='left'?'左':'右')+'侧原文未能定位');}
 if(results.length)notice(results.join('；'));else{setTimeout(()=>{if(window.CSS?.highlights){CSS.highlights.delete('left-clause');CSS.highlights.delete('right-clause');}},2400);$('summaryToggle').focus({preventScroll:true});}
}
function initializeResearchTools(){
 let warm=DocumentData.library(store).slice();const preindex=()=>{const doc=warm.shift();if(doc)PactResearch.structure(doc);if(warm.length)(window.requestIdleCallback||setTimeout)(preindex);};(window.requestIdleCallback||setTimeout)(preindex);
 try{comparisonWorker=new Worker('analysis-worker.js?v=revision-word-1');comparisonWorker.onmessage=({data})=>{pendingComparisons.delete(data.key);asyncComparisons.set(data.key,data.error?{count:0,error:data.error,leftAnnotations:[],rightAnnotations:[]}:data.result);if(asyncComparisons.size>24)asyncComparisons.delete(asyncComparisons.keys().next().value);if(workerKey===data.key&&store.view==='compare'&&!composing)renderText();};comparisonWorker.onerror=()=>{comparisonWorker.terminate();comparisonWorker=null;pendingComparisons.clear();notice('后台比较暂不可用，已切换本地计算。');if(store.view==='compare')renderText();};}catch{}
 for(const side of ['left','right'])$(side+'Version').onchange=e=>switchVersion(side,e.target.value);
 $('articleToggle').onclick=()=>{const open=$('articlePanel').hidden;dismissTools('articlePanel');renderArticlePicker();panel('articlePanel',open);if(open)$('articleSearch').focus();};$('articleSearch').oninput=renderArticlePicker;$('articleSearch').onkeydown=e=>{if(e.key==='Enter')$('articleResults').querySelector('button'+($('articleSearch').value?':nth-child(2)':''))?.click();};
 $('summaryToggle').onclick=()=>{const open=$('summaryPanel').hidden;dismissTools('summaryPanel');panel('summaryPanel',open);if(open){renderSummary();$('closeSummary').focus();}};
 $('settingsToggle').onclick=()=>{dismissTools();togglePopover('settings','settingsToggle');};
 $('closeArticles').onclick=()=>panel('articlePanel',false,true);$('closeSummary').onclick=()=>panel('summaryPanel',false,true);$('closeSearch').onclick=()=>panel('searchPanel',false,true);
 $('search').oncompositionend=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(showTopicResults,180);};$('search').oninput=e=>{topicResults=[];resultIndex=-1;$('search').removeAttribute('aria-activedescendant');clearTimeout(searchTimer);if(e.isComposing)return;searchTimer=setTimeout(showTopicResults,180);};$('search').onclick=()=>{if($('search').value.trim())showTopicResults();};$('search').onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();if($('searchPanel').hidden)showTopicResults();const options=[...$('topicResults').querySelectorAll('[role=option]')];if(!options.length)return;resultIndex=(resultIndex+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;options.forEach((b,i)=>b.setAttribute('aria-selected',String(i===resultIndex)));$('search').setAttribute('aria-activedescendant',options[resultIndex].id);options[resultIndex].scrollIntoView({block:'nearest'});}else if(e.key==='Enter'){e.preventDefault();if(!topicResults.length)showTopicResults();if(topicResults.length)chooseSearchResult(topicResults[Math.max(0,resultIndex)]); }else if(e.key==='Escape'){panel('searchPanel',false);}};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){dismissTools();$('search').removeAttribute('aria-activedescendant');}if(store.view==='compare'&&(e.metaKey||e.ctrlKey)&&e.key==='f'){e.preventDefault();$('search').focus();showTopicResults();}});
 window.addEventListener('resize',()=>{for(const id of ['articlePanel','searchPanel'])if(!$(id).hidden)panel(id,true);});
 document.addEventListener('pointerdown',e=>{for(const [id,trigger]of [['articlePanel','articleToggle'],['summaryPanel','summaryToggle']])if(!$(id).contains(e.target)&&!$(trigger).contains(e.target))panel(id,false);});
}

initializeResearchTools();
draftHistory();render();updateAddress();save();
requestAnimationFrame(()=>{restoreReadingPositions();const side=params.get('sectionSide')==='right'?'right':'left',article=params.get('article'),section=params.get('section');if(article||section){const hit=PactResearch.structure(store.doc(store[side]),side==='left'?originalLeftText():store.doc(store.right).text).entries.find(a=>section?a.id===section||a.articleId===section:a.number===article);if(hit){if(store.view==='compare')selectArticle(side,hit.id);else{activeSelection={side,articleId:hit.articleId,titleKey:PactResearch.titleKey(hit.title),title:hit.title};selectionResolution=resolveSelection();const item=clauseState[side].items.find(a=>DocumentLanguage.sectionKey(a)===DocumentLanguage.sectionKey(hit))||hit;scrollProseTo(side,item);clauseState[side].current=item.id;renderOutline(side);}}}});
