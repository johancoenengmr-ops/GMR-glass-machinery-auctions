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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    bids = db.relationship('Bid', backref='user', lazy=True)
    auctions_created = db.relationship('Auction', foreign_keys='Auction.created_by_id', backref='creator', lazy=True)
    auctions_won = db.relationship('Auction', foreign_keys='Auction.winner_id', backref='winner', lazy=True)

    def to_dict(self, include_private=False):
        data = {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'company': self.company,
            'phone': self.phone,
            'is_admin': self.is_admin,
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
    end_time = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default='active')  # active, ended, cancelled
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'))
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    winner_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    bids = db.relationship('Bid', backref='auction', lazy=True, order_by='Bid.amount.desc()')

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
            'end_time': self.end_time.isoformat(),
            'status': self.status,
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
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'auction_id': self.auction_id,
            'user_id': self.user_id,
            'user_name': self.user.name if self.user else None,
            'amount': self.amount,
            'timestamp': self.timestamp.isoformat(),
        }
