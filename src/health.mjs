import {fresh} from './core.mjs';

// A successful RSS download is not proof that the resale radar is operational.
export function radarHealth(data, config, now=Date.now()) {
  const acquisitionIds=new Set(config.sources.map(s=>s.id));
  const acquisition=data.sources.filter(s=>acquisitionIds.has(s.id));
  const comparisons=data.sources.filter(s=>!acquisitionIds.has(s.id));
  const current=data.deals.filter(d=>!d.stale);
  const verified=current.filter(d=>d.analysis?.comparisonVerified===true);
  const references=(data.referencePrices||[]).filter(e=>fresh(e.observedAt,now,24));
  const counts={currentOffers:current.length,comparedOffers:verified.length,
    unverifiedOffers:current.length-verified.length,
    qualifiedOffers:verified.filter(d=>d.analysis.qualified).length,
    acquisitionSources:acquisition.filter(s=>s.status==='ok').length,
    comparisonSources:comparisons.filter(s=>s.status==='ok').length,
    currentReferences:references.length};
  let state, message, exitCode=0;
  if(!fresh(data.updatedAt,now,3)) {
    state='stale';message='Recherche périmée : aucun résultat actuel ne peut être confirmé.';exitCode=4;
  } else if(!counts.acquisitionSources) {
    state='acquisition_failed';message='Collecte des offres indisponible. Les anciennes observations ne sont pas des offres confirmées.';exitCode=2;
  } else if(!counts.comparisonSources||!counts.currentReferences) {
    state='comparison_failed';message='Vérification de revente indisponible : aucune conclusion possible sur la rentabilité. Zéro alerte ne signifie pas zéro bonne affaire.';exitCode=3;
  } else if(current.length&&!verified.length) {
    state='coverage_missing';message='Aucune offre actuelle couverte par une comparaison de revente vérifiée. Le catalogue de comparaison doit être élargi.';
  } else if(counts.unverifiedOffers||data.sources.some(s=>s.status!=='ok')) {
    state='partial';message='Couverture partielle : seules les offres avec comparaison vérifiée peuvent produire une alerte.';
  } else {
    state='ready';message='Les offres actuelles disposent de comparaisons de revente vérifiées. Les marges restent des estimations conditionnelles.';
  }
  return {state,message,exitCode,...counts};
}
