import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://portal.integrationone.net',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify JWT using anon key client — service role key cannot validate user tokens
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      console.error('Auth error:', authError?.message)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Service role client for privileged DB operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

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

    const { invoiceId } = await req.json()
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: 'Missing invoiceId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('*, customers!inner(email)')
      .eq('id', invoiceId)
      .single()

    if (invError || !invoice) {
      console.error('Invoice fetch failed:', invError, 'invoiceId:', invoiceId, 'user:', user.email)
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Invoice customer email:', invoice.customers?.email, 'User email:', user.email)

    if (invoice.customers.email !== user.email) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const balance = invoice.amount_total - invoice.amount_paid
    if (balance <= 0) {
      return new Response(JSON.stringify({ error: 'Invoice already paid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create Stripe Checkout Session via REST API — no SDK needed
    const params = new URLSearchParams({
      'payment_method_types[]': 'card',
      'customer_email': user.email,
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': `Invoice ${invoice.invoice_number}`,
      'line_items[0][price_data][product_data][description]': 'Integration One — Professional Perimeter Security',
      'line_items[0][price_data][unit_amount]': String(Math.round(balance * 100)),
      'line_items[0][quantity]': '1',
      'mode': 'payment',
      'success_url': `https://portal.integrationone.net/payment-confirmed?invoiceId=${invoiceId}`,
      'cancel_url': `https://portal.integrationone.net/invoice/${invoiceId}`,
      'metadata[invoiceId]': invoiceId,
    })

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const session = await stripeRes.json()

    if (!stripeRes.ok) {
      return new Response(JSON.stringify({ error: session.error?.message || 'Stripe error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
