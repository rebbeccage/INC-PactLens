(function(root){
'use strict';
const base='https://www.unep.org/en/inc-plastic-pollution/';
const meetings=[
 {id:'inc-1',shortName:'INC-1',name:'第一届会议',startDate:'2022-11-28',endDate:'2022-12-02',displayDate:'2022.11.28–12.02',country:'乌拉圭',city:'埃斯特角城',officialUrl:base+'sessions/first-session'},
 {id:'inc-2',shortName:'INC-2',name:'第二届会议',startDate:'2023-05-29',endDate:'2023-06-02',displayDate:'2023.05.29–06.02',country:'法国',city:'巴黎',officialUrl:base+'sessions/second-session'},
 {id:'inc-3',shortName:'INC-3',name:'第三届会议',startDate:'2023-11-13',endDate:'2023-11-19',displayDate:'2023.11.13–11.19',country:'肯尼亚',city:'内罗毕',officialUrl:base+'sessions/third-session'},
 {id:'inc-4',shortName:'INC-4',name:'第四届会议',startDate:'2024-04-23',endDate:'2024-04-29',displayDate:'2024.04.23–04.29',country:'加拿大',city:'渥太华',officialUrl:base+'sessions/fourth-session'},
 {id:'inc-5-1',shortName:'INC-5.1',name:'第五届会议第一部分',startDate:'2024-11-25',endDate:'2024-12-01',displayDate:'2024.11.25–12.01',country:'韩国',city:'釜山',officialUrl:base+'sessions/first-part-fifth-session'},
 {id:'inc-5-2',shortName:'INC-5.2',name:'第五届会议第二部分',startDate:'2025-08-05',endDate:'2025-08-15',displayDate:'2025.08.05–08.15',country:'瑞士',city:'日内瓦',officialUrl:base+'sessions/second-part-fifth-session',dateNote:'官方目录及页面标题仍列原定会期 2025 年 8 月 5—14 日；会议主页正文确认实际延续至 15 日。本页显示实际会期。'},
 {id:'inc-5-3',shortName:'INC-5.3',name:'第五届会议第三部分',startDate:'2026-02-07',endDate:'2026-02-07',displayDate:'2026.02.07',country:'肯尼亚',city:'内罗布',officialUrl:base+'sessions/third-part-fifth-session',dateNote:'该次会议处理组织、行政及官员选举事项，未进行实质谈判。此节点不预置虚构的新谈判案文。'}
].map(m=>Object.freeze(m));
const get=id=>meetings.find(m=>m.id===id);
const demoMetadata={
 'demo-a':{shortTitle:'全生命周期措施',meetingId:'inc-4',relatedMeetingIds:[],publishedDate:null},
 'demo-b':{shortTitle:'基础条款',meetingId:'inc-5-2',relatedMeetingIds:[],publishedDate:null},
 'demo-c':{shortTitle:'替代措辞',meetingId:'inc-4',relatedMeetingIds:['inc-5-1','inc-5-2'],publishedDate:null}
};
function ready(d){return !!d&&d.textReady!==false&&typeof d.text==='string';}
function matches(d,id){return ready(d)&&(!id||d.meetingId===id||(d.relatedMeetingIds||[]).includes(id));}
const validFilter=id=>id===null||!!get(id);
function enrich(d){const meta=demoMetadata[d.id];return Object.freeze({shortTitle:d.name,meetingId:null,relatedMeetingIds:[],publishedDate:null,source:d.demo?{type:'demo',label:'虚构交互示例 / 无官方案文来源'}:{type:'local',label:d.name},textReady:typeof d.text==='string',...meta,...d,shortTitle:d.shortTitle||meta?.shortTitle||d.name});}
class HomeState{
 constructor(docs,saved={}){this.docs=docs;this.filter=saved.filter==='intersessional'?'inc-5-3':validFilter(saved.filter)?saved.filter:'inc-5-2';this.target=saved.target==='right'?'right':'left';this.choice={left:null,right:null};for(const side of ['left','right'])if(ready(docs.find(d=>d.id===saved.choice?.[side])))this.choice[side]=saved.choice[side];this.focusedId=this.visible.find(d=>d.id===saved.focusedId)?.id||this.visible[0]?.id||null;}
 get visible(){return this.docs.filter(d=>matches(d,this.filter));}
 get focused(){return this.docs.find(d=>d.id===this.focusedId);}
 setFilter(id){this.filter=validFilter(id)?id:null;if(!this.visible.some(d=>d.id===this.focusedId))this.focusedId=this.visible[0]?.id||null;}
 browse(id){if(this.visible.some(d=>d.id===id))this.focusedId=id;}
 choose(id,side=this.target){if(!ready(this.docs.find(d=>d.id===id)))return false;this.choice[side]=id;if(side==='left'&&!this.choice.right)this.target='right';return true;}
 locate(id){const d=this.docs.find(d=>d.id===id);if(!d)return;if(!matches(d,this.filter))this.filter=get(d.meetingId)?d.meetingId:null;this.focusedId=id;}
 snapshot(){return {filter:this.filter,focusedId:this.focusedId,target:this.target,choice:{...this.choice}};}
}
const api={meetings,get,ready,matches,enrich,HomeState,directoryUrl:base+'documents',activitiesUrl:base+'activities'};
if(typeof module!=='undefined')module.exports=api;root.MeetingData=api;
})(typeof window==='undefined'?globalThis:window);
