import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('bids');
  const [bids, setBids] = useState([]);
  const [won, setWon] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [payments, setPayments] = useState([]);
  const [profile, setProfile] = useState({ name: '', email: '', company: '', phone: '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const [bidsRes, wonRes, watchRes, payRes] = await Promise.all([
          api.get(`/api/users/${user.id}/bids`),
          api.get(`/api/users/${user.id}/won`),
          api.get('/api/watchlist'),
          api.get('/api/payments'),
        ]);
        setBids(bidsRes.data);
        setWon(wonRes.data);
        setWatchlist(watchRes.data);
        setPayments(payRes.data);
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

  const removeFromWatchlist = async (auctionId) => {
    try {
      await api.delete(`/api/watchlist/${auctionId}`);
      setWatchlist((prev) => prev.filter((w) => w.auction_id !== auctionId));
    } catch {
      // ignore
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
        {[
          ['bids', '🔨 My Bids'],
          ['won', '🏆 Won Auctions'],
          ['watchlist', '❤️ Watchlist'],
          ['payments', '💳 Payments'],
          ['profile', '👤 Profile'],
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
          {tab === 'bids' && (
            <>
              <h2 className="section-title" style={{ fontSize: '1.1rem' }}>My Bids ({bids.length})</h2>
              {bids.length === 0 ? (
                <div className="empty-msg">You haven't placed any bids yet. <Link to="/">Browse auctions →</Link></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Auction ID</th><th>Amount</th><th>Type</th><th>Time</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {bids.map((bid) => (
                        <tr key={bid.id}>
                          <td>#{bid.auction_id}</td>
                          <td><strong>€{bid.amount.toLocaleString('nl-BE')}</strong></td>
                          <td>
                            <span className={`badge ${bid.is_auto_bid ? 'badge-auto' : 'badge-manual'}`}>
                              {bid.is_auto_bid ? '🤖 Auto' : '✋ Manual'}
                            </span>
                          </td>
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
                        {auction.payment && (
                          <div style={{ marginTop: 6 }}>
                            <PaymentStatusBadge status={auction.payment.status} />
                            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 4 }}>
                              Total: €{auction.payment.total.toLocaleString('nl-BE')}
                              {' '}· Invoice #{auction.payment.invoice_number}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="card-footer">
                        <span className="badge badge-ended">Ended</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Link to={`/auctions/${auction.id}`} className="btn btn-ghost btn-sm">Details</Link>
                          {auction.payment && auction.payment.status !== 'paid' && (
                            <Link to={`/payment/${auction.id}`} className="btn btn-accent btn-sm">Pay Now</Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'watchlist' && (
            <>
              <h2 className="section-title" style={{ fontSize: '1.1rem' }}>My Watchlist ({watchlist.length})</h2>
              {watchlist.length === 0 ? (
                <div className="empty-msg">
                  Your watchlist is empty. Click ❤️ on any auction to add it. <Link to="/">Browse auctions →</Link>
                </div>
              ) : (
                <div className="grid grid-2">
                  {watchlist.map((entry) => {
                    const a = entry.auction;
                    if (!a) return null;
                    const currentBid = a.current_bid || a.starting_price;
                    return (
                      <div key={entry.id} className="card">
                        <img
                          className="card-img"
                          src={a.image_url || 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800'}
                          alt={a.title}
                          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800'; }}
                        />
                        <div className="card-body">
                          <div className="card-title">{a.title}</div>
                          <div className="card-price">€{currentBid.toLocaleString('nl-BE')}</div>
                          <div style={{ fontSize: '0.8rem', color: '#666' }}>
                            {a.bid_count} bid{a.bid_count !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="card-footer">
                          <span className={`badge badge-${a.status}`}>{a.status}</span>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => removeFromWatchlist(a.id)}
                            >
                              ❌ Remove
                            </button>
                            <Link to={`/auctions/${a.id}`} className="btn btn-primary btn-sm">Bid →</Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {tab === 'payments' && (
            <>
              <h2 className="section-title" style={{ fontSize: '1.1rem' }}>Payment History ({payments.length})</h2>
              {payments.length === 0 ? (
                <div className="empty-msg">No payment history yet.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Auction</th>
                        <th>Winning Bid</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td><strong>{p.invoice_number}</strong></td>
                          <td>{p.auction_title || `Auction #${p.auction_id}`}</td>
                          <td>€{p.winning_bid.toLocaleString('nl-BE')}</td>
                          <td><strong>€{p.total.toLocaleString('nl-BE')}</strong></td>
                          <td><PaymentStatusBadge status={p.status} /></td>
                          <td>{new Date(p.created_at).toLocaleDateString('nl-BE')}</td>
                          <td>
                            {p.status !== 'paid' && (
                              <Link to={`/payment/${p.auction_id}`} className="btn btn-accent btn-sm">Pay</Link>
                            )}
                            {p.status === 'paid' && (
                              <span style={{ color: '#1a7a46', fontSize: '0.85rem' }}>✅ Paid</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
      fontSize: '0.75rem', fontWeight: 600,
      background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}
