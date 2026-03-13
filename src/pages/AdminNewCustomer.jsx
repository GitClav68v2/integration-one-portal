import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Dashboard.css'

export default function AdminNewCustomer() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    account_number: '',
    business_name: '',
    contact_name: '',
    email: '',
    phone: ''
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function suggestAccountNumber() {
      const { data } = await supabase
        .from('customers')
        .select('account_number')
        .order('account_number', { ascending: false })
        .limit(1)
      if (data && data.length > 0) {
        const last = data[0].account_number // e.g. IO-0001
        const num = parseInt(last.replace('IO-', ''), 10)
        setForm(f => ({ ...f, account_number: `IO-${String(num + 1).padStart(4, '0')}` }))
      } else {
        setForm(f => ({ ...f, account_number: 'IO-0001' }))
      }
    }
    suggestAccountNumber()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('customers').insert([form])
    if (error) {
      setError(error.message)
      setSaving(false)
    } else {
      navigate('/admin')
    }
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-brand">Integration One <span>Admin</span></div>
        <button className="btn-signout" onClick={() => navigate('/admin')}>← Customers</button>
      </header>

      <main className="dashboard-main" style={{ maxWidth: 560 }}>
        <h1 style={{ margin: '0 0 32px', fontSize: '1.5rem' }}>Add Customer</h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={labelStyle}>Account Number</label>
            <input style={inputStyle} value={form.account_number}
              onChange={e => setForm({ ...form, account_number: e.target.value })} required />
          </div>
          <div>
            <label style={labelStyle}>Business Name</label>
            <input style={inputStyle} value={form.business_name}
              onChange={e => setForm({ ...form, business_name: e.target.value })} required />
          </div>
          <div>
            <label style={labelStyle}>Contact Name</label>
            <input style={inputStyle} value={form.contact_name}
              onChange={e => setForm({ ...form, contact_name: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} type="tel" value={form.phone}
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                let formatted = digits
                if (digits.length > 6) formatted = digits.slice(0,3) + '-' + digits.slice(3,6) + '-' + digits.slice(6)
                else if (digits.length > 3) formatted = digits.slice(0,3) + '-' + digits.slice(3)
                setForm({ ...form, phone: formatted })
              }} />
          </div>

          {error && <p style={{ color: '#EF4444', margin: 0, fontSize: '0.88rem' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button type="submit" className="btn-view" style={{ padding: '10px 24px' }} disabled={saving}>
              {saving ? 'Saving…' : 'Create Customer'}
            </button>
            <button type="button" className="btn-signout" style={{ padding: '10px 18px' }} onClick={() => navigate('/admin')}>
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: '0.85rem',
  color: '#94A3B8',
  marginBottom: 6
}

const inputStyle = {
  width: '100%',
  background: '#0B1120',
  border: '1px solid #1E3A5F',
  borderRadius: 8,
  padding: '10px 14px',
  color: '#E2E8F0',
  fontSize: '0.95rem',
  outline: 'none',
  boxSizing: 'border-box'
}
