import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.11.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  if (!signature) {
    return new Response('Missing Stripe signature', { status: 400 })
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2023-10-16',
  })

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    )
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const invoiceId = session.metadata?.invoiceId

    if (!invoiceId) {
      return new Response('Missing invoiceId in session metadata', { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fetch invoice + customer for authoritative amount and receipt details
    const { data: invoice, error: fetchErr } = await supabase
      .from('invoices')
      .select('*, customers!inner(email, business_name, contact_name)')
      .eq('id', invoiceId)
      .single()

    if (fetchErr || !invoice) {
      return new Response('Invoice not found', { status: 404 })
    }

    const { error: updateErr } = await supabase
      .from('invoices')
      .update({ status: 'paid', amount_paid: invoice.amount_total })
      .eq('id', invoiceId)

    if (updateErr) {
      return new Response('Database update failed', { status: 500 })
    }

    // Send payment receipt — fire and forget
    const amountFormatted = parseFloat(invoice.amount_total).toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    })
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      },
      body: JSON.stringify({
        from: 'invoices@integrationone.net',
        to: invoice.customers.email,
        subject: `Payment Received — Invoice ${invoice.invoice_number}`,
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
            <div style="background: #0B1120; padding: 24px 32px; border-radius: 8px 8px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 1.2rem; font-weight: 700;">
                Integration One <span style="color: #06B6D4; font-weight: 400;">Client Portal</span>
              </h1>
            </div>
            <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px;">Hi ${invoice.customers.business_name},</p>
              <p style="margin: 0 0 24px; color: #4b5563;">We've received your payment. Thank you!</p>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 10px 0; color: #6b7280; font-size: 0.9rem;">Invoice #</td>
                  <td style="padding: 10px 0; font-weight: 600; text-align: right;">${invoice.invoice_number}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-size: 0.9rem;">Amount Paid</td>
                  <td style="padding: 10px 0; font-weight: 700; font-size: 1.1rem; color: #22C55E; text-align: right;">$${amountFormatted}</td>
                </tr>
              </table>
              <a href="https://portal.integrationone.net/invoice/${invoiceId}" style="display: inline-block; background: #06B6D4; color: #0B1120; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Invoice</a>
              <p style="margin: 24px 0 0; color: #9ca3af; font-size: 0.85rem;">Questions? Email us at <a href="mailto:info@integrationone.net" style="color: #06B6D4;">info@integrationone.net</a></p>
            </div>
          </div>
        `,
      }),
    }).catch(() => {}) // don't fail the webhook if email fails
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
})
