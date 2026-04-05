import React from 'react';
import { Link } from 'react-router-dom';
import CountdownTimer from './CountdownTimer';
import { getImageUrl } from '../api';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800';

export default function AuctionCard({ auction }) {
  const currentBid = auction.current_bid || auction.starting_price;

  return (
    <div className="card">
      <img
        className="card-img"
        src={getImageUrl(auction.image_url) || FALLBACK_IMG}
        alt={auction.title}
        onError={(e) => {
          e.target.src = FALLBACK_IMG;
        }}
      />
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
