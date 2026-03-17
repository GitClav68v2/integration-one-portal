import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://portal.integrationone.net',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { customerEmail, customerName, invoiceId, invoiceNumber, invoiceDate, dueDate, amountTotal } = await req.json()

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      },
      body: JSON.stringify({
        from: 'invoices@integrationone.net',
        to: customerEmail,
        subject: `New Invoice ${invoiceNumber} from Integration One`,
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
            <div style="background: #0B1120; padding: 24px 32px; border-radius: 8px 8px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 1.2rem; font-weight: 700;">
                Integration One <span style="color: #06B6D4; font-weight: 400;">Client Portal</span>
              </h1>
            </div>
            <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 16px;">Hi ${customerName},</p>
              <p style="margin: 0 0 24px; color: #4b5563;">A new invoice has been posted to your account.</p>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 10px 0; color: #6b7280; font-size: 0.9rem;">Invoice #</td>
                  <td style="padding: 10px 0; font-weight: 600; text-align: right;">${invoiceNumber}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 10px 0; color: #6b7280; font-size: 0.9rem;">Invoice Date</td>
                  <td style="padding: 10px 0; text-align: right;">${invoiceDate}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 10px 0; color: #6b7280; font-size: 0.9rem;">Due Date</td>
                  <td style="padding: 10px 0; text-align: right;">${dueDate}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-size: 0.9rem;">Amount Due</td>
                  <td style="padding: 10px 0; font-weight: 700; font-size: 1.1rem; text-align: right;">$${amountTotal}</td>
                </tr>
              </table>
              <a href="https://portal.integrationone.net/invoice/${invoiceId}" style="display: inline-block; background: #06B6D4; color: #0B1120; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Invoice</a>
              <p style="margin: 24px 0 0; color: #9ca3af; font-size: 0.85rem;">Questions? Email us at <a href="mailto:info@integrationone.net" style="color: #06B6D4;">info@integrationone.net</a></p>
            </div>
          </div>
        `,
      }),
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: res.ok ? 200 : 400,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
