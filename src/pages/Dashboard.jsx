import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Dashboard.css'

export default function Dashboard({ session }) {
  const [invoices, setInvoices] = useState([])
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data: cust } = await supabase
        .from('customers')
        .select('*')
        .eq('email', session.user.email)
        .single()

      if (cust) {
        setCustomer(cust)
        const { data: inv } = await supabase
          .from('invoices')
          .select('*')
          .eq('customer_id', cust.id)
          .order('invoice_date', { ascending: false })
        setInvoices(inv || [])
      }
      setLoading(false)
    }
    load()
  }, [session])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  function statusBadge(status) {
    const colors = { paid: '#22C55E', partial: '#F59E0B', unpaid: '#EF4444' }
    return (
      <span style={{
        background: colors[status] + '22',
        color: colors[status],
        padding: '2px 10px',
        borderRadius: '99px',
        fontSize: '0.78rem',
        fontWeight: 600,
        textTransform: 'capitalize'
      }}>{status}</span>
    )
  }

  if (loading) return <div className="loading">Loading…</div>

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-brand">Integration One <span>Client Portal</span></div>
        <div className="dashboard-user">
          <span>{session.user.email}</span>
          <button onClick={handleSignOut} className="btn-signout">Sign Out</button>
        </div>
      </header>

      <main className="dashboard-main">
        {customer && (
          <div className="dashboard-welcome">
            <h1>Welcome, {customer.business_name}</h1>
            <p>Account #{customer.account_number}</p>
          </div>
        )}

        <section className="invoices-section">
          <h2>Your Invoices</h2>
          {invoices.length === 0 ? (
            <p className="no-invoices">No invoices yet.</p>
          ) : (
            <div className="invoices-table-wrap">
              <table className="invoices-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Due Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td>{inv.invoice_number}</td>
                      <td>{new Date(inv.invoice_date).toLocaleDateString()}</td>
                      <td>{new Date(inv.due_date).toLocaleDateString()}</td>
                      <td>${parseFloat(inv.amount_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td>{statusBadge(inv.status)}</td>
                      <td>
                        <button className="btn-view" onClick={() => navigate(`/invoice/${inv.id}`)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
