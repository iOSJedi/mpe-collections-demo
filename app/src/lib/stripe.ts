import Stripe from 'stripe'

let _stripe: Stripe | null = null

function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    _stripe = new Stripe(key, {
      apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
    })
  }
  return _stripe
}

export async function createPaymentIntent(amountInCentavos: number, metadata: Record<string, string>) {
  return getStripe().paymentIntents.create({
    amount: amountInCentavos,
    currency: 'php',
    metadata,
  })
}

// Lazy stripe accessor for direct usage in route handlers
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
