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
export function conditionFromTitle(value){
  const title=normal(value);
  const used=/\b(?:occasion|reconditionne\w*|seconde main|comme neuf|excellent etat|tres bon etat|bon etat|etat correct|etat acceptable|grade [abc])\b/.test(title);
  if(!used)return {condition:'new',conditionGrade:'new',conditionLabel:'Neuf présumé'};
  if(/\b(?:comme neuf|excellent etat)\b/.test(title))return {condition:'used',conditionGrade:'like-new',conditionLabel:'Excellent état annoncé'};
  if(/\btres bon etat\b/.test(title))return {condition:'used',conditionGrade:'very-good',conditionLabel:'Très bon état annoncé'};
  if(/\bbon etat\b/.test(title))return {condition:'used',conditionGrade:'good',conditionLabel:'Bon état annoncé'};
  return {condition:'used',conditionGrade:'unknown',conditionLabel:'Occasion : état insuffisamment documenté'};
}
export function classify(offer, config, now=Date.now()) {
  const reasons=[];
  if(!Number.isFinite(offer.price)||offer.price<=0) reasons.push('Prix exploitable absent');
  if(offer.price>config.maximumPurchase) reasons.push('Hors budget');
  if(!fresh(offer.publishedAt,now,config.maximumOfferAgeHours)) reasons.push('Offre ancienne ou date absente');
  const title=normal(offer.title),category=normal(offer.category);
  for(const pattern of config.excludedTitlePatterns) if(title.includes(normal(pattern))) reasons.push('Condition particulière : '+pattern);
  for(const pattern of config.excludedCategoryPatterns) if(category.includes(normal(pattern))) reasons.push('Catégorie exclue : '+pattern);
  if(/\b(?:lot|pack)\b/.test(title)) reasons.push('Composition du lot à vérifier');
  if(/\b(?:odr|cashback|bonus reprise|bonus de reprise|bonus reprises|remise sur facture|sur la carte|compte fidelite|forfait|thecorner|the corner|boursobank|unidays|etudiants|macif avantage|frontaliers)\b/.test(title))reasons.push('Prix soumis à remboursement, reprise, fidélité, localisation ou statut particulier');
  if(offer.conditionalPrice)reasons.push('Condition de prix repérée dans la description : '+offer.conditionalPrice);
  return reasons;
}
export function matchingMapping(offer,mappings) {
  const title=normal(offer.title);
  const matches=mappings.filter(m=>m.required.every(word=>(Array.isArray(word)?word:[word]).some(w=>(' '+title+' ').includes(' '+normal(w)+' '))) && !(m.excluded||[]).some(word=>(' '+title+' ').includes(' '+normal(word)+' ')));
  return matches.length===1?matches[0]:null;
}
export function assess(offer,evidence,config,now=Date.now()) {
  const reasons=[...(offer.exclusions||[])];
  if(offer.conditionWarnings?.length)reasons.push('État ou défaut à vérifier : '+offer.conditionWarnings.join(', '));
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
    resale=evidence.price;
    if(offer.condition!=='new'){
      const declared=conditionFromTitle(offer.title);
      const validGrade=declared.condition==='used'&&['like-new','very-good','good'].includes(declared.conditionGrade)&&declared.conditionGrade===offer.conditionGrade;
      if(!validGrade)reasons.push('État de l’occasion insuffisamment documenté dans le titre');
      const prices=evidence.conditionPrices;
      if(evidence.provider!=='Rebuy'||!prices||!['A1','A2','A3','A4'].every(g=>Number.isFinite(prices[g])&&prices[g]>0)||!(prices.A1>=prices.A2&&prices.A2>=prices.A3&&prices.A3>=prices.A4)){
        reasons.push('Grille de reprise occasion complète et cohérente indisponible');resale=null;
      }else{
        resale=prices.A4;
        output.evidence={...evidence,price:resale,grade:'A4'};
        output.assumptions.push('État annoncé par la source : '+declared.conditionLabel+'. Il ne constitue pas un contrôle physique ni une équivalence de grade entre vendeurs.');
        output.assumptions.push('Scénario occasion prudent : plus bas tarif publié de la grille A1–A4 (A4), même si le vendeur annonce un meilleur état. Ce tarif n’est pas un minimum garanti : défaut technique, batterie, pièces remplacées ou accessoires manquants peuvent entraîner une baisse ou un refus.');
      }
    }
    output.liquidity='Reprise professionnelle, sous contrôle';
    output.assumptions.push('Estimation de rachat non contractuelle, sous réserve de contrôle de l’état, des accessoires et de l’éligibilité du vendeur.');
    output.assumptions.push(...(evidence.assumptions||[]).filter(a=>typeof a==='string'));
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
  const riskRate=offer.condition==='used'?Math.max(config.riskReservePercent,config.usedRiskReservePercent??15):config.riskReservePercent;
  const fees=resale*(feeRate+riskRate)/100+outbound;
  const profit=resale-cost-fees;
  const roi=100*profit/cost;
  Object.assign(output,{resale:round(resale),cost:round(cost),fees:round(fees),profit:round(profit),roi:round(roi),feeRate,riskRate,outbound,inbound});
  if(cost>config.maximumPurchase)reasons.push('Coût total supérieur au budget');
  if(profit<config.minimumProfit)reasons.push('Bénéfice inférieur à '+config.minimumProfit+' €');
  if(roi<config.minimumRoiPercent)reasons.push('Rendement inférieur à '+config.minimumRoiPercent+' %');
  if(reasons.length===0){output.status='qualified';output.qualified=true;output.score=Math.min(95,Math.round(65+Math.min(roi,60)/2));}
  else output.status=profit<=0?'unprofitable':'unverified';
  output.assumptions.push('Provision de risque : '+riskRate+' % de la revente. Calcul avant fiscalité et rémunération du temps. Stock et prix à reconfirmer avant achat.');
  return output;
}
