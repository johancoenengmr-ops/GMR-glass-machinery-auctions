from datetime import datetime
from extensions import db


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    company = db.Column(db.String(120))
    phone = db.Column(db.String(30))
    is_admin = db.Column(db.Boolean, default=False)
    notification_preferences = db.Column(db.String(200), default='outbid,won,ending_soon')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    bids = db.relationship('Bid', backref='user', lazy=True)
    auctions_created = db.relationship('Auction', foreign_keys='Auction.created_by_id', backref='creator', lazy=True)
    auctions_won = db.relationship('Auction', foreign_keys='Auction.winner_id', backref='winner', lazy=True)
    autobids = db.relationship('AutoBid', backref='user', lazy=True)
    watchlist_entries = db.relationship('Watchlist', backref='user', lazy=True)
    notifications = db.relationship('Notification', backref='user', lazy=True)
    payments = db.relationship('Payment', backref='user', lazy=True)

    def to_dict(self, include_private=False):
        data = {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'company': self.company,
            'phone': self.phone,
            'is_admin': self.is_admin,
            'notification_preferences': self.notification_preferences,
            'created_at': self.created_at.isoformat(),
        }
        return data


class Category(db.Model):
    __tablename__ = 'categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text)
    slug = db.Column(db.String(100), unique=True, nullable=False)

    auctions = db.relationship('Auction', backref='category', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'slug': self.slug,
        }


class Auction(db.Model):
    __tablename__ = 'auctions'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    manufacturer = db.Column(db.String(120))
    model_number = db.Column(db.String(120))
    year = db.Column(db.Integer)
    condition = db.Column(db.String(50))
    location = db.Column(db.String(150))
    image_url = db.Column(db.String(500))
    starting_price = db.Column(db.Float, nullable=False)
    current_bid = db.Column(db.Float)
    reserve_price = db.Column(db.Float)
    reserve_price_met = db.Column(db.Boolean, default=False)
    final_price = db.Column(db.Float)
    buyer_premium_rate = db.Column(db.Float, default=12.0)   # percentage, e.g. 12.0 = 12%
    vat_rate = db.Column(db.Float, default=21.0)              # percentage, e.g. 21.0 = 21%
    end_time = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default='active')      # active, ended, cancelled
    anti_snipe_count = db.Column(db.Integer, default=0)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'))
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    winner_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    bids = db.relationship('Bid', backref='auction', lazy=True, order_by='Bid.amount.desc()')
    autobids = db.relationship('AutoBid', backref='auction', lazy=True)
    watchlist_entries = db.relationship('Watchlist', backref='auction', lazy=True)
    payments = db.relationship('Payment', backref='auction', lazy=True)

    @property
    def bid_count(self):
        return len(self.bids)

    @property
    def highest_bid(self):
        return self.current_bid or self.starting_price

    def to_dict(self, include_bids=False):
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'manufacturer': self.manufacturer,
            'model_number': self.model_number,
            'year': self.year,
            'condition': self.condition,
            'location': self.location,
            'image_url': self.image_url,
            'starting_price': self.starting_price,
            'current_bid': self.current_bid,
            'highest_bid': self.highest_bid,
            'reserve_price': self.reserve_price,
            'reserve_price_met': self.reserve_price_met,
            'final_price': self.final_price,
            'buyer_premium_rate': self.buyer_premium_rate,
            'vat_rate': self.vat_rate,
            'end_time': self.end_time.isoformat(),
            'status': self.status,
            'anti_snipe_count': self.anti_snipe_count,
            'category_id': self.category_id,
            'category': self.category.to_dict() if self.category else None,
            'created_by_id': self.created_by_id,
            'winner_id': self.winner_id,
            'bid_count': self.bid_count,
            'created_at': self.created_at.isoformat(),
        }
        if include_bids:
            data['bids'] = [b.to_dict() for b in self.bids]
        return data


class Bid(db.Model):
    __tablename__ = 'bids'

    id = db.Column(db.Integer, primary_key=True)
    auction_id = db.Column(db.Integer, db.ForeignKey('auctions.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    is_auto_bid = db.Column(db.Boolean, default=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'auction_id': self.auction_id,
            'user_id': self.user_id,
            'user_name': self.user.name if self.user else None,
            'amount': self.amount,
            'is_auto_bid': self.is_auto_bid,
            'timestamp': self.timestamp.isoformat(),
        }


class AutoBid(db.Model):
    """Proxy / auto-bid: system places incremental bids up to max_amount."""
    __tablename__ = 'autobids'

    id = db.Column(db.Integer, primary_key=True)
    auction_id = db.Column(db.Integer, db.ForeignKey('auctions.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    max_amount = db.Column(db.Float, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'auction_id': self.auction_id,
            'user_id': self.user_id,
            'max_amount': self.max_amount,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat(),
        }


class Watchlist(db.Model):
    """User watchlist / favourites."""
    __tablename__ = 'watchlist'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    auction_id = db.Column(db.Integer, db.ForeignKey('auctions.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('user_id', 'auction_id', name='uq_watchlist_user_auction'),)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'auction_id': self.auction_id,
            'auction': self.auction.to_dict() if self.auction else None,
            'created_at': self.created_at.isoformat(),
        }


class Payment(db.Model):
    """Payment / invoice record for a won auction."""
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(50), unique=True, nullable=False)
    auction_id = db.Column(db.Integer, db.ForeignKey('auctions.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    # amounts
    winning_bid = db.Column(db.Float, nullable=False)
    buyer_premium = db.Column(db.Float, nullable=False, default=0.0)
    vat = db.Column(db.Float, nullable=False, default=0.0)
    total = db.Column(db.Float, nullable=False)
    # status: pending | paid | failed | refunded
    status = db.Column(db.String(20), default='pending')
    payment_method = db.Column(db.String(50))       # card | bank_transfer | stripe
    stripe_payment_intent_id = db.Column(db.String(200))
    stripe_client_secret = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    paid_at = db.Column(db.DateTime)

    def to_dict(self):
        return {
            'id': self.id,
            'invoice_number': self.invoice_number,
            'auction_id': self.auction_id,
            'auction_title': self.auction.title if self.auction else None,
            'user_id': self.user_id,
            'winning_bid': self.winning_bid,
            'buyer_premium': self.buyer_premium,
            'vat': self.vat,
            'total': self.total,
            'status': self.status,
            'payment_method': self.payment_method,
            'stripe_payment_intent_id': self.stripe_payment_intent_id,
            'created_at': self.created_at.isoformat(),
            'paid_at': self.paid_at.isoformat() if self.paid_at else None,
        }


class Notification(db.Model):
    """User notification record."""
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    auction_id = db.Column(db.Integer, db.ForeignKey('auctions.id'), nullable=True)
    # type: outbid | won | ending_soon | payment_due | payment_confirmed
    type = db.Column(db.String(50), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'auction_id': self.auction_id,
            'type': self.type,
            'content': self.content,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat(),
        }
