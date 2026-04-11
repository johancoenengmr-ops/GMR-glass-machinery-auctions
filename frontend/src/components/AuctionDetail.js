import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import CountdownTimer from './CountdownTimer';

const MIN_BID_INCREMENT = 500;

export default function AuctionDetail({ auctionId }) {
  const { user } = useAuth();
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(false);
  const [error, setError] = useState(null);
  const [bidError, setBidError] = useState(null);
  const [bidSuccess, setBidSuccess] = useState(null);

  const fetchAuction = useCallback(async () => {
    try {
      const res = await api.get(`/api/auctions/${auctionId}`);
      setAuction(res.data);
      setBids(res.data.bids || []);
    } catch (err) {
      setError('Failed to load auction details.');
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => {
    fetchAuction();
  }, [fetchAuction]);

  const handleBid = async (e) => {
    e.preventDefault();
    setBidError(null);
    setBidSuccess(null);

    const amount = parseFloat(bidAmount);
    if (!amount || amount <= 0) {
      setBidError('Please enter a valid bid amount.');
      return;
    }

    setBidding(true);
    try {
      await api.post(`/api/auctions/${auctionId}/bids`, { amount });
      setBidSuccess(`Bid of €${amount.toLocaleString('nl-BE')} placed successfully!`);
      setBidAmount('');
      fetchAuction();
    } catch (err) {
      setBidError(err.response?.data?.error || 'Failed to place bid.');
    } finally {
      setBidding(false);
    }
  };

  if (loading) return <div className="container">Loading auction details…</div>;
  if (error) return <div className="container" style={{ color: 'red' }}>{error}</div>;
  if (!auction) return null;

  const currentBid = auction.current_bid || auction.starting_price;
  const minNextBid = currentBid + 500;
  const isActive = auction.status === 'active';

  return (
    <div className="container">
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {/* Left column: image + details */}
        <div style={{ flex: '1 1 400px' }}>
          <img
            src={auction.image_url || 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800'}
            alt={auction.title}
            style={{ width: '100%', borderRadius: '8px', marginBottom: '1rem' }}
            onError={(e) => {
              e.target.src = 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800';
            }}
          />
          <h2>{auction.title}</h2>
          <p style={{ color: '#555' }}>{auction.description}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <tbody>
              {auction.manufacturer && (
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '4px 8px' }}>Manufacturer</td>
                  <td style={{ padding: '4px 8px' }}>{auction.manufacturer}</td>
                </tr>
              )}
              {auction.model_number && (
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '4px 8px' }}>Model</td>
                  <td style={{ padding: '4px 8px' }}>{auction.model_number}</td>
                </tr>
              )}
              {auction.year && (
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '4px 8px' }}>Year</td>
                  <td style={{ padding: '4px 8px' }}>{auction.year}</td>
                </tr>
              )}
              {auction.condition && (
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '4px 8px' }}>Condition</td>
                  <td style={{ padding: '4px 8px' }}>{auction.condition}</td>
                </tr>
              )}
              {auction.location && (
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '4px 8px' }}>Location</td>
                  <td style={{ padding: '4px 8px' }}>{auction.location}</td>
                </tr>
              )}
              <tr>
                <td style={{ fontWeight: 'bold', padding: '4px 8px' }}>Status</td>
                <td style={{ padding: '4px 8px' }}>
                  <span className={`badge badge-${auction.status}`}>{auction.status}</span>
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '4px 8px' }}>Time left</td>
                <td style={{ padding: '4px 8px' }}>
                  <CountdownTimer endTime={auction.end_time} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Right column: bid info */}
        <div style={{ flex: '0 0 300px' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                {auction.bid_count > 0 ? `${auction.bid_count} bid${auction.bid_count > 1 ? 's' : ''}` : 'No bids yet'}
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#1a1a2e' }}>
                €{currentBid.toLocaleString('nl-BE')}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#888' }}>
                Starting price: €{auction.starting_price?.toLocaleString('nl-BE')}
              </div>
            </div>

            {isActive && user ? (
              <form onSubmit={handleBid}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>
                    Your bid (min. €{minNextBid.toLocaleString('nl-BE')})
                  </label>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    min={minNextBid}
                    step={MIN_BID_INCREMENT}
                    placeholder={`€${minNextBid.toLocaleString('nl-BE')}`}
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
                    required
                  />
                </div>
                {bidError && <div style={{ color: 'red', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{bidError}</div>}
                {bidSuccess && <div style={{ color: 'green', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{bidSuccess}</div>}
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={bidding}
                >
                  {bidding ? 'Placing bid…' : 'Place Bid'}
                </button>
              </form>
            ) : !user ? (
              <p style={{ fontSize: '0.9rem', color: '#666' }}>
                <a href="/login">Log in</a> to place a bid.
              </p>
            ) : (
              <p style={{ fontSize: '0.9rem', color: '#888' }}>This auction is no longer accepting bids.</p>
            )}
          </div>

          {/* Bid history */}
          {bids.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ marginBottom: '0.75rem' }}>Bid History</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {[...bids].reverse().map((bid) => (
                  <li
                    key={bid.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      borderBottom: '1px solid #eee',
                      fontSize: '0.9rem',
                    }}
                  >
                    <span style={{ fontWeight: 'bold' }}>€{bid.amount?.toLocaleString('nl-BE')}</span>
                    <span style={{ color: '#666' }}>
                      {bid.user_name || 'Bidder'} · {new Date(bid.timestamp).toLocaleString('nl-BE')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
