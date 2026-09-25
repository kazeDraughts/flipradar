import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,dirname,resolve} from 'node:path';
import {fetchPublic,parseDealabs,parseEasyCash,parseRebuy} from '../src/sources.mjs';
import {classify,matchingMapping,assess,fresh} from '../src/core.mjs';
import {radarHealth} from '../src/health.mjs';
import {productIdentity,discoverRebuy} from '../src/discovery.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(await readFile(join(root,'config.json'),'utf8'));
const now=new Date().toISOString();
let previous={deals:[]};try{previous=JSON.parse(await readFile(join(root,'public/data/deals.json'),'utf8'));}catch{}
const status=[],collected=[];
for(const source of config.sources){
  try{
    if(source.type!=='dealabs-rss')throw Error('Connecteur inconnu');
    const {text}=await fetchPublic(source.url);
    const items=parseDealabs(text,source,now);if(!items.length)throw Error('Flux sans offres exploitables');
    collected.push(...items);status.push({id:source.id,name:source.name,url:source.url,status:'ok',count:items.length,checkedAt:now});
  }catch(e){status.push({id:source.id,name:source.name,url:source.url,status:'error',error:e.message,checkedAt:now});}
}
const byId=new Map(previous.deals.filter(d=>fresh(d.publishedAt,Date.parse(now),config.maximumOfferAgeHours)).map(d=>[d.id,{...d,stale:true}]));
for(const deal of collected)byId.set(deal.id,{...deal,firstSeen:byId.get(deal.id)?.firstSeen||now,stale:false});
const evidenceCache=new Map(),discoveryCache=new Map();const deals=[];let excluded=0;
for(const mapping of config.productMappings){
  const provider=mapping.provider||'easycash';
  const name=(provider==='rebuy'?'Rebuy':'Easy Cash')+' · '+mapping.label;
  try{const parser=provider==='rebuy'?parseRebuy:provider==='easycash'?parseEasyCash:null;if(!parser)throw Error('Connecteur de comparaison inconnu');const {text}=await fetchPublic(mapping.url);evidenceCache.set(mapping.key,parser(text,mapping,now));status.push({id:mapping.key,name,url:mapping.url,status:'ok',count:1,checkedAt:now});}
  catch(e){evidenceCache.set(mapping.key,null);status.push({id:mapping.key,name,url:mapping.url,status:'error',error:e.message,checkedAt:now});}
}
// Newest offers get discovery capacity first; old cached offers cannot consume it.
for(const deal of [...byId.values()].sort((a,b)=>Number(a.stale)-Number(b.stale)||Date.parse(b.publishedAt)-Date.parse(a.publishedAt))){
  deal.exclusions=classify(deal,config,Date.parse(now));
  if(deal.exclusions.length){excluded++;continue;}
  deal.productKey=null;delete deal.discovery;
  const mapping=matchingMapping(deal,config.productMappings);let evidence=null;
  if(mapping){deal.productKey=mapping.key;
    evidence=evidenceCache.get(mapping.key);
  }
  if(!evidence&&!deal.stale&&config.automaticRebuyDiscovery){
    const identity=productIdentity(deal.title);
    if(identity){
      if(!discoveryCache.has(identity.key)&&discoveryCache.size<config.maximumDiscoveryQueries){
        try{
          const result=await discoverRebuy(identity,{observedAt:now});discoveryCache.set(identity.key,result);
          if(result.evidence){evidenceCache.set(result.mapping.key,result.evidence);status.push({id:result.mapping.key,name:'Rebuy · recherche automatique · '+result.evidence.title,url:result.evidence.url,status:'ok',count:1,checkedAt:now});}
        }catch(e){discoveryCache.set(identity.key,{status:'error',reason:e.message});status.push({id:'discovery-'+identity.key,name:'Rebuy · recherche automatique · '+identity.query,status:'error',error:e.message,checkedAt:now});}
      }
      const result=discoveryCache.get(identity.key);
      deal.discovery=result?{status:result.status,searchUrl:result.searchUrl,reason:result.reason}:{status:'deferred',reason:'Limite de recherches atteinte pour ce scan ; comparaison non effectuée.'};
      if(result?.evidence){deal.productKey=result.mapping.key;evidence=result.evidence;}
    }else deal.discovery={status:'unsupported',reason:'Modèle, capacité ou couleur insuffisamment précis, ou famille de produit non encore reconnue automatiquement.'};
  }
  if(deal.stale)deal.exclusions.push('Offre absente du dernier flux : prix et disponibilité à revérifier');
  deal.analysis=assess(deal,evidence,config,Date.parse(now));deals.push(deal);
  if(!evidence&&deal.discovery?.reason)deal.analysis.reasons.push(deal.discovery.reason);
}
deals.sort((a,b)=>Number(b.analysis.qualified)-Number(a.analysis.qualified)||(config.preferNew?Number(b.condition==='new')-Number(a.condition==='new'):0)||Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
const data={schemaVersion:1,updatedAt:now,sources:status,referencePrices:[...evidenceCache.values()].filter(Boolean),excludedCount:excluded,deals,policy:{budget:config.maximumPurchase,minimumProfit:config.minimumProfit,minimumRoi:config.minimumRoiPercent,alertsEnabled:config.alertsEnabled,alertChannel:'GitHub email',scope:'France · neuf prioritaire'}};
data.health=radarHealth(data,config,Date.parse(now));
await mkdir(join(root,'public/data'),{recursive:true});
await writeFile(join(root,'public/data/deals.json'),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({offers:deals.length,qualified:deals.filter(d=>d.analysis.qualified).length,excluded,sources:status.map(s=>({name:s.name,status:s.status,error:s.error}))},null,2));
console.log(JSON.stringify({health:data.health},null,2));
process.exitCode=data.health.exitCode;
