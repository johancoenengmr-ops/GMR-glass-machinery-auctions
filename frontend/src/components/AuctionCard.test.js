import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuctionCard from '../components/AuctionCard';

const baseAuction = {
  id: 1,
  title: 'Glaston FC Series Tempering Furnace',
  manufacturer: 'Glaston',
  year: 2020,
  condition: 'Excellent',
  location: 'Brussels, Belgium',
  image_url: null,
  starting_price: 75000,
  current_bid: null,
  bid_count: 0,
  status: 'active',
  end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  category: { id: 1, name: 'Glass Tempering', slug: 'tempering' },
};

function renderCard(auction = baseAuction) {
  return render(
    <MemoryRouter>
      <AuctionCard auction={auction} />
    </MemoryRouter>
  );
}

describe('AuctionCard', () => {
  test('renders the auction title', () => {
    renderCard();
    expect(screen.getByText(baseAuction.title)).toBeInTheDocument();
  });

  test('displays the starting price when there are no bids', () => {
    renderCard();
    // Starting price 75000 formatted in nl-BE locale
    expect(screen.getByText(/75\.000/)).toBeInTheDocument();
  });

  test('displays the current bid when bids exist', () => {
    const withBid = { ...baseAuction, current_bid: 80000, bid_count: 3 };
    renderCard(withBid);
    expect(screen.getByText(/80\.000/)).toBeInTheDocument();
  });

  test('shows "No bids yet" when bid_count is 0', () => {
    renderCard();
    expect(screen.getByText(/No bids yet/i)).toBeInTheDocument();
  });

  test('shows bid count when bids exist', () => {
    const withBid = { ...baseAuction, current_bid: 80000, bid_count: 5 };
    renderCard(withBid);
    expect(screen.getByText(/5 bids/i)).toBeInTheDocument();
  });

  test('shows bid count singular for exactly 1 bid', () => {
    const withBid = { ...baseAuction, current_bid: 75500, bid_count: 1 };
    renderCard(withBid);
    // "1 bid" (no trailing 's')
    const items = screen.getAllByText(/\d+ bid/i);
    expect(items.some((el) => el.textContent.trim() === '1 bid')).toBe(true);
  });

  test('renders manufacturer and year metadata', () => {
    renderCard();
    // Manufacturer appears in the card meta section
    expect(screen.getAllByText(/Glaston/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2020/).length).toBeGreaterThan(0);
  });

  test('renders category name', () => {
    renderCard();
    expect(screen.getByText(/Glass Tempering/)).toBeInTheDocument();
  });

  test('renders location', () => {
    renderCard();
    expect(screen.getByText(/Brussels, Belgium/)).toBeInTheDocument();
  });

  test('renders a "View" link pointing to the correct auction URL', () => {
    renderCard();
    const link = screen.getByRole('link', { name: /view/i });
    expect(link).toHaveAttribute('href', `/auctions/${baseAuction.id}`);
  });

  test('renders active status badge', () => {
    renderCard();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  test('renders ended status badge for ended auction', () => {
    const ended = { ...baseAuction, status: 'ended' };
    renderCard(ended);
    expect(screen.getByText('ended')).toBeInTheDocument();
  });

  test('uses fallback image when image_url is null', () => {
    renderCard();
    const img = screen.getByRole('img', { name: baseAuction.title });
    expect(img).toHaveAttribute('src', expect.stringContaining('unsplash'));
  });

  test('uses provided image_url when set', () => {
    const withImage = { ...baseAuction, image_url: 'https://example.com/machine.jpg' };
    renderCard(withImage);
    const img = screen.getByRole('img', { name: withImage.title });
    expect(img).toHaveAttribute('src', 'https://example.com/machine.jpg');
  });

  test('renders countdown timer for active auction', () => {
    renderCard();
    // CountdownTimer renders a <span> – it will show days/hours/mins
    const timer = document.querySelector('.timer');
    expect(timer).not.toBeNull();
  });
});
