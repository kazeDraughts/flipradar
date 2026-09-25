import {load} from 'cheerio';
import {normal,idFor} from './core.mjs';
import {fetchPublic,parseRebuy} from './sources.mjs';

// Closed vocabularies for variants: an unknown/missing colour never becomes a guess.
const colours=[
  ['titanium-jetblack',['noir absolu titane','titanium jetblack','titanium jet black']],
  ['titanium-black',['titanium black','noir titane','titane noir']],
  ['titanium-grey',['titanium gray','titanium grey','gris titane','titane gris']],
  ['titanium-blue',['titanium blue','bleu titane','titane bleu']],
  ['titanium-silver',['titanium silver','argent titane']],
  ['titanium-white',['titanium white','titane blanc','blanc titane']],
  ['titanium-natural',['natural titanium','titane naturel']],
  ['titanium-desert',['desert titanium','titane desert']],
  ['phantom-black',['noir fantome','phantom black']],
  ['midnight-blue',['bleu nuit','midnight blue']],
  ['platinum-silver',['argent platine','platinum silver']],
  ['deep-blue',['bleu profond','deep blue']],
  ['black',['noir','noire','black']], ['white',['blanc','blanche','white']],
  ['grey',['gris','grise','gray','grey']], ['blue',['bleu','bleue','blue']],
  ['green',['vert','verte','green']], ['pink',['rose','pink']],
  ['orange',['orange']], ['silver',['argent','silver']], ['gold',['or','gold']],
  ['violet',['violet','violette','purple']], ['beige',['beige']], ['red',['rouge','red']],
  ['midnight',['minuit','midnight']], ['starlight',['lumiere stellaire','starlight']],
  ['obsidian',['obsidienne','obsidian']], ['porcelain',['porcelaine','porcelain']],
];
function colourOf(title){
  let rest=' '+title+' ';const found=[];
  for(const [key,aliases] of colours){
    if(aliases.some(a=>rest.includes(' '+a+' '))){found.push(key);for(const a of aliases)rest=rest.replaceAll(' '+a+' ',' ');}
  }
  return found.length===1?found[0]:null;
}
const accessory=/\b(?:pour|coque|housse|protection|coussinets|embouts|boitier seul|boitier de charge|piece|pieces|reparation|defectueux|panne|lot|pack|import|globale|global|chinoise|chinois|japon|us|usa|seul|seule|selection|plusieurs|au choix)\b/;
export function productIdentity(title){
  const n=normal(String(title).replace(/\b(S\d{2})\s*\+/gi,'$1 plus')).replace(/\bfold\s*(\d+)/g,'fold $1').replace(/\bflip\s*(\d+)/g,'flip $1');
  if(accessory.test(n))return null;
  if(/(?:iphone|pixel|galaxy|1000\s?xm).*\b(?:ou|et)\b/.test(n))return null;
  let model,brand,family,storage=null;
  const sony=n.match(/\b(?:wh|wf)\s?1000\s?xm\d+\b/);
  const samsung=n.match(/\b(?:samsung\s+)?(?:galaxy\s+)?(s\d{2}(?:\s+(?:ultra|plus|fe))?|a\d{2}(?:\s+[45]g)?|z\s+(?:fold|flip)\s+\d+(?:\s+ultra)?)\b/);
  const iphone=n.match(/\biphone\s+(\d{1,2}[e]?(?:\s+(?:pro max|pro|plus|mini))?)\b/);
  const pixel=n.match(/\bpixel\s+(\d{1,2}a?(?:\s+(?:pro xl|pro fold|pro|xl))?)\b/);
  if(sony&&/\bsony\b/.test(n)){brand='sony';model=sony[0].replaceAll(' ','');family='audio';}
  else if(samsung&&/\bsamsung\b/.test(n)){brand='samsung';model='galaxy '+samsung[1];family='phone';if(/^a\d{2}$/.test(samsung[1]))return null;}
  else if(iphone){brand='apple';model='iphone '+iphone[1];family='phone';}
  else if(pixel){brand='google';model='pixel '+pixel[1];family='phone';}
  else return null;
  // Earlier Galaxy S/FE generations exist in distinct 4G and 5G versions.
  if(brand==='samsung'&&/^galaxy s(?:10|20)\b/.test(model)){
    const network=n.match(/\b([45]g)\b/);if(!network)return null;model+=' '+network[1];
  }
  if((n.match(/\b(?:iphone|pixel|galaxy|(?:wh|wf)\s?1000\s?xm\d+)\b/g)||[]).length>1)return null;
  // Avoid accessory or mixed-model titles that happen to contain a supported model.
  if(family==='phone'&&/\b(?:montre|watch|tablette|ipad|ordinateur|pc|ceinture|support|etui|chargeur|cable)\b/.test(n))return null;
  if(family==='audio'&&/\b(?:etui|chargeur|cable|arceau|batterie)\b/.test(n))return null;
  const colour=colourOf(n);if(!colour)return null;
  if(family==='phone'){
    const sizes=[...n.matchAll(/\b(\d+)\s*(go|gb|to|tb|g)\b/g)].map(m=>({value:Number(m[1]),tb:/^t/.test(m[2])})).filter(m=>m.tb||m.value>=32).map(m=>m.tb?m.value*1024:m.value);
    const unique=[...new Set(sizes)];if(unique.length!==1)return null;storage=unique[0];
  }
  return {family,brand,model,storage,colour,key:[brand,model,storage||'',colour].join('|'),query:[brand,model,storage?storage+' Go':''].filter(Boolean).join(' ')};
}
export function searchCandidates(html,identity){
  const doc=load(html),matches=new Map();
  for(const a of doc('a[href]').toArray()){
    let url;try{url=new URL(doc(a).attr('href'),'https://www.rebuy.fr');}catch{continue;}
    if(url.origin!=='https://www.rebuy.fr'||!/^\/vendre\/(?:mobile|casques-et-ecouteurs)\/[^/]+_\d+$/.test(url.pathname))continue;
    const title=doc(a).text().replace(/\s+/g,' ').trim();
    const candidate=productIdentity(title);
    if(candidate?.key===identity.key){const providerId=Number(url.pathname.match(/_(\d+)$/)[1]);matches.set(providerId,{providerId,url:url.origin+url.pathname,title});}
  }
  return [...matches.values()];
}
export async function discoverRebuy(identity,{fetcher=fetchPublic,observedAt=new Date().toISOString()}={}){
  const searchUrl='https://www.rebuy.fr/vendre/rechercher?query='+encodeURIComponent(identity.query);
  const search=await fetcher(searchUrl);
  const candidates=searchCandidates(search.text,identity);
  if(candidates.length!==1)return {status:'unmatched',searchUrl,reason:candidates.length?'Plusieurs références Rebuy concordent : modèle exact à préciser.':'Aucune référence Rebuy avec le même modèle, la même capacité et la même couleur.'};
  const candidate=candidates[0],page=await fetcher(candidate.url),doc=load(page.text);
  const productTitle=doc('h1').toArray().map(e=>doc(e).text()).find(t=>productIdentity(t)?.key===identity.key);
  if(!productTitle)throw Error('La fiche Rebuy ne confirme pas la variante trouvée');
  const mapping={key:'rebuy-auto-'+idFor(identity.key),provider:'rebuy',providerId:candidate.providerId,url:candidate.url,expectedTitle:[productTitle],
    quoteAssumptions:['Correspondance automatique du titre : modèle, capacité et couleur. Version régionale, connectivité, facture et accessoires à confirmer avant achat.']};
  const evidence=parseRebuy(page.text,mapping,observedAt);
  return {status:'matched',searchUrl,mapping,evidence};
}
