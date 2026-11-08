// Fixed EUR/CFA parity, rounded to the nearest whole CFA franc.
export const toCfa = (euros: number) => Math.round(euros * 655.957)
export const formatMoney = (amount: number) =>
  `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA`
export const formatPriceRange = (minPrice: number, maxPrice?: number | null) => {
  if (maxPrice && maxPrice > minPrice) {
    return `${minPrice.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} – ${maxPrice.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA`
  }
  return formatMoney(minPrice)
}


