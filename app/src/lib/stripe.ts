import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
})

export async function createPaymentIntent(amountInCentavos: number, metadata: Record<string, string>) {
  return stripe.paymentIntents.create({
    amount: amountInCentavos,
    currency: 'php',
    metadata,
  })
}

export { stripe }
