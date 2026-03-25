import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Dashboard.css'

export default function AdminDashboard({ session }) {
  const [customers, setCustomers] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()

  const tab = location.pathname.startsWith('/admin/suppliers') ? 'suppliers' : 'customers'

  useEffect(() => {
    async function load() {
      const [{ data: custs }, { data: sups }] = await Promise.all([
        supabase.from('customers').select('*, invoices(count)').order('business_name'),
        supabase.from('suppliers').select('*, supplier_orders(count)').order('business_name')
      ])
      setCustomers(custs || [])
      setSuppliers(sups || [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (loading) return <div className="loading">Loading…</div>

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <a href="https://integrationone.net" className="dashboard-brand" style={{ textDecoration: 'none' }}>Integration One <span>Admin</span></a>
        <div className="dashboard-user">
          <span>{session.user.email}</span>
          <button onClick={handleSignOut} className="btn-signout">Sign Out</button>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          <button
            onClick={() => navigate('/admin')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 20px', fontSize: '0.95rem', fontWeight: 600,
              color: tab === 'customers' ? 'var(--cyan)' : 'var(--muted)',
              borderBottom: tab === 'customers' ? '2px solid var(--cyan)' : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.15s'
            }}>
            Customers
          </button>
          <button
            onClick={() => navigate('/admin/suppliers')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 20px', fontSize: '0.95rem', fontWeight: 600,
              color: tab === 'suppliers' ? 'var(--cyan)' : 'var(--muted)',
              borderBottom: tab === 'suppliers' ? '2px solid var(--cyan)' : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.15s'
            }}>
            OEM Suppliers
          </button>
        </div>

        {tab === 'customers' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Customers</h1>
              <button className="btn-view" style={{ padding: '8px 18px' }} onClick={() => navigate('/admin/customers/new')}>
                + Add Customer
              </button>
            </div>
            <div className="invoices-table-wrap">
              <table className="invoices-table">
                <thead>
                  <tr>
                    <th>Account #</th>
                    <th>Business</th>
                    <th>Contact</th>
                    <th>Email</th>
                    <th>Invoices</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id}>
                      <td>{c.account_number}</td>
                      <td>{c.business_name}</td>
                      <td>{c.contact_name}</td>
                      <td>{c.email}</td>
                      <td>{c.invoices?.[0]?.count ?? 0}</td>
                      <td style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-view" onClick={() => navigate(`/admin/customers/${c.id}`)}>
                          Manage
                        </button>
                        <button className="btn-view" onClick={() => navigate(`/admin/customers/${c.id}#add-invoice`)}>
                          + Invoice
                        </button>
                      </td>
                    </tr>
                  ))}
                  {customers.length === 0 && (
                    <tr><td colSpan={6} style={{ color: 'var(--muted)', textAlign: 'center' }}>No customers yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'suppliers' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h1 style={{ margin: 0, fontSize: '1.5rem' }}>OEM Suppliers</h1>
              <button className="btn-view" style={{ padding: '8px 18px' }} onClick={() => navigate('/admin/suppliers/new')}>
                + Add Supplier
              </button>
            </div>
            <div className="invoices-table-wrap">
              <table className="invoices-table">
                <thead>
                  <tr>
                    <th>Vendor #</th>
                    <th>Business</th>
                    <th>Contact</th>
                    <th>Email</th>
                    <th>POs</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map(s => (
                    <tr key={s.id}>
                      <td>{s.vendor_number}</td>
                      <td>{s.business_name}</td>
                      <td>{s.contact_name}</td>
                      <td>{s.email}</td>
                      <td>{s.supplier_orders?.[0]?.count ?? 0}</td>
                      <td style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-view" onClick={() => navigate(`/admin/suppliers/${s.id}`)}>
                          Manage
                        </button>
                        <button className="btn-view" onClick={() => navigate(`/admin/suppliers/${s.id}#add-order`)}>
                          + PO
                        </button>
                      </td>
                    </tr>
                  ))}
                  {suppliers.length === 0 && (
                    <tr><td colSpan={6} style={{ color: 'var(--muted)', textAlign: 'center' }}>No suppliers yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
