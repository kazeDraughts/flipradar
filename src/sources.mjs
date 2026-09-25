import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { load } from 'cheerio';
import { euros, httpsUrl, idFor, normal } from './core.mjs';

const allowed=new Set(['www.dealabs.com','prix.easycash.fr','www.rebuy.fr']);
export async function fetchPublic(url,{timeout=20000}={}) {
  const initial=new URL(url);if(initial.protocol!=='https:'||!allowed.has(initial.hostname))throw Error('Source non autorisée');
  let target=url;
  for(let hop=0;hop<4;hop++){
    const response=await fetch(target,{redirect:'manual',signal:AbortSignal.timeout(timeout),headers:{'User-Agent':'FlipRadar/1.0 (+https://github.com/kazeDraughts/flipradar)','Accept':'application/rss+xml,text/html,application/xml;q=0.9'}});
    if([301,302,303,307,308].includes(response.status)) {const next=new URL(response.headers.get('location'),target);if(next.protocol!=='https:'||!allowed.has(next.hostname))throw Error('Redirection de source non autorisée');target=next.href;continue;}
    if(response.status!==200)throw Error('HTTP '+response.status);
    const length=Number(response.headers.get('content-length'));if(length>3000000)throw Error('Réponse trop volumineuse');
    const reader=response.body.getReader();let size=0;const parts=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>3000000){await reader.cancel();throw Error('Réponse trop volumineuse');}parts.push(value);}
    return {text:Buffer.concat(parts).toString('utf8'),url:target};
  }
  throw Error('Trop de redirections');
}
export function parseDealabs(xml,source,observedAt=new Date().toISOString()) {
  if(/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw Error('Flux XML invalide');
  const parsed=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@',parseTagValue:false,processEntities:true}).parse(xml);
  if(!parsed.rss?.channel)throw Error('Structure RSS non reconnue');
  const raw=parsed.rss.channel.item||[];const items=Array.isArray(raw)?raw:[raw];
  return items.flatMap(item=>{
    const url=httpsUrl(item.link);if(!url||new URL(url).hostname!=='www.dealabs.com')return [];
    const merchant=item['pepper:merchant']||{};
    const title=String(item.title||'').trim();if(!title)return [];
    const plain=load(String(item.description||'')).text();
    const condition=/occasion|reconditionn|seconde main/i.test(title)?'used':'new';
    const shipping=/livraison\s+(?:est\s+)?(?:gratuite|offerte)/i.test(plain)?0:null;
    const publication=Date.parse(item.pubDate);
    return [{id:idFor(url),title,url,source:source.name,sourceId:source.id,merchant:String(merchant['@name']||'À vérifier'),category:String(item.category||''),price:euros(merchant['@price']),currency:'EUR',country:'FR',condition,shipping,publishedAt:Number.isFinite(publication)?new Date(publication).toISOString():null,observedAt,productKey:null}];
  });
}
export function parseEasyCash(html,mapping,observedAt=new Date().toISOString()) {
  const doc=load(html);
  const title=doc('h1').first().text().trim();
  const priceNodes=doc('.sell-price--price').map((i,e)=>euros(doc(e).text())).get().filter(x=>Number.isFinite(x));
  const unique=[...new Set(priceNodes)];
  if(unique.length!==1||unique[0]<=0||!doc('body').text().includes('Offre de reprise'))throw Error('Prix de reprise non reconnu');
  const verified=mapping.expectedTitle.every(t=>normal(title).includes(normal(t)));
  if(!verified)throw Error('Modèle de reprise différent de la référence attendue');
  return {type:'buyback',provider:'Easy Cash',productKey:mapping.key,price:unique[0],currency:'EUR',country:'FR',url:mapping.url,title,titleVerified:true,observedAt,freeShipping:false};
}

export function parseRebuy(html,mapping,observedAt=new Date().toISOString()) {
  const url=new URL(mapping.url);
  if(url.protocol!=='https:'||url.hostname!=='www.rebuy.fr'||!url.pathname.startsWith('/vendre/'))throw Error('URL de reprise Rebuy invalide');
  const doc=load(html);
  const nodes=doc('script#ry-inject[type="application/json"]');
  if(nodes.length!==1)throw Error('Données de reprise Rebuy absentes');
  const data=JSON.parse(nodes.text());
  const product=data.productDetailViewDto?.product;
  if(data.locale!=='fr'||!String(data.currencyTemplate).includes('€'))throw Error('Marché Rebuy non comparable');
  if(!product||String(product.id)!==String(mapping.providerId)||!url.pathname.endsWith('_'+product.id))throw Error('Référence Rebuy différente');
  if(product.allowed_purchase!==true||product.is_purchaseable!==true||product.purchase_stop!==false)throw Error('Reprise Rebuy non disponible');
  const title=String(product.name||'');
  if(!mapping.expectedTitle.every(t=>(' '+normal(title)+' ').includes(' '+normal(t)+' '))||!doc('h1').toArray().some(e=>normal(doc(e).text())===normal(title)))throw Error('Modèle Rebuy non concordant');
  // A1 = comme neuf. Never use retail prices, coupons, vouchers or A0 as cash proceeds.
  const cents=product.purchase_a1_price;
  const variants=product.variants?.filter(v=>v.label==='A1')||[];
  if(!Number.isSafeInteger(cents)||cents<=0||variants.length!==1||variants[0].purchasePrice!==cents)throw Error('Prix de reprise Rebuy absent ou incohérent');
  return {type:'buyback',provider:'Rebuy',productKey:mapping.key,price:cents/100,currency:'EUR',country:'FR',url:mapping.url,title,titleVerified:true,observedAt,freeShipping:false,
    assumptions:['Tarif de rachat public A1 (« comme neuf »), paiement en argent hors coupons et bons d’achat. Le questionnaire final et le contrôle du produit peuvent modifier ce montant.',
      'Hypothèse : produit pleinement fonctionnel, authentique, complet avec tous les accessoires d’origine requis. Éligibilité du vendeur et conditions de reprise à confirmer.',
      ...(mapping.quoteAssumptions||[])]};
}
