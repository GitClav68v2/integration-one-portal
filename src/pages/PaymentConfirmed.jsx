import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Dashboard.css'

export default function PaymentConfirmed() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const invoiceId = searchParams.get('invoiceId')
  const [invoice, setInvoice] = useState(null)
  const [status, setStatus] = useState('polling') // polling | confirmed | timeout

  useEffect(() => {
    if (!invoiceId) { navigate('/dashboard'); return }

    let attempts = 0
    const MAX = 15 // 30 seconds

    async function poll() {
      const { data } = await supabase
        .from('invoices')
        .select('*, customers!inner(business_name, email, account_number)')
        .eq('id', invoiceId)
        .single()

      if (data?.status === 'paid') {
        setInvoice(data)
        setStatus('confirmed')
      } else if (++attempts >= MAX) {
        setInvoice(data)
        setStatus('timeout')
      } else {
        setTimeout(poll, 2000)
      }
    }

    poll()
  }, [invoiceId])

  if (status === 'polling') {
    return (
      <div className="dashboard-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '3px solid #1E3A5F', borderTop: '3px solid #06B6D4', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 24px' }} />
          <p style={{ color: '#94A3B8' }}>Confirming your payment…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <a href="https://integrationone.net" className="dashboard-brand" style={{ textDecoration: 'none' }}>
          Integration One <span>Client Portal</span>
        </a>
        <button className="btn-signout" onClick={() => navigate('/dashboard')}>Dashboard</button>
      </header>

      <main className="dashboard-main" style={{ maxWidth: 560, margin: '0 auto' }}>
        {status === 'confirmed' ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#052e16', border: '2px solid #22C55E',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px'
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 8 }}>Payment Confirmed</h1>
              <p style={{ color: '#94A3B8' }}>Thank you, {invoice?.customers?.business_name}. A receipt has been sent to {invoice?.customers?.email}.</p>
            </div>

            <div style={{ background: '#0D1829', border: '1px solid #1E3A5F', borderRadius: 12, padding: 24, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #1E3A5F' }}>
                <span style={{ color: '#94A3B8', fontSize: '0.875rem' }}>Invoice</span>
                <span style={{ fontWeight: 600 }}>{invoice?.invoice_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #1E3A5F' }}>
                <span style={{ color: '#94A3B8', fontSize: '0.875rem' }}>Account</span>
                <span>#{invoice?.customers?.account_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8', fontSize: '0.875rem' }}>Amount Paid</span>
                <span style={{ fontWeight: 700, fontSize: '1.25rem', color: '#22C55E' }}>
                  ${parseFloat(invoice?.amount_total ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-view" style={{ flex: 1, padding: '12px 0' }} onClick={() => navigate(`/invoice/${invoiceId}`)}>
                View Invoice
              </button>
              <button className="btn-view" style={{ flex: 1, padding: '12px 0' }} onClick={() => navigate('/dashboard')}>
                Dashboard
              </button>
            </div>
          </>
        ) : (
          // Timeout — payment may still process
          <>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#1c1400', border: '2px solid #F59E0B',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px'
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 8 }}>Payment Processing</h1>
              <p style={{ color: '#94A3B8' }}>Your payment is being processed. This usually takes a few seconds. Check your dashboard or email for confirmation.</p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-view" style={{ flex: 1, padding: '12px 0' }} onClick={() => navigate(`/invoice/${invoiceId}`)}>
                View Invoice
              </button>
              <button className="btn-view" style={{ flex: 1, padding: '12px 0' }} onClick={() => navigate('/dashboard')}>
                Dashboard
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
