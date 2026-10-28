interface AboutProps {
  onBack?: () => void
}

export default function About({ onBack }: AboutProps) {
  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      window.location.hash = ""
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  return (
    <section id="view-about" className="legal-view-container pt-32 lg:pt-40 pb-24 px-6 container mx-auto max-w-5xl flex-grow animate-fadeIn">
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

      <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-12 lg:mb-16 text-zinc-900 pb-8" style={{ borderBottom: "1px solid", borderImage: "linear-gradient(90deg, rgba(124, 58, 237, 0.3), transparent) 1" }}>
        À Propos de{" "}
        <span style={{ background: "linear-gradient(135deg, #2563eb, #22d3ee, #38bdf8)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          GoodDoctor's Shop
        </span>
      </h1>

      <div className="space-y-8 text-zinc-600 font-medium leading-relaxed">
        <p className="text-lg lg:text-xl">
          La boutique en ligne de confiance <strong className="text-zinc-900 font-bold">gooddoctorsshop.com</strong> est la référence de choix au Togo pour l'achat de matériel médical, paramédical et d'instruments de diagnostic de haute précision. Basés à Lomé, nous accompagnons au quotidien les professionnels de la santé, les cliniques, les laboratoires et les particuliers à la recherche de la rigueur clinique absolue.
        </p>
        <p className="text-lg lg:text-xl">
          Nous nous engageons à offrir les meilleurs standards de fiabilité grâce à notre signature unique : <span className="font-bold bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent">l'empreinte de la qualité !</span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mt-16">
          {/* Card 1 */}
          <div className="feature-card bg-white p-8 lg:p-10 flex flex-col items-start gap-5 rounded-3xl border border-zinc-200">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-blue-50 border border-blue-100 shadow-sm">
              <svg className="w-7 h-7 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="7"/>
                <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
              </svg>
            </div>
            <h3 className="font-extrabold text-zinc-900 uppercase tracking-widest text-sm lg:text-base">Articles Certifiés</h3>
            <p className="text-sm lg:text-base text-zinc-500 font-medium">Chaque instrument et équipement proposé est certifié cliniquement conforme.</p>
          </div>

          {/* Card 2 */}
          <div className="feature-card bg-white p-8 lg:p-10 flex flex-col items-start gap-5 rounded-3xl border border-zinc-200">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-cyan-50 border border-cyan-100 shadow-sm">
              <svg className="w-7 h-7 text-cyan-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <h3 className="font-extrabold text-zinc-900 uppercase tracking-widest text-sm lg:text-base">Réseau Local Togo</h3>
            <p className="text-sm lg:text-base text-zinc-500 font-medium">Une présence ancrée au coeur de Lomé pour une réactivité optimale.</p>
          </div>

          {/* Card 3 */}
          <div className="feature-card bg-white p-8 lg:p-10 flex flex-col items-start gap-5 rounded-3xl border border-zinc-200">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-blue-50 border border-blue-100 shadow-sm">
              <svg className="w-7 h-7 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <h3 className="font-extrabold text-zinc-900 uppercase tracking-widest text-sm lg:text-base">Rigueur & Confiance</h3>
            <p className="text-sm lg:text-base text-zinc-500 font-medium">Un service clientèle à l'écoute des praticiens de santé togolais.</p>
          </div>
        </div>

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
