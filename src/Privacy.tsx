interface PrivacyProps {
  onBack?: () => void
}

export default function Privacy({ onBack }: PrivacyProps) {
  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      window.location.hash = ""
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  return (
    <section id="view-privacy" className="legal-view-container pt-32 lg:pt-40 pb-24 px-6 container mx-auto max-w-5xl flex-grow animate-fadeIn">
      <div className="mb-8">
        <button
          type="button"
          onClick={handleBack}
          className="legal-back-btn inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-blue-600 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Retour à la boutique
        </button>
      </div>

      <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold mb-8 text-zinc-900 pb-6" style={{ borderBottom: "1px solid", borderImage: "linear-gradient(90deg, rgba(124, 58, 237, 0.3), transparent) 1" }}>
        Politique de{" "}
        <span style={{ background: "linear-gradient(135deg, #2563eb, #22d3ee)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Confidentialité
        </span>
      </h1>

      <div className="space-y-6 text-zinc-600 font-medium leading-relaxed">
        <p className="text-sm font-bold text-zinc-500">Dernière mise à jour : Septembre 2026</p>

        <h2 className="text-xl font-bold text-zinc-900 mt-8 mb-4">1. Collecte des données</h2>
        <p>Nous collectons les informations nécessaires au traitement de vos commandes (nom, prénom, numéro de téléphone, adresse de livraison au Togo). Ces informations sont stockées de manière sécurisée grâce à notre partenaire technologique Supabase.</p>

        <h2 className="text-xl font-bold text-zinc-900 mt-8 mb-4">2. Utilisation des données</h2>
        <p>Vos données sont exclusivement utilisées pour la gestion de vos commandes, le suivi de livraison, et pour vous contacter en cas de besoin concernant votre achat de matériel médical.</p>

        <h2 className="text-xl font-bold text-zinc-900 mt-8 mb-4">3. Cookies</h2>
        <p>Notre site utilise des cookies essentiels pour le fonctionnement de la boutique (comme la mémorisation de votre panier et de vos préférences de navigation).</p>

        <h2 className="text-xl font-bold text-zinc-900 mt-8 mb-4">4. Partage des données</h2>
        <p><strong>Aucune donnée personnelle n'est vendue à des tiers.</strong> Les données nécessaires au paiement sont transmises de manière sécurisée à CashPay, notre partenaire de paiement. Les informations de livraison peuvent être partagées avec nos partenaires logistiques au Togo.</p>

        <h2 className="text-xl font-bold text-zinc-900 mt-8 mb-4">5. Sécurité</h2>
        <p>Nous mettons en œuvre toutes les mesures techniques pour sécuriser vos données. Les paiements via CashPay sont cryptés et sécurisés.</p>

        <h2 className="text-xl font-bold text-zinc-900 mt-8 mb-4">6. Droits des utilisateurs</h2>
        <p>Vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour exercer ces droits, veuillez nous contacter.</p>

        <h2 className="text-xl font-bold text-zinc-900 mt-8 mb-4">7. Contact</h2>
        <p>GoodDoctor's Shop<br/>Lomé, Togo<br/>Email : <a href="mailto:gooddoctorshops@gmail.com" className="text-blue-600 hover:underline">gooddoctorshops@gmail.com</a></p>

        <div className="mt-12 pt-8 border-t border-zinc-200 text-center">
          <button
            type="button"
            onClick={handleBack}
            className="px-8 py-3 rounded-full bg-zinc-900 text-white font-bold hover:opacity-90 transition-opacity"
          >
            Retour à la boutique
          </button>
        </div>
      </div>
    </section>
  )
}
