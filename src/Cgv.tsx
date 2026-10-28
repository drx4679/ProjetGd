interface CgvProps {
  onBack?: () => void
}

export default function Cgv({ onBack }: CgvProps) {
  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      window.location.hash = ""
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  return (
    <section id="view-cgv" className="legal-view-container pt-32 lg:pt-40 pb-24 px-6 container mx-auto max-w-5xl flex-grow animate-fadeIn">
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
        Conditions Générales de{" "}
        <span style={{ background: "linear-gradient(135deg, #2563eb, #22d3ee)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Vente
        </span>
      </h1>

      <div className="space-y-6 text-zinc-600 font-medium leading-relaxed">
        <h2 className="text-xl font-bold text-zinc-900 mt-8 mb-4">1. Objet</h2>
        <p>Les présentes CGV régissent les ventes de matériel médical et paramédical par GoodDoctor's Shop, basé à Lomé, Togo. Elles s'appliquent à toutes les commandes passées sur notre site.</p>

        <h2 className="text-xl font-bold text-zinc-900 mt-8 mb-4">2. Produits</h2>
        <p>Nous proposons des équipements médicaux certifiés pour les professionnels et les particuliers en Afrique. Les caractéristiques des produits sont présentées sur chaque page article.</p>

        <h2 className="text-xl font-bold text-zinc-900 mt-8 mb-4">3. Prix</h2>
        <p>Tous nos prix sont indiqués en FCFA (Francs CFA). GoodDoctor's Shop se réserve le droit de modifier les prix à tout moment, mais les produits seront facturés sur la base des tarifs en vigueur au moment de la validation de la commande.</p>

        <h2 className="text-xl font-bold text-zinc-900 mt-8 mb-4">4. Commande</h2>
        <p>La validation de la commande implique l'acceptation de ces CGV. Un récapitulatif est envoyé après chaque commande.</p>

        <h2 className="text-xl font-bold text-zinc-900 mt-8 mb-4">5. Paiement</h2>
        <p>Les paiements sont sécurisés et traités par CashPay. Nous acceptons divers moyens de paiement incluant Coris Money, Visa et Mastercard.</p>

        <h2 className="text-xl font-bold text-zinc-900 mt-8 mb-4">6. Livraison</h2>
        <p>Nous assurons la livraison au Togo. Les frais de livraison sont calculés lors de la commande ou définis lors de l'expédition selon l'accord du client.</p>

        <h2 className="text-xl font-bold text-zinc-900 mt-8 mb-4">7. Retours</h2>
        <p>Pour des raisons d'hygiène et de sécurité liées au matériel médical, les retours sont soumis à des conditions strictes. Veuillez nous contacter dans les 48 heures suivant la réception en cas de produit défectueux.</p>

        <h2 className="text-xl font-bold text-zinc-900 mt-8 mb-4">8. Garantie</h2>
        <p>Nos produits bénéficient de la garantie constructeur. La durée et les conditions varient selon le type de matériel.</p>

        <h2 className="text-xl font-bold text-zinc-900 mt-8 mb-4">9. Responsabilité</h2>
        <p>GoodDoctor's Shop ne saurait être tenu responsable des dommages résultant d'une mauvaise utilisation du matériel médical acheté.</p>

        <h2 className="text-xl font-bold text-zinc-900 mt-8 mb-4">10. Contact</h2>
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
