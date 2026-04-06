import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import CountdownTimer from '../components/CountdownTimer';

export default function AuctionDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [bidMsg, setBidMsg] = useState('');
  const [bidErr, setBidErr] = useState('');
  const [bidding, setBidding] = useState(false);

  const fetchAuction = async () => {
    try {
      const res = await api.get(`/api/auctions/${id}`);
      setAuction(res.data);
    } catch {
      setError('Auction not found.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuction();
    // eslint-disable-next-line
  }, [id]);

  const handleBid = async (e) => {
    e.preventDefault();
    setBidErr('');
    setBidMsg('');
    if (!bidAmount || parseFloat(bidAmount) <= 0) {
      setBidErr('Please enter a valid bid amount.');
      return;
    }
    setBidding(true);
    try {
      await api.post(`/api/auctions/${id}/bids`, { amount: parseFloat(bidAmount) });
      setBidMsg('✅ Bid placed successfully!');
      setBidAmount('');
      await fetchAuction();
    } catch (err) {
      setBidErr(err.response?.data?.error || 'Failed to place bid.');
    } finally {
      setBidding(false);
    }
  };

  if (loading) return <div className="loading">⏳ Loading auction…</div>;
  if (error) return <div className="page"><div className="error-msg">{error}</div></div>;

  const currentBid = auction.current_bid || auction.starting_price;
  const minBid = currentBid + 500;
  const isActive = auction.status === 'active';

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/">Auctions</Link>
        <span>›</span>
        {auction.title}
      </div>

      <div className="detail-layout">
        {/* Left column */}
        <div>
          <img
            className="detail-img"
            src={auction.image_url || 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800'}
            alt={auction.title}
            onError={(e) => {
              e.target.src = 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800';
            }}
          />

          <div style={{ marginTop: 24 }}>
            <h1 style={{ fontSize: '1.6rem', color: '#002855', marginBottom: 16 }}>{auction.title}</h1>

            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <h2 style={{ fontSize: '1rem', color: '#666', marginBottom: 12 }}>Machine Details</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['Manufacturer', auction.manufacturer],
                    ['Model', auction.model_number],
                    ['Year', auction.year],
                    ['Condition', auction.condition],
                    ['Location', auction.location],
                    ['Category', auction.category?.name],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ padding: '6px 0', fontWeight: 600, width: '40%', color: '#555' }}>{k}</td>
                      <td style={{ padding: '6px 0' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <h2 style={{ fontSize: '1rem', color: '#666', marginBottom: 12 }}>Description</h2>
              <p style={{ lineHeight: 1.7, color: '#444' }}>{auction.description}</p>
            </div>

            {/* Bid history */}
            <div className="card" style={{ padding: 20 }}>
              <h2 style={{ fontSize: '1rem', color: '#666', marginBottom: 12 }}>
                Bid History ({auction.bid_count} bid{auction.bid_count !== 1 ? 's' : ''})
              </h2>
              {auction.bids && auction.bids.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Bidder</th>
                        <th>Amount</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auction.bids.map((bid) => (
                        <tr key={bid.id}>
                          <td>{bid.user_name || 'Anonymous'}</td>
                          <td><strong>€{bid.amount.toLocaleString('nl-BE')}</strong></td>
                          <td>{new Date(bid.timestamp).toLocaleString('nl-BE')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-msg">No bids yet. Be the first to bid!</p>
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="detail-sidebar">
          {/* Price box */}
          <div className="sidebar-box">
            <h3>{auction.bid_count > 0 ? 'Current Bid' : 'Starting Price'}</h3>
            <div className="big">€{currentBid.toLocaleString('nl-BE')}</div>
            {auction.bid_count > 0 && (
              <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 4 }}>
                Starting price: €{auction.starting_price.toLocaleString('nl-BE')}
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <span className={`badge badge-${auction.status}`}>{auction.status}</span>
            </div>
          </div>

          {/* Timer */}
          {isActive && (
            <div className="sidebar-box">
              <h3>Time Remaining</h3>
              <div className="big timer">
                <CountdownTimer endTime={auction.end_time} />
              </div>
              <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 6 }}>
                Ends: {new Date(auction.end_time).toLocaleString('nl-BE')}
              </div>
            </div>
          )}

          {/* Winner */}
          {auction.status === 'ended' && auction.winner_id && (
            <div className="sidebar-box" style={{ background: '#d4f7e0' }}>
              <h3>🏆 Auction Won</h3>
              <p style={{ marginTop: 8 }}>This auction has ended.</p>
            </div>
          )}

          {/* Bid form */}
          {isActive && user ? (
            <div className="sidebar-box">
              <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>Place Your Bid</h3>
              {bidMsg && <div className="success-msg">{bidMsg}</div>}
              {bidErr && <div className="error-msg">{bidErr}</div>}
              <form onSubmit={handleBid}>
                <div className="form-group">
                  <label className="form-label">Bid Amount (€)</label>
                  <input
                    className="form-control"
                    type="number"
                    step="1"
                    placeholder={`Min: €${minBid.toLocaleString('nl-BE')}`}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    required
                  />
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 4 }}>
                    Must be at least €500 above current price (min. €{minBid.toLocaleString('nl-BE')})
                  </div>
                </div>
                <button className="btn btn-accent btn-full" type="submit" disabled={bidding}>
                  {bidding ? 'Placing bid…' : '🔨 Place Bid'}
                </button>
              </form>
            </div>
          ) : isActive && !user ? (
            <div className="sidebar-box">
              <p style={{ marginBottom: 12, color: '#555' }}>You must be logged in to place a bid.</p>
              <Link to="/login" className="btn btn-primary btn-full">Login to Bid</Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

