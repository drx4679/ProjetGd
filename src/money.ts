// Fixed EUR/CFA parity, rounded to the nearest whole CFA franc.
export const toCfa = (euros: number) => Math.round(euros * 655.957)
export const formatMoney = (amount: number) =>
  `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA`
export const standardDelivery = toCfa(4.9)
export const expressDelivery = toCfa(9.9)
export const freeDeliveryThreshold = toCfa(75)
