from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity, get_jwt
)
from datetime import datetime, timedelta
import os
import uuid
from dotenv import load_dotenv

load_dotenv()

from extensions import db, bcrypt, jwt
from models import User, Auction, Bid, Category, AutoBid, Watchlist, Payment, Notification

app = Flask(__name__)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///gmr_auctions.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'gmr-super-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

CORS(app, origins=['http://localhost:3000', 'http://127.0.0.1:3000'])

db.init_app(app)
bcrypt.init_app(app)
jwt.init_app(app)

# Stripe (optional – falls back to simulated payment when key is absent)
STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY', '')
stripe = None
if STRIPE_SECRET_KEY:
    try:
        import stripe as _stripe
        _stripe.api_key = STRIPE_SECRET_KEY
        stripe = _stripe
    except ImportError:
        pass

# Platform-level settings (stored in memory; extend with a DB Settings model if needed)
_PLATFORM_SETTINGS = {
    'buyer_premium_rate': 12.0,   # %
    'vat_rate': 21.0,             # %
    'anti_snipe_minutes': 2,
    'currency': 'EUR',
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def admin_required(fn):
    """Decorator that checks JWT + admin flag."""
    from functools import wraps

    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        if not user or not user.is_admin:
            return jsonify({'error': 'Admin access required'}), 403
        return fn(*args, **kwargs)

    return wrapper


def get_bid_increment(current_price: float) -> float:
    """Dynamic minimum bid increment based on current price."""
    if current_price < 1_000:
        return 50
    elif current_price < 5_000:
        return 100
    elif current_price < 10_000:
        return 250
    elif current_price < 50_000:
        return 500
    elif current_price < 100_000:
        return 1_000
    elif current_price < 500_000:
        return 2_500
    else:
        return 5_000


def _create_notification(user_id: int, notif_type: str, content: str, auction_id: int = None):
    """Helper to create a notification record."""
    notif = Notification(
        user_id=user_id,
        type=notif_type,
        content=content,
        auction_id=auction_id,
    )
    db.session.add(notif)


def _generate_invoice_number() -> str:
    now = datetime.utcnow()
    return f"GMR-{now.year}{now.month:02d}-{uuid.uuid4().hex[:6].upper()}"


def close_expired_auctions():
    """Mark ended auctions, set winner, create payment invoices and notifications."""
    now = datetime.utcnow()
    expired = Auction.query.filter(
        Auction.status == 'active',
        Auction.end_time <= now
    ).all()
    for auction in expired:
        auction.status = 'ended'
        top_bid = Bid.query.filter_by(auction_id=auction.id)\
            .order_by(Bid.amount.desc()).first()
        if top_bid:
            auction.winner_id = top_bid.user_id
            auction.final_price = top_bid.amount

            # Create payment invoice if not already present
            existing = Payment.query.filter_by(auction_id=auction.id).first()
            if not existing:
                premium_rate = auction.buyer_premium_rate or _PLATFORM_SETTINGS['buyer_premium_rate']
                vat_rate = auction.vat_rate or _PLATFORM_SETTINGS['vat_rate']
                winning_bid = top_bid.amount
                buyer_premium = round(winning_bid * premium_rate / 100, 2)
                subtotal = winning_bid + buyer_premium
                vat = round(subtotal * vat_rate / 100, 2)
                total = round(subtotal + vat, 2)

                payment = Payment(
                    invoice_number=_generate_invoice_number(),
                    auction_id=auction.id,
                    user_id=top_bid.user_id,
                    winning_bid=winning_bid,
                    buyer_premium=buyer_premium,
                    vat=vat,
                    total=total,
                    status='pending',
                )
                db.session.add(payment)

                # Notify winner
                _create_notification(
                    top_bid.user_id,
                    'won',
                    f"🏆 Congratulations! You won '{auction.title}' with a bid of €{winning_bid:,.2f}. "
                    f"Total due: €{total:,.2f} (incl. buyer's premium + VAT).",
                    auction.id,
                )

    if expired:
        db.session.commit()


def _process_autobids(auction, new_bid_user_id: int, new_bid_amount: float):
    """
    After a manual bid, trigger auto-bids from other users whose max_amount
    exceeds the new bid. The auto-bidder with the highest max wins, and their
    counter-bid is placed at increment above the manual bid (or just enough
    to beat the manual bidder's auto-bid ceiling).
    """
    # Collect active auto-bids from OTHER users, sorted by max_amount desc
    auto_bids = AutoBid.query.filter(
        AutoBid.auction_id == auction.id,
        AutoBid.is_active == True,
        AutoBid.user_id != new_bid_user_id,
        AutoBid.max_amount > new_bid_amount,
    ).order_by(AutoBid.max_amount.desc()).all()

    if not auto_bids:
        return

    # The top auto-bidder wins
    winner_ab = auto_bids[0]

    # Also check if the manual bidder has an autobid set
    bidder_ab = AutoBid.query.filter_by(
        auction_id=auction.id,
        user_id=new_bid_user_id,
        is_active=True,
    ).first()

    if bidder_ab:
        # Both have autobids – the higher max wins, counter-bid = loser's max + increment
        if winner_ab.max_amount >= bidder_ab.max_amount:
            # winner_ab beats bidder_ab
            increment = get_bid_increment(bidder_ab.max_amount)
            auto_amount = min(winner_ab.max_amount, bidder_ab.max_amount + increment)
        else:
            # bidder_ab beats winner_ab – manual bidder's autobid prevails, nothing to do
            return
    else:
        # winner_ab simply counters at one increment above the new bid
        increment = get_bid_increment(new_bid_amount)
        auto_amount = min(winner_ab.max_amount, new_bid_amount + increment)

    if auto_amount <= auction.current_bid:
        return  # already covered

    # Find the previous highest bidder (before this auto-bid) for outbid notification
    prev_top_bid = Bid.query.filter_by(auction_id=auction.id)\
        .order_by(Bid.amount.desc()).first()
    prev_top_user_id = prev_top_bid.user_id if prev_top_bid else None

    # Place the auto-bid
    bid = Bid(
        auction_id=auction.id,
        user_id=winner_ab.user_id,
        amount=auto_amount,
        is_auto_bid=True,
    )
    auction.current_bid = auto_amount

    # Update reserve met flag
    if auction.reserve_price and auto_amount >= auction.reserve_price:
        auction.reserve_price_met = True

    db.session.add(bid)

    # Notify the user who placed the manual bid that they were outbid
    if prev_top_user_id and prev_top_user_id != winner_ab.user_id:
        _create_notification(
            prev_top_user_id,
            'outbid',
            f"⚡ You've been outbid on '{auction.title}'. Current bid: €{auto_amount:,.2f}.",
            auction.id,
        )


# ── Auth ─────────────────────────────────────────────────────────────────────

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    required = ['email', 'password', 'name']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    if User.query.filter_by(email=data['email'].lower()).first():
        return jsonify({'error': 'Email already registered'}), 409

    pw_hash = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    user = User(
        email=data['email'].lower(),
        password_hash=pw_hash,
        name=data['name'],
        company=data.get('company', ''),
        phone=data.get('phone', ''),
        is_admin=False,
    )
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=user.id)
    return jsonify({'token': token, 'user': user.to_dict()}), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    user = User.query.filter_by(email=data.get('email', '').lower()).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, data.get('password', '')):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = create_access_token(identity=user.id)
    return jsonify({'token': token, 'user': user.to_dict()})


@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user.to_dict())


# ── Categories ────────────────────────────────────────────────────────────────

@app.route('/api/categories', methods=['GET'])
def get_categories():
    cats = Category.query.all()
    return jsonify([c.to_dict() for c in cats])


# ── Auctions ──────────────────────────────────────────────────────────────────

@app.route('/api/auctions', methods=['GET'])
def get_auctions():
    close_expired_auctions()

    query = Auction.query

    status = request.args.get('status')
    if status:
        query = query.filter(Auction.status == status)
    else:
        query = query.filter(Auction.status == 'active')

    category_id = request.args.get('category_id')
    if category_id:
        query = query.filter(Auction.category_id == category_id)

    search = request.args.get('search', '').strip()
    if search:
        like = f'%{search}%'
        query = query.filter(
            db.or_(
                Auction.title.ilike(like),
                Auction.description.ilike(like),
                Auction.manufacturer.ilike(like),
            )
        )

    min_price = request.args.get('min_price')
    if min_price:
        query = query.filter(Auction.starting_price >= float(min_price))

    max_price = request.args.get('max_price')
    if max_price:
        query = query.filter(Auction.starting_price <= float(max_price))

    sort = request.args.get('sort', 'end_time')
    if sort == 'price_asc':
        query = query.order_by(Auction.starting_price.asc())
    elif sort == 'price_desc':
        query = query.order_by(Auction.starting_price.desc())
    elif sort == 'newest':
        query = query.order_by(Auction.created_at.desc())
    else:
        query = query.order_by(Auction.end_time.asc())

    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'auctions': [a.to_dict() for a in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page,
    })


@app.route('/api/auctions/all', methods=['GET'])
def get_all_auctions():
    """Return all auctions regardless of status (admin listing)."""
    close_expired_auctions()
    auctions = Auction.query.order_by(Auction.created_at.desc()).all()
    return jsonify([a.to_dict() for a in auctions])


@app.route('/api/auctions/<int:auction_id>', methods=['GET'])
def get_auction(auction_id):
    close_expired_auctions()
    auction = Auction.query.get_or_404(auction_id)
    return jsonify(auction.to_dict(include_bids=True))


@app.route('/api/auctions', methods=['POST'])
@admin_required
def create_auction():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    required = ['title', 'starting_price', 'end_time']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    user_id = get_jwt_identity()

    try:
        end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
    except ValueError:
        return jsonify({'error': 'Invalid end_time format'}), 400

    auction = Auction(
        title=data['title'],
        description=data.get('description', ''),
        manufacturer=data.get('manufacturer', ''),
        model_number=data.get('model_number', ''),
        year=data.get('year'),
        condition=data.get('condition', ''),
        location=data.get('location', ''),
        image_url=data.get('image_url', ''),
        starting_price=float(data['starting_price']),
        reserve_price=float(data['reserve_price']) if data.get('reserve_price') else None,
        buyer_premium_rate=float(data.get('buyer_premium_rate', _PLATFORM_SETTINGS['buyer_premium_rate'])),
        vat_rate=float(data.get('vat_rate', _PLATFORM_SETTINGS['vat_rate'])),
        end_time=end_time,
        status='active',
        category_id=data.get('category_id'),
        created_by_id=user_id,
    )
    db.session.add(auction)
    db.session.commit()
    return jsonify(auction.to_dict()), 201


@app.route('/api/auctions/<int:auction_id>', methods=['PUT'])
@admin_required
def update_auction(auction_id):
    auction = Auction.query.get_or_404(auction_id)
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    updatable = ['title', 'description', 'manufacturer', 'model_number', 'year',
                 'condition', 'location', 'image_url', 'starting_price',
                 'reserve_price', 'status', 'category_id',
                 'buyer_premium_rate', 'vat_rate']
    for field in updatable:
        if field in data:
            setattr(auction, field, data[field])

    if 'end_time' in data:
        try:
            auction.end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid end_time format'}), 400

    db.session.commit()
    return jsonify(auction.to_dict())


@app.route('/api/auctions/<int:auction_id>', methods=['DELETE'])
@admin_required
def delete_auction(auction_id):
    auction = Auction.query.get_or_404(auction_id)
    db.session.delete(auction)
    db.session.commit()
    return jsonify({'message': 'Auction deleted'}), 200


# ── Bids ──────────────────────────────────────────────────────────────────────

@app.route('/api/auctions/<int:auction_id>/bids', methods=['GET'])
def get_bids(auction_id):
    auction = Auction.query.get_or_404(auction_id)
    bids = Bid.query.filter_by(auction_id=auction_id)\
        .order_by(Bid.amount.desc()).all()
    return jsonify([b.to_dict() for b in bids])


@app.route('/api/auctions/<int:auction_id>/bids', methods=['POST'])
@jwt_required()
def place_bid(auction_id):
    close_expired_auctions()
    auction = Auction.query.get_or_404(auction_id)

    if auction.status != 'active':
        return jsonify({'error': 'Auction is not active'}), 400

    now = datetime.utcnow()
    if auction.end_time <= now:
        return jsonify({'error': 'Auction has ended'}), 400

    data = request.get_json()
    if not data or 'amount' not in data:
        return jsonify({'error': 'Bid amount is required'}), 400

    amount = float(data['amount'])
    user_id = get_jwt_identity()

    # Prevent self-bidding
    top_bid = Bid.query.filter_by(auction_id=auction_id)\
        .order_by(Bid.amount.desc()).first()
    if top_bid and top_bid.user_id == user_id:
        return jsonify({'error': 'You are already the highest bidder'}), 400

    current_price = auction.current_bid or auction.starting_price
    increment = get_bid_increment(current_price)
    min_bid = current_price + increment

    if amount < min_bid:
        return jsonify({
            'error': f'Minimum bid is €{min_bid:,.2f} (increment: €{increment:,.2f})'
        }), 400

    # Anti-sniping: if bid placed in the last anti_snipe_minutes, extend end_time
    anti_snipe_mins = _PLATFORM_SETTINGS['anti_snipe_minutes']
    time_left = (auction.end_time - now).total_seconds() / 60
    if time_left <= anti_snipe_mins:
        auction.end_time = auction.end_time + timedelta(minutes=anti_snipe_mins)
        auction.anti_snipe_count = (auction.anti_snipe_count or 0) + 1

    # Notify previous top bidder that they've been outbid
    if top_bid and top_bid.user_id != user_id:
        _create_notification(
            top_bid.user_id,
            'outbid',
            f"⚡ You've been outbid on '{auction.title}'. New bid: €{amount:,.2f}.",
            auction.id,
        )

    bid = Bid(auction_id=auction_id, user_id=user_id, amount=amount)
    auction.current_bid = amount

    # Update reserve met flag
    if auction.reserve_price and amount >= auction.reserve_price:
        auction.reserve_price_met = True

    db.session.add(bid)
    db.session.flush()

    # Trigger auto-bids from other users
    _process_autobids(auction, user_id, amount)

    db.session.commit()

    # Return refreshed auction to client
    return jsonify({'bid': bid.to_dict(), 'auction': auction.to_dict(include_bids=True)}), 201


# ── Auto-bid ──────────────────────────────────────────────────────────────────

@app.route('/api/auctions/<int:auction_id>/autobid', methods=['GET'])
@jwt_required()
def get_autobid(auction_id):
    user_id = get_jwt_identity()
    ab = AutoBid.query.filter_by(
        auction_id=auction_id, user_id=user_id, is_active=True
    ).first()
    if not ab:
        return jsonify(None)
    return jsonify(ab.to_dict())


@app.route('/api/auctions/<int:auction_id>/autobid', methods=['POST'])
@jwt_required()
def set_autobid(auction_id):
    close_expired_auctions()
    auction = Auction.query.get_or_404(auction_id)

    if auction.status != 'active':
        return jsonify({'error': 'Auction is not active'}), 400

    data = request.get_json()
    if not data or 'max_amount' not in data:
        return jsonify({'error': 'max_amount is required'}), 400

    user_id = get_jwt_identity()
    max_amount = float(data['max_amount'])

    current_price = auction.current_bid or auction.starting_price
    if max_amount <= current_price:
        return jsonify({'error': f'Max amount must be higher than current price €{current_price:,.2f}'}), 400

    # Deactivate any existing autobid
    existing = AutoBid.query.filter_by(
        auction_id=auction_id, user_id=user_id, is_active=True
    ).first()
    if existing:
        existing.is_active = False

    ab = AutoBid(auction_id=auction_id, user_id=user_id, max_amount=max_amount)
    db.session.add(ab)
    db.session.flush()

    # Immediately place a bid at minimum increment if user is not already highest bidder
    top_bid = Bid.query.filter_by(auction_id=auction_id)\
        .order_by(Bid.amount.desc()).first()

    if not top_bid or top_bid.user_id != user_id:
        increment = get_bid_increment(current_price)
        auto_amount = min(max_amount, current_price + increment)

        # Notify prev top bidder
        if top_bid and top_bid.user_id != user_id:
            _create_notification(
                top_bid.user_id,
                'outbid',
                f"⚡ You've been outbid on '{auction.title}'. New bid: €{auto_amount:,.2f}.",
                auction.id,
            )

        auto_bid = Bid(
            auction_id=auction_id, user_id=user_id,
            amount=auto_amount, is_auto_bid=True,
        )
        auction.current_bid = auto_amount
        if auction.reserve_price and auto_amount >= auction.reserve_price:
            auction.reserve_price_met = True
        db.session.add(auto_bid)

    db.session.commit()
    return jsonify(ab.to_dict()), 201


@app.route('/api/auctions/<int:auction_id>/autobid', methods=['DELETE'])
@jwt_required()
def delete_autobid(auction_id):
    user_id = get_jwt_identity()
    ab = AutoBid.query.filter_by(
        auction_id=auction_id, user_id=user_id, is_active=True
    ).first()
    if not ab:
        return jsonify({'error': 'No active auto-bid found'}), 404
    ab.is_active = False
    db.session.commit()
    return jsonify({'message': 'Auto-bid cancelled'})


# ── Watchlist ─────────────────────────────────────────────────────────────────

@app.route('/api/watchlist', methods=['GET'])
@jwt_required()
def get_watchlist():
    user_id = get_jwt_identity()
    entries = Watchlist.query.filter_by(user_id=user_id)\
        .order_by(Watchlist.created_at.desc()).all()
    return jsonify([e.to_dict() for e in entries])


@app.route('/api/watchlist/<int:auction_id>', methods=['POST'])
@jwt_required()
def add_to_watchlist(auction_id):
    user_id = get_jwt_identity()
    Auction.query.get_or_404(auction_id)  # validate auction exists

    existing = Watchlist.query.filter_by(user_id=user_id, auction_id=auction_id).first()
    if existing:
        return jsonify({'error': 'Already in watchlist'}), 409

    entry = Watchlist(user_id=user_id, auction_id=auction_id)
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201


@app.route('/api/watchlist/<int:auction_id>', methods=['DELETE'])
@jwt_required()
def remove_from_watchlist(auction_id):
    user_id = get_jwt_identity()
    entry = Watchlist.query.filter_by(user_id=user_id, auction_id=auction_id).first()
    if not entry:
        return jsonify({'error': 'Not in watchlist'}), 404
    db.session.delete(entry)
    db.session.commit()
    return jsonify({'message': 'Removed from watchlist'})


@app.route('/api/watchlist/<int:auction_id>/check', methods=['GET'])
@jwt_required()
def check_watchlist(auction_id):
    user_id = get_jwt_identity()
    entry = Watchlist.query.filter_by(user_id=user_id, auction_id=auction_id).first()
    return jsonify({'watching': entry is not None})


# ── Payments / Invoices ───────────────────────────────────────────────────────

@app.route('/api/payments', methods=['GET'])
@jwt_required()
def get_user_payments():
    user_id = get_jwt_identity()
    caller = db.session.get(User, user_id)

    if caller.is_admin:
        payments = Payment.query.order_by(Payment.created_at.desc()).all()
    else:
        payments = Payment.query.filter_by(user_id=user_id)\
            .order_by(Payment.created_at.desc()).all()

    return jsonify([p.to_dict() for p in payments])


@app.route('/api/payments/invoice/<int:auction_id>', methods=['GET'])
@jwt_required()
def get_invoice(auction_id):
    user_id = get_jwt_identity()
    close_expired_auctions()

    payment = Payment.query.filter_by(auction_id=auction_id, user_id=user_id).first()
    if not payment:
        return jsonify({'error': 'Invoice not found'}), 404

    auction = db.session.get(Auction, auction_id)
    return jsonify({
        **payment.to_dict(),
        'auction': auction.to_dict() if auction else None,
    })


@app.route('/api/payments/<int:payment_id>/checkout', methods=['POST'])
@jwt_required()
def checkout(payment_id):
    """Create a Stripe PaymentIntent (or simulate one if Stripe not configured)."""
    user_id = get_jwt_identity()
    payment = db.session.get(Payment, payment_id)
    if not payment:
        return jsonify({'error': 'Payment not found'}), 404
    if payment.user_id != user_id:
        return jsonify({'error': 'Forbidden'}), 403
    if payment.status == 'paid':
        return jsonify({'error': 'Already paid'}), 400

    data = request.get_json() or {}
    payment_method = data.get('payment_method', 'card')

    if stripe and STRIPE_SECRET_KEY:
        # Real Stripe flow
        try:
            intent = stripe.PaymentIntent.create(
                amount=int(payment.total * 100),  # cents
                currency='eur',
                metadata={
                    'invoice_number': payment.invoice_number,
                    'auction_id': str(payment.auction_id),
                    'user_id': str(user_id),
                },
            )
            payment.stripe_payment_intent_id = intent.id
            payment.stripe_client_secret = intent.client_secret
            payment.payment_method = payment_method
            db.session.commit()
            return jsonify({
                'client_secret': intent.client_secret,
                'payment_id': payment.id,
                'total': payment.total,
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        # Simulated payment (no Stripe key configured)
        payment.payment_method = payment_method
        payment.stripe_payment_intent_id = f'sim_{uuid.uuid4().hex}'
        payment.status = 'paid'
        payment.paid_at = datetime.utcnow()
        db.session.commit()

        _create_notification(
            user_id,
            'payment_confirmed',
            f"✅ Payment confirmed for '{payment.auction.title}'. "
            f"Invoice #{payment.invoice_number}. Amount: €{payment.total:,.2f}.",
            payment.auction_id,
        )
        db.session.commit()

        return jsonify({
            'status': 'paid',
            'payment_id': payment.id,
            'invoice_number': payment.invoice_number,
            'total': payment.total,
            'simulated': True,
        })


@app.route('/api/payments/<int:payment_id>/confirm', methods=['POST'])
@jwt_required()
def confirm_payment(payment_id):
    """Called after Stripe confirms payment on client (webhook alternative for demo)."""
    user_id = get_jwt_identity()
    payment = db.session.get(Payment, payment_id)
    if not payment or payment.user_id != user_id:
        return jsonify({'error': 'Payment not found'}), 404

    data = request.get_json() or {}
    if data.get('stripe_payment_intent_id'):
        payment.stripe_payment_intent_id = data['stripe_payment_intent_id']

    payment.status = 'paid'
    payment.paid_at = datetime.utcnow()
    db.session.commit()

    _create_notification(
        user_id,
        'payment_confirmed',
        f"✅ Payment confirmed for '{payment.auction.title}'. "
        f"Invoice #{payment.invoice_number}. Amount: €{payment.total:,.2f}.",
        payment.auction_id,
    )
    db.session.commit()
    return jsonify(payment.to_dict())


# ── Notifications ─────────────────────────────────────────────────────────────

@app.route('/api/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    user_id = get_jwt_identity()
    limit = int(request.args.get('limit', 20))
    notifs = Notification.query.filter_by(user_id=user_id)\
        .order_by(Notification.created_at.desc()).limit(limit).all()
    unread_count = Notification.query.filter_by(user_id=user_id, is_read=False).count()
    return jsonify({
        'notifications': [n.to_dict() for n in notifs],
        'unread_count': unread_count,
    })


@app.route('/api/notifications/read-all', methods=['POST'])
@jwt_required()
def mark_all_read():
    user_id = get_jwt_identity()
    Notification.query.filter_by(user_id=user_id, is_read=False)\
        .update({'is_read': True})
    db.session.commit()
    return jsonify({'message': 'All notifications marked as read'})


@app.route('/api/notifications/<int:notif_id>/read', methods=['POST'])
@jwt_required()
def mark_read(notif_id):
    user_id = get_jwt_identity()
    notif = db.session.get(Notification, notif_id)
    if not notif or notif.user_id != user_id:
        return jsonify({'error': 'Not found'}), 404
    notif.is_read = True
    db.session.commit()
    return jsonify(notif.to_dict())


# ── Users ─────────────────────────────────────────────────────────────────────

@app.route('/api/users/profile', methods=['GET'])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user.to_dict())


@app.route('/api/users/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    for field in ['name', 'company', 'phone', 'notification_preferences']:
        if field in data:
            setattr(user, field, data[field])

    if 'password' in data and data['password']:
        user.password_hash = bcrypt.generate_password_hash(data['password']).decode('utf-8')

    db.session.commit()
    return jsonify(user.to_dict())


@app.route('/api/users/<int:user_id>/bids', methods=['GET'])
@jwt_required()
def get_user_bids(user_id):
    caller_id = get_jwt_identity()
    caller = db.session.get(User, caller_id)
    if caller_id != user_id and not caller.is_admin:
        return jsonify({'error': 'Forbidden'}), 403

    bids = Bid.query.filter_by(user_id=user_id)\
        .order_by(Bid.timestamp.desc()).all()
    return jsonify([b.to_dict() for b in bids])


@app.route('/api/users/<int:user_id>/won', methods=['GET'])
@jwt_required()
def get_user_won(user_id):
    caller_id = get_jwt_identity()
    caller = db.session.get(User, caller_id)
    if caller_id != user_id and not caller.is_admin:
        return jsonify({'error': 'Forbidden'}), 403

    close_expired_auctions()
    won = Auction.query.filter_by(winner_id=user_id, status='ended').all()

    # Attach payment status
    result = []
    for a in won:
        a_dict = a.to_dict()
        payment = Payment.query.filter_by(auction_id=a.id, user_id=user_id).first()
        a_dict['payment'] = payment.to_dict() if payment else None
        result.append(a_dict)

    return jsonify(result)


# ── Admin ─────────────────────────────────────────────────────────────────────

@app.route('/api/admin/stats', methods=['GET'])
@admin_required
def admin_stats():
    close_expired_auctions()
    total_auctions = Auction.query.count()
    active_auctions = Auction.query.filter_by(status='active').count()
    ended_auctions = Auction.query.filter_by(status='ended').count()
    total_bids = Bid.query.count()
    total_users = User.query.count()
    total_payments = Payment.query.count()
    paid_payments = Payment.query.filter_by(status='paid').count()
    pending_payments = Payment.query.filter_by(status='pending').count()
    total_revenue = db.session.query(
        db.func.sum(Payment.total)
    ).filter_by(status='paid').scalar() or 0

    return jsonify({
        'total_auctions': total_auctions,
        'active_auctions': active_auctions,
        'ended_auctions': ended_auctions,
        'total_bids': total_bids,
        'total_users': total_users,
        'total_payments': total_payments,
        'paid_payments': paid_payments,
        'pending_payments': pending_payments,
        'total_revenue': round(total_revenue, 2),
    })


@app.route('/api/admin/users', methods=['GET'])
@admin_required
def admin_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([u.to_dict() for u in users])


@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@admin_required
def admin_update_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    data = request.get_json()
    if 'is_admin' in data:
        user.is_admin = bool(data['is_admin'])
    db.session.commit()
    return jsonify(user.to_dict())


@app.route('/api/admin/payments', methods=['GET'])
@admin_required
def admin_payments():
    """Payment reconciliation view for admins."""
    payments = Payment.query.order_by(Payment.created_at.desc()).all()
    result = []
    for p in payments:
        p_dict = p.to_dict()
        if p.user:
            p_dict['user_name'] = p.user.name
            p_dict['user_email'] = p.user.email
        result.append(p_dict)
    return jsonify(result)


@app.route('/api/admin/payments/<int:payment_id>', methods=['PUT'])
@admin_required
def admin_update_payment(payment_id):
    """Admin can manually update payment status (e.g., mark bank transfer received)."""
    payment = db.session.get(Payment, payment_id)
    if not payment:
        return jsonify({'error': 'Payment not found'}), 404
    data = request.get_json() or {}
    if 'status' in data:
        payment.status = data['status']
        if data['status'] == 'paid' and not payment.paid_at:
            payment.paid_at = datetime.utcnow()
            _create_notification(
                payment.user_id,
                'payment_confirmed',
                f"✅ Payment confirmed for '{payment.auction.title}'. "
                f"Invoice #{payment.invoice_number}. Amount: €{payment.total:,.2f}.",
                payment.auction_id,
            )
    db.session.commit()
    return jsonify(payment.to_dict())


@app.route('/api/admin/settings', methods=['GET'])
@admin_required
def get_settings():
    return jsonify(_PLATFORM_SETTINGS)


@app.route('/api/admin/settings', methods=['PUT'])
@admin_required
def update_settings():
    data = request.get_json() or {}
    for key in ['buyer_premium_rate', 'vat_rate', 'anti_snipe_minutes']:
        if key in data:
            _PLATFORM_SETTINGS[key] = float(data[key])
    return jsonify(_PLATFORM_SETTINGS)


@app.route('/api/admin/auctions/<int:auction_id>/close', methods=['POST'])
@admin_required
def admin_close_auction(auction_id):
    """Manually close an active auction."""
    auction = Auction.query.get_or_404(auction_id)
    if auction.status != 'active':
        return jsonify({'error': 'Auction is not active'}), 400

    auction.end_time = datetime.utcnow()
    db.session.commit()
    close_expired_auctions()
    return jsonify(auction.to_dict())


# ── Init ──────────────────────────────────────────────────────────────────────

def create_tables():
    db.create_all()


if __name__ == '__main__':
    with app.app_context():
        create_tables()
        from seed_data import seed
        seed()
    app.run(debug=True, host='0.0.0.0', port=5000)

