import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CountdownTimer from './CountdownTimer';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function AuctionCard({ auction }) {
  const currentBid = auction.current_bid || auction.starting_price;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [watching, setWatching] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get(`/api/watchlist/${auction.id}/check`)
      .then((res) => setWatching(res.data.watching))
      .catch(() => {});
  }, [auction.id, user]);

  const handleWatchlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { navigate('/login'); return; }
    setWatchLoading(true);
    try {
      if (watching) {
        await api.delete(`/api/watchlist/${auction.id}`);
        setWatching(false);
      } else {
        await api.post(`/api/watchlist/${auction.id}`);
        setWatching(true);
      }
    } catch {
      // ignore
    } finally {
      setWatchLoading(false);
    }
  };

  return (
    <div className="card">
      <div style={{ position: 'relative' }}>
        <img
          className="card-img"
          src={auction.image_url || 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800'}
          alt={auction.title}
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800';
          }}
        />
        <button
          className={`watchlist-btn watchlist-btn-card${watching ? ' watching' : ''}`}
          onClick={handleWatchlist}
          disabled={watchLoading}
          title={watching ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          {watching ? '❤️' : '🤍'}
        </button>
      </div>
      <div className="card-body">
        <div className="card-meta">
          {auction.category && <span>📦 {auction.category.name}</span>}
          {auction.manufacturer && <span> · {auction.manufacturer}</span>}
          {auction.year && <span> · {auction.year}</span>}
          {auction.location && <span> · 📍{auction.location}</span>}
        </div>
        <div className="card-title">{auction.title}</div>
        <div className="card-price">€{currentBid.toLocaleString('nl-BE')}</div>
        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>
          {auction.bid_count > 0
            ? `${auction.bid_count} bid${auction.bid_count > 1 ? 's' : ''}`
            : 'No bids yet — Starting price'}
        </div>
      </div>
      <div className="card-footer">
        <div>
          <span className={`badge badge-${auction.status}`}>{auction.status}</span>
          &nbsp;
          <span style={{ fontSize: '0.8rem', color: '#666' }}>
            ⏱ <CountdownTimer endTime={auction.end_time} />
          </span>
        </div>
        <Link to={`/auctions/${auction.id}`} className="btn btn-primary btn-sm">
          View →
        </Link>
      </div>
    </div>
  );
}
