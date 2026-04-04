import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('bids');
  const [bids, setBids] = useState([]);
  const [won, setWon] = useState([]);
  const [profile, setProfile] = useState({ name: '', email: '', company: '', phone: '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const [bidsRes, wonRes] = await Promise.all([
          api.get(`/api/users/${user.id}/bids`),
          api.get(`/api/users/${user.id}/won`),
        ]);
        setBids(bidsRes.data);
        setWon(wonRes.data);
        setProfile({ name: user.name, email: user.email, company: user.company || '', phone: user.phone || '' });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleProfileChange = (e) => setProfile((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    try {
      await api.put('/api/users/profile', profile);
      setProfileMsg('Profile updated successfully!');
    } catch (err) {
      setProfileErr(err.response?.data?.error || 'Failed to update profile.');
    }
  };

  if (!user) {
    return <div className="page"><div className="error-msg">Please log in to view your dashboard.</div></div>;
  }

  return (
    <div className="page">
      <h1 className="section-title">My Dashboard</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>Welcome back, {user.name}!</p>

      <div className="tabs">
        {[['bids', '🔨 My Bids'], ['won', '🏆 Won Auctions'], ['profile', '👤 Profile']].map(([key, label]) => (
          <div key={key} className={`tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="loading">⏳ Loading…</div>
      ) : (
        <>
          {tab === 'bids' && (
            <>
              <h2 className="section-title" style={{ fontSize: '1.1rem' }}>My Bids ({bids.length})</h2>
              {bids.length === 0 ? (
                <div className="empty-msg">You haven't placed any bids yet. <Link to="/">Browse auctions →</Link></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Auction ID</th><th>Amount</th><th>Time</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {bids.map((bid) => (
                        <tr key={bid.id}>
                          <td>#{bid.auction_id}</td>
                          <td><strong>€{bid.amount.toLocaleString('nl-BE')}</strong></td>
                          <td>{new Date(bid.timestamp).toLocaleString('nl-BE')}</td>
                          <td>
                            <Link to={`/auctions/${bid.auction_id}`} className="btn btn-ghost btn-sm">View</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === 'won' && (
            <>
              <h2 className="section-title" style={{ fontSize: '1.1rem' }}>Won Auctions ({won.length})</h2>
              {won.length === 0 ? (
                <div className="empty-msg">You haven't won any auctions yet. Keep bidding!</div>
              ) : (
                <div className="grid grid-2">
                  {won.map((auction) => (
                    <div key={auction.id} className="card">
                      <img
                        className="card-img"
                        src={auction.image_url || 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800'}
                        alt={auction.title}
                        onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800'; }}
                      />
                      <div className="card-body">
                        <div className="card-title">🏆 {auction.title}</div>
                        <div className="card-price">€{(auction.current_bid || auction.starting_price).toLocaleString('nl-BE')}</div>
                      </div>
                      <div className="card-footer">
                        <span className="badge badge-ended">Ended</span>
                        <Link to={`/auctions/${auction.id}`} className="btn btn-ghost btn-sm">Details</Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'profile' && (
            <>
              <h2 className="section-title" style={{ fontSize: '1.1rem' }}>My Profile</h2>
              <div className="card" style={{ maxWidth: 500, padding: 24 }}>
                {profileMsg && <div className="success-msg">{profileMsg}</div>}
                {profileErr && <div className="error-msg">{profileErr}</div>}
                <form onSubmit={handleProfileSave}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input className="form-control" name="name" value={profile.name} onChange={handleProfileChange} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-control" type="email" value={profile.email} disabled style={{ background: '#f5f5f5' }} />
                    <small style={{ color: '#888' }}>Email cannot be changed</small>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company</label>
                    <input className="form-control" name="company" value={profile.company} onChange={handleProfileChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-control" name="phone" value={profile.phone} onChange={handleProfileChange} />
                  </div>
                  <button className="btn btn-primary" type="submit">Save Changes</button>
                </form>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
