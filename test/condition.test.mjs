import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assess,conditionFromTitle} from '../src/core.mjs';
import {parseDealabs,parseRebuy} from '../src/sources.mjs';
const config=JSON.parse(readFileSync(new URL('../config.json',import.meta.url)));
const now=Date.parse('2026-09-25T12:00:00Z');
const title='Occasion : Sony WH-1000XM5 noir — Très bon état';
const deal={title,...conditionFromTitle(title),price:40,shipping:0,productKey:'headphones',exclusions:[]};
const evidence={type:'buyback',provider:'Rebuy',productKey:'headphones',titleVerified:true,price:150,grade:'A1',conditionPrices:{A1:150,A2:130,A3:110,A4:100},currency:'EUR',country:'FR',observedAt:new Date(now).toISOString(),url:'https://www.rebuy.fr/vendre/test_1',assumptions:[]};
test('declared condition is not inferred from a bare refurbished or grade A label',()=>{
  assert.equal(conditionFromTitle('Casque neuf').condition,'new');
  assert.equal(conditionFromTitle('Casque comme neuf').condition,'used');
  assert.equal(conditionFromTitle('Occasion casque très bon état').conditionGrade,'very-good');
  assert.equal(conditionFromTitle('Occasion casque bon état').conditionGrade,'good');
  for(const t of ['Reconditionné casque','Casque occasion Grade A','Casque occasion état correct'])assert.equal(conditionFromTitle(t).conditionGrade,'unknown');
});
test('used offers use the lowest complete grade grid and a larger risk reserve',()=>{
  const a=assess(deal,evidence,config,now);
  assert.equal(a.qualified,true);assert.equal(a.resale,100);assert.equal(a.riskRate,15);assert.equal(a.fees,23);assert.equal(a.profit,37);assert.equal(a.evidence.grade,'A4');
  assert.ok(a.assumptions.some(s=>s.includes('pas un minimum garanti')));
  assert.equal(assess(deal,a.evidence,config,now).profit,a.profit);
});
test('incomplete or inconsistent used price grids cannot trigger alerts',()=>{
  for(const conditionPrices of [undefined,{A1:150,A2:130,A3:110},{A1:150,A2:130,A3:110,A4:200}])assert.equal(assess(deal,{...evidence,conditionPrices},config,now).qualified,false);
  assert.equal(assess(deal,{...evidence,provider:'Unknown'},config,now).qualified,false);
});
test('unknown grade, spoofed state and defects keep the deal unverified',()=>{
  for(const patch of [{title:'Casque reconditionné',conditionGrade:'unknown'},{title:'Casque reconditionné',conditionGrade:'very-good'},{conditionWarnings:['batterie hs']}]){
    const a=assess({...deal,...patch},evidence,config,now);assert.equal(a.qualified,false);assert.equal(a.profit,null);
  }
});
test('new offers retain A1 and the existing reserve',()=>{
  const a=assess({...deal,condition:'new',conditionGrade:'new'},evidence,config,now);
  assert.equal(a.resale,150);assert.equal(a.riskRate,5);assert.equal(a.profit,94.5);
});
test('RSS preserves explicit used condition and defects in descriptions',()=>{
  const xml='<rss xmlns:pepper="http://www.pepper.com/rss"><channel><item><title>'+title+'</title><link>https://www.dealabs.com/bons-plans/used-fixture</link><pepper:merchant price="40€"/><description>Batterie HS</description><pubDate>Fri, 25 Sep 2026 10:00:00 GMT</pubDate></item></channel></rss>';
  const [d]=parseDealabs(xml,{id:'test',name:'test'});assert.equal(d.conditionGrade,'very-good');assert.deepEqual(d.conditionWarnings,['batterie hs']);
});

test('an apparently new title cannot hide a defect or a used mention in the description',()=>{
  const d={...deal,title:'Casque Sony WH-1000XM5 noir',...conditionFromTitle('Casque Sony WH-1000XM5 noir')};
  assert.equal(assess({...d,conditionWarnings:['batterie hs']},evidence,config,now).profit,null);
  const xml='<rss xmlns:pepper="http://www.pepper.com/rss"><channel><item><title>'+d.title+'</title><link>https://www.dealabs.com/bons-plans/used-fixture</link><pepper:merchant price="40€"/><description>Produit reconditionné</description></item></channel></rss>';
  const [parsed]=parseDealabs(xml,{id:'test',name:'test'});
  assert.equal(parsed.conditionWarnings.length,1);
  assert.equal(assess({...d,...parsed,productKey:'headphones'},evidence,config,now).qualified,false);
});
test('Rebuy keeps only grade prices corroborated by their matching variant',()=>{
  const p={id:1,name:'Test noir',allowed_purchase:true,is_purchaseable:true,purchase_stop:false,purchase_a1_price:15000,purchase_a2_price:13000,purchase_a3_price:11000,purchase_a4_price:10000,variants:[{label:'A1',purchasePrice:15000},{label:'A2',purchasePrice:13000},{label:'A3',purchasePrice:999},{label:'A4',purchasePrice:10000}]};
  const html='<h1>Test noir</h1><script id="ry-inject" type="application/json">'+JSON.stringify({locale:'fr',currencyTemplate:'€',productDetailViewDto:{product:p}})+'</script>';
  const e=parseRebuy(html,{providerId:1,key:'test',expectedTitle:['Test noir'],url:'https://www.rebuy.fr/vendre/test_1'});
  assert.deepEqual(e.conditionPrices,{A1:150,A2:130,A4:100});
});
