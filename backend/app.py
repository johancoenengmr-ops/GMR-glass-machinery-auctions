from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity, get_jwt
)
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

from extensions import db, bcrypt, jwt
from models import User, Auction, Bid, Category

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


# ── Helper ──────────────────────────────────────────────────────────────────

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


def close_expired_auctions():
    """Mark ended auctions and set winner."""
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
    if expired:
        db.session.commit()


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
                 'reserve_price', 'status', 'category_id']
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

    if auction.end_time <= datetime.utcnow():
        return jsonify({'error': 'Auction has ended'}), 400

    data = request.get_json()
    if not data or 'amount' not in data:
        return jsonify({'error': 'Bid amount is required'}), 400

    amount = float(data['amount'])
    min_bid = (auction.current_bid or auction.starting_price) + 1

    if amount < min_bid:
        return jsonify({
            'error': f'Bid must be at least €{min_bid:.2f}'
        }), 400

    user_id = get_jwt_identity()

    bid = Bid(auction_id=auction_id, user_id=user_id, amount=amount)
    auction.current_bid = amount
    db.session.add(bid)
    db.session.commit()

    return jsonify(bid.to_dict()), 201


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

    for field in ['name', 'company', 'phone']:
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
    return jsonify([a.to_dict() for a in won])


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

    return jsonify({
        'total_auctions': total_auctions,
        'active_auctions': active_auctions,
        'ended_auctions': ended_auctions,
        'total_bids': total_bids,
        'total_users': total_users,
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


# ── Init ──────────────────────────────────────────────────────────────────────

def create_tables():
    db.create_all()


if __name__ == '__main__':
    with app.app_context():
        create_tables()
        from seed_data import seed
        seed()
    app.run(debug=True, host='0.0.0.0', port=5000)

