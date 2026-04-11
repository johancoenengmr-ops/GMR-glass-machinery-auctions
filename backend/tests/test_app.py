"""
Backend tests for the GMR Glass Machinery Auctions API.

Run from the backend/ directory:
    pytest tests/
"""
import sys
import os
from datetime import datetime, timedelta

import pytest

# Ensure the backend package is importable when running from the repo root
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app import app as flask_app
from extensions import db as _db
from models import Auction, Bid, Category, User


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope='function')
def app():
    flask_app.config.update({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'JWT_SECRET_KEY': 'test-secret',
        'WTF_CSRF_ENABLED': False,
    })
    with flask_app.app_context():
        _db.create_all()
        yield flask_app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope='function')
def db(app):
    with app.app_context():
        yield _db


@pytest.fixture(scope='function')
def client(app):
    return app.test_client()


@pytest.fixture
def category(db):
    cat = Category(name='Test Category', description='A test category', slug='test-cat')
    db.session.add(cat)
    db.session.flush()
    return cat


@pytest.fixture
def admin_user(db):
    from extensions import bcrypt
    pw = bcrypt.generate_password_hash('admin123').decode('utf-8')
    user = User(email='admin@test.com', password_hash=pw, name='Admin User', is_admin=True)
    db.session.add(user)
    db.session.flush()
    return user


@pytest.fixture
def regular_user(db):
    from extensions import bcrypt
    pw = bcrypt.generate_password_hash('user123').decode('utf-8')
    user = User(
        email='buyer@test.com',
        password_hash=pw,
        name='Test Buyer',
        company='Buyer Corp',
        phone='+32 1 000 0000',
    )
    db.session.add(user)
    db.session.flush()
    return user


@pytest.fixture
def active_auction(db, admin_user, category):
    auction = Auction(
        title='Test Tempering Furnace',
        description='A test auction for a tempering furnace',
        manufacturer='TestMaker',
        model_number='TM-100',
        year=2020,
        condition='Good',
        location='Brussels, Belgium',
        starting_price=10000.0,
        end_time=datetime.utcnow() + timedelta(days=7),
        status='active',
        category_id=category.id,
        created_by_id=admin_user.id,
    )
    db.session.add(auction)
    db.session.flush()
    return auction


@pytest.fixture
def ended_auction(db, admin_user, category):
    auction = Auction(
        title='Ended Test Auction',
        starting_price=5000.0,
        end_time=datetime.utcnow() - timedelta(days=1),
        status='ended',
        category_id=category.id,
        created_by_id=admin_user.id,
    )
    db.session.add(auction)
    db.session.flush()
    return auction


def _get_token(client, email, password):
    res = client.post('/api/auth/login', json={'email': email, 'password': password})
    return res.get_json()['token']


def _auth_headers(token):
    return {'Authorization': f'Bearer {token}'}


# ── Auth tests ────────────────────────────────────────────────────────────────

class TestRegister:
    def test_register_success(self, client):
        res = client.post('/api/auth/register', json={
            'email': 'new@example.com',
            'password': 'secret123',
            'name': 'New User',
        })
        assert res.status_code == 201
        data = res.get_json()
        assert 'token' in data
        assert data['user']['email'] == 'new@example.com'
        assert data['user']['name'] == 'New User'

    def test_register_missing_name(self, client):
        res = client.post('/api/auth/register', json={
            'email': 'x@example.com',
            'password': 'secret123',
        })
        assert res.status_code == 400
        assert 'required' in res.get_json()['error'].lower()

    def test_register_missing_email(self, client):
        res = client.post('/api/auth/register', json={
            'password': 'secret123',
            'name': 'Some Name',
        })
        assert res.status_code == 400

    def test_register_missing_password(self, client):
        res = client.post('/api/auth/register', json={
            'email': 'y@example.com',
            'name': 'Some Name',
        })
        assert res.status_code == 400

    def test_register_duplicate_email(self, client, regular_user):
        res = client.post('/api/auth/register', json={
            'email': regular_user.email,
            'password': 'another123',
            'name': 'Duplicate',
        })
        assert res.status_code == 409
        assert 'already exists' in res.get_json()['error']

    def test_register_email_normalised_lowercase(self, client):
        res = client.post('/api/auth/register', json={
            'email': 'Upper@Example.COM',
            'password': 'pass123',
            'name': 'Case Test',
        })
        assert res.status_code == 201
        assert res.get_json()['user']['email'] == 'upper@example.com'


class TestLogin:
    def test_login_success(self, client, regular_user):
        res = client.post('/api/auth/login', json={
            'email': regular_user.email,
            'password': 'user123',
        })
        assert res.status_code == 200
        data = res.get_json()
        assert 'token' in data
        assert data['user']['id'] == regular_user.id

    def test_login_wrong_password(self, client, regular_user):
        res = client.post('/api/auth/login', json={
            'email': regular_user.email,
            'password': 'wrongpass',
        })
        assert res.status_code == 401
        assert 'Invalid' in res.get_json()['error']

    def test_login_unknown_email(self, client):
        res = client.post('/api/auth/login', json={
            'email': 'nobody@example.com',
            'password': 'whatever',
        })
        assert res.status_code == 401

    def test_login_email_case_insensitive(self, client, regular_user):
        res = client.post('/api/auth/login', json={
            'email': regular_user.email.upper(),
            'password': 'user123',
        })
        assert res.status_code == 200


# ── Category tests ────────────────────────────────────────────────────────────

class TestCategories:
    def test_list_categories(self, client, category):
        res = client.get('/api/categories')
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, list)
        names = [c['name'] for c in data]
        assert category.name in names


# ── Auction listing tests ─────────────────────────────────────────────────────

class TestListAuctions:
    def test_list_all_active(self, client, active_auction):
        res = client.get('/api/auctions?status=active')
        assert res.status_code == 200
        data = res.get_json()
        assert 'auctions' in data
        assert data['total'] >= 1
        titles = [a['title'] for a in data['auctions']]
        assert active_auction.title in titles

    def test_list_ended(self, client, ended_auction):
        res = client.get('/api/auctions?status=ended')
        assert res.status_code == 200
        data = res.get_json()
        titles = [a['title'] for a in data['auctions']]
        assert ended_auction.title in titles

    def test_search_filter(self, client, active_auction):
        res = client.get(f'/api/auctions?search=TestMaker')
        assert res.status_code == 200
        data = res.get_json()
        assert any(a['id'] == active_auction.id for a in data['auctions'])

    def test_search_no_match(self, client):
        res = client.get('/api/auctions?search=ZZZZNONEXISTENT')
        assert res.status_code == 200
        assert res.get_json()['total'] == 0

    def test_category_filter(self, client, active_auction):
        res = client.get(f'/api/auctions?category_id={active_auction.category_id}')
        assert res.status_code == 200
        data = res.get_json()
        assert any(a['id'] == active_auction.id for a in data['auctions'])

    def test_min_price_filter(self, client, active_auction):
        # Set min above starting price – should not return the auction
        res = client.get(f'/api/auctions?min_price={active_auction.starting_price + 1}')
        assert res.status_code == 200
        ids = [a['id'] for a in res.get_json()['auctions']]
        assert active_auction.id not in ids

    def test_max_price_filter(self, client, active_auction):
        # Set max below starting price – should not return the auction
        res = client.get(f'/api/auctions?max_price={active_auction.starting_price - 1}')
        assert res.status_code == 200
        ids = [a['id'] for a in res.get_json()['auctions']]
        assert active_auction.id not in ids

    def test_sort_price_asc(self, client):
        res = client.get('/api/auctions?sort=price_asc')
        assert res.status_code == 200

    def test_sort_price_desc(self, client):
        res = client.get('/api/auctions?sort=price_desc')
        assert res.status_code == 200

    def test_sort_newest(self, client):
        res = client.get('/api/auctions?sort=newest')
        assert res.status_code == 200

    def test_response_shape(self, client, active_auction):
        res = client.get('/api/auctions')
        assert res.status_code == 200
        data = res.get_json()
        assert 'auctions' in data
        assert 'total' in data
        if data['auctions']:
            first = data['auctions'][0]
            for key in ('id', 'title', 'starting_price', 'status', 'end_time', 'bid_count'):
                assert key in first


# ── Auction detail tests ──────────────────────────────────────────────────────

class TestGetAuction:
    def test_get_existing_auction(self, client, active_auction):
        res = client.get(f'/api/auctions/{active_auction.id}')
        assert res.status_code == 200
        data = res.get_json()
        assert data['id'] == active_auction.id
        assert data['title'] == active_auction.title
        assert 'bids' in data  # include_bids=True

    def test_get_nonexistent_auction(self, client):
        res = client.get('/api/auctions/999999')
        assert res.status_code == 404


# ── Bid tests ─────────────────────────────────────────────────────────────────

class TestPlaceBid:
    def test_place_bid_success(self, client, regular_user, active_auction):
        token = _get_token(client, regular_user.email, 'user123')
        res = client.post(
            f'/api/auctions/{active_auction.id}/bids',
            json={'amount': active_auction.starting_price + 500},
            headers=_auth_headers(token),
        )
        assert res.status_code == 201
        data = res.get_json()
        assert data['amount'] == active_auction.starting_price + 500
        assert data['auction_id'] == active_auction.id

    def test_place_bid_too_low(self, client, regular_user, active_auction):
        token = _get_token(client, regular_user.email, 'user123')
        # Bid equal to starting price – increment not met
        res = client.post(
            f'/api/auctions/{active_auction.id}/bids',
            json={'amount': active_auction.starting_price},
            headers=_auth_headers(token),
        )
        assert res.status_code == 400
        assert 'error' in res.get_json()

    def test_place_bid_negative_amount(self, client, regular_user, active_auction):
        token = _get_token(client, regular_user.email, 'user123')
        res = client.post(
            f'/api/auctions/{active_auction.id}/bids',
            json={'amount': -1},
            headers=_auth_headers(token),
        )
        assert res.status_code == 400

    def test_place_bid_zero_amount(self, client, regular_user, active_auction):
        token = _get_token(client, regular_user.email, 'user123')
        res = client.post(
            f'/api/auctions/{active_auction.id}/bids',
            json={'amount': 0},
            headers=_auth_headers(token),
        )
        assert res.status_code == 400

    def test_place_bid_string_amount(self, client, regular_user, active_auction):
        token = _get_token(client, regular_user.email, 'user123')
        res = client.post(
            f'/api/auctions/{active_auction.id}/bids',
            json={'amount': 'not-a-number'},
            headers=_auth_headers(token),
        )
        assert res.status_code == 400

    def test_place_bid_on_ended_auction(self, client, regular_user, ended_auction):
        token = _get_token(client, regular_user.email, 'user123')
        res = client.post(
            f'/api/auctions/{ended_auction.id}/bids',
            json={'amount': 99999},
            headers=_auth_headers(token),
        )
        assert res.status_code == 400

    def test_place_bid_unauthenticated(self, client, active_auction):
        res = client.post(
            f'/api/auctions/{active_auction.id}/bids',
            json={'amount': active_auction.starting_price + 500},
        )
        assert res.status_code == 401

    def test_place_bid_updates_current_bid(self, client, regular_user, active_auction):
        token = _get_token(client, regular_user.email, 'user123')
        new_amount = active_auction.starting_price + 500
        client.post(
            f'/api/auctions/{active_auction.id}/bids',
            json={'amount': new_amount},
            headers=_auth_headers(token),
        )
        res = client.get(f'/api/auctions/{active_auction.id}')
        assert res.get_json()['current_bid'] == new_amount

    def test_minimum_increment_is_500(self, client, regular_user, active_auction):
        token = _get_token(client, regular_user.email, 'user123')
        # Place a bid exactly at starting_price + 499 – should fail
        res = client.post(
            f'/api/auctions/{active_auction.id}/bids',
            json={'amount': active_auction.starting_price + 499},
            headers=_auth_headers(token),
        )
        assert res.status_code == 400
        # Place a bid at starting_price + 500 – should succeed
        res = client.post(
            f'/api/auctions/{active_auction.id}/bids',
            json={'amount': active_auction.starting_price + 500},
            headers=_auth_headers(token),
        )
        assert res.status_code == 201


# ── User routes tests ─────────────────────────────────────────────────────────

class TestUserRoutes:
    def test_get_own_bids(self, client, regular_user):
        token = _get_token(client, regular_user.email, 'user123')
        res = client.get(
            f'/api/users/{regular_user.id}/bids',
            headers=_auth_headers(token),
        )
        assert res.status_code == 200
        assert isinstance(res.get_json(), list)

    def test_get_bids_other_user_forbidden(self, client, regular_user, admin_user):
        # regular user trying to see another user's bids
        token = _get_token(client, regular_user.email, 'user123')
        res = client.get(
            f'/api/users/{admin_user.id}/bids',
            headers=_auth_headers(token),
        )
        assert res.status_code == 403

    def test_admin_can_see_other_user_bids(self, client, regular_user, admin_user):
        token = _get_token(client, admin_user.email, 'admin123')
        res = client.get(
            f'/api/users/{regular_user.id}/bids',
            headers=_auth_headers(token),
        )
        assert res.status_code == 200

    def test_update_profile(self, client, regular_user):
        token = _get_token(client, regular_user.email, 'user123')
        res = client.put(
            '/api/users/profile',
            json={'name': 'Updated Name', 'company': 'New Corp'},
            headers=_auth_headers(token),
        )
        assert res.status_code == 200
        data = res.get_json()
        assert data['name'] == 'Updated Name'
        assert data['company'] == 'New Corp'

    def test_update_profile_unauthenticated(self, client):
        res = client.put('/api/users/profile', json={'name': 'Hacker'})
        assert res.status_code == 401

    def test_get_won_auctions(self, client, regular_user):
        token = _get_token(client, regular_user.email, 'user123')
        res = client.get(
            f'/api/users/{regular_user.id}/won',
            headers=_auth_headers(token),
        )
        assert res.status_code == 200
        assert isinstance(res.get_json(), list)


# ── Admin tests ───────────────────────────────────────────────────────────────

class TestAdminStats:
    def test_stats_as_admin(self, client, admin_user):
        token = _get_token(client, admin_user.email, 'admin123')
        res = client.get('/api/admin/stats', headers=_auth_headers(token))
        assert res.status_code == 200
        data = res.get_json()
        for key in ('total_auctions', 'active_auctions', 'ended_auctions', 'total_bids', 'total_users'):
            assert key in data

    def test_stats_as_regular_user_forbidden(self, client, regular_user):
        token = _get_token(client, regular_user.email, 'user123')
        res = client.get('/api/admin/stats', headers=_auth_headers(token))
        assert res.status_code == 403

    def test_stats_unauthenticated(self, client):
        res = client.get('/api/admin/stats')
        assert res.status_code == 401


class TestAdminUsers:
    def test_list_users_as_admin(self, client, admin_user, regular_user):
        token = _get_token(client, admin_user.email, 'admin123')
        res = client.get('/api/admin/users', headers=_auth_headers(token))
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, list)
        emails = [u['email'] for u in data]
        assert regular_user.email in emails

    def test_list_users_as_regular_user_forbidden(self, client, regular_user):
        token = _get_token(client, regular_user.email, 'user123')
        res = client.get('/api/admin/users', headers=_auth_headers(token))
        assert res.status_code == 403

    def test_toggle_admin_flag(self, client, admin_user, regular_user):
        token = _get_token(client, admin_user.email, 'admin123')
        res = client.put(
            f'/api/admin/users/{regular_user.id}',
            json={'is_admin': True},
            headers=_auth_headers(token),
        )
        assert res.status_code == 200
        assert res.get_json()['is_admin'] is True

    def test_toggle_admin_as_regular_user_forbidden(self, client, regular_user, admin_user):
        token = _get_token(client, regular_user.email, 'user123')
        res = client.put(
            f'/api/admin/users/{admin_user.id}',
            json={'is_admin': False},
            headers=_auth_headers(token),
        )
        assert res.status_code == 403


class TestAdminAuctions:
    def test_list_all_auctions_as_admin(self, client, admin_user, active_auction, ended_auction):
        token = _get_token(client, admin_user.email, 'admin123')
        res = client.get('/api/auctions/all', headers=_auth_headers(token))
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, list)
        ids = [a['id'] for a in data]
        assert active_auction.id in ids
        assert ended_auction.id in ids

    def test_list_all_auctions_as_regular_user_forbidden(self, client, regular_user):
        token = _get_token(client, regular_user.email, 'user123')
        res = client.get('/api/auctions/all', headers=_auth_headers(token))
        assert res.status_code == 403

    def test_create_auction_as_admin(self, client, admin_user, category):
        token = _get_token(client, admin_user.email, 'admin123')
        res = client.post(
            '/api/auctions',
            json={
                'title': 'New Test Auction',
                'starting_price': 20000,
                'end_time': (datetime.utcnow() + timedelta(days=5)).isoformat() + 'Z',
                'category_id': category.id,
                'status': 'active',
            },
            headers=_auth_headers(token),
        )
        assert res.status_code == 201
        data = res.get_json()
        assert data['title'] == 'New Test Auction'
        assert data['starting_price'] == 20000

    def test_create_auction_as_regular_user_forbidden(self, client, regular_user, category):
        token = _get_token(client, regular_user.email, 'user123')
        res = client.post(
            '/api/auctions',
            json={
                'title': 'Unauthorized Auction',
                'starting_price': 5000,
                'end_time': (datetime.utcnow() + timedelta(days=5)).isoformat() + 'Z',
            },
            headers=_auth_headers(token),
        )
        assert res.status_code == 403

    def test_create_auction_missing_required_fields(self, client, admin_user):
        token = _get_token(client, admin_user.email, 'admin123')
        res = client.post(
            '/api/auctions',
            json={'title': 'Missing end_time and price'},
            headers=_auth_headers(token),
        )
        assert res.status_code == 400

    def test_update_auction_as_admin(self, client, admin_user, active_auction):
        token = _get_token(client, admin_user.email, 'admin123')
        res = client.put(
            f'/api/auctions/{active_auction.id}',
            json={'title': 'Updated Title', 'condition': 'Excellent'},
            headers=_auth_headers(token),
        )
        assert res.status_code == 200
        data = res.get_json()
        assert data['title'] == 'Updated Title'
        assert data['condition'] == 'Excellent'

    def test_update_auction_as_regular_user_forbidden(self, client, regular_user, active_auction):
        token = _get_token(client, regular_user.email, 'user123')
        res = client.put(
            f'/api/auctions/{active_auction.id}',
            json={'title': 'Hacked Title'},
            headers=_auth_headers(token),
        )
        assert res.status_code == 403

    def test_delete_auction_as_admin(self, client, admin_user, active_auction):
        token = _get_token(client, admin_user.email, 'admin123')
        res = client.delete(
            f'/api/auctions/{active_auction.id}',
            headers=_auth_headers(token),
        )
        assert res.status_code == 200
        # Verify it's gone
        res = client.get(f'/api/auctions/{active_auction.id}')
        assert res.status_code == 404

    def test_delete_auction_as_regular_user_forbidden(self, client, regular_user, active_auction):
        token = _get_token(client, regular_user.email, 'user123')
        res = client.delete(
            f'/api/auctions/{active_auction.id}',
            headers=_auth_headers(token),
        )
        assert res.status_code == 403
