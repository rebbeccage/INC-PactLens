(function(root){
'use strict';
// Search relationships expand recall; they do not assert legal equivalence.
const rows=[
 ['products','塑料制品禁限','Plastic products',['塑料制品','塑料产品'],['plastic products'],['禁塑','禁限','限制','禁止','逐步淘汰','prohibit','ban','restrict','phase out','phase-out','phase-down']],
 ['epr','生产者责任延伸','Extended producer responsibility',['生产者责任延伸','生产者延伸责任','EPR'],['extended producer responsibility'],['生产者责任','producer responsibility']],
 ['design','产品设计','Plastic product design',['产品设计','塑料产品设计','塑料制品设计'],['plastic product design'],['可维修','可重复使用','repairability','reusability']],
 ['chemicals','化学品及聚合物','Chemicals and polymers',['化学品','化学物质','聚合物'],['chemicals','polymers'],['受关注化学品','chemicals of concern','primary plastic polymers']],
 ['production','塑料生产','Plastic production',['塑料生产','初级塑料聚合物'],['plastic production','primary plastic polymers'],['生产限制','生产上限','production cap','supply']],
 ['waste','废物管理','Waste management',['废物管理','废弃物管理','塑料废物管理'],['waste management','plastic waste'],['废物处置','回收利用','waste disposal','recycling']],
 ['recycled','再生材料','Recycled materials',['再生材料','再生塑料','再生含量'],['recycled materials','recycled plastic','recycled content'],['再生料','二次塑料','secondary plastics']],
 ['finance','融资机制','Financial mechanism',['融资机制','资金机制','财政资源','财务资源'],['financial resources','financial mechanism'],['融资','资金','finance','funding']],
 ['compliance','履约与报告','Compliance and reporting',['履约','遵约','报告'],['compliance','reporting'],['实施','implementation','national reports']],
 ['plans','国家行动计划','National plans',['国家行动计划','国家计划'],['national plans','national action plans'],['行动计划','action plans']]
];
const topics=rows.map(([topicId,zh,en,zhTerms,enTerms,related])=>({topicId,zh,en,terms:[{text:zh,type:'synonym',weight:1},{text:en,type:'synonym',weight:1},...zhTerms.map(text=>({text,type:'synonym',weight:1})),...enTerms.map(text=>({text,type:'synonym',weight:1})),...related.map(text=>({text,type:'related',weight:.45}))]}));
const aliases=[['范围','适用范围','scope'],['目标','宗旨','目的','objective'],['定义','definitions'],['原则与方法','原则和方法','原则和方针','principles and approaches']];
const api={topics,aliases};if(typeof module!=='undefined')module.exports=api;root.PactTopics=api;
})(typeof window==='undefined'?globalThis:window);
