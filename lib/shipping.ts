export interface ShippingCalculation {
  courierFee: number
  estimatedTax: number
  totalShippingAndTax: number
}

export function calculateDHLShipping(cardCount: number, totalDeclaredValue: number, country: string): ShippingCalculation {
  // Base DHL Express fee for international card transit (example baseline)
  let baseCourier = 35.00 
  
  // Add a small incremental fee per card for weight/handling
  const perCardFee = 1.50
  let courierFee = baseCourier + (cardCount * perCardFee)

  // Adjust slightly if domestic vs international (e.g., local courier to your Cape Town hub vs DHL international)
  if (country.toLowerCase() === 'south africa' || country.toLowerCase() === 'za') {
    // Local domestic leg + international consolidation bundle
    courierFee = 25.00 + (cardCount * 1.00)
  }

  // Insurance / Customs handling (e.g., 1% of declared value over $100 for fine-art/secure transit insurance)
  let insuranceFee = 0
  if (totalDeclaredValue > 100) {
    insuranceFee = (totalDeclaredValue - 100) * 0.01
  }

  // Estimated import VAT / duties handling fee
  const estimatedTax = (totalDeclaredValue * 0.05) + (courierFee * 0.15) // Example VAT estimation formula

  const totalShippingAndTax = courierFee + insuranceFee + estimatedTax

  return {
    courierFee: Number(courierFee.toFixed(2)),
    estimatedTax: Number(estimatedTax.toFixed(2)),
    totalShippingAndTax: Number(totalShippingAndTax.toFixed(2))
  }
}