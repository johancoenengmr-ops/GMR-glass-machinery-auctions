import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import AuctionCard from '../components/AuctionCard';

export default function AuctionsPage() {
  const [auctions, setAuctions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState({
    search: '',
    category_id: '',
    min_price: '',
    max_price: '',
    sort: 'end_time',
    status: 'active',
  });

  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => { if (v !== '') params[k] = v; });
      const res = await api.get('/api/auctions', { params });
      setAuctions(res.data.auctions || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError('Failed to load auctions.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    api.get('/api/categories').then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  const handleFilter = (e) => {
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <>
      <div className="hero">
        <h1>Glass Machinery Auctions</h1>
        <p>
          Discover industrial glass machinery from leading manufacturers.
          Place bids and win quality equipment for your production line.
        </p>
      </div>
      <div className="page">
        {/* Filters */}
        <div className="filters">
          <div className="form-group filter-search">
            <label className="form-label">Search</label>
            <input
              className="form-control"
              name="search"
              placeholder="Machine name, manufacturer…"
              value={filters.search}
              onChange={handleFilter}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-control" name="category_id" value={filters.category_id} onChange={handleFilter}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control" name="status" value={filters.status} onChange={handleFilter}>
              <option value="active">Active</option>
              <option value="ended">Ended</option>
              <option value="">All</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Min price (€)</label>
            <input className="form-control" type="number" name="min_price" placeholder="0" value={filters.min_price} onChange={handleFilter} />
          </div>
          <div className="form-group">
            <label className="form-label">Max price (€)</label>
            <input className="form-control" type="number" name="max_price" placeholder="Any" value={filters.max_price} onChange={handleFilter} />
          </div>
          <div className="form-group">
            <label className="form-label">Sort by</label>
            <select className="form-control" name="sort" value={filters.sort} onChange={handleFilter}>
              <option value="end_time">Ending soon</option>
              <option value="price_asc">Price: low → high</option>
              <option value="price_desc">Price: high → low</option>
              <option value="newest">Newest first</option>
            </select>
          </div>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <div style={{ marginBottom: '12px', color: '#666' }}>
          {!loading && `${total} auction${total !== 1 ? 's' : ''} found`}
        </div>

        {loading ? (
          <div className="loading">⏳ Loading auctions…</div>
        ) : auctions.length === 0 ? (
          <div className="empty-msg">No auctions match your filters.</div>
        ) : (
          <div className="grid grid-3">
            {auctions.map((a) => (
              <AuctionCard key={a.id} auction={a} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
