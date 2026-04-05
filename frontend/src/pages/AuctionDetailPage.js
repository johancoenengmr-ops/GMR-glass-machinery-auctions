import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import CountdownTimer from '../components/CountdownTimer';

export default function AuctionDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Manual bid
  const [bidAmount, setBidAmount] = useState('');
  const [bidMsg, setBidMsg] = useState('');
  const [bidErr, setBidErr] = useState('');
  const [bidding, setBidding] = useState(false);

  // Auto-bid
  const [autoBid, setAutoBid] = useState(null);
  const [showAutoBid, setShowAutoBid] = useState(false);
  const [maxAmount, setMaxAmount] = useState('');
  const [autoBidMsg, setAutoBidMsg] = useState('');
  const [autoBidErr, setAutoBidErr] = useState('');
  const [settingAutoBid, setSettingAutoBid] = useState(false);

  // Watchlist
  const [watching, setWatching] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);

  const fetchAuction = useCallback(async () => {
    try {
      const res = await api.get(`/api/auctions/${id}`);
      setAuction(res.data);
    } catch {
      setError('Auction not found.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchAutoBid = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get(`/api/auctions/${id}/autobid`);
      setAutoBid(res.data);
    } catch {
      setAutoBid(null);
    }
  }, [id, user]);

  const fetchWatchlistStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get(`/api/watchlist/${id}/check`);
      setWatching(res.data.watching);
    } catch {
      setWatching(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchAuction();
    fetchAutoBid();
    fetchWatchlistStatus();
  }, [fetchAuction, fetchAutoBid, fetchWatchlistStatus]);

  // Poll for live bid updates every 15 seconds
  useEffect(() => {
    const interval = setInterval(fetchAuction, 15000);
    return () => clearInterval(interval);
  }, [fetchAuction]);

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
      const res = await api.post(`/api/auctions/${id}/bids`, { amount: parseFloat(bidAmount) });
      setBidMsg('✅ Bid placed successfully!');
      setBidAmount('');
      if (res.data.auction) {
        setAuction(res.data.auction);
      } else {
        await fetchAuction();
      }
    } catch (err) {
      setBidErr(err.response?.data?.error || 'Failed to place bid.');
    } finally {
      setBidding(false);
    }
  };

  const handleSetAutoBid = async (e) => {
    e.preventDefault();
    setAutoBidErr('');
    setAutoBidMsg('');
    if (!maxAmount || parseFloat(maxAmount) <= 0) {
      setAutoBidErr('Please enter a valid maximum amount.');
      return;
    }
    setSettingAutoBid(true);
    try {
      const res = await api.post(`/api/auctions/${id}/autobid`, { max_amount: parseFloat(maxAmount) });
      setAutoBid(res.data);
      setAutoBidMsg('✅ Auto-bid set! The system will bid for you up to your maximum.');
      setMaxAmount('');
      await fetchAuction();
    } catch (err) {
      setAutoBidErr(err.response?.data?.error || 'Failed to set auto-bid.');
    } finally {
      setSettingAutoBid(false);
    }
  };

  const handleCancelAutoBid = async () => {
    try {
      await api.delete(`/api/auctions/${id}/autobid`);
      setAutoBid(null);
      setAutoBidMsg('Auto-bid cancelled.');
    } catch (err) {
      setAutoBidErr(err.response?.data?.error || 'Failed to cancel auto-bid.');
    }
  };

  const handleWatchlist = async () => {
    if (!user) { navigate('/login'); return; }
    setWatchLoading(true);
    try {
      if (watching) {
        await api.delete(`/api/watchlist/${id}`);
        setWatching(false);
      } else {
        await api.post(`/api/watchlist/${id}`);
        setWatching(true);
      }
    } catch {
      // ignore
    } finally {
      setWatchLoading(false);
    }
  };

  if (loading) return <div className="loading">⏳ Loading auction…</div>;
  if (error) return <div className="page"><div className="error-msg">{error}</div></div>;

  const currentBid = auction.current_bid || auction.starting_price;
  const increment = getBidIncrement(currentBid);
  const minBid = currentBid + increment;
  const isActive = auction.status === 'active';
  const isWinner = auction.status === 'ended' && auction.winner_id === user?.id;

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
          <div style={{ position: 'relative' }}>
            <img
              className="detail-img"
              src={auction.image_url || 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800'}
              alt={auction.title}
              onError={(e) => {
                e.target.src = 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800';
              }}
            />
            <button
              className={`watchlist-btn${watching ? ' watching' : ''}`}
              onClick={handleWatchlist}
              disabled={watchLoading}
              title={watching ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              {watching ? '❤️' : '🤍'}
            </button>
          </div>

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

            {/* Cost breakdown */}
            {isActive && (
              <div className="card" style={{ padding: 20, marginBottom: 16 }}>
                <h2 style={{ fontSize: '1rem', color: '#666', marginBottom: 12 }}>Estimated Costs at Current Bid</h2>
                <CostBreakdown
                  bid={currentBid}
                  premiumRate={auction.buyer_premium_rate}
                  vatRate={auction.vat_rate}
                />
              </div>
            )}

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
                        <th>Type</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auction.bids.map((bid) => (
                        <tr key={bid.id}>
                          <td>{bid.user_id === user?.id ? '⭐ You' : 'Bidder'}</td>
                          <td><strong>€{bid.amount.toLocaleString('nl-BE')}</strong></td>
                          <td>
                            <span className={`badge ${bid.is_auto_bid ? 'badge-auto' : 'badge-manual'}`}>
                              {bid.is_auto_bid ? '🤖 Auto' : '✋ Manual'}
                            </span>
                          </td>
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
            {auction.reserve_price && (
              <div style={{ fontSize: '0.82rem', marginTop: 6 }}>
                {auction.reserve_price_met ? (
                  <span style={{ color: '#1a7a46', fontWeight: 600 }}>✅ Reserve met</span>
                ) : (
                  <span style={{ color: '#e63946' }}>⚠ Reserve not yet met</span>
                )}
              </div>
            )}
            {auction.anti_snipe_count > 0 && (
              <div style={{ fontSize: '0.8rem', color: '#f0a500', marginTop: 6 }}>
                ⏱ Extended {auction.anti_snipe_count}× (anti-sniping)
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

          {/* Winner / payment CTA */}
          {auction.status === 'ended' && (
            <div className="sidebar-box" style={{ background: isWinner ? '#d4f7e0' : '#f7f9fc' }}>
              {isWinner ? (
                <>
                  <h3>🏆 You Won!</h3>
                  <p style={{ marginTop: 8, marginBottom: 12 }}>
                    Congratulations! You won this auction with a bid of{' '}
                    <strong>€{currentBid.toLocaleString('nl-BE')}</strong>.
                  </p>
                  <Link to={`/payment/${id}`} className="btn btn-accent btn-full">
                    💳 Pay Now
                  </Link>
                </>
              ) : (
                <>
                  <h3>🔒 Auction Ended</h3>
                  <p style={{ marginTop: 8 }}>This auction has closed.</p>
                </>
              )}
            </div>
          )}

          {/* Auto-bid status */}
          {isActive && user && autoBid && (
            <div className="sidebar-box" style={{ background: '#e8f4ff', border: '1px solid #b3d4f0' }}>
              <h3 style={{ color: '#00509e' }}>🤖 Auto-bid Active</h3>
              <p style={{ marginTop: 6, fontSize: '0.9rem' }}>
                Your maximum: <strong>€{autoBid.max_amount.toLocaleString('nl-BE')}</strong>
              </p>
              {autoBidMsg && <div className="success-msg" style={{ marginTop: 8 }}>{autoBidMsg}</div>}
              {autoBidErr && <div className="error-msg" style={{ marginTop: 8 }}>{autoBidErr}</div>}
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 10, width: '100%' }}
                onClick={handleCancelAutoBid}
              >
                Cancel Auto-bid
              </button>
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
                    step={increment}
                    min={minBid}
                    placeholder={`Min: €${minBid.toLocaleString('nl-BE')}`}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    required
                  />
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 4 }}>
                    Minimum increment: €{increment.toLocaleString('nl-BE')}
                  </div>
                </div>
                <button className="btn btn-accent btn-full" type="submit" disabled={bidding}>
                  {bidding ? 'Placing bid…' : '🔨 Place Bid'}
                </button>
              </form>

              {/* Auto-bid toggle */}
              <div style={{ marginTop: 16 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%' }}
                  type="button"
                  onClick={() => { setShowAutoBid(!showAutoBid); setAutoBidMsg(''); setAutoBidErr(''); }}
                >
                  {showAutoBid ? '▲ Hide Auto-bid' : '🤖 Set Auto-bid (Proxy)'}
                </button>
                {showAutoBid && !autoBid && (
                  <div style={{ marginTop: 12, padding: 16, background: '#f0f8ff', borderRadius: 8 }}>
                    <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: 12 }}>
                      Set a maximum amount and we'll automatically bid for you in increments until your limit is reached.
                    </p>
                    {autoBidMsg && <div className="success-msg">{autoBidMsg}</div>}
                    {autoBidErr && <div className="error-msg">{autoBidErr}</div>}
                    <form onSubmit={handleSetAutoBid}>
                      <div className="form-group" style={{ marginBottom: 10 }}>
                        <label className="form-label">My Maximum (€)</label>
                        <input
                          className="form-control"
                          type="number"
                          step={increment}
                          min={minBid}
                          placeholder={`Min: €${minBid.toLocaleString('nl-BE')}`}
                          value={maxAmount}
                          onChange={(e) => setMaxAmount(e.target.value)}
                          required
                        />
                      </div>
                      <button className="btn btn-primary btn-full" type="submit" disabled={settingAutoBid}>
                        {settingAutoBid ? 'Setting…' : 'Activate Auto-bid'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ) : isActive && !user ? (
            <div className="sidebar-box">
              <p style={{ marginBottom: 12, color: '#555' }}>You must be logged in to place a bid.</p>
              <Link to="/login" className="btn btn-primary btn-full">Login to Bid</Link>
            </div>
          ) : null}

          {/* Terms */}
          {isActive && (
            <div className="sidebar-box" style={{ fontSize: '0.8rem', color: '#666' }}>
              <strong>Terms & Conditions</strong>
              <p style={{ marginTop: 6 }}>
                By placing a bid you agree to the GMR Glass Machinery Auctions{' '}
                <a href="#terms" style={{ color: '#002855' }}>Terms & Conditions</a>.
                A {auction.buyer_premium_rate}% buyer's premium and {auction.vat_rate}% VAT apply to the winning bid.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getBidIncrement(price) {
  if (price < 1000) return 50;
  if (price < 5000) return 100;
  if (price < 10000) return 250;
  if (price < 50000) return 500;
  if (price < 100000) return 1000;
  if (price < 500000) return 2500;
  return 5000;
}

function CostBreakdown({ bid, premiumRate, vatRate }) {
  const premium = bid * (premiumRate / 100);
  const subtotal = bid + premium;
  const vat = subtotal * (vatRate / 100);
  const total = subtotal + vat;

  const row = (label, amount, bold = false) => (
    <tr key={label}>
      <td style={{ padding: '4px 0', color: '#555' }}>{label}</td>
      <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: bold ? 700 : 400 }}>
        €{amount.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
      </td>
    </tr>
  );

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
      <tbody>
        {row('Winning bid', bid)}
        {row(`Buyer's premium (${premiumRate}%)`, premium)}
        {row(`VAT (${vatRate}%)`, vat)}
        <tr><td colSpan={2} style={{ borderTop: '1px solid #ddd', paddingTop: 6 }} /></tr>
        {row('Total due', total, true)}
      </tbody>
    </table>
  );
}
