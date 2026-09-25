import test from 'node:test';
import assert from 'node:assert/strict';
import {productIdentity,searchCandidates,discoverRebuy} from '../src/discovery.mjs';
const identity=productIdentity('Smartphone Samsung Galaxy S25 Ultra RAM 12 Go, 256 Go, Titanium Black');
const title='Samsung Galaxy S25 Ultra Dual SIM 256 Go noir titane';
const path='/vendre/mobile/samsung-galaxy-s25-ultra-dual-sim-256-go-noir-titane_15586569';
const result=(text=title,href=path)=>`<a href="${href}">${text}</a>`;
const page=(name=title)=>`<h1>${name}</h1><script id="ry-inject" type="application/json">${JSON.stringify({locale:'fr',currencyTemplate:'0,00 €',productDetailViewDto:{product:{id:15586569,name,allowed_purchase:true,is_purchaseable:true,purchase_stop:false,purchase_a1_price:52052,variants:[{label:'A1',purchasePrice:52052}]}}})}</script>`;
test('automatic identification preserves model, capacity and exact colour',()=>{
  assert.equal(identity.storage,256);assert.equal(identity.model,'galaxy s25 ultra');
  assert.equal(identity.key,productIdentity(title).key);
  assert.notEqual(identity.key,productIdentity(title.replace('256','512')).key);
  assert.notEqual(identity.key,productIdentity(title.replace('noir titane','noir absolu titane')).key);
  assert.notEqual(identity.key,productIdentity(title.replace('Ultra','')).key);
});
test('plus, pro max, folding models and audio models remain distinct',()=>{
  assert.equal(productIdentity('Samsung S25+ 256 Go noir').model,'galaxy s25 plus');
  assert.equal(productIdentity('Apple iPhone 16 Pro Max 1 To titane naturel').storage,1024);
  assert.equal(productIdentity('Samsung Galaxy Z Fold4 5G 256 GB Noir Dual-SIM').model,'galaxy z fold 4');
  assert.equal(productIdentity('Sony WH-1000XM6 noir').model,'wh1000xm6');
  assert.notEqual(productIdentity('Sony WH-1000XM6 noir').key,productIdentity('Sony WF-1000XM6 noir').key);
});
test('unknown variants, missing capacity, accessories and multiple choices cannot match',()=>{
  for(const t of ['Samsung Galaxy S25 Ultra 256 Go','Samsung Galaxy S25 Ultra noir titane','Samsung Galaxy S25 Ultra 256 Go blanc et noir','Samsung Galaxy S25 Ultra 256 Go ou 512 Go noir','Coque pour Samsung Galaxy S25 Ultra 256 Go noir titane','Samsung Galaxy A55 128 Go noir','iPhone 15 ou iPhone 16 128 Go noir','Sony WH-1000XM5 et WH-1000XM6 noir','Sélection de Samsung Galaxy S25 Ultra 256 Go noir','Samsung Galaxy S25 Ultra 256 Go noir version globale'])assert.equal(productIdentity(t),null,t);
});
test('search deduplicates links and rejects external hosts, retail links and other variants',()=>{
  const html=result()+result()+result(title,'https://evil.example'+path)+result(title,'/acheter/mobile/product_15586569')+result(title.replace('256','512'),path.replace('15586569','42'));
  assert.equal(searchCandidates(html,identity).length,1);
});
test('discovery validates the product page before accepting its cash quote',async()=>{
  const calls=[];const fetcher=async url=>{calls.push(url);return {text:calls.length===1?result():page()};};
  const r=await discoverRebuy(identity,{fetcher,observedAt:'2026-09-25T12:00:00Z'});
  assert.equal(r.status,'matched');assert.equal(r.evidence.price,520.52);assert.equal(calls.length,2);assert.ok(r.evidence.assumptions.some(a=>a.includes('régionale')));
});
test('missing or ambiguous search results never select the first product',async()=>{
  for(const html of ['',result()+result(title,path.replace('15586569','99'))]){
    let calls=0;const r=await discoverRebuy(identity,{fetcher:async()=>{calls++;return {text:html};}});
    assert.equal(r.status,'unmatched');assert.equal(calls,1);
  }
});
test('a redirect-like wrong product page or network refusal fails closed',async()=>{
  let calls=0;
  await assert.rejects(discoverRebuy(identity,{fetcher:async()=>({text:++calls===1?result():page(title.replace('256','512'))})}));
  await assert.rejects(discoverRebuy(identity,{fetcher:async()=>{throw Error('HTTP 403');}}));
});
