import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Dashboard.css'

export default function AdminDashboard({ session }) {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('customers')
        .select('*, invoices(count)')
        .order('business_name')
      setCustomers(data || [])
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
        <div className="dashboard-brand">Integration One <span>Admin</span></div>
        <div className="dashboard-user">
          <span>{session.user.email}</span>
          <button onClick={handleSignOut} className="btn-signout">Sign Out</button>
        </div>
      </header>

      <main className="dashboard-main">
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
                  <td>
                    <button className="btn-view" onClick={() => navigate(`/admin/customers/${c.id}`)}>
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
