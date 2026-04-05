import os
import uuid
from datetime import datetime

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, get_jwt_identity, jwt_required

from extensions import bcrypt, db
from models import Auction, Bid, Category, User

load_dotenv()

app = Flask(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///gmr_auctions.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'dev-secret-change-in-production')

# ── Extensions ────────────────────────────────────────────────────────────────
db.init_app(app)
bcrypt.init_app(app)
JWTManager(app)
CORS(app, origins=['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'])

# ── Constants ─────────────────────────────────────────────────────────────────
MIN_BID_INCREMENT = 500  # Minimum amount a bid must exceed the current highest bid
BUYER_PREMIUM_RATE = 0.12
VAT_RATE = 0.21


# ── Helpers ───────────────────────────────────────────────────────────────────
def _current_user():
    uid = get_jwt_identity()
    return User.query.get(int(uid))


def _generate_invoice_number():
    now = datetime.utcnow()
    return f"GMR-{now.strftime('%Y%m')}-{uuid.uuid4().hex[:8].upper()}"


# ── Auth routes ───────────────────────────────────────────────────────────────
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    name = (data.get('name') or '').strip()
    company = (data.get('company') or '').strip()
    phone = (data.get('phone') or '').strip()

    if not email or not password or not name:
        return jsonify({'error': 'Email, password and name are required.'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'An account with this email already exists.'}), 409

    pw_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    user = User(email=email, password_hash=pw_hash, name=name, company=company, phone=phone)
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token, 'user': user.to_dict()}), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid email or password.'}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token, 'user': user.to_dict()}), 200


# ── Category routes ───────────────────────────────────────────────────────────
@app.route('/api/categories', methods=['GET'])
def list_categories():
    cats = Category.query.order_by(Category.name).all()
    return jsonify([c.to_dict() for c in cats])


# ── Auction routes ────────────────────────────────────────────────────────────
@app.route('/api/auctions', methods=['GET'])
def list_auctions():
    query = Auction.query

    status = request.args.get('status')
    if status:
        query = query.filter_by(status=status)

    search = request.args.get('search', '').strip()
    if search:
        like = f'%{search}%'
        query = query.filter(
            Auction.title.ilike(like) |
            Auction.manufacturer.ilike(like) |
            Auction.description.ilike(like)
        )

    category_id = request.args.get('category_id')
    if category_id:
        query = query.filter_by(category_id=int(category_id))

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

    total = query.count()
    auctions = query.all()
    return jsonify({'auctions': [a.to_dict() for a in auctions], 'total': total})


@app.route('/api/auctions/all', methods=['GET'])
@jwt_required()
def list_all_auctions():
    user = _current_user()
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required.'}), 403
    auctions = Auction.query.order_by(Auction.created_at.desc()).all()
    return jsonify([a.to_dict() for a in auctions])


@app.route('/api/auctions/<int:auction_id>', methods=['GET'])
def get_auction(auction_id):
    auction = Auction.query.get_or_404(auction_id)
    return jsonify(auction.to_dict(include_bids=True))


@app.route('/api/auctions', methods=['POST'])
@jwt_required()
def create_auction():
    user = _current_user()
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required.'}), 403

    data = request.get_json() or {}
    required = ['title', 'starting_price', 'end_time']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required.'}), 400

    end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
    auction = Auction(
        title=data['title'],
        description=data.get('description'),
        manufacturer=data.get('manufacturer'),
        model_number=data.get('model_number'),
        year=data.get('year'),
        condition=data.get('condition'),
        location=data.get('location'),
        image_url=data.get('image_url'),
        starting_price=float(data['starting_price']),
        reserve_price=float(data['reserve_price']) if data.get('reserve_price') else None,
        end_time=end_time,
        status=data.get('status', 'active'),
        category_id=int(data['category_id']) if data.get('category_id') else None,
        created_by_id=user.id,
    )
    db.session.add(auction)
    db.session.commit()
    return jsonify(auction.to_dict()), 201


@app.route('/api/auctions/<int:auction_id>', methods=['PUT'])
@jwt_required()
def update_auction(auction_id):
    user = _current_user()
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required.'}), 403

    auction = Auction.query.get_or_404(auction_id)
    data = request.get_json() or {}

    if 'title' in data:
        auction.title = data['title']
    if 'description' in data:
        auction.description = data['description']
    if 'manufacturer' in data:
        auction.manufacturer = data['manufacturer']
    if 'model_number' in data:
        auction.model_number = data['model_number']
    if 'year' in data:
        auction.year = data['year']
    if 'condition' in data:
        auction.condition = data['condition']
    if 'location' in data:
        auction.location = data['location']
    if 'image_url' in data:
        auction.image_url = data['image_url']
    if 'starting_price' in data:
        auction.starting_price = float(data['starting_price'])
    if 'reserve_price' in data:
        auction.reserve_price = float(data['reserve_price']) if data['reserve_price'] else None
    if 'end_time' in data:
        auction.end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
    if 'status' in data:
        auction.status = data['status']
    if 'category_id' in data:
        auction.category_id = int(data['category_id']) if data['category_id'] else None

    db.session.commit()
    return jsonify(auction.to_dict())


@app.route('/api/auctions/<int:auction_id>', methods=['DELETE'])
@jwt_required()
def delete_auction(auction_id):
    user = _current_user()
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required.'}), 403

    auction = Auction.query.get_or_404(auction_id)
    db.session.delete(auction)
    db.session.commit()
    return jsonify({'message': 'Auction deleted.'})


# ── Bid routes ────────────────────────────────────────────────────────────────
@app.route('/api/auctions/<int:auction_id>/bids', methods=['POST'])
@jwt_required()
def place_bid(auction_id):
    auction = Auction.query.get_or_404(auction_id)

    if auction.status != 'active':
        return jsonify({'error': 'This auction is no longer active.'}), 400

    if auction.end_time < datetime.utcnow():
        return jsonify({'error': 'This auction has already ended.'}), 400

    data = request.get_json() or {}
    amount = data.get('amount')

    if amount is None or not isinstance(amount, (int, float)) or amount <= 0:
        return jsonify({'error': 'Please enter a valid bid amount.'}), 400

    current_highest = auction.current_bid if auction.current_bid is not None else auction.starting_price
    min_bid = current_highest + MIN_BID_INCREMENT

    if amount < min_bid:
        return jsonify({
            'error': (
                f'Your bid must be at least €{min_bid:,.0f}. '
                f'Bids must exceed the current price of €{current_highest:,.0f} '
                f'by a minimum of €{MIN_BID_INCREMENT:,.0f}.'
            )
        }), 400

    user = _current_user()
    bid = Bid(auction_id=auction_id, user_id=user.id, amount=amount)
    auction.current_bid = amount
    db.session.add(bid)
    db.session.commit()

    return jsonify(bid.to_dict()), 201


# ── User routes ───────────────────────────────────────────────────────────────
@app.route('/api/users/<int:user_id>/bids', methods=['GET'])
@jwt_required()
def user_bids(user_id):
    current = _current_user()
    if not current or (current.id != user_id and not current.is_admin):
        return jsonify({'error': 'Access denied.'}), 403

    bids = Bid.query.filter_by(user_id=user_id).order_by(Bid.timestamp.desc()).all()
    return jsonify([b.to_dict() for b in bids])


@app.route('/api/users/<int:user_id>/won', methods=['GET'])
@jwt_required()
def user_won(user_id):
    current = _current_user()
    if not current or (current.id != user_id and not current.is_admin):
        return jsonify({'error': 'Access denied.'}), 403

    auctions = Auction.query.filter_by(winner_id=user_id).all()
    return jsonify([a.to_dict() for a in auctions])


@app.route('/api/users/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user = _current_user()
    if not user:
        return jsonify({'error': 'User not found.'}), 404

    data = request.get_json() or {}
    if 'name' in data:
        user.name = data['name']
    if 'company' in data:
        user.company = data['company']
    if 'phone' in data:
        user.phone = data['phone']

    db.session.commit()
    return jsonify(user.to_dict())


# ── Admin routes ──────────────────────────────────────────────────────────────
@app.route('/api/admin/stats', methods=['GET'])
@jwt_required()
def admin_stats():
    user = _current_user()
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required.'}), 403

    return jsonify({
        'total_auctions': Auction.query.count(),
        'active_auctions': Auction.query.filter_by(status='active').count(),
        'ended_auctions': Auction.query.filter_by(status='ended').count(),
        'total_bids': Bid.query.count(),
        'total_users': User.query.count(),
    })


@app.route('/api/admin/users', methods=['GET'])
@jwt_required()
def admin_list_users():
    user = _current_user()
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required.'}), 403

    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([u.to_dict() for u in users])


@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@jwt_required()
def admin_update_user(user_id):
    current = _current_user()
    if not current or not current.is_admin:
        return jsonify({'error': 'Admin access required.'}), 403

    target = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    if 'is_admin' in data:
        target.is_admin = bool(data['is_admin'])

    db.session.commit()
    return jsonify(target.to_dict())


# ── App entry point ───────────────────────────────────────────────────────────
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        from seed_data import seed
        seed()
    app.run(debug=os.environ.get('FLASK_DEBUG', 'false').lower() == 'true', port=5000)