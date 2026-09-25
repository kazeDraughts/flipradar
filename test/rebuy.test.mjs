import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseRebuy} from '../src/sources.mjs';
import {assess,matchingMapping} from '../src/core.mjs';
const config=JSON.parse(readFileSync(new URL('../config.json',import.meta.url)));
const mapping=config.productMappings.find(m=>m.providerId===15358283);
const title='Sony PlayStation 5 slim 1 To Édition disque blanc';
const product={id:15358283,name:title,allowed_purchase:true,purchase_stop:false,is_purchaseable:true,purchase_a1_price:42144,variants:[{label:'A1',purchasePrice:42144,price:65999}],price_purchase:44251};
function html(p=product,locale='fr'){return '<h1>'+title+'</h1><script id="ry-inject" type="application/json">'+JSON.stringify({locale,currencyTemplate:'0,00 €',productDetailViewDto:{product:p}})+'</script>';}
test('Rebuy uses A1 cash cents, never retail prices, vouchers or promotional totals',()=>{
  const e=parseRebuy(html(),mapping);assert.equal(e.price,421.44);assert.equal(e.provider,'Rebuy');assert.equal(e.country,'FR');assert.ok(e.assumptions.length);assert.equal(e.freeShipping,false);
});
test('Rebuy rejects unavailable buyback, wrong ID, ambiguous or invalid amount',()=>{
  for(const patch of [{allowed_purchase:false},{purchase_stop:true},{is_purchaseable:false},{id:42},{purchase_a1_price:0},{purchase_a1_price:'42144'},{purchase_a1_price:421.44},{variants:[{label:'A1',purchasePrice:99}]},{variants:[]},{name:'Autre console'}])assert.throws(()=>parseRebuy(html({...product,...patch}),mapping));
  assert.throws(()=>parseRebuy(html(product,'de'),mapping));
  assert.throws(()=>parseRebuy('<html>Validation required</html>',mapping));
});
test('product mapping rejects accessories and different editions',()=>{
  const refs=config.productMappings;
  assert.equal(matchingMapping({title:'Casque Sony WH-1000XM5 noir'},refs)?.key,'sony-wh1000xm5-black');
  assert.equal(matchingMapping({title:'Console Nintendo Switch OLED blanche'},refs)?.key,'nintendo-switch-oled-white');
  assert.equal(matchingMapping({title:'Écouteurs Apple AirPods Pro 2 USB-C'},refs)?.key,'apple-airpods-pro2-usbc');
  for(const title of ['Coussinets pour Sony WH-1000XM5 noir','Console Nintendo Switch OLED Zelda blanche','Boitier AirPods Pro 2 USB-C seul','Écouteur gauche AirPods Pro 2 USB-C','PS5 slim 1 To disque E-Chassis','PS5 slim 1 To disque'])assert.equal(matchingMapping({title},refs),null);
});
test('Rebuy conditions reach the fiche and net margin still includes costs',()=>{
  const now=Date.parse('2026-09-25T12:00:00Z');const e=parseRebuy(html(),mapping,new Date(now).toISOString());
  const a=assess({price:250,shipping:0,productKey:mapping.key,condition:'new',exclusions:[]},e,config,now);
  assert.equal(a.resale,421.44);assert.equal(a.profit,142.37);assert.equal(a.qualified,true);assert.ok(a.assumptions.some(s=>s.includes('hors coupons')));
});
