import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Dashboard.css'

export default function AdminSupplier({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [supplier, setSupplier] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [newOrder, setNewOrder] = useState({
    po_number: '', order_date: '', due_date: '',
    amount_total: '', amount_paid: '0', status: 'pending'
  })

  useEffect(() => {
    async function load() {
      const { data: sup } = await supabase.from('suppliers').select('*').eq('id', id).single()
      if (sup) {
        setSupplier(sup)
        const { data: ord } = await supabase
          .from('supplier_orders').select('*').eq('supplier_id', id)
          .order('order_date', { ascending: false })
        setOrders(ord || [])
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function handleAddOrder(e) {
    e.preventDefault()
    const { data, error } = await supabase.from('supplier_orders').insert([{
      ...newOrder,
      supplier_id: id,
      amount_total: parseFloat(newOrder.amount_total.replace(/,/g, '')),
      amount_paid: parseFloat(newOrder.amount_paid.replace(/,/g, ''))
    }]).select().single()
    if (!error && data) {
      setOrders([data, ...orders])
      setNewOrder({ po_number: '', order_date: '', due_date: '', amount_total: '', amount_paid: '0', status: 'pending' })
    }
  }

  if (loading) return <div className="loading">Loading…</div>
  if (!supplier) return <div className="loading">Supplier not found.</div>

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <a href="https://integrationone.net" className="dashboard-brand" style={{ textDecoration: 'none' }}>Integration One <span>Admin</span></a>
        <button className="btn-signout" onClick={() => navigate('/admin/suppliers')}>← OEM Suppliers</button>
      </header>

      <main className="dashboard-main">
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem' }}>{supplier.business_name}</h1>
          <p className="customer-meta" style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
            <span>Vendor #{supplier.vendor_number} · {supplier.contact_name}</span>
            <span style={{ wordBreak: 'break-all' }}>{supplier.email}</span>
          </p>
        </div>

        <div id="add-order" style={{ background: 'var(--slate)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, marginBottom: 32 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1rem' }}>Add Purchase Order</h2>
          <form onSubmit={handleAddOrder}
            onKeyDown={e => {
              const isDate = e.target.type === 'date'
              const isEnter = e.key === 'Enter'
              const isTab = e.key === 'Tab' && !e.shiftKey
              if ((isEnter || (isTab && !isDate)) && e.target.tagName !== 'BUTTON') {
                e.preventDefault()
                const fields = Array.from(e.currentTarget.querySelectorAll('input, select, button'))
                const idx = fields.indexOf(e.target)
                if (idx < fields.length - 1) requestAnimationFrame(() => fields[idx + 1].focus())
              }
            }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div><label style={labelStyle}>PO #</label><input value={newOrder.po_number} onChange={e => setNewOrder({ ...newOrder, po_number: e.target.value })} required style={inputStyle} /></div>
            <div><label style={labelStyle}>Order Date</label><input type="date" value={newOrder.order_date} onChange={e => setNewOrder({ ...newOrder, order_date: e.target.value })} required style={inputStyle} /></div>
            <div><label style={labelStyle}>Due Date</label><input type="date" value={newOrder.due_date} onChange={e => setNewOrder({ ...newOrder, due_date: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Total $</label><input value={newOrder.amount_total} onChange={e => setNewOrder({ ...newOrder, amount_total: formatCurrency(e.target.value) })} onBlur={e => { const val = e.target.value; setTimeout(() => setNewOrder(v => ({ ...v, amount_total: finalizeCurrency(val) })), 0) }} required style={inputStyle} placeholder="0.00" /></div>
            <div><label style={labelStyle}>Paid $</label><input value={newOrder.amount_paid} onChange={e => setNewOrder({ ...newOrder, amount_paid: formatCurrency(e.target.value) })} onBlur={e => { const val = e.target.value; setTimeout(() => setNewOrder(v => ({ ...v, amount_paid: finalizeCurrency(val) })), 0) }} style={inputStyle} placeholder="0.00" /></div>
            <div><label style={labelStyle}>Status</label><select value={newOrder.status} onChange={e => setNewOrder({ ...newOrder, status: e.target.value })} style={inputStyle}>
              <option value="pending">Pending</option>
              <option value="received">Received</option>
              <option value="paid">Paid</option>
            </select></div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}><button type="submit" className="btn-view" style={{ padding: '10px 18px', width: '100%' }}>Add PO</button></div>
          </form>
        </div>

        <div className="invoices-table-wrap">
          <table className="invoices-table">
            <thead>
              <tr>
                <th>PO #</th>
                <th>Order Date</th>
                <th>Due</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(ord => (
                <tr key={ord.id}>
                  <td>{ord.po_number}</td>
                  <td>{new Date(ord.order_date).toLocaleDateString()}</td>
                  <td>{ord.due_date ? new Date(ord.due_date).toLocaleDateString() : '—'}</td>
                  <td>${parseFloat(ord.amount_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td>${parseFloat(ord.amount_paid).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td><span style={{ color: ord.status === 'paid' ? '#22C55E' : ord.status === 'received' ? '#F59E0B' : '#94A3B8', textTransform: 'capitalize' }}>{ord.status}</span></td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={6} style={{ color: 'var(--muted)', textAlign: 'center' }}>No purchase orders yet.</td></tr>
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
  if (parts.length > 1) parts[1] = parts[1].slice(0, 2)
  return parts.length > 2 ? parts[0] + '.' + parts[1] : parts.join('.')
}

function finalizeCurrency(value) {
  const num = parseFloat(value.replace(/,/g, ''))
  if (isNaN(num)) return ''
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
