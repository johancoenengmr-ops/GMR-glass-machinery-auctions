import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function PaymentPage() {
  const { auctionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [paying, setPaying] = useState(false);
  const [payMsg, setPayMsg] = useState('');
  const [payErr, setPayErr] = useState('');

  // Card form (simulated)
  const [card, setCard] = useState({ name: '', number: '', expiry: '', cvc: '' });

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    api.get(`/api/payments/invoice/${auctionId}`)
      .then((res) => setInvoice(res.data))
      .catch(() => setError('Invoice not found or you are not the winner.'))
      .finally(() => setLoading(false));
  }, [auctionId, user, navigate]);

  const handlePay = async (e) => {
    e.preventDefault();
    setPayErr('');
    setPayMsg('');
    setPaying(true);
    try {
      const res = await api.post(`/api/payments/${invoice.id}/checkout`, { payment_method: paymentMethod });
      if (res.data.status === 'paid') {
        setPayMsg('✅ Payment successful! Your invoice has been confirmed.');
        setInvoice((prev) => ({ ...prev, status: 'paid' }));
      } else if (res.data.client_secret) {
        // Real Stripe flow would use client_secret with Stripe.js here
        setPayMsg('Payment initiated. Please complete in Stripe Elements (not configured in demo).');
      }
    } catch (err) {
      setPayErr(err.response?.data?.error || 'Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  if (!user) return null;
  if (loading) return <div className="loading">⏳ Loading invoice…</div>;
  if (error) return <div className="page"><div className="error-msg">{error}</div><Link to="/dashboard" className="btn btn-primary" style={{ marginTop: 16 }}>Back to Dashboard</Link></div>;

  const a = invoice.auction;

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/dashboard">Dashboard</Link>
        <span>›</span>
        Payment
      </div>

      <h1 className="section-title">💳 Payment &amp; Invoice</h1>

      {invoice.status === 'paid' ? (
        <div className="card" style={{ padding: 32, maxWidth: 600, background: '#d4f7e0', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
          <h2 style={{ color: '#1a7a46', marginBottom: 8 }}>Payment Complete</h2>
          <p style={{ color: '#555' }}>Invoice #{invoice.invoice_number} has been paid.</p>
          <p style={{ color: '#555', marginTop: 4 }}>Total paid: <strong>€{invoice.total.toLocaleString('nl-BE')}</strong></p>
          <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: 20 }}>← Back to Dashboard</Link>
        </div>
      ) : (
        <div className="payment-layout">
          {/* Invoice summary */}
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ fontSize: '1.1rem', color: '#002855', marginBottom: 20 }}>Invoice #{invoice.invoice_number}</h2>

            {a && (
              <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #eee' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{a.title}</div>
                {a.manufacturer && <div style={{ color: '#666', fontSize: '0.9rem' }}>{a.manufacturer} {a.model_number}</div>}
                {a.location && <div style={{ color: '#666', fontSize: '0.9rem' }}>📍 {a.location}</div>}
              </div>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
              <tbody>
                <InvoiceRow label="Winning Bid" amount={invoice.winning_bid} />
                <InvoiceRow label={`Buyer's Premium (${a?.buyer_premium_rate ?? 12}%)`} amount={invoice.buyer_premium} />
                <InvoiceRow label="Subtotal" amount={invoice.winning_bid + invoice.buyer_premium} />
                <InvoiceRow label={`VAT (${a?.vat_rate ?? 21}%)`} amount={invoice.vat} />
                <tr>
                  <td colSpan={2} style={{ borderTop: '2px solid #002855', paddingTop: 8 }} />
                </tr>
                <InvoiceRow label="Total Due" amount={invoice.total} bold />
              </tbody>
            </table>

            <div style={{ marginTop: 20, padding: 14, background: '#f7f9fc', borderRadius: 8, fontSize: '0.82rem', color: '#666' }}>
              <strong>GMR Glass Machinery Auctions</strong><br />
              Buyer: {user.name} {user.company ? `· ${user.company}` : ''}<br />
              Invoice date: {new Date(invoice.created_at).toLocaleDateString('nl-BE')}
            </div>
          </div>

          {/* Payment form */}
          <div>
            <div className="card" style={{ padding: 28 }}>
              <h2 style={{ fontSize: '1.1rem', color: '#002855', marginBottom: 20 }}>Complete Payment</h2>

              {payMsg && <div className="success-msg">{payMsg}</div>}
              {payErr && <div className="error-msg">{payErr}</div>}

              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <div className="payment-methods">
                  {[
                    ['card', '💳 Credit / Debit Card'],
                    ['bank_transfer', '🏦 Bank Transfer'],
                  ].map(([val, lbl]) => (
                    <label key={val} className={`payment-method-option${paymentMethod === val ? ' selected' : ''}`}>
                      <input
                        type="radio"
                        name="payment_method"
                        value={val}
                        checked={paymentMethod === val}
                        onChange={() => setPaymentMethod(val)}
                      />
                      {lbl}
                    </label>
                  ))}
                </div>
              </div>

              {paymentMethod === 'card' && (
                <form onSubmit={handlePay}>
                  <div className="form-group">
                    <label className="form-label">Cardholder Name</label>
                    <input
                      className="form-control"
                      placeholder="John Smith"
                      value={card.name}
                      onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Card Number</label>
                    <input
                      className="form-control"
                      placeholder="4242 4242 4242 4242"
                      maxLength={19}
                      value={card.number}
                      onChange={(e) => setCard((c) => ({ ...c, number: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Expiry</label>
                      <input
                        className="form-control"
                        placeholder="MM/YY"
                        maxLength={5}
                        value={card.expiry}
                        onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">CVC</label>
                      <input
                        className="form-control"
                        placeholder="123"
                        maxLength={4}
                        value={card.cvc}
                        onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: 16, padding: 12, background: '#fff3cd', borderRadius: 8, fontSize: '0.82rem', color: '#856404' }}>
                    🔒 <strong>Demo mode:</strong> Payments are simulated. No real charges will be made.
                    Use any card number for testing.
                  </div>

                  <button className="btn btn-accent btn-full" type="submit" disabled={paying}>
                    {paying ? 'Processing…' : `Pay €${invoice.total.toLocaleString('nl-BE')}`}
                  </button>
                </form>
              )}

              {paymentMethod === 'bank_transfer' && (
                <div>
                  <div style={{ padding: 20, background: '#f7f9fc', borderRadius: 8, marginBottom: 16 }}>
                    <strong>Bank Transfer Details</strong>
                    <table style={{ marginTop: 12, fontSize: '0.9rem', borderCollapse: 'collapse', width: '100%' }}>
                      <tbody>
                        {[
                          ['Beneficiary', 'GMR Glass Machinery Auctions BV'],
                          ['IBAN', 'BE68 5390 0754 7034'],
                          ['BIC', 'TRIOBEBB'],
                          ['Reference', invoice.invoice_number],
                          ['Amount', `€${invoice.total.toLocaleString('nl-BE')}`],
                        ].map(([k, v]) => (
                          <tr key={k}>
                            <td style={{ padding: '4px 0', fontWeight: 600, width: '40%', color: '#555' }}>{k}</td>
                            <td style={{ padding: '4px 0' }}>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 16 }}>
                    Please include your invoice number as the payment reference. Your order will be confirmed once payment is received (1-3 business days).
                  </p>
                  <button
                    className="btn btn-primary btn-full"
                    type="button"
                    onClick={handlePay}
                    disabled={paying}
                  >
                    {paying ? 'Processing…' : 'Confirm Bank Transfer Order'}
                  </button>
                </div>
              )}
            </div>

            <div style={{ marginTop: 16, fontSize: '0.82rem', color: '#888', textAlign: 'center' }}>
              🔒 Secure payment processing · Questions? Contact <a href="mailto:info@gmr.be" style={{ color: '#002855' }}>info@gmr.be</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InvoiceRow({ label, amount, bold }) {
  return (
    <tr>
      <td style={{ padding: '6px 0', color: '#555', fontWeight: bold ? 700 : 400 }}>{label}</td>
      <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: bold ? 700 : 400, fontSize: bold ? '1.05rem' : 'inherit' }}>
        €{amount.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
      </td>
    </tr>
  );
}
