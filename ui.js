(function(root){
'use strict';
let active=null,anchor=null;
const bubble=document.createElement('div');bubble.id='hintBubble';bubble.className='hint-bubble';bubble.role='tooltip';bubble.hidden=true;document.body.append(bubble);
function position(panel,button){
 const r=button.getBoundingClientRect(),gap=10,pad=14;
 panel.style.left='0px';panel.style.top='0px';
 const box=panel.getBoundingClientRect(),left=Math.max(pad,Math.min(innerWidth-box.width-pad,r.left+r.width/2-box.width/2));
 const top=r.bottom+gap+box.height<=innerHeight-pad?r.bottom+gap:Math.max(pad,r.top-box.height-gap);
 panel.style.left=left+'px';panel.style.top=top+'px';
}
function close(focus=false){if(!active)return;const button=anchor;active instanceof HTMLDialogElement?active.close():active.hidden=true;button?.setAttribute('aria-expanded','false');button?.removeAttribute('aria-describedby');active=anchor=null;if(focus)button?.focus({preventScroll:true});}
function open(panel,button){if(active===panel&&anchor===button){close();return;}close();anchor=button;active=panel;panel instanceof HTMLDialogElement?panel.show():panel.hidden=false;button.setAttribute('aria-expanded','true');if(panel===bubble)button.setAttribute('aria-describedby',bubble.id);position(panel,button);}
document.addEventListener('click',e=>{const button=e.target.closest('[data-hint]');if(button){bubble.textContent=button.dataset.hint;open(bubble,button);return;}if(active&&!active.contains(e.target)&&!anchor?.contains(e.target))close();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active){e.preventDefault();close(true);}});
window.addEventListener('resize',()=>{if(active)position(active,anchor);});
root.QuietUI={open,close};
})(window);
