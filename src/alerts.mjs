import {assess,fresh,httpsUrl} from './core.mjs';
const text=value=>String(value??'').replace(/[\r\n]/g,' ').replace(/@/g,'＠').replace(/[\\`*_{}\[\]<>#|]/g,'');
export const marker=id=>'<!-- flipradar:'+id+' -->';
export function alertCandidates(data,config,existingBodies,now=Date.now()) {
  if(!config.alertsEnabled||!fresh(data.updatedAt,now,3))return [];
  const known=existingBodies.join('\n');
  return data.deals.filter(d=>!d.stale&&fresh(d.publishedAt,now,config.maximumOfferAgeHours)&&httpsUrl(d.url)&&assess(d,d.analysis?.evidence,config,now).qualified&&!known.includes(marker(d.id))).slice(0,10);
}
export function alertBody(deal,owner) {
  if(!/^[a-zA-Z0-9-]+$/.test(owner))throw Error('Destinataire GitHub invalide');
  const a=deal.analysis,e=a.evidence;
  return `${marker(deal.id)}\n@${owner}\n\nUne offre passe les seuils configurés. Vérifier le stock et les conditions avant achat.\n\n**${text(deal.title)}**\n\n- Achat affiché : ${deal.price} €\n- Coût achat + transport : ${a.cost} €\n- Revente / reprise estimée : ${a.resale} €\n- Frais et réserve de risque : ${a.fees} €\n- **Bénéfice estimé : ${a.profit} € ; rendement : ${a.roi} %**\n- Débouché : ${text(a.liquidity)}\n\n[Offre source](${httpsUrl(deal.url)})\n\n[Preuve de revente / reprise](${httpsUrl(e?.url)||'https://github.com/kazeDraughts/flipradar'}) — observée le ${text(e?.observedAt)}\n\n${a.assumptions.map(s=>'- '+text(s)).join('\n')}\n\n[Fiche dans FlipRadar](https://kazedraughts.github.io/flipradar/)`;
}
