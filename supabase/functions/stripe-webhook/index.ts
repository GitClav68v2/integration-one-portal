import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

async function buildReceiptPDF(data: {
  businessName: string
  invoiceNumber: string
  accountNumber: string
  amountPaid: string
  paidDate: string
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const cyan = rgb(0.024, 0.714, 0.831)
  const dark = rgb(0.118, 0.141, 0.188)
  const muted = rgb(0.58, 0.635, 0.722)
  const { width, height } = page.getSize()

  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: dark })
  page.drawText('Integration One', { x: 40, y: height - 40, font: bold, size: 18, color: rgb(1,1,1) })
  page.drawText('Client Portal', { x: 40, y: height - 58, font: regular, size: 10, color: cyan })
  page.drawText('PAYMENT RECEIPT', { x: 40, y: height - 120, font: bold, size: 20, color: dark })
  page.drawLine({ start: { x: 40, y: height - 135 }, end: { x: width - 40, y: height - 135 }, thickness: 1, color: rgb(0.878, 0.91, 0.941) })

  const rows: [string, string][] = [
    ['Invoice Number', data.invoiceNumber],
    ['Account', `#${data.accountNumber}`],
    ['Customer', data.businessName],
    ['Date Paid', data.paidDate],
  ]
  let y = height - 165
  for (const [label, value] of rows) {
    page.drawText(label, { x: 40, y, font: regular, size: 10, color: muted })
    page.drawText(value, { x: 220, y, font: regular, size: 10, color: dark })
    y -= 26
  }

  page.drawLine({ start: { x: 40, y: y - 6 }, end: { x: width - 40, y: y - 6 }, thickness: 1, color: rgb(0.878, 0.91, 0.941) })
  y -= 32
  page.drawText('Amount Paid', { x: 40, y, font: bold, size: 13, color: dark })
  page.drawText(`$${data.amountPaid}`, { x: 220, y, font: bold, size: 13, color: cyan })

  page.drawText('Questions? Contact us at info@integrationone.net', { x: 40, y: 60, font: regular, size: 9, color: muted })
  page.drawText('© 2026 Integration One. All rights reserved.', { x: 40, y: 44, font: regular, size: 9, color: muted })

  return doc.save()
}

async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')))
  const timestamp = parts['t']
  const sig = parts['v1']
  if (!timestamp || !sig) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`))
  const hex = Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hex === sig
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  if (!signature) {
    return new Response('Missing Stripe signature', { status: 400 })
  }

  const valid = await verifyStripeSignature(body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!)
  if (!valid) {
    return new Response('Webhook signature verification failed', { status: 400 })
  }

  const event = JSON.parse(body)

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const invoiceId = session.metadata?.invoiceId

    if (!invoiceId) {
      return new Response('Missing invoiceId in session metadata', { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: invoice, error: fetchErr } = await supabase
      .from('invoices')
      .select('*, customers!inner(email, business_name, contact_name, account_number)')
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

    // Generate PDF, store, and email — fire and forget
    ;(async () => {
      try {
        const amountFormatted = parseFloat(invoice.amount_total).toLocaleString('en-US', {
          minimumFractionDigits: 2, maximumFractionDigits: 2
        })
        const paidDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

        const pdfBytes = await buildReceiptPDF({
          businessName: invoice.customers.business_name,
          invoiceNumber: invoice.invoice_number,
          accountNumber: invoice.customers.account_number ?? '',
          amountPaid: amountFormatted,
          paidDate,
        })

        const pdfPath = `${invoice.customer_id}/${invoiceId}-receipt.pdf`
        await supabase.storage.from('invoices').upload(pdfPath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        })

        await supabase.from('invoices').update({ receipt_pdf_path: pdfPath }).eq('id', invoiceId)

        const pdfBase64 = btoa(String.fromCharCode(...pdfBytes))

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
          },
          body: JSON.stringify({
            from: 'invoices@integrationone.net',
            to: invoice.customers.email,
            subject: `Payment Received — Invoice ${invoice.invoice_number}`,
            attachments: [{ filename: `receipt-${invoice.invoice_number}.pdf`, content: pdfBase64 }],
            html: `
              <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
                <div style="background: #0B1120; padding: 24px 32px; border-radius: 8px 8px 0 0;">
                  <h1 style="color: #fff; margin: 0; font-size: 1.2rem; font-weight: 700;">
                    Integration One <span style="color: #06B6D4; font-weight: 400;">Client Portal</span>
                  </h1>
                </div>
                <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 8px 8px;">
                  <p style="margin: 0 0 8px;">Hi ${invoice.customers.business_name},</p>
                  <p style="margin: 0 0 24px; color: #4b5563;">We've received your payment. Your receipt is attached to this email.</p>
                  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                      <td style="padding: 10px 0; color: #6b7280; font-size: 0.9rem;">Invoice #</td>
                      <td style="padding: 10px 0; font-weight: 600; text-align: right;">${invoice.invoice_number}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                      <td style="padding: 10px 0; color: #6b7280; font-size: 0.9rem;">Date Paid</td>
                      <td style="padding: 10px 0; text-align: right;">${paidDate}</td>
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
        })
      } catch (e) {
        console.error('Receipt generation/email failed:', e)
      }
    })()
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
})
