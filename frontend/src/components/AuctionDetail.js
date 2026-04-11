import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import CountdownTimer from './CountdownTimer';

export default function AuctionDetail({ auctionId }) {
  const { user } = useAuth();
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    const fetchAuction = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/auctions/${auctionId}`);
        setAuction(res.data);
        setBids(res.data.bids || []);
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load auction');
      } finally {
        setLoading(false);
      }
    };

    if (auctionId) {
      fetchAuction();
    }
  }, [auctionId]);

  const handlePlaceBid = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('Please log in to place a bid');
      return;
    }

    if (!bidAmount || isNaN(bidAmount) || parseFloat(bidAmount) <= 0) {
      setError('Please enter a valid bid amount');
      return;
    }

    try {
      setPlacing(true);
      setError('');
      const res = await api.post(`/api/auctions/${auctionId}/bids`, {
        amount: parseFloat(bidAmount),
      });
      
      setBids([res.data, ...bids]);
      const newBids = [res.data, ...bids];
      setAuction({ ...auction, current_bid: parseFloat(bidAmount), bids: newBids });
      setBidAmount('');
      setSuccess('Bid placed successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to place bid');
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading auction...</div>;
  }

  if (error && !auction) {
    return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;
  }

  if (!auction) {
    return <div style={{ padding: '20px' }}>Auction not found</div>;
  }

  const currentBid = auction.current_bid || auction.starting_price;
  const minNextBid = currentBid + 500;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        {/* Image */}
        <div>
          <img
            src={auction.image_url || 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800'}
            alt={auction.title}
            style={{ width: '100%', borderRadius: '8px', marginBottom: '10px' }}
            onError={(e) => {
              e.target.src = 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800';
            }}
          />
          <div style={{ padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <p style={{ margin: '5px 0', fontSize: '0.9rem' }}>
              <strong>Status:</strong> <span className={`badge badge-${auction.status}`}>{auction.status}</span>
            </p>
            <p style={{ margin: '5px 0', fontSize: '0.9rem' }}>
              <strong>Time Left:</strong> <CountdownTimer endTime={auction.end_time} />
            </p>
          </div>
        </div>

        {/* Details & Bid Form */}
        <div>
          <h1 style={{ marginTop: 0 }}>{auction.title}</h1>
          
          <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #ddd' }}>
            <p style={{ margin: '8px 0' }}>
              <strong>Manufacturer:</strong> {auction.manufacturer || 'N/A'}
            </p>
            <p style={{ margin: '8px 0' }}>
              <strong>Model:</strong> {auction.model_number || 'N/A'}
            </p>
            <p style={{ margin: '8px 0' }}>
              <strong>Year:</strong> {auction.year || 'N/A'}
            </p>
            <p style={{ margin: '8px 0' }}>
              <strong>Condition:</strong> {auction.condition || 'N/A'}
            </p>
            <p style={{ margin: '8px 0' }}>
              <strong>Location:</strong> {auction.location || 'N/A'}
            </p>
            {auction.category && (
              <p style={{ margin: '8px 0' }}>
                <strong>Category:</strong> {auction.category.name}
              </p>
            )}
          </div>

          {/* Description */}
          {auction.description && (
            <div style={{ marginBottom: '20px' }}>
              <h3>Description</h3>
              <p style={{ color: '#666', lineHeight: '1.6' }}>{auction.description}</p>
            </div>
          )}

          {/* Pricing */}
          <div style={{
            backgroundColor: '#f9f9f9',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '20px',
            borderLeft: '4px solid #007bff'
          }}>
            <p style={{ margin: '8px 0' }}>
              <strong>Starting Price:</strong> €{auction.starting_price.toLocaleString('nl-BE')}
            </p>
            <p style={{ margin: '8px 0', fontSize: '1.2em', color: '#007bff' }}>
              <strong>Current Bid:</strong> €{currentBid.toLocaleString('nl-BE')}
            </p>
            {auction.reserve_price && (
              <p style={{ margin: '8px 0', fontSize: '0.9rem', color: '#999' }}>
                Reserve Price: €{auction.reserve_price.toLocaleString('nl-BE')}
              </p>
            )}
            <p style={{ margin: '8px 0', fontSize: '0.9rem' }}>
              <strong>Bids:</strong> {bids.length}
            </p>
          </div>

          {/* Bid Form */}
          {user ? (
            <form onSubmit={handlePlaceBid} style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Your Bid (min €{minNextBid.toLocaleString('nl-BE')}):
                </label>
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder={`Minimum €${minNextBid.toLocaleString('nl-BE')}`}
                  min={minNextBid}
                  step="100"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1rem'
                  }}
                  disabled={placing || auction.status !== 'active'}
                />
              </div>
              {error && <div style={{ color: 'red', marginBottom: '10px', fontSize: '0.9rem' }}>{error}</div>}
              {success && <div style={{ color: 'green', marginBottom: '10px', fontSize: '0.9rem' }}>{success}</div>}
              <button
                type="submit"
                disabled={placing || auction.status !== 'active'}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: auction.status !== 'active' ? '#ccc' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: auction.status !== 'active' ? 'default' : 'pointer'
                }}
              >
                {placing ? 'Placing Bid...' : 'Place Bid'}
              </button>
            </form>
          ) : (
            <div style={{
              backgroundColor: '#fff3cd',
              padding: '12px',
              borderRadius: '4px',
              marginBottom: '20px',
              color: '#856404'
            }}>
              <strong>Please <a href="/login" style={{ color: '#004085' }}>log in</a> to place a bid</strong>
            </div>
          )}
        </div>
      </div>

      {/* Bid History */}
      <div style={{ marginTop: '40px' }}>
        <h2>Bid History ({bids.length} bids)</h2>
        {bids.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.95rem'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Bidder</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {bids.map((bid, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>
                      {bid.user_name || 'Anonymous'} {bid.user_id === user?.id && <span style={{ color: '#007bff' }}>(You)</span>}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>
                      €{bid.amount.toLocaleString('nl-BE')}
                    </td>
                    <td style={{ padding: '10px', fontSize: '0.85rem', color: '#666' }}>
                      {new Date(bid.timestamp).toLocaleString('en-US')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#666' }}>No bids yet. Be the first to bid!</p>
        )}
      </div>
    </div>
  );
}