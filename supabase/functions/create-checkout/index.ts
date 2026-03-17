import Stripe from 'npm:stripe@13.11.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://portal.integrationone.net',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Require Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Verify JWT and get the authenticated user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Rate limit: max 5 payment attempts per 60 seconds per user
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString()
    const { count } = await supabase
      .from('payment_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('attempted_at', oneMinuteAgo)

    if ((count ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: 'Too many attempts. Please wait a minute.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabase.from('payment_attempts').insert({ user_id: user.id })

    // Only accept invoiceId from client — never trust amount
    const { invoiceId } = await req.json()
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: 'Missing invoiceId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch invoice with customer email for ownership check
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('*, customers!inner(email)')
      .eq('id', invoiceId)
      .single()

    if (invError || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify the invoice belongs to the authenticated user
    if (invoice.customers.email !== user.email) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Calculate balance server-side
    const balance = invoice.amount_total - invoice.amount_paid
    if (balance <= 0) {
      return new Response(JSON.stringify({ error: 'Invoice already paid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2023-10-16',
    })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Invoice ${invoice.invoice_number}`,
            description: 'Integration One — Professional Perimeter Security',
          },
          unit_amount: Math.round(balance * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `https://portal.integrationone.net/invoice/${invoiceId}?paid=true`,
      cancel_url: `https://portal.integrationone.net/invoice/${invoiceId}`,
      metadata: { invoiceId },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
