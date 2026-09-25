import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assess,classify,euros,matchingMapping} from '../src/core.mjs';
import {parseDealabs,parseEasyCash} from '../src/sources.mjs';
const config=JSON.parse(readFileSync(new URL('../config.json',import.meta.url)));
const now=Date.parse('2026-09-25T12:00:00Z');
const deal={id:'test',title:'Objet test',productKey:'test-model',price:100,shipping:0,condition:'new',publishedAt:'2026-09-25T11:00:00Z',category:'Informatique',exclusions:[]};
const quote={type:'buyback',productKey:'test-model',price:200,currency:'EUR',country:'FR',titleVerified:true,url:'https://prix.easycash.fr/test',observedAt:'2026-09-25T11:00:00Z',freeShipping:false};
test('French euro prices do not silently turn ranges or cashback into a price',()=>{assert.equal(euros('1 869,15€'),1869.15);assert.equal(euros('dès 12€'),null);assert.equal(euros('12 à 20€'),null);assert.equal(euros(''),null);assert.equal(euros('gratuit'),null);});
test('net profit includes outbound shipping and risk reserve',()=>{const a=assess(deal,quote,config,now);assert.equal(a.cost,100);assert.equal(a.fees,18);assert.equal(a.profit,82);assert.equal(a.roi,82);assert.equal(a.qualified,true);});
test('unknown shipping is budgeted rather than treated as free',()=>{const a=assess({...deal,shipping:null},quote,config,now);assert.equal(a.cost,110);assert.equal(a.profit,72);});
test('a stale quote never qualifies',()=>{assert.equal(assess(deal,{...quote,observedAt:'2026-09-20T00:00:00Z'},config,now).qualified,false);});
test('invalid evidence never displays an apparent resale margin',()=>{
  for(const evidence of [{...quote,productKey:'other'},{...quote,country:'US'},{...quote,observedAt:'2026-09-20T00:00:00Z'},{...quote,titleVerified:false}]){
    const a=assess(deal,evidence,config,now);assert.equal(a.comparisonVerified,false);assert.equal(a.profit,null);assert.equal(a.resale,null);
  }
});
test('negative shipping cannot inflate profit',()=>{
  const a=assess({...deal,shipping:-50},quote,config,now);assert.equal(a.qualified,false);assert.equal(a.profit,null);
});
test('valid but unprofitable evidence still counts as a verified comparison',()=>{
  const a=assess({...deal,price:250},quote,config,now);assert.equal(a.comparisonVerified,true);assert.equal(a.qualified,false);assert.ok(a.profit<0);
});
test('variant and country mismatches never qualify',()=>{assert.equal(assess(deal,{...quote,productKey:'other'},config,now).qualified,false);assert.equal(assess(deal,{...quote,country:'US'},config,now).qualified,false);});
test('cashback and vouchers are excluded from cash arbitrage',()=>{assert.ok(classify({...deal,title:'Lego via 20€ carte de fidélité'},config,now).length);assert.ok(classify({...deal,title:'30€ en bon d’achat'},config,now).length);});
test('a score is absent when there is no market evidence',()=>{const a=assess(deal,null,config,now);assert.equal(a.profit,null);assert.equal(a.score,null);assert.equal(a.qualified,false);});
test('deduplicate completed sales and exclude asking prices',()=>{const sale={status:'sold',productKey:'test-model',condition:'new',currency:'EUR',country:'FR',soldAt:'2026-09-24T12:00:00Z',price:200,url:'https://example.com/sold/1'};const e={type:'sold',productKey:'test-model',currency:'EUR',country:'FR',observedAt:quote.observedAt,sales:[...Array(8).fill(sale),{...sale,url:'https://example.com/2',status:'active'}]};const a=assess(deal,e,config,now);assert.equal(a.evidence.sales.length,1);assert.equal(a.qualified,false);});
test('new old-looking sales without recent demand do not qualify',()=>{const e={...quote,type:'sold',sales:Array.from({length:6},(_,i)=>({status:'sold',productKey:'test-model',condition:'new',currency:'EUR',country:'FR',soldAt:'2026-07-24T12:00:00Z',price:200,url:'https://example.com/'+i}))};assert.equal(assess(deal,e,config,now).qualified,false);});
test('recognition rejects special editions and accessories',()=>{assert.equal(matchingMapping({title:'Manette Sony DualSense blanche'},config.productMappings)?.key,'sony-dualsense-white-standard');for(const title of ['DualSense Icon Blue Edition limitée','Coque pour DualSense blanche','DualSense Edge blanche'])assert.equal(matchingMapping({title},config.productMappings),null);});
test('RSS parses merchant prices, not discount text',()=>{const xml='<rss xmlns:pepper="http://www.pepper.com/rss"><channel><item><title><![CDATA[Test]]></title><link>https://www.dealabs.com/bons-plans/test</link><pepper:merchant name="Boutique" price="129,99€"/><description><![CDATA[Avant 199€]]></description><pubDate>Fri, 25 Sep 2026 10:00:00 GMT</pubDate></item></channel></rss>';const [d]=parseDealabs(xml,{id:'test',name:'test'});assert.equal(d.price,129.99);assert.equal(d.shipping,null);assert.equal(d.merchant,'Boutique');assert.throws(()=>parseDealabs('<html>Blocked</html>',{}));});
test('Easy Cash requires an unambiguous price and the expected model',()=>{const html='<h1>Sony DualSense Blanc PS5</h1><p>Offre de reprise</p><span class="sell-price--price">24,00</span>';const mapping={key:'x',url:'https://prix.easycash.fr/test',expectedTitle:['DualSense','Blanc']};assert.equal(parseEasyCash(html,mapping).price,24);assert.throws(()=>parseEasyCash(html,{...mapping,expectedTitle:['Bleu']}));assert.throws(()=>parseEasyCash(html+'<span class="sell-price--price">25,00</span>',mapping));});
