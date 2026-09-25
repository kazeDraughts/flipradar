import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,symlinkSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {alertCandidates} from '../src/alerts.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));

test('real scan pipeline: feeds → automatic matching → profit decision → alert candidates',()=>{
  const sandbox=mkdtempSync(join(tmpdir(),'flipradar-scan-test-'));
  try{
    cpSync(join(root,'src'),join(sandbox,'src'),{recursive:true});
    cpSync(join(root,'scripts'),join(sandbox,'scripts'),{recursive:true});
    symlinkSync(join(root,'node_modules'),join(sandbox,'node_modules'),'junction');
    const base=JSON.parse(readFileSync(join(root,'config.json'),'utf8'));
    const config={...base,productMappings:[],sources:[{id:'fixture',name:'Test RSS',type:'dealabs-rss',url:'https://www.dealabs.com/rss'}]};
    writeFileSync(join(sandbox,'config.json'),JSON.stringify(config));
    // Offline synthetic responses only. These files are never published or emailed.
    const stub=`const price=Number(process.env.FIXTURE_PRICE);const failed=process.env.FIXTURE_FAIL==='true';
      const title='Samsung Galaxy S25 Ultra Dual SIM 256 Go noir titane';
      const path='/vendre/mobile/samsung-galaxy-s25-ultra-dual-sim-256-go-noir-titane_15586569';
      globalThis.fetch=async url=>{
        if(String(url)==='https://www.dealabs.com/rss')return new Response('<rss xmlns:pepper="http://www.pepper.com/rss"><channel><item><title>'+title+'</title><link>https://www.dealabs.com/bons-plans/synthetic-test-only</link><pepper:merchant name="Test" price="'+price+'"/><pubDate>'+new Date().toUTCString()+'</pubDate></item></channel></rss>');
        if(failed)return new Response('Unavailable',{status:403});
        if(String(url).startsWith('https://www.rebuy.fr/vendre/rechercher?'))return new Response('<a href="'+path+'">'+title+'</a>');
        if(String(url)==='https://www.rebuy.fr'+path)return new Response('<h1>'+title+'</h1><script id="ry-inject" type="application/json">'+JSON.stringify({locale:'fr',currencyTemplate:'0,00 €',productDetailViewDto:{product:{id:15586569,name:title,allowed_purchase:true,is_purchaseable:true,purchase_stop:false,purchase_a1_price:40000,variants:[{label:'A1',purchasePrice:40000}]}}})+'</script>');
        throw Error('Unexpected network request: '+url);
      };`;
    writeFileSync(join(sandbox,'mock-network.mjs'),stub);
    function run(price,failed=false){
      const result=spawnSync(process.execPath,['--import',pathToFileURL(join(sandbox,'mock-network.mjs')).href,join(sandbox,'scripts/scan.mjs')],{cwd:sandbox,encoding:'utf8',timeout:15000,env:{...process.env,FIXTURE_PRICE:String(price),FIXTURE_FAIL:String(failed)}});
      assert.ifError(result.error);
      assert.ok([0,3].includes(result.status),result.stderr||result.stdout);
      const data=JSON.parse(readFileSync(join(sandbox,'public/data/deals.json'),'utf8'));
      return {result,data};
    }
    const profitable=run(100);
    assert.equal(profitable.result.status,0,profitable.result.stderr);
    assert.equal(profitable.data.deals.length,1);
    assert.equal(profitable.data.deals[0].analysis.qualified,true);
    assert.equal(profitable.data.health.comparedOffers,1);
    assert.equal(alertCandidates(profitable.data,config,[]).length,1);
    const expensive=run(500);
    assert.equal(expensive.result.status,0);
    assert.equal(expensive.data.deals[0].analysis.status,'unprofitable');
    assert.equal(alertCandidates(expensive.data,config,[]).length,0);
    const unavailable=run(100,true);
    assert.equal(unavailable.result.status,3);
    assert.equal(unavailable.data.health.state,'comparison_failed');
    assert.equal(unavailable.data.deals[0].analysis.profit,null);
    assert.equal(alertCandidates(unavailable.data,config,[]).length,0);
  }finally{
    assert.equal(dirname(sandbox),tmpdir());
    rmSync(sandbox,{recursive:true,force:true});
  }
});
