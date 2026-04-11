import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import CountdownTimer from './CountdownTimer';

export default function AuctionDetail({ auctionId }) {
  const { user } = useAuth();
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [bidError, setBidError] = useState('');
  const [bidSuccess, setBidSuccess] = useState('');
  const [bidding, setBidding] = useState(false);

  const fetchAuction = useCallback(async () => {
    try {
      const res = await api.get(`/api/auctions/${auctionId}`);
      setAuction(res.data);
    } catch {
      setError('Auction not found.');
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => {
    fetchAuction();
  }, [fetchAuction]);

  const handleBid = async (e) => {
    e.preventDefault();
    setBidError('');
    setBidSuccess('');
    setBidding(true);
    try {
      await api.post(`/api/auctions/${auctionId}/bids`, { amount: Number(bidAmount) });
      setBidSuccess('Your bid was placed successfully!');
      setBidAmount('');
      fetchAuction();
    } catch (err) {
      setBidError(err.response?.data?.error || 'Failed to place bid. Please try again.');
    } finally {
      setBidding(false);
    }
  };

  if (loading) return <div className="loading">⏳ Loading auction…</div>;
  if (error) return <div className="page"><div className="error-msg">{error}</div></div>;
  if (!auction) return null;

  const currentBid = auction.current_bid || auction.starting_price;
  const minBid = currentBid + 500;
  const isActive = auction.status === 'active' && new Date(auction.end_time) > new Date();

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <Link to="/" style={{ color: '#002855', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← Back to Auctions
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {/* Left: image + details */}
        <div>
          <img
            src={auction.image_url || 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800'}
            alt={auction.title}
            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800'; }}
            style={{ width: '100%', borderRadius: 12, marginBottom: 20, maxHeight: 380, objectFit: 'cover' }}
          />

          <h1 style={{ fontSize: '1.5rem', color: '#002855', marginBottom: 8 }}>{auction.title}</h1>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {auction.category && (
              <span className="badge badge-active">{auction.category.name}</span>
            )}
            <span className={`badge badge-${auction.status}`}>{auction.status}</span>
          </div>

          {auction.description && (
            <p style={{ color: '#444', lineHeight: 1.6, marginBottom: 20 }}>{auction.description}</p>
          )}

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ marginBottom: 12, fontSize: '1rem', color: '#002855' }}>Machine Details</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <tbody>
                {auction.manufacturer && (
                  <tr>
                    <td style={{ padding: '6px 0', color: '#666', width: '40%' }}>Manufacturer</td>
                    <td style={{ padding: '6px 0', fontWeight: 600 }}>{auction.manufacturer}</td>
                  </tr>
                )}
                {auction.model_number && (
                  <tr>
                    <td style={{ padding: '6px 0', color: '#666' }}>Model</td>
                    <td style={{ padding: '6px 0', fontWeight: 600 }}>{auction.model_number}</td>
                  </tr>
                )}
                {auction.year && (
                  <tr>
                    <td style={{ padding: '6px 0', color: '#666' }}>Year</td>
                    <td style={{ padding: '6px 0', fontWeight: 600 }}>{auction.year}</td>
                  </tr>
                )}
                {auction.condition && (
                  <tr>
                    <td style={{ padding: '6px 0', color: '#666' }}>Condition</td>
                    <td style={{ padding: '6px 0', fontWeight: 600 }}>{auction.condition}</td>
                  </tr>
                )}
                {auction.location && (
                  <tr>
                    <td style={{ padding: '6px 0', color: '#666' }}>Location</td>
                    <td style={{ padding: '6px 0', fontWeight: 600 }}>📍 {auction.location}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: bidding panel */}
        <div>
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 4 }}>
              {auction.bid_count > 0 ? `${auction.bid_count} bid${auction.bid_count !== 1 ? 's' : ''}` : 'No bids yet — starting price'}
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#002855', marginBottom: 4 }}>
              €{currentBid.toLocaleString('nl-BE')}
            </div>
            {auction.bid_count === 0 && (
              <div style={{ fontSize: '0.85rem', color: '#888' }}>Starting price</div>
            )}

            <div style={{ margin: '16px 0', padding: '12px 0', borderTop: '1px solid #eee' }}>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                {isActive ? (
                  <>⏱ Ends in: <strong><CountdownTimer endTime={auction.end_time} /></strong></>
                ) : (
                  <span style={{ color: '#999' }}>This auction has ended</span>
                )}
              </div>
            </div>

            {isActive && (
              <>
                {user ? (
                  <form onSubmit={handleBid}>
                    {bidSuccess && <div className="success-msg">{bidSuccess}</div>}
                    {bidError && <div className="error-msg">{bidError}</div>}
                    <div className="form-group">
                      <label className="form-label">Your Bid (€)</label>
                      <input
                        className="form-control"
                        type="number"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder={`Min. €${minBid.toLocaleString('nl-BE')}`}
                        min={minBid}
                        step="100"
                        required
                      />
                      <small style={{ color: '#888', display: 'block', marginTop: 4 }}>
                        Minimum bid: €{minBid.toLocaleString('nl-BE')}
                      </small>
                    </div>
                    <button
                      className="btn btn-accent btn-full"
                      type="submit"
                      disabled={bidding}
                      style={{ marginTop: 8 }}
                    >
                      {bidding ? 'Placing bid…' : '🔨 Place Bid'}
                    </button>
                  </form>
                ) : (
                  <div style={{ textAlign: 'center', padding: 16 }}>
                    <p style={{ color: '#666', marginBottom: 12 }}>Sign in to place a bid</p>
                    <Link to="/login" className="btn btn-primary btn-full">Sign In</Link>
                    <div style={{ marginTop: 8 }}>
                      <Link to="/register" style={{ color: '#002855', fontSize: '0.85rem' }}>
                        No account? Register here
                      </Link>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Bid history */}
          {auction.bids && auction.bids.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ marginBottom: 12, fontSize: '1rem', color: '#002855' }}>
                Bid History ({auction.bids.length})
              </h3>
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
                        <td style={{ fontSize: '0.85rem', color: '#666' }}>
                          {new Date(bid.timestamp).toLocaleString('nl-BE')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
