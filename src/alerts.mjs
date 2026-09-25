import {assess,fresh,httpsUrl} from './core.mjs';
const text=value=>String(value??'').replace(/[\r\n]/g,' ').replace(/@/g,'＠').replace(/[\\`*_{}\[\]<>#|]/g,'');
export const marker=id=>'<!-- flipradar:'+id+' -->';
export function alertCandidates(data,config,existingBodies,now=Date.now()) {
  if(!config.alertsEnabled||!fresh(data.updatedAt,now,3))return [];
  const known=existingBodies.join('\n');
  return data.deals.filter(d=>!d.stale&&fresh(d.publishedAt,now,config.maximumOfferAgeHours)&&httpsUrl(d.url)&&!known.includes(marker(d.id))).map(d=>({...d,analysis:assess(d,d.analysis?.evidence,config,now)})).filter(d=>d.analysis.qualified).slice(0,10);
}
export function alertBody(deal,owner) {
  if(!/^[a-zA-Z0-9-]+$/.test(owner))throw Error('Destinataire GitHub invalide');
  const a=deal.analysis,e=a.evidence;
  return `${marker(deal.id)}
@${owner}

Une offre passe les seuils configurés. Vérifier le stock et les conditions avant achat.

**${text(deal.title)}**

- Achat affiché : ${deal.price} €
- Coût achat + transport : ${a.cost} €
- Revente / reprise estimée : ${a.resale} €
- Frais et réserve de risque : ${a.fees} €
- **Bénéfice estimé : ${a.profit} € ; rendement : ${a.roi} %**
- Prix d'achat maximal estimé, hors transport entrant : ${a.maximumPurchasePrice} € (mêmes hypothèses et seuils)
- Débouché : ${text(a.liquidity)}

[Offre source](${httpsUrl(deal.url)})

[Preuve de revente / reprise](${httpsUrl(e?.url)||'https://github.com/kazeDraughts/flipradar'}) — observée le ${text(e?.observedAt)}

${a.assumptions.map(s=>'- '+text(s)).join('\n')}

[Fiche dans FlipRadar](https://kazedraughts.github.io/flipradar/#deal=${encodeURIComponent(deal.id)})

La fiche du site conserve les recherches récentes ; les détails de cette alerte restent consultables ici si l'offre sort de la veille.`;
}
