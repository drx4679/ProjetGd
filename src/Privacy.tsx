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
    <section id="view-privacy" className="legal-view-container animate-fadeIn">
      <div className="mb-8">
        <button
          type="button"
          onClick={handleBack}
          className="legal-back-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Retour à la boutique
        </button>
      </div>

      <div style={{ marginBottom: "32px", borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--color-accent, #087fb5)", display: "block", marginBottom: "8px" }}>
          Transparence &amp; Protection des données
        </span>
        <h1 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.2 }}>
          Politique de <span style={{ color: "var(--color-accent, #087fb5)" }}>Confidentialité</span>
        </h1>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "8px 0 0" }}>
          Dernière mise à jour : 31 Octobre 2026 · Conforme aux exigences de protection des données personnelles au Togo (Loi n° 2019-014)
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "28px", color: "#334155", fontSize: "14.5px", lineHeight: "1.75" }}>
        
        {/* Introduction */}
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px 24px" }}>
          <p style={{ margin: 0, fontWeight: 500, color: "#1e293b" }}>
            Chez <strong>GoodDoctor's Shop</strong> (Lomé, Togo), nous accordons une importance capitale à la confidentialité et à la sécurité de vos données personnelles. En tant que plateforme de référence dédiée aux professionnels de santé et soignants, nous traitons vos informations avec la plus grande rigueur éthique et technologique.
          </p>
        </div>

        {/* Article 1 */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "#e0f2fe", color: "#0369a1", width: "28px", height: "28px", borderRadius: "50%", display: "inline-grid", placeItems: "center", fontSize: "13px" }}>1</span>
            Données collectées
          </h2>
          <p>
            Nous ne collectons que les informations strictement nécessaires à la bonne exécution de vos commandes et à la personnalisation de votre expérience d'achat :
          </p>
          <ul style={{ paddingLeft: "20px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <li><strong>Identité du client :</strong> Nom complet, civilité, nécessaires pour l'adressage et l'étiquetage de votre colis.</li>
            <li><strong>Coordonnées de contact :</strong> Numéro de téléphone portable (essentiel pour les notifications SMS, la coordination avec les livreurs et le suivi CashPay) et adresse e-mail le cas échéant.</li>
            <li><strong>Données de livraison :</strong> Adresse postale, quartier, repère géographique et, si vous utilisez notre outil de localisation interactive, coordonnées GPS (latitude et longitude) afin de calculer l'itinéraire de livraison le plus précis dans le Grand Lomé.</li>
            <li><strong>Détail des achats :</strong> Articles commandés, tailles, coloris sélectionnés, montant et historique de transaction.</li>
          </ul>
        </div>

        {/* Article 2 */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "#e0f2fe", color: "#0369a1", width: "28px", height: "28px", borderRadius: "50%", display: "inline-grid", placeItems: "center", fontSize: "13px" }}>2</span>
            Finalités du traitement
          </h2>
          <p>Vos informations sont traitées exclusivement pour les finalités suivantes :</p>
          <ul style={{ paddingLeft: "20px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <li>La validation, la préparation et l'expédition de vos commandes de matériel médical.</li>
            <li>La communication par SMS ou appel téléphonique pour la remise en mains propres de vos colis.</li>
            <li>Le suivi de commande en temps réel via notre page <em>Suivre ma commande</em>.</li>
            <li>Le traitement des retours, réclamations ou demandes d'assistance au service après-vente.</li>
            <li>L'envoi d'actualités et d'offres professionnelles, uniquement si vous avez renseigné volontairement votre e-mail dans la section <em>« Restez informés »</em>.</li>
          </ul>
        </div>

        {/* Article 3 */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "#e0f2fe", color: "#0369a1", width: "28px", height: "28px", borderRadius: "50%", display: "inline-grid", placeItems: "center", fontSize: "13px" }}>3</span>
            Sécurité des paiements &amp; Partenaires de confiance
          </h2>
          <p>
            <strong>Aucune coordonnée bancaire, aucun code secret T-Money, Moov Money ou numéro de carte ne transite ni n'est stocké sur nos serveurs.</strong>
          </p>
          <p style={{ marginTop: "8px" }}>
            L'ensemble des transactions financières est délégué à notre partenaire agréé <strong>CashPay (SEMOA Togo)</strong> via des protocoles de chiffrement bancaire sécurisés (JWE - JSON Web Encryption RSA-OAEP-256 et AES-256-GCM).
          </p>
          <p style={{ marginTop: "8px" }}>
            Pour l'hébergement sécurisé de nos bases de données, nous faisons appel à <strong>Supabase</strong>, qui applique des restrictions d'accès de niveau bancaire (Row Level Security - RLS). Vos données ne sont accessibles qu'au personnel habilité à l'acheminement de votre commande.
          </p>
        </div>

        {/* Article 4 */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "#e0f2fe", color: "#0369a1", width: "28px", height: "28px", borderRadius: "50%", display: "inline-grid", placeItems: "center", fontSize: "13px" }}>4</span>
            Non-divulgation &amp; Non-vente des données
          </h2>
          <p>
            GoodDoctor's Shop s'engage formellement à <strong>ne jamais vendre, louer ou échanger vos données personnelles</strong> à des courtiers de données ou à des tiers publicitaires. Les seuls tiers recevant vos coordonnées sont nos livreurs certifiés, strictement limités au nom, au téléphone et au lieu de rendez-vous pour assurer la livraison.
          </p>
        </div>

        {/* Article 5 */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "#e0f2fe", color: "#0369a1", width: "28px", height: "28px", borderRadius: "50%", display: "inline-grid", placeItems: "center", fontSize: "13px" }}>5</span>
            Cookies &amp; Stockage local
          </h2>
          <p>
            Nous limitons strictement l'utilisation de traceurs à ce qui est fonctionnellement indispensable :
          </p>
          <ul style={{ paddingLeft: "20px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <li><strong>Stockage local (LocalStorage / SessionStorage) :</strong> Mémorisation de votre panier d'achat, de vos équipements mis en favoris et de votre référence de commande en attente de validation.</li>
            <li><strong>Absence de traceurs publicitaires :</strong> Aucun cookie intrusif de pistage tiers n'est utilisé sur notre boutique.</li>
          </ul>
        </div>

        {/* Article 6 */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "#e0f2fe", color: "#0369a1", width: "28px", height: "28px", borderRadius: "50%", display: "inline-grid", placeItems: "center", fontSize: "13px" }}>6</span>
            Vos droits &amp; Durée de conservation
          </h2>
          <p>
            Vos données de commande sont conservées pendant la durée nécessaire aux obligations comptables et fiscales légales, ainsi qu'au suivi de vos garanties matérielles.
          </p>
          <p style={{ marginTop: "8px" }}>
            Conformément aux lois en vigueur, vous disposez à tout moment des droits suivants sur vos données :
          </p>
          <ul style={{ paddingLeft: "20px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <li><strong>Droit d'accès et de rectification :</strong> Vous pouvez demander une copie de vos données ou la mise à jour de vos coordonnées.</li>
            <li><strong>Droit à l'effacement :</strong> Vous pouvez demander la suppression définitive de vos informations personnelles lorsqu'elles ne sont plus requises pour une livraison ou une obligation légale.</li>
            <li><strong>Droit de désinscription :</strong> Pour la newsletter, un simple signalement vous retire immédiatement de notre liste de diffusion.</li>
          </ul>
        </div>

        {/* Article 7 */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "#e0f2fe", color: "#0369a1", width: "28px", height: "28px", borderRadius: "50%", display: "inline-grid", placeItems: "center", fontSize: "13px" }}>7</span>
            Contact &amp; Responsable du traitement
          </h2>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px 20px", marginTop: "10px" }}>
            <p style={{ margin: 0, fontWeight: 600, color: "#0f172a" }}>GoodDoctor's Shop · Service Protection des Données</p>
            <p style={{ margin: "4px 0 0", color: "#475569" }}>Lomé, République Togolaise</p>
            <p style={{ margin: "4px 0 0", color: "#475569" }}>
              E-mail de contact :{" "}
              <a href="mailto:gooddoctorshops@gmail.com" style={{ color: "var(--color-accent, #087fb5)", fontWeight: 600, textDecoration: "underline" }}>
                gooddoctorshops@gmail.com
              </a>
            </p>
          </div>
        </div>

        <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
          <button
            type="button"
            onClick={handleBack}
            className="primary"
            style={{ margin: "0 auto", padding: "14px 28px", borderRadius: "9999px", display: "inline-flex", cursor: "pointer" }}
          >
            ← Retour à la boutique
          </button>
        </div>
      </div>
    </section>
  )
}
