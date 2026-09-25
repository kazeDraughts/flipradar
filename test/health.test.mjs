import test from 'node:test';
import assert from 'node:assert/strict';
import {radarHealth} from '../src/health.mjs';
const date='2026-09-25T10:00:00Z',now=Date.parse(date);
const config={sources:[{id:'feed'}]};
const data={updatedAt:date,sources:[{id:'feed',status:'ok'},{id:'quote',status:'ok'}],
  referencePrices:[{observedAt:date}],deals:[{analysis:{comparisonVerified:true,qualified:false}}]};
test('healthy comparisons with no profitable deals are not an outage',()=>{
  const h=radarHealth(data,config,now);assert.equal(h.state,'ready');assert.equal(h.exitCode,0);assert.equal(h.qualifiedOffers,0);assert.equal(h.comparedOffers,1);
});
test('RSS success cannot hide a total comparison outage',()=>{
  const h=radarHealth({...data,sources:[data.sources[0],{id:'quote',status:'error'}],referencePrices:[],deals:[{analysis:{comparisonVerified:false}}]},config,now);
  assert.equal(h.state,'comparison_failed');assert.equal(h.exitCode,3);assert.equal(h.comparedOffers,0);
});
test('comparison responses with no current evidence do not count as ready',()=>{
  assert.equal(radarHealth({...data,referencePrices:[]},config,now).exitCode,3);
  assert.equal(radarHealth({...data,referencePrices:[{observedAt:'2026-09-20T10:00:00Z'}]},config,now).exitCode,3);
});
test('unused working mappings do not imply coverage of the offers',()=>{
  const h=radarHealth({...data,deals:[{analysis:{comparisonVerified:false}}]},config,now);
  assert.equal(h.state,'coverage_missing');assert.equal(h.currentReferences,1);assert.equal(h.unverifiedOffers,1);
});
test('stale offers do not inflate compared or qualified counts',()=>{
  const h=radarHealth({...data,deals:[{stale:true,analysis:{comparisonVerified:true,qualified:true}}]},config,now);
  assert.equal(h.currentOffers,0);assert.equal(h.qualifiedOffers,0);
});
test('partial coverage is explicit',()=>{
  assert.equal(radarHealth({...data,deals:[...data.deals,{analysis:{comparisonVerified:false}}]},config,now).state,'partial');
});
test('failed collection and stale snapshots are failures',()=>{
  assert.equal(radarHealth({...data,sources:[{id:'feed',status:'error'},data.sources[1]]},config,now).exitCode,2);
  assert.equal(radarHealth(data,config,now+4*3600000).exitCode,4);
});
