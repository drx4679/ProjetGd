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
    <section id="view-cgv" className="legal-view-container animate-fadeIn">
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
          Cadre contractuel &amp; Engagements
        </span>
        <h1 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.2 }}>
          Conditions Générales de <span style={{ color: "var(--color-accent, #087fb5)" }}>Vente (CGV)</span>
        </h1>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "8px 0 0" }}>
          Applicables aux commandes en ligne sur gooddoctorshop.com · En vigueur au 31 Octobre 2026
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "28px", color: "#334155", fontSize: "14.5px", lineHeight: "1.75" }}>
        
        {/* Encart Préambule */}
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px 24px" }}>
          <p style={{ margin: 0, fontWeight: 500, color: "#1e293b" }}>
            Les présentes Conditions Générales de Vente (ci-après <strong>« CGV »</strong>) régissent l'ensemble des transactions commerciales conclues sur la boutique en ligne <strong>gooddoctorshop.com</strong>, éditée par <strong>GoodDoctor's Shop</strong>, domiciliée à Lomé (République Togolaise). Toute validation de commande implique l'adhésion pleine, entière et sans réserve du client aux présentes dispositions.
          </p>
        </div>

        {/* Article 1 */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "#e0f2fe", color: "#0369a1", width: "28px", height: "28px", borderRadius: "50%", display: "inline-grid", placeItems: "center", fontSize: "13px" }}>1</span>
            Produits &amp; Conformité médicale
          </h2>
          <p>
            GoodDoctor's Shop commercialise des équipements destinés en priorité aux professionnels de la santé, cliniques, laboratoires, étudiants en médecine et soignants :
          </p>
          <ul style={{ paddingLeft: "20px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <li><strong>Uniformes &amp; Blouses médicales (Scrubs) :</strong> Vêtements professionnels confectionnés dans des textiles respirants, durables et résistants aux lavages fréquents en milieu hospitalier.</li>
            <li><strong>Dispositifs de diagnostic &amp; Matériel médical :</strong> Stéthoscopes, tensiomètres, oxymètres, thermomètres, marteaux réflexes et instruments certifiés cliniquement.</li>
            <li><strong>Accessoires &amp; Consommables de soins :</strong> Sabots médicaux, montres pour soignants, ciseaux de premiers secours et petit matériel pratique.</li>
          </ul>
          <p style={{ marginTop: "8px" }}>
            Les photographies et descriptions détaillées sont établies avec le plus grand soin. Les offres de produits sont valables tant qu'elles demeurent visibles sur le catalogue en ligne et dans la limite des stocks disponibles.
          </p>
        </div>

        {/* Article 2 */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "#e0f2fe", color: "#0369a1", width: "28px", height: "28px", borderRadius: "50%", display: "inline-grid", placeItems: "center", fontSize: "13px" }}>2</span>
            Prix &amp; Devises
          </h2>
          <p>
            Tous les prix affichés sur le site sont exprimés en <strong>Francs CFA (XOF)</strong>.
          </p>
          <ul style={{ paddingLeft: "20px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <li>Les tarifs applicables sont ceux en vigueur au moment de la passation de votre commande sur le site.</li>
            <li>GoodDoctor's Shop se réserve le droit de modifier ses prix à tout moment en fonction des cours et des approvisionnements, sans effet rétroactif sur les commandes déjà confirmées.</li>
            <li><strong>Frais de transaction :</strong> Conformément aux barèmes des opérateurs de paiement mobile et bancaire (1,5 %), les frais de transaction technique sont calculés et affichés de manière parfaitement transparente avant toute confirmation d'achat.</li>
          </ul>
        </div>

        {/* Article 3 */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "#e0f2fe", color: "#0369a1", width: "28px", height: "28px", borderRadius: "50%", display: "inline-grid", placeItems: "center", fontSize: "13px" }}>3</span>
            Validation de commande &amp; Processus d'achat
          </h2>
          <p>La passation de commande s'effectue selon les étapes suivantes :</p>
          <ol style={{ paddingLeft: "20px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <li><strong>Sélection des articles :</strong> Choix des modèles, tailles, coloris et quantités ajoutés au panier.</li>
            <li><strong>Renseignement de la livraison :</strong> Saisie du nom, du numéro de téléphone de contact et de l'adresse de livraison (avec géolocalisation GPS facultative sur carte pour le Grand Lomé).</li>
            <li><strong>Acceptation légale :</strong> Lecture et validation de la Politique de confidentialité et des présentes CGV via la case à cocher obligatoire.</li>
            <li><strong>Règlement :</strong> Redirection sécurisée vers le portail de paiement officiel CashPay.</li>
            <li><strong>Confirmation :</strong> Attribution immédiate d'une référence unique de commande (ex: <code>GDS-...</code>) permettant le suivi en direct.</li>
          </ol>
        </div>

        {/* Article 4 */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "#e0f2fe", color: "#0369a1", width: "28px", height: "28px", borderRadius: "50%", display: "inline-grid", placeItems: "center", fontSize: "13px" }}>4</span>
            Modalités de paiement sécurisé (CashPay)
          </h2>
          <p>
            Le règlement s'effectue en ligne via la plateforme agréée <strong>CashPay (SEMOA Togo)</strong>. Plusieurs moyens de règlement sont mis à votre disposition :
          </p>
          <ul style={{ paddingLeft: "20px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <li><strong>Mobile Money Togo &amp; Sous-région :</strong> Moov Money, Mixx by Yas (T-Money), Coris Money.</li>
            <li><strong>Cartes bancaires internationales :</strong> Visa et Mastercard.</li>
          </ul>
          <p style={{ marginTop: "8px" }}>
            La commande n'est préparée et expédiée qu'après confirmation irrévocable du débit par l'opérateur de paiement.
          </p>
        </div>

        {/* Article 5 */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "#e0f2fe", color: "#0369a1", width: "28px", height: "28px", borderRadius: "50%", display: "inline-grid", placeItems: "center", fontSize: "13px" }}>5</span>
            Livraison &amp; Délais d'acheminement
          </h2>
          <p>GoodDoctor's Shop dessert le Grand Lomé, les villes de l'intérieur du Togo ainsi que la sous-région :</p>
          <ul style={{ paddingLeft: "20px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <li><strong>Zone directe - Grand Lomé (≤ 20 km) :</strong> Les frais de livraison sont calculés selon la distance routière (de 1 000 à 2 000 FCFA). <strong>La livraison est offerte pour toute commande atteignant ou dépassant 35 000 FCFA.</strong> Le délai habituel de livraison est de <strong>24 à 48 heures ouvrées</strong>.</li>
            <li><strong>Hors zone directe Lomé (&gt; 20 km) &amp; Intérieur du Togo :</strong> La livraison s'opère par dépôt en gare ou compagnie de transport routier. Les frais d'expédition sont définis au cas par cas lors du dépôt en accord avec le client.</li>
            <li><strong>Commandes internationales :</strong> Pour les pays frontaliers (Bénin, Ghana, etc.) et la diaspora, les conditions et coûts d'acheminement sont établis sur mesure par notre service logistique.</li>
          </ul>
        </div>

        {/* Article 6 */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "#e0f2fe", color: "#0369a1", width: "28px", height: "28px", borderRadius: "50%", display: "inline-grid", placeItems: "center", fontSize: "13px" }}>6</span>
            Réception du colis &amp; Réclamations
          </h2>
          <p>
            Le client est tenu de vérifier l'état apparent de son colis et le nombre d'articles en présence du livreur ou lors du retrait en gare.
          </p>
          <p style={{ marginTop: "8px" }}>
            En cas de produit manquant, endommagé ou non conforme, une réclamation motivée doit être adressée à notre service client sous un délai maximum de <strong>48 heures</strong> suivant la remise en mains propres, accompagnée de photos justificatives (emballage et article).
          </p>
        </div>

        {/* Article 7 */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "#e0f2fe", color: "#0369a1", width: "28px", height: "28px", borderRadius: "50%", display: "inline-grid", placeItems: "center", fontSize: "13px" }}>7</span>
            Hygiène médicale &amp; Conditions strictes de retour
          </h2>
          <p>
            En raison de la destination hospitalière et clinique de nos produits, et pour d'impérieuses <strong>raisons d'hygiène et de protection de la santé publique</strong> :
          </p>
          <ul style={{ paddingLeft: "20px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <li>Les uniformes ou vêtements ayant été portés, lavés ou altérés ne peuvent faire l'objet d'aucun retour ni échange.</li>
            <li>Les dispositifs médicaux et instruments dont le scellé de garantie, l'emballage stérile ou la boîte d'origine a été ouvert ne sont ni repris ni échangés.</li>
            <li>Seuls les articles neufs, intacts dans leur emballage complet d'origine et signalés sous 48h (erreur de taille avant utilisation, défaut de fabrication avéré) pourront être acceptés pour échange après validation de notre équipe technique.</li>
          </ul>
        </div>

        {/* Article 8 */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "#e0f2fe", color: "#0369a1", width: "28px", height: "28px", borderRadius: "50%", display: "inline-grid", placeItems: "center", fontSize: "13px" }}>8</span>
            Garantie constructeur &amp; Service Après-Vente (SAV)
          </h2>
          <p>
            Tous les dispositifs électroniques et mécaniques (stéthoscopes, tensiomètres, thermomètres, oxymètres) bénéficient de la garantie légale contre les défauts de conformité et de la garantie constructeur. Cette garantie couvre le remplacement ou la réparation des pièces défectueuses sous réserve d'une utilisation normale conforme à la notice du fabricant.
          </p>
        </div>

        {/* Article 9 */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "#e0f2fe", color: "#0369a1", width: "28px", height: "28px", borderRadius: "50%", display: "inline-grid", placeItems: "center", fontSize: "13px" }}>9</span>
            Responsabilité &amp; Droit applicable
          </h2>
          <p>
            GoodDoctor's Shop ne saurait être tenue pour responsable de l'inadéquation d'un matériel à un acte médical particulier ou d'un dommage causé par une manipulation erronée ou non conforme aux recommandations médicales.
          </p>
          <p style={{ marginTop: "8px" }}>
            Les présentes CGV sont soumises à la <strong>législation togolaise</strong>. Tout différend relatif à leur validité, interprétation ou exécution fera l'objet d'une tentative de résolution amiable préalable. À défaut, compétence exclusive est attribuée aux tribunaux compétents de Lomé (Togo).
          </p>
        </div>

        {/* Article 10 */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "#e0f2fe", color: "#0369a1", width: "28px", height: "28px", borderRadius: "50%", display: "inline-grid", placeItems: "center", fontSize: "13px" }}>10</span>
            Service Client &amp; Assistance
          </h2>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px 20px", marginTop: "10px" }}>
            <p style={{ margin: 0, fontWeight: 600, color: "#0f172a" }}>GoodDoctor's Shop · Service Clientèle</p>
            <p style={{ margin: "4px 0 0", color: "#475569" }}>Lomé, République Togolaise</p>
            <p style={{ margin: "4px 0 0", color: "#475569" }}>
              Assistance par e-mail :{" "}
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
