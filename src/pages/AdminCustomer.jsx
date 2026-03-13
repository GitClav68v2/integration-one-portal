import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Dashboard.css'

export default function AdminCustomer({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [newInvoice, setNewInvoice] = useState({
    invoice_number: '', invoice_date: '', due_date: '',
    amount_total: '', amount_paid: '0', status: 'unpaid'
  })

  useEffect(() => {
    async function load() {
      const { data: cust } = await supabase.from('customers').select('*').eq('id', id).single()
      if (cust) {
        setCustomer(cust)
        const { data: inv } = await supabase
          .from('invoices').select('*').eq('customer_id', id)
          .order('invoice_date', { ascending: false })
        setInvoices(inv || [])
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function handleAddInvoice(e) {
    e.preventDefault()
    const { data, error } = await supabase.from('invoices').insert([{
      ...newInvoice,
      customer_id: id,
      amount_total: parseFloat(newInvoice.amount_total.replace(/,/g, '')),
      amount_paid: parseFloat(newInvoice.amount_paid.replace(/,/g, ''))
    }]).select().single()
    if (!error && data) {
      setInvoices([data, ...invoices])
      setNewInvoice({ invoice_number: '', invoice_date: '', due_date: '', amount_total: '', amount_paid: '0', status: 'unpaid' })
      // Send email notification
      supabase.functions.invoke('notify-invoice', {
        body: {
          customerEmail: customer.email,
          customerName: customer.business_name,
          invoiceNumber: data.invoice_number,
          invoiceDate: new Date(data.invoice_date).toLocaleDateString(),
          dueDate: new Date(data.due_date).toLocaleDateString(),
          amountTotal: parseFloat(data.amount_total).toLocaleString('en-US', { minimumFractionDigits: 2 }),
        }
      })
    }
  }

  async function handleUploadPdf(invoiceId, file) {
    setUploading(true)
    const path = `${id}/${invoiceId}/${file.name}`
    const { error: upErr } = await supabase.storage.from('invoices').upload(path, file, { upsert: true })
    if (!upErr) {
      await supabase.from('invoices').update({ pdf_path: path }).eq('id', invoiceId)
      setInvoices(invoices.map(inv => inv.id === invoiceId ? { ...inv, pdf_path: path } : inv))
    }
    setUploading(false)
  }

  if (loading) return <div className="loading">Loading…</div>
  if (!customer) return <div className="loading">Customer not found.</div>

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-brand">Integration One <span>Admin</span></div>
        <button className="btn-signout" onClick={() => navigate('/admin')}>← Customers</button>
      </header>

      <main className="dashboard-main">
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem' }}>{customer.business_name}</h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
            Account #{customer.account_number} · {customer.contact_name} · {customer.email}
          </p>
        </div>

        <div style={{ background: 'var(--slate)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, marginBottom: 32 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1rem' }}>Add Invoice</h2>
          <form onSubmit={handleAddInvoice} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div><label style={labelStyle}>Invoice #</label><input value={newInvoice.invoice_number} onChange={e => setNewInvoice({ ...newInvoice, invoice_number: e.target.value })} required style={inputStyle} /></div>
            <div><label style={labelStyle}>Invoice Date</label><input type="date" value={newInvoice.invoice_date} onChange={e => setNewInvoice({ ...newInvoice, invoice_date: e.target.value })} required style={inputStyle} /></div>
            <div><label style={labelStyle}>Due Date</label><input type="date" value={newInvoice.due_date} onChange={e => setNewInvoice({ ...newInvoice, due_date: e.target.value })} required style={inputStyle} /></div>
            <div><label style={labelStyle}>Total $</label><input value={newInvoice.amount_total} onChange={e => setNewInvoice({ ...newInvoice, amount_total: formatCurrency(e.target.value) })} required style={inputStyle} placeholder="0.00" /></div>
            <div><label style={labelStyle}>Paid $</label><input value={newInvoice.amount_paid} onChange={e => setNewInvoice({ ...newInvoice, amount_paid: formatCurrency(e.target.value) })} style={inputStyle} placeholder="0.00" /></div>
            <div><label style={labelStyle}>Status</label><select value={newInvoice.status} onChange={e => setNewInvoice({ ...newInvoice, status: e.target.value })} style={inputStyle}>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select></div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}><button type="submit" className="btn-view" style={{ padding: '10px 18px', width: '100%' }}>Add Invoice</button></div>
          </form>
        </div>

        <div className="invoices-table-wrap">
          <table className="invoices-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Due</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Status</th>
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td>{inv.invoice_number}</td>
                  <td>{new Date(inv.invoice_date).toLocaleDateString()}</td>
                  <td>{new Date(inv.due_date).toLocaleDateString()}</td>
                  <td>${parseFloat(inv.amount_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td>${parseFloat(inv.amount_paid).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td><span style={{ color: inv.status === 'paid' ? '#22C55E' : inv.status === 'partial' ? '#F59E0B' : '#EF4444', textTransform: 'capitalize' }}>{inv.status}</span></td>
                  <td>
                    {inv.pdf_path ? (
                      <span style={{ color: 'var(--cyan)', fontSize: '0.82rem' }}>✓ Uploaded</span>
                    ) : (
                      <label style={{ cursor: 'pointer' }}>
                        <span className="btn-view" style={{ fontSize: '0.78rem', padding: '4px 10px' }}>
                          {uploading ? 'Uploading…' : 'Upload PDF'}
                        </span>
                        <input type="file" accept="application/pdf" style={{ display: 'none' }}
                          onChange={e => e.target.files[0] && handleUploadPdf(inv.id, e.target.files[0])} />
                      </label>
                    )}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={7} style={{ color: 'var(--muted)', textAlign: 'center' }}>No invoices yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

function formatCurrency(value) {
  const digits = value.replace(/[^\d.]/g, '')
  const parts = digits.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.length > 2 ? parts[0] + '.' + parts[1] : parts.join('.')
}

const labelStyle = {
  display: 'block',
  fontSize: '0.78rem',
  color: '#94A3B8',
  marginBottom: 5
}

const inputStyle = {
  background: '#0B1120',
  border: '1px solid #1E3A5F',
  borderRadius: 6,
  padding: '9px 12px',
  color: '#E2E8F0',
  fontSize: '0.9rem',
  outline: 'none',
  width: '100%'
}
