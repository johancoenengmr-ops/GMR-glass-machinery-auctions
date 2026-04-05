import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

function StatsGrid({ stats }) {
  const items = [
    { label: 'Total Auctions', value: stats.total_auctions },
    { label: 'Active Auctions', value: stats.active_auctions },
    { label: 'Ended Auctions', value: stats.ended_auctions },
    { label: 'Total Bids', value: stats.total_bids },
    { label: 'Registered Users', value: stats.total_users },
    { label: 'Payments Received', value: stats.paid_payments },
    { label: 'Payments Pending', value: stats.pending_payments },
    { label: 'Total Revenue', value: stats.total_revenue != null ? `€${Number(stats.total_revenue).toLocaleString('nl-BE')}` : '–' },
  ];
  return (
    <div className="stats-grid">
      {items.map(({ label, value }) => (
        <div key={label} className="stat-box">
          <div className="stat-value">{value ?? '–'}</div>
          <div className="stat-label">{label}</div>
        </div>
      ))}
    </div>
  );
}

function AuctionModal({ auction, categories, onClose, onSaved }) {
  const isNew = !auction;
  const [form, setForm] = useState(
    auction
      ? {
          ...auction,
          end_time: auction.end_time ? auction.end_time.slice(0, 16) : '',
          category_id: auction.category_id || '',
          reserve_price: auction.reserve_price || '',
          buyer_premium_rate: auction.buyer_premium_rate ?? 12,
          vat_rate: auction.vat_rate ?? 21,
        }
      : {
          title: '', description: '', manufacturer: '', model_number: '', year: '',
          condition: '', location: '', image_url: '', starting_price: '', reserve_price: '',
          end_time: '', category_id: '', status: 'active',
          buyer_premium_rate: 12, vat_rate: 21,
        }
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { ...form, end_time: new Date(form.end_time).toISOString() };
      if (isNew) {
        await api.post('/api/auctions', payload);
      } else {
        await api.put(`/api/auctions/${auction.id}`, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save auction.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16,
    }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 32, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: 20, color: '#002855' }}>{isNew ? 'Create Auction' : 'Edit Auction'}</h2>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-control" name="title" value={form.title} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" name="description" value={form.description} onChange={handleChange} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Manufacturer</label>
              <input className="form-control" name="manufacturer" value={form.manufacturer} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Model</label>
              <input className="form-control" name="model_number" value={form.model_number} onChange={handleChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Year</label>
              <input className="form-control" type="number" name="year" value={form.year} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Condition</label>
              <select className="form-control" name="condition" value={form.condition} onChange={handleChange}>
                <option value="">Select…</option>
                <option>Excellent</option>
                <option>Good</option>
                <option>Fair</option>
                <option>Poor</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Location</label>
            <input className="form-control" name="location" value={form.location} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Image URL</label>
            <input className="form-control" name="image_url" value={form.image_url} onChange={handleChange} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Starting Price (€) *</label>
              <input className="form-control" type="number" name="starting_price" value={form.starting_price} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Reserve Price (€)</label>
              <input className="form-control" type="number" name="reserve_price" value={form.reserve_price} onChange={handleChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Buyer's Premium (%)</label>
              <input className="form-control" type="number" step="0.5" name="buyer_premium_rate" value={form.buyer_premium_rate} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">VAT Rate (%)</label>
              <input className="form-control" type="number" step="0.5" name="vat_rate" value={form.vat_rate} onChange={handleChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-control" name="category_id" value={form.category_id} onChange={handleChange}>
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-control" name="status" value={form.status} onChange={handleChange}>
                <option value="active">Active</option>
                <option value="ended">Ended</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">End Time *</label>
            <input className="form-control" type="datetime-local" name="end_time" value={form.end_time} onChange={handleChange} required />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : isNew ? 'Create' : 'Save Changes'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('auctions');
  const [stats, setStats] = useState({});
  const [auctions, setAuctions] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [payments, setPayments] = useState([]);
  const [settings, setSettings] = useState({ buyer_premium_rate: 12, vat_rate: 21, anti_snipe_minutes: 2 });
  const [settingsMsg, setSettingsMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !user.is_admin) {
      navigate('/');
    }
  }, [user, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, auctionsRes, usersRes, catsRes, paymentsRes, settingsRes] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/auctions/all'),
        api.get('/api/admin/users'),
        api.get('/api/categories'),
        api.get('/api/admin/payments'),
        api.get('/api/admin/settings'),
      ]);
      setStats(statsRes.data);
      setAuctions(auctionsRes.data);
      setUsers(usersRes.data);
      setCategories(catsRes.data);
      setPayments(paymentsRes.data);
      setSettings(settingsRes.data);
    } catch (err) {
      setError('Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line
  }, []);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/auctions/${id}`);
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed.');
    }
  };

  const handleCloseAuction = async (id) => {
    try {
      await api.post(`/api/admin/auctions/${id}/close`);
      fetchData();
    } catch (err) {
      setError('Failed to close auction.');
    }
  };

  const toggleAdmin = async (userId, isAdmin) => {
    try {
      await api.put(`/api/admin/users/${userId}`, { is_admin: !isAdmin });
      fetchData();
    } catch (err) {
      setError('Failed to update user.');
    }
  };

  const updatePaymentStatus = async (paymentId, status) => {
    try {
      await api.put(`/api/admin/payments/${paymentId}`, { status });
      fetchData();
    } catch (err) {
      setError('Failed to update payment.');
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSettingsMsg('');
    try {
      await api.put('/api/admin/settings', settings);
      setSettingsMsg('✅ Settings saved successfully.');
    } catch (err) {
      setError('Failed to save settings.');
    }
  };

  if (!user || !user.is_admin) return null;

  return (
    <div className="page">
      <h1 className="section-title">Admin Dashboard</h1>

      {error && <div className="error-msg">{error}</div>}

      <StatsGrid stats={stats} />

      <div className="tabs">
        {[
          ['auctions', '📋 Auctions'],
          ['users', '👥 Users'],
          ['payments', '💳 Payments'],
          ['settings', '⚙️ Settings'],
        ].map(([key, label]) => (
          <div key={key} className={`tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="loading">⏳ Loading…</div>
      ) : (
        <>
          {tab === 'auctions' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.1rem' }}>All Auctions ({auctions.length})</h2>
                <button className="btn btn-accent" onClick={() => setModal('new')}>+ Create Auction</button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>ID</th><th>Title</th><th>Starting</th><th>Current Bid</th><th>Bids</th><th>Status</th><th>Ends</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {auctions.map((a) => (
                      <tr key={a.id}>
                        <td>#{a.id}</td>
                        <td><Link to={`/auctions/${a.id}`} style={{ color: '#002855' }}>{a.title.slice(0, 40)}{a.title.length > 40 ? '…' : ''}</Link></td>
                        <td>€{a.starting_price?.toLocaleString('nl-BE')}</td>
                        <td>{a.current_bid ? `€${a.current_bid.toLocaleString('nl-BE')}` : '–'}</td>
                        <td>{a.bid_count}</td>
                        <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                        <td>{new Date(a.end_time).toLocaleDateString('nl-BE')}</td>
                        <td>
                          <button className="btn btn-ghost btn-sm" style={{ marginRight: 4 }} onClick={() => setModal(a)}>Edit</button>
                          {a.status === 'active' && (
                            <button className="btn btn-ghost btn-sm" style={{ marginRight: 4 }} onClick={() => handleCloseAuction(a.id)}>Close</button>
                          )}
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(a.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'users' && (
            <>
              <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>All Users ({users.length})</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>ID</th><th>Name</th><th>Email</th><th>Company</th><th>Admin</th><th>Joined</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>#{u.id}</td>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td>{u.company || '–'}</td>
                        <td>{u.is_admin ? '✅' : '—'}</td>
                        <td>{new Date(u.created_at).toLocaleDateString('nl-BE')}</td>
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={() => toggleAdmin(u.id, u.is_admin)}>
                            {u.is_admin ? 'Remove Admin' : 'Make Admin'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'payments' && (
            <>
              <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>Payment Reconciliation ({payments.length})</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>User</th>
                      <th>Auction</th>
                      <th>Winning Bid</th>
                      <th>Total</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td><strong>{p.invoice_number}</strong></td>
                        <td>
                          <div>{p.user_name || '—'}</div>
                          <div style={{ fontSize: '0.8rem', color: '#888' }}>{p.user_email}</div>
                        </td>
                        <td>{p.auction_title || `#${p.auction_id}`}</td>
                        <td>€{p.winning_bid.toLocaleString('nl-BE')}</td>
                        <td><strong>€{p.total.toLocaleString('nl-BE')}</strong></td>
                        <td>{p.payment_method || '—'}</td>
                        <td><PaymentStatusBadge status={p.status} /></td>
                        <td>{new Date(p.created_at).toLocaleDateString('nl-BE')}</td>
                        <td>
                          {p.status === 'pending' && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => updatePaymentStatus(p.id, 'paid')}
                            >
                              ✅ Mark Paid
                            </button>
                          )}
                          {p.status === 'paid' && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => updatePaymentStatus(p.id, 'refunded')}
                            >
                              ↩ Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'settings' && (
            <>
              <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>Platform Settings</h2>
              <div className="card" style={{ maxWidth: 500, padding: 28 }}>
                {settingsMsg && <div className="success-msg">{settingsMsg}</div>}
                <form onSubmit={saveSettings}>
                  <div className="form-group">
                    <label className="form-label">Buyer's Premium Rate (%)</label>
                    <input
                      className="form-control"
                      type="number"
                      step="0.5"
                      min="0"
                      max="50"
                      value={settings.buyer_premium_rate}
                      onChange={(e) => setSettings((s) => ({ ...s, buyer_premium_rate: parseFloat(e.target.value) }))}
                    />
                    <small style={{ color: '#888' }}>Applied to all new auctions as default (currently {settings.buyer_premium_rate}%)</small>
                  </div>
                  <div className="form-group">
                    <label className="form-label">VAT Rate (%)</label>
                    <input
                      className="form-control"
                      type="number"
                      step="0.5"
                      min="0"
                      max="50"
                      value={settings.vat_rate}
                      onChange={(e) => setSettings((s) => ({ ...s, vat_rate: parseFloat(e.target.value) }))}
                    />
                    <small style={{ color: '#888' }}>Belgian standard VAT rate (currently {settings.vat_rate}%)</small>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Anti-sniping Extension (minutes)</label>
                    <input
                      className="form-control"
                      type="number"
                      min="1"
                      max="30"
                      value={settings.anti_snipe_minutes}
                      onChange={(e) => setSettings((s) => ({ ...s, anti_snipe_minutes: parseInt(e.target.value, 10) }))}
                    />
                    <small style={{ color: '#888' }}>Extend auction by this many minutes when a bid is placed in final minutes</small>
                  </div>
                  <button className="btn btn-primary" type="submit">Save Settings</button>
                </form>

                <div style={{ marginTop: 24, padding: 16, background: '#f7f9fc', borderRadius: 8, fontSize: '0.85rem', color: '#666' }}>
                  <strong>Bid Increment Schedule</strong>
                  <table style={{ marginTop: 8, width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={{ textAlign: 'left', fontWeight: 600 }}>Current Price</th><th style={{ textAlign: 'left', fontWeight: 600 }}>Min. Increment</th></tr></thead>
                    <tbody>
                      {[
                        ['< €1,000', '€50'],
                        ['€1,000 – €4,999', '€100'],
                        ['€5,000 – €9,999', '€250'],
                        ['€10,000 – €49,999', '€500'],
                        ['€50,000 – €99,999', '€1,000'],
                        ['€100,000 – €499,999', '€2,500'],
                        ['€500,000+', '€5,000'],
                      ].map(([price, incr]) => (
                        <tr key={price}>
                          <td style={{ padding: '3px 0' }}>{price}</td>
                          <td style={{ padding: '3px 0' }}>{incr}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Delete confirm dialog */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, maxWidth: 400 }}>
            <h3 style={{ marginBottom: 12 }}>Delete Auction</h3>
            <p>Are you sure you want to delete auction #{deleteConfirm}? This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {modal && (
        <AuctionModal
          auction={modal === 'new' ? null : modal}
          categories={categories}
          onClose={() => setModal(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}

function PaymentStatusBadge({ status }) {
  const map = {
    pending: { bg: '#fff3cd', color: '#856404', label: '⏳ Pending' },
    paid: { bg: '#d4f7e0', color: '#1a7a46', label: '✅ Paid' },
    failed: { bg: '#ffe0e0', color: '#c1121f', label: '❌ Failed' },
    refunded: { bg: '#e8e8f0', color: '#5a5a8a', label: '↩ Refunded' },
  };
  const s = map[status] || { bg: '#eee', color: '#666', label: status };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: '0.75rem', fontWeight: 600, background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}
