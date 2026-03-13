import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Dashboard.css'

export default function Invoice({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: inv } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .single()

      if (inv) {
        setInvoice(inv)
        if (inv.pdf_path) {
          const { data } = await supabase.storage
            .from('invoices')
            .createSignedUrl(inv.pdf_path, 3600)
          if (data) setPdfUrl(data.signedUrl)
        }
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="loading">Loading…</div>
  if (!invoice) return <div className="loading">Invoice not found.</div>

  const balance = invoice.amount_total - invoice.amount_paid

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-brand">Integration One <span>Client Portal</span></div>
        <button className="btn-signout" onClick={() => navigate('/dashboard')}>← Back</button>
      </header>

      <main className="dashboard-main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem' }}>Invoice {invoice.invoice_number}</h1>
            <p style={{ margin: 0, color: 'var(--muted)' }}>
              Issued {new Date(invoice.invoice_date).toLocaleDateString()} · Due {new Date(invoice.due_date).toLocaleDateString()}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>${parseFloat(invoice.amount_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              Paid: ${parseFloat(invoice.amount_paid).toLocaleString('en-US', { minimumFractionDigits: 2 })} ·
              Balance: ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {pdfUrl && (
          <div style={{ marginBottom: 24 }}>
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn-view" style={{ textDecoration: 'none', display: 'inline-block', padding: '10px 20px' }}>
              Download PDF
            </a>
          </div>
        )}

        {invoice.status !== 'paid' && (
          <div style={{ background: 'var(--slate)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, marginTop: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1rem' }}>Make a Payment</h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Online payments coming soon. Please contact us at <a href="mailto:info@integrationone.net" style={{ color: 'var(--cyan)' }}>info@integrationone.net</a>.</p>
          </div>
        )}
      </main>
    </div>
  )
}
