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
        }
      : {
          title: '', description: '', manufacturer: '', model_number: '', year: '',
          condition: '', location: '', image_url: '', starting_price: '', reserve_price: '',
          end_time: '', category_id: '', status: 'active',
        }
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState(auction?.image_url || '');
  const objectUrlRef = React.useRef(null);

  React.useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const previewUrl = URL.createObjectURL(file);
    objectUrlRef.current = previewUrl;
    setUploadFile(file);
    setUploadPreview(previewUrl);
  };

  const handleUpload = async () => {
    if (!uploadFile) return null;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const res = await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.url;
    } catch (err) {
      setError(err.response?.data?.error || 'Image upload failed.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      let imageUrl = form.image_url;
      if (uploadFile) {
        const uploaded = await handleUpload();
        if (!uploaded) { setSaving(false); return; }
        imageUrl = uploaded;
      }
      const payload = { ...form, image_url: imageUrl, end_time: new Date(form.end_time).toISOString() };
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
            <input
              className="form-control"
              name="image_url"
              value={form.image_url}
              onChange={(e) => { handleChange(e); setUploadPreview(e.target.value); setUploadFile(null); }}
              placeholder="https://… or upload a file below"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Upload Image from Computer</label>
            <input
              className="form-control"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileChange}
            />
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 4 }}>
              Accepted: JPG, PNG, GIF, WEBP · Max 16 MB. Uploading a file overrides the Image URL field.
            </div>
          </div>
          {uploadPreview && (
            <div className="form-group">
              <label className="form-label">Image Preview</label>
              <img
                src={uploadPreview}
                alt="Preview"
                style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'contain', border: '1px solid #ddd' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          )}
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
            <button className="btn btn-primary" type="submit" disabled={saving || uploading}>
              {uploading ? 'Uploading image…' : saving ? 'Saving…' : isNew ? 'Create' : 'Save Changes'}
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
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'new' | auction object
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
      const [statsRes, auctionsRes, usersRes, catsRes] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/auctions/all'),
        api.get('/api/admin/users'),
        api.get('/api/categories'),
      ]);
      setStats(statsRes.data);
      setAuctions(auctionsRes.data);
      setUsers(usersRes.data);
      setCategories(catsRes.data);
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

  const toggleAdmin = async (userId, isAdmin) => {
    try {
      await api.put(`/api/admin/users/${userId}`, { is_admin: !isAdmin });
      fetchData();
    } catch (err) {
      setError('Failed to update user.');
    }
  };

  if (!user || !user.is_admin) return null;

  return (
    <div className="page">
      <h1 className="section-title">Admin Dashboard</h1>

      {error && <div className="error-msg">{error}</div>}

      <StatsGrid stats={stats} />

      <div className="tabs">
        {[['auctions', '📋 Auctions'], ['users', '👥 Users']].map(([key, label]) => (
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
                          <button className="btn btn-ghost btn-sm" style={{ marginRight: 6 }} onClick={() => setModal(a)}>Edit</button>
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
