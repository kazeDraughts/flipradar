import {readFile} from 'node:fs/promises';
import {alertCandidates,alertBody,marker} from '../src/alerts.mjs';
const root=new URL('../',import.meta.url);
const config=JSON.parse(await readFile(new URL('config.json',root),'utf8'));
const data=JSON.parse(await readFile(new URL('public/data/deals.json',root),'utf8'));
const repository=process.env.GITHUB_REPOSITORY;
const token=process.env.GITHUB_TOKEN;
if(!repository||!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository)||!token)throw Error('Exécuter les alertes dans GitHub Actions ; aucun secret ne doit être ajouté au site.');
async function api(path,body){const r=await fetch('https://api.github.com/repos/'+repository+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('GitHub API HTTP '+r.status);return r.json();}
const issues=[];
for(let page=1;page<=20;page++){const batch=await api('/issues?state=all&per_page=100&page='+page);issues.push(...batch);if(batch.length<100)break;if(page===20)throw Error('Historique trop volumineux : déduplication à archiver avant envoi');}
const bodies=issues.map(i=>i.body||'');
if(process.env.TEST_ALERT==='true'&&!bodies.some(b=>b.includes(marker('email-test-v1')))){
  if(!/^[a-zA-Z0-9-]+$/.test(config.alertOwner))throw Error('Destinataire invalide');
  const issue=await api('/issues',{title:'[FlipRadar] Test des alertes email',body:marker('email-test-v1')+'\n@'+config.alertOwner+'\n\nCeci est un test de réception, pas une bonne affaire.\n\nSi cet avis arrive par email, le canal de notification fonctionne. Les prochaines alertes ne concernent que les nouvelles offres qui passent les critères de marge et de comparaison.\n\nCritères : France, neuf prioritaire, budget 1 000 €, bénéfice minimum 30 €, rendement minimum 25 %.\n\nSi aucun email ne vous parvient, vérifiez « Participating and @mentions → Email » dans vos réglages GitHub : https://github.com/settings/notifications'});
  console.log('Test créé : '+issue.html_url);
}
const matches=alertCandidates(data,config,bodies);
for(const deal of matches){const issue=await api('/issues',{title:'[FlipRadar] '+deal.analysis.profit+' € estimés · '+deal.title.replace(/[\r\n@]/g,' ').slice(0,130),body:alertBody(deal,config.alertOwner)});console.log('Alerte créée : '+issue.html_url);}
console.log('Nouvelles alertes opportunités : '+matches.length);
