'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number.isFinite(v)?v.toLocaleString('fr-FR',{style:'currency',currency:'EUR'}):'Non renseigné';
const date=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('fr-FR'):'Non renseignée';
const safeUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'#';}catch{return '#';}};
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
let bookmarks=read('flipradar-saved-v2',[]);if(!Array.isArray(bookmarks))bookmarks=[];
let prefs=read('flipradar-prefs-v2',{budget:1000,profit:30,roi:25});
if(!prefs||!Number.isFinite(prefs.budget)||prefs.budget<=0)prefs={budget:1000,profit:30,roi:25};
let dataset={deals:[],sources:[]},view='all';
function persist(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{toast('Le stockage local est indisponible.');return false;}}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),3500);}
async function load(){
 $('#refresh').disabled=true;
 try{const r=await fetch('data/deals.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error();const d=await r.json();if(!Array.isArray(d.deals)||!Array.isArray(d.sources))throw Error();dataset=d;
 $('#updated').textContent='Dernière recherche : '+date(d.updatedAt)+' · France';
 const stale=!Number.isFinite(Date.parse(d.updatedAt))||Date.now()-Date.parse(d.updatedAt)>3*3600000;
 const failed=d.sources.filter(s=>s.status!=='ok');
 $('#notice').textContent=stale?'La dernière recherche date de plus de 3 heures. Vérifiez la veille dans GitHub Actions.':(failed.length===d.sources.length?'Aucune source n’a répondu. Les offres conservées sont à recontrôler.':failed.length?'Certaines sources de comparaison sont indisponibles. Les offres sans preuve de revente restent à vérifier ; voir le détail des sources ci-dessous.':'');
 if(!stale&&d.health?.message)$('#notice').textContent=d.health.message;
 let coverage=$('#coverage');
 if(!coverage){coverage=document.createElement('p');coverage.id='coverage';coverage.className='muted';$('#sources').before(coverage);}
 coverage.textContent=d.health?`${d.health.comparedOffers} offre(s) actuelle(s) avec comparaison vérifiée sur ${d.health.currentOffers} · ${d.health.unverifiedOffers} sans comparaison exploitable. ${d.health.currentReferences} référence(s) de marché récente(s).`:'Couverture de revente non mesurée dans cette version des données.';
 $('#alert-state').textContent=d.policy?.alertsEnabled?'Alertes automatiques configurées. Réception email à vérifier dans votre compte GitHub.':'Alertes automatiques non activées.';render();
 }catch{$('#notice').textContent='Impossible de charger les recherches. Réessayez ou consultez GitHub Actions.';}finally{$('#refresh').disabled=false;}
}
function render(){
 const all=dataset.deals,q=$('#search').value.toLocaleLowerCase('fr');
 const qualified=d=>d.analysis?.qualified&&d.analysis.profit>=prefs.profit&&d.analysis.roi>=prefs.roi;
 const matched=all.filter(d=>(d.price===null||d.price<=prefs.budget)&&(view!=='qualified'||qualified(d))&&(view!=='saved'||bookmarks.includes(d.id))&&($('#condition').value==='all'||d.condition===$('#condition').value)&&(d.title+' '+d.merchant).toLocaleLowerCase('fr').includes(q));
 const sorts={recent:(a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt),profit:(a,b)=>(b.analysis?.profit??-1e9)-(a.analysis?.profit??-1e9),price:(a,b)=>(a.price??1e9)-(b.price??1e9)};matched.sort(sorts[$('#sort').value]);
 $('#total').textContent=all.length;$('#qualified').textContent=all.filter(qualified).length;$('#pending').textContent=all.filter(d=>!d.analysis?.qualified).length;$('#saved').textContent=all.filter(d=>bookmarks.includes(d.id)).length;$('#results').textContent=matched.length+' résultat'+(matched.length!==1?'s':'');
 $('#deals').innerHTML=matched.map(d=>`<article class="deal"><div class="deal-head"><span class="tag ${d.analysis?.qualified?'green':''}">${d.analysis?.qualified?'Marge suffisante':d.analysis?.status==='unprofitable'?'Marge insuffisante':'À vérifier'}</span><span class="merchant">${esc(d.category)}</span></div><h3>${esc(d.title)}</h3><div class="merchant">${esc(d.merchant)} · ${d.condition==='new'?'Neuf présumé':'Occasion / reconditionné'}</div><div class="price-row"><div class="price">${money(d.price)}<small>Prix repéré · transport à confirmer</small></div><div class="estimate ${d.analysis?.qualified?'':'pending'}">${Number.isFinite(d.analysis?.profit)?money(d.analysis.profit)+' de bénéfice estimé':'Prix de revente<br>à documenter'}</div></div><div class="deal-bottom"><button data-open="${esc(d.id)}">Analyser la fiche ↗</button><button class="bookmark" data-save="${esc(d.id)}" aria-label="${bookmarks.includes(d.id)?'Retirer du suivi':'Ajouter au suivi'}" aria-pressed="${bookmarks.includes(d.id)}">${bookmarks.includes(d.id)?'★':'☆'}</button></div></article>`).join('')||'<div class="empty"><b>Aucune offre dans cette vue.</b><br>Les bons plans doivent disposer d’une comparaison de revente et d’une marge suffisante.<br>Modifiez les filtres ou consultez les dernières détections.</div>';
 $('#sources').innerHTML=(dataset.sources||[]).map(s=>`<div class="source"><b>${esc(s.name)}</b><span>${s.status==='ok'?'✓ '+esc(s.count)+' observations':'⚠ '+esc(s.error||'Indisponible')} · ${date(s.checkedAt)}</span></div>`).join('');
}
function show(id){
 const d=dataset.deals.find(x=>x.id===id);if(!d)return;const a=d.analysis||{},e=a.evidence;const query=encodeURIComponent(d.title);
 $('#detail-body').innerHTML=`<h2 class="dialog-title">${esc(d.title)}</h2><p class="muted">${esc(d.merchant)} · publié le ${date(d.publishedAt)}<br>Source : ${esc(d.source)} · référence ${d.productKey?esc(d.productKey):'à confirmer'}</p><div class="metrics"><div class="metric"><span>Prix d’achat affiché</span><b>${money(d.price)}</b></div><div class="metric"><span>${e?.type==='buyback'?'Reprise professionnelle':'Revente prudente'}</span><b>${money(a.resale)}</b></div><div class="metric"><span>Débouché de revente</span><b>${esc(a.liquidity||'Non mesuré')}</b></div></div><div class="calculation"><div class="calc-row"><span>Achat + transport entrant</span><b>${money(a.cost)}</b></div><div class="calc-row"><span>Frais, envoi & provision de risque</span><b>${money(a.fees)}</b></div><div class="calc-row"><span>Bénéfice estimé avant fiscalité</span><b>${money(a.profit)}</b></div></div><h3>${a.qualified?'Critères de marge respectés':'Points à vérifier'}</h3><ul class="reasons">${(a.reasons||[]).map(r=>'<li>'+esc(r)+'</li>').join('')||'<li>Le coût et le rendement respectent les seuils configurés. Confirmez le stock et les conditions avant achat.</li>'}</ul><p class="muted">${Number.isFinite(a.roi)?'Rendement sur coût : '+esc(a.roi)+' %.':'Rendement non calculable sans référence de revente.'}</p><h3>Preuves et hypothèses</h3>${e?`<p><a href="${esc(safeUrl(e.url))}" target="_blank" rel="noopener noreferrer">${esc(e.provider||'Source des comparables')} ↗</a> · observé le ${date(e.observedAt)}</p>`:'<p class="muted">Pas de prix comparable vérifié. Un prix demandé ou des votes sur une promotion ne constituent pas une vente conclue.</p>'}<ul class="muted">${(a.assumptions||[]).map(r=>'<li>'+esc(r)+'</li>').join('')}</ul><div class="links"><a href="${esc(safeUrl(d.url))}" target="_blank" rel="noopener noreferrer">Voir l’offre source ↗</a><a href="https://www.ebay.fr/sch/i.html?_nkw=${query}&amp;LH_Sold=1&amp;LH_Complete=1" target="_blank" rel="noopener noreferrer">Ventes eBay : recherche manuelle ↗</a><a href="https://www.leboncoin.fr/recherche?text=${query}" target="_blank" rel="noopener noreferrer">Annonces Leboncoin ↗</a></div><p class="muted">À contrôler : référence et variante, facture, état, stock, restrictions promotionnelles, authenticité et garantie. Les liens de recherche ne sont pas une surveillance automatique de ces sites.</p>`;
 const state=document.createElement('p');state.className='muted';
 state.textContent='État retenu : '+(d.conditionLabel||(d.condition==='new'?'Neuf présumé':'Occasion : état à confirmer'))+(e?.grade?' · Scénario de reprise '+e.grade:'');
 $('#detail-body h2').after(state);
 $('#detail').showModal();
}
document.querySelector('nav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(!b)return;view=b.dataset.view;document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('selected',x===b));$('#settings').hidden=view!=='settings';$('#feed').hidden=view==='settings';$('#view-title').textContent={all:'Dernières détections',qualified:'Marge suffisante',saved:'Mon suivi'}[view]||'';render();});
$('#deals').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.open)show(b.dataset.open);if(b.dataset.save){const id=b.dataset.save,next=bookmarks.includes(id)?bookmarks.filter(x=>x!==id):[...bookmarks,id];if(persist('flipradar-saved-v2',next)){bookmarks=next;render();}}});
for(const key of ['budget','profit','roi'])$('#'+key).value=prefs[key];
$('#preferences').addEventListener('submit',e=>{e.preventDefault();const next=Object.fromEntries(['budget','profit','roi'].map(k=>[k,Number($('#'+k).value)]));if(persist('flipradar-prefs-v2',next)){prefs=next;render();toast('Filtres locaux enregistrés.');}});
['search','condition','sort'].forEach(id=>$('#'+id).addEventListener('input',render));$('#refresh').addEventListener('click',load);$('#close').addEventListener('click',()=>$('#detail').close());load();
