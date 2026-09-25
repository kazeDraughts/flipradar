import { createHash } from 'node:crypto';

export const normal = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
export const idFor = value => createHash('sha256').update(value).digest('hex').slice(0,20);
export function euros(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  const clean = String(value ?? '').replace(/[\s\u00a0\u202f€]/g,'').replace(/EUR/gi,'').replace(',','.');
  return /^\d+(?:\.\d{1,2})?$/.test(clean) ? Number(clean) : null;
}
export function httpsUrl(value, base) { try {const u=new URL(value,base);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;} }
export function fresh(iso, now, hours) {const age=now-Date.parse(iso);return Number.isFinite(age)&&age>=-60000&&age<=hours*3600000;}
export function classify(offer, config, now=Date.now()) {
  const reasons=[];
  if(!Number.isFinite(offer.price)||offer.price<=0) reasons.push('Prix exploitable absent');
  if(offer.price>config.maximumPurchase) reasons.push('Hors budget');
  if(!fresh(offer.publishedAt,now,config.maximumOfferAgeHours)) reasons.push('Offre ancienne ou date absente');
  const title=normal(offer.title),category=normal(offer.category);
  for(const pattern of config.excludedTitlePatterns) if(title.includes(normal(pattern))) reasons.push('Condition particulière : '+pattern);
  for(const pattern of config.excludedCategoryPatterns) if(category.includes(normal(pattern))) reasons.push('Catégorie exclue : '+pattern);
  if(/\b(?:lot|pack)\b/.test(title)) reasons.push('Composition du lot à vérifier');
  return reasons;
}
export function matchingMapping(offer,mappings) {
  const title=normal(offer.title);
  const matches=mappings.filter(m=>m.required.every(word=>(Array.isArray(word)?word:[word]).some(w=>(' '+title+' ').includes(' '+normal(w)+' '))) && !(m.excluded||[]).some(word=>(' '+title+' ').includes(' '+normal(word)+' ')));
  return matches.length===1?matches[0]:null;
}
export function assess(offer,evidence,config,now=Date.now()) {
  const reasons=[...(offer.exclusions||[])];
  const output={status:'unverified',qualified:false,comparisonVerified:false,resale:null,cost:null,fees:null,profit:null,roi:null,score:null,liquidity:'Non mesurée',reasons,evidence:evidence||null,assumptions:[]};
  if(!evidence) {reasons.push('Aucun prix de reprise ni historique de ventes comparable disponible');return output;}
  if(evidence.productKey!==offer.productKey||!evidence.productKey) reasons.push('Référence exacte non concordante');
  if(evidence.currency!=='EUR'||evidence.country!=='FR') reasons.push('Marché ou devise non comparable');
  if(!fresh(evidence.observedAt,now,24)) reasons.push('Référence de marché périmée');
  let resale;
  if(evidence.type==='buyback') {
    if(!Number.isFinite(evidence.price)||evidence.price<=0) reasons.push('Prix de reprise absent');
    if(!evidence.titleVerified) reasons.push('Modèle de reprise non vérifié');
    if(!httpsUrl(evidence.url)) reasons.push('Source du prix de reprise absente');
    if(offer.condition!=='new') reasons.push('État réel de l’occasion à contrôler avant reprise');
    resale=evidence.price;
    output.liquidity='Reprise professionnelle, sous contrôle';
    output.assumptions.push('Estimation de rachat non contractuelle, sous réserve de contrôle de l’état, des accessoires et de l’éligibilité du vendeur.');
  } else if(evidence.type==='sold') {
    const seen=new Set();
    const sales=(evidence.sales||[]).filter(s=>{
      const valid=s.status==='sold'&&s.productKey===offer.productKey&&s.condition===offer.condition&&s.currency==='EUR'&&s.country==='FR'&&fresh(s.soldAt,now,config.maximumEvidenceAgeDays*24)&&Number.isFinite(s.price)&&s.price>0&&httpsUrl(s.url)&&!seen.has(s.url);
      if(valid)seen.add(s.url);return valid;
    });
    output.evidence={...evidence,sales};
    if(sales.length<config.minimumComparableSales) reasons.push('Pas assez de ventes conclues comparables');
    const monthly=sales.filter(s=>fresh(s.soldAt,now,30*24)).length;
    if(monthly<config.minimumMonthlySales) reasons.push('Demande récente insuffisamment documentée');
    const prices=sales.map(s=>s.price).sort((a,b)=>a-b);
    resale=prices.length?prices[Math.floor((prices.length-1)*.25)]*(1-config.resaleHaircutPercent/100):null;
    output.liquidity=monthly+' ventes comparables sur 30 jours';
    output.assumptions.push('Prix prudent : premier quartile des ventes comparables, diminué de '+config.resaleHaircutPercent+' %.');
  } else {reasons.push('Type de preuve non reconnu');return output;}
  // Invalid/stale/mismatched evidence must never produce apparent profit figures.
  if(reasons.length||!Number.isFinite(resale)||resale<=0||!Number.isFinite(offer.price)||offer.price<=0) return output;
  if(offer.shipping!=null&&(!Number.isFinite(offer.shipping)||offer.shipping<0)) {reasons.push('Transport entrant invalide');return output;}
  output.comparisonVerified=true;
  const inbound=Number.isFinite(offer.shipping)?offer.shipping:config.inboundShippingReserve;
  if(!Number.isFinite(offer.shipping))output.assumptions.push('Transport entrant estimé : '+inbound+' € ; à confirmer à la commande.');
  const cost=offer.price+inbound;
  const feeRate=evidence.type==='buyback'?0:config.sellingFeePercent;
  const outbound=evidence.type==='buyback'&&evidence.freeShipping?0:config.outboundShipping;
  const fees=resale*(feeRate+config.riskReservePercent)/100+outbound;
  const profit=resale-cost-fees;
  const roi=100*profit/cost;
  Object.assign(output,{resale:round(resale),cost:round(cost),fees:round(fees),profit:round(profit),roi:round(roi),feeRate,outbound,inbound});
  if(cost>config.maximumPurchase)reasons.push('Coût total supérieur au budget');
  if(profit<config.minimumProfit)reasons.push('Bénéfice inférieur à '+config.minimumProfit+' €');
  if(roi<config.minimumRoiPercent)reasons.push('Rendement inférieur à '+config.minimumRoiPercent+' %');
  if(reasons.length===0){output.status='qualified';output.qualified=true;output.score=Math.min(95,Math.round(65+Math.min(roi,60)/2));}
  else output.status=profit<=0?'unprofitable':'unverified';
  output.assumptions.push('Provision de risque : '+config.riskReservePercent+' % de la revente. Calcul avant fiscalité et rémunération du temps. Stock et prix à reconfirmer avant achat.');
  return output;
}
