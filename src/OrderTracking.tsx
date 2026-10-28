import { useState } from 'react'

export default function OrderTracking() {
  const [reference, setReference] = useState('')
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<'idle' | 'demo' | 'unavailable'>('idle')
  const stages = [
    ['Commande confirmée', 'Votre sélection a été prise en compte.'],
    ['En préparation', 'Vos équipements sont préparés pour expédition.'],
    ['En livraison', 'Le colis est confié au transporteur.'],
    ['Livrée', 'Votre colis est arrivé à destination.'],
  ]
  return <section className="tracking-page">
    <a className="text-link tracking-back" href="#">← Retour à la boutique</a>
    <div className="tracking-intro"><span className="eyebrow">À VOS CÔTÉS, JUSQU’À LA LIVRAISON</span><h1>Suivre ma commande</h1><p>Suivez l’acheminement de vos uniformes et équipements médicaux.</p></div>
    <div className="tracking-layout">
      <form className="tracking-card checkout-form" onSubmit={e => { e.preventDefault(); setResult(reference.trim().toUpperCase() === 'GD-DEMO-001' && email.trim().toLowerCase() === 'demo@example.com' ? 'demo' : 'unavailable') }}>
        <h2>Où en est mon colis ?</h2><p className="tracking-muted">Mode démonstration : aucune commande réelle n’est consultée. Utilisez uniquement les identifiants d’exemple.</p>
        <label>Numéro de commande<input maxLength={60} required value={reference} onChange={e => { setReference(e.target.value); setResult('idle') }} placeholder="GD-DEMO-001" autoComplete="off" /></label>
        <label>Adresse e-mail<input maxLength={254} required type="email" value={email} onChange={e => { setEmail(e.target.value); setResult('idle') }} placeholder="demo@example.com" autoComplete="off" /></label>
        <button className="primary">Rechercher ma commande</button>
        <button className="tracking-example" type="button" onClick={() => { setReference('GD-DEMO-001'); setEmail('demo@example.com'); setResult('demo') }}>Afficher un exemple de suivi</button>
      </form>
      <div className="tracking-card tracking-result" aria-live="polite">
        {result === 'idle' && <><span className="tracking-status">SUIVI DE LIVRAISON</span><h2>Chaque étape compte.</h2><p className="tracking-muted">Renseignez les identifiants de démonstration ou affichez un exemple pour découvrir le suivi.</p><div className="tracking-empty-icon" aria-hidden="true"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7 5l10 4"/></svg></div></>}
        {result === 'unavailable' && <><span className="tracking-status">SUIVI NON CONNECTÉ</span><h2>Le suivi réel est indisponible.</h2><p className="tracking-muted">Le backend n’est pas connecté : nous ne pouvons ni vérifier ces identifiants ni consulter une commande. Essayez l’exemple GD-DEMO-001 avec demo@example.com.</p><button type="button" className="tracking-example" onClick={() => setResult('idle')}>Réessayer</button></>}
        {result === 'demo' && <><span className="tracking-status">EXEMPLE FICTIF · EN LIVRAISON</span><h2>Commande GD-DEMO-001</h2><p className="tracking-muted">Livraison estimée : 24–48 h après expédition, à titre illustratif.</p><ol className="tracking-timeline">{stages.map(([title, description], i) => <li key={title} className={i < 2 ? 'complete' : i === 2 ? 'current' : ''}><span className="tracking-dot">{i + 1}</span><div><b>{title}</b><p>{description}</p>{i === 2 && <small>Étape actuelle de la démonstration</small>}</div></li>)}</ol><p className="tracking-muted">Ces étapes ne correspondent à aucun colis réel.</p></>}
      </div>
    </div>
    <div className="tracking-help"><h2>Une question sur le suivi ?</h2><details><summary>Où trouver mon numéro de commande ?</summary><p>Sur une boutique connectée, il figure dans l’e-mail de confirmation envoyé après l’achat. Ici, seul le numéro d’exemple est disponible.</p></details><details><summary>Mon statut n’a pas changé</summary><p>Le suivi présenté est une démonstration statique. Les mises à jour du transporteur seront disponibles après connexion du service de commandes.</p></details></div>
  </section>
}
