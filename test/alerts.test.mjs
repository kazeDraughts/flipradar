import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {alertCandidates,marker,alertBody} from '../src/alerts.mjs';
import {assess} from '../src/core.mjs';
const config={...JSON.parse(readFileSync(new URL('../config.json',import.meta.url))),alertsEnabled:true};
const now=Date.parse('2026-09-25T12:00:00Z');
function fixture(){const d={id:'one',title:'Test @other-user',productKey:'test',url:'https://www.dealabs.com/test',price:100,shipping:0,condition:'new',publishedAt:'2026-09-25T11:30:00Z',exclusions:[]};d.analysis=assess(d,{type:'buyback',productKey:'test',price:200,currency:'EUR',country:'FR',titleVerified:true,url:'https://prix.easycash.fr/test',observedAt:'2026-09-25T11:30:00Z'},config,now);return {updatedAt:'2026-09-25T11:30:00Z',deals:[d]};}
test('known alerts are not repeated even if closed',()=>{const d=fixture();assert.equal(alertCandidates(d,config,[],now).length,1);assert.equal(alertCandidates(d,config,[marker('one')],now).length,0);});
test('notification recomputes profitability rather than trusting qualified flag',()=>{const d=fixture();d.deals[0].price=500;assert.equal(alertCandidates(d,config,[],now).length,0);});
test('the amount in the alert is also recomputed before sending',()=>{const d=fixture();d.deals[0].price=120;const [candidate]=alertCandidates(d,config,[],now);assert.equal(candidate.analysis.profit,62);assert.ok(alertBody(candidate,'kazeDraughts').includes('62 €'));});
test('old scans, paused alerts and stale offers cannot notify',()=>{const d=fixture();assert.equal(alertCandidates(d,{...config,alertsEnabled:false},[],now).length,0);assert.equal(alertCandidates({...d,updatedAt:'2026-09-20T12:00:00Z'},config,[],now).length,0);d.deals[0].stale=true;assert.equal(alertCandidates(d,config,[],now).length,0);});
test('untrusted titles cannot mention other accounts',()=>{const body=alertBody(fixture().deals[0],'kazeDraughts');assert.ok(body.includes('@kazeDraughts'));assert.ok(!body.includes('@other-user'));});
