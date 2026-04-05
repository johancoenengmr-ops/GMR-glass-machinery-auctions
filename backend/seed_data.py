"""Seed the database with initial categories, users and auction listings."""
from datetime import datetime, timedelta
from extensions import db, bcrypt
from models import User, Category, Auction, Bid


def seed():
    if User.query.count() > 0:
        return  # already seeded

    # ── Categories ────────────────────────────────────────────────────────
    categories = [
        Category(name='Flat Glass Machinery', description='Machinery for processing flat glass', slug='flat-glass'),
        Category(name='Hollow Glass Machinery', description='Machinery for hollow/container glass', slug='hollow-glass'),
        Category(name='Glass Cutting', description='Glass cutting and scoring equipment', slug='glass-cutting'),
        Category(name='Glass Grinding & Polishing', description='Edge grinding and polishing machines', slug='grinding-polishing'),
        Category(name='Glass Tempering', description='Tempering and heat treatment furnaces', slug='tempering'),
        Category(name='Glass Washing', description='Glass washing and cleaning machines', slug='washing'),
        Category(name='Safety & Laminated Glass', description='Lamination and safety glass equipment', slug='laminated'),
        Category(name='Insulating Glass', description='Double/triple glazing production lines', slug='insulating'),
    ]
    for c in categories:
        db.session.add(c)
    db.session.flush()  # get IDs

    # Map slug -> id
    cat = {c.slug: c.id for c in categories}

    # ── Users ─────────────────────────────────────────────────────────────
    admin = User(
        email='admin@gmr.be',
        password_hash=bcrypt.generate_password_hash('admin123').decode('utf-8'),
        name='GMR Admin',
        company='GMR Glass Machinery',
        phone='+32 2 000 0000',
        is_admin=True,
    )
    user1 = User(
        email='buyer1@example.com',
        password_hash=bcrypt.generate_password_hash('buyer123').decode('utf-8'),
        name='Jan Janssen',
        company='Janssen Glas BV',
        phone='+31 20 000 0001',
        is_admin=False,
    )
    user2 = User(
        email='buyer2@example.com',
        password_hash=bcrypt.generate_password_hash('buyer123').decode('utf-8'),
        name='Pierre Dupont',
        company='Dupont Verrerie SA',
        phone='+33 1 00 00 00 01',
        is_admin=False,
    )
    db.session.add_all([admin, user1, user2])
    db.session.flush()

    now = datetime.utcnow()

    # ── Auctions ─────────────────────────────────────────────────────────
    listings = [
        dict(
            title='Lisec IG Line – Insulating Glass Production Line',
            description=(
                'Complete Lisec insulating glass production line, fully operational. '
                'Includes butyl extruder, gas filling station, and sealing robot. '
                'Capacity up to 200 units/hour. Year 2018, in excellent condition.'
            ),
            manufacturer='Lisec', model_number='IG-2018-A', year=2018,
            condition='Excellent', location='Antwerp, Belgium',
            image_url='https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800',
            starting_price=45000, category_id=cat['insulating'],
            end_time=now + timedelta(days=7),
        ),
        dict(
            title='Bottero 360 Glass Cutting Table',
            description=(
                'Bottero 360 series flat glass cutting optimiser table. '
                'Software-driven optimisation reduces waste by up to 15%. '
                'Cutting area 3210 × 2250 mm. Year 2017, well maintained.'
            ),
            manufacturer='Bottero', model_number='360', year=2017,
            condition='Good', location='Ghent, Belgium',
            image_url='https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800',
            starting_price=28000, category_id=cat['glass-cutting'],
            end_time=now + timedelta(days=5),
        ),
        dict(
            title='Bavelloni Horizontal Glass Washing Machine',
            description=(
                'Bavelloni horizontal washing machine for float glass up to 6 m length. '
                'Four-brush system with high-pressure rinsing and IR drying. '
                'Max thickness 25 mm. Year 2019, minimal usage.'
            ),
            manufacturer='Bavelloni', model_number='RW-2500', year=2019,
            condition='Excellent', location='Brussels, Belgium',
            image_url='https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800',
            starting_price=18500, category_id=cat['washing'],
            end_time=now + timedelta(days=10),
        ),
        dict(
            title='Glaston FC Series Tempering Furnace',
            description=(
                'Glaston FC 2500 flat glass tempering furnace. Roller hearth design, '
                'convection heating for low-E glass. Process width 2500 mm, '
                'thickness 3–19 mm. Year 2016, fully serviced.'
            ),
            manufacturer='Glaston', model_number='FC-2500', year=2016,
            condition='Good', location='Liège, Belgium',
            image_url='https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=800',
            starting_price=75000, category_id=cat['tempering'],
            end_time=now + timedelta(days=14),
        ),
        dict(
            title='Hegla Automated Glass Storage System',
            description=(
                'Hegla chameleon automated glass storage and retrieval system. '
                'Capacity 500 m² of glass. Integrated with cutting optimiser. '
                'Year 2015. Requires dismantling – buyer responsible for transport.'
            ),
            manufacturer='Hegla', model_number='Chameleon', year=2015,
            condition='Fair', location='Bruges, Belgium',
            image_url='https://images.unsplash.com/photo-1581092921461-eab62e97a780?w=800',
            starting_price=35000, category_id=cat['flat-glass'],
            end_time=now + timedelta(days=3),
        ),
        dict(
            title='Intermac Master 33 CNC Glass Machining Centre',
            description=(
                'Intermac Master 33 CNC 5-axis glass machining centre. '
                'Suitable for drilling, milling, shaping, and polishing. '
                'Work table 3300 × 2000 mm. Year 2020, low hours.'
            ),
            manufacturer='Intermac', model_number='Master 33', year=2020,
            condition='Excellent', location='Namur, Belgium',
            image_url='https://images.unsplash.com/photo-1563770557593-d31a0b32d0b4?w=800',
            starting_price=92000, category_id=cat['grinding-polishing'],
            end_time=now + timedelta(days=12),
        ),
        dict(
            title='Bystronic Lamination Line for Safety Glass',
            description=(
                'Bystronic complete lamination line including autoclave, PVB lay-up '
                'room, and pre-press. Max glass size 3200 × 6000 mm. '
                'Year 2014, full service history available.'
            ),
            manufacturer='Bystronic', model_number='BYE-3200', year=2014,
            condition='Good', location='Mechelen, Belgium',
            image_url='https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800',
            starting_price=62000, category_id=cat['laminated'],
            end_time=now + timedelta(days=9),
        ),
        dict(
            title='Forel Edging Machine – Flat Glass Edge Polisher',
            description=(
                'Forel straight-line edging machine with 10 spindles. '
                'Processes glass 4–19 mm thickness, up to 2500 mm width. '
                'Arrissing, flat grinding and polishing in one pass. Year 2018.'
            ),
            manufacturer='Forel', model_number='FGL-2500', year=2018,
            condition='Good', location='Kortrijk, Belgium',
            image_url='https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800',
            starting_price=22000, category_id=cat['grinding-polishing'],
            end_time=now + timedelta(days=6),
        ),
        dict(
            title='LandGlass Jet Convection Tempering Furnace',
            description=(
                'LandGlass jet convection tempering furnace, model LD-A2442. '
                'Processing width 2440 mm, length 2440–6000 mm. '
                'Year 2021, used for 18 months only. Reason for sale: factory upgrade.'
            ),
            manufacturer='LandGlass', model_number='LD-A2442', year=2021,
            condition='Excellent', location='Hasselt, Belgium',
            image_url='https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=800',
            starting_price=55000, category_id=cat['tempering'],
            end_time=now + timedelta(days=8),
        ),
        dict(
            title='CMS Brembana Numerix Glass Waterjet Cutting System',
            description=(
                'CMS Brembana Numerix 5-axis waterjet cutting system for glass and stone. '
                'Table size 4000 × 2000 mm. Includes high-pressure pump 60 000 psi. '
                'Year 2016, fully operational.'
            ),
            manufacturer='CMS Brembana', model_number='Numerix', year=2016,
            condition='Good', location='Leuven, Belgium',
            image_url='https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
            starting_price=48000, category_id=cat['glass-cutting'],
            end_time=now + timedelta(days=11),
        ),
        dict(
            title='Archimedys Autoclave – Glass Lamination Autoclave 3.2m',
            description=(
                'Large-diameter autoclave for PVB and EVA laminated glass. '
                'Inner diameter 3200 mm, length 12 000 mm. Pressure 15 bar, '
                'temperature up to 145 °C. Year 2013, recently relined.'
            ),
            manufacturer='Archimedys', model_number='ACL-3200', year=2013,
            condition='Good', location='Charleroi, Belgium',
            image_url='https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800',
            starting_price=85000, category_id=cat['laminated'],
            end_time=now + timedelta(days=16),
        ),
        dict(
            title='Triulzi Sandblasting Cabin for Decorative Glass',
            description=(
                'Triulzi automated sandblasting cabin for decorative glass etching. '
                'Working area 2000 × 1500 mm. Programmable patterns via CNC controller. '
                'Year 2019. Comes with 4 stencil rolls.'
            ),
            manufacturer='Triulzi', model_number='SBC-2000', year=2019,
            condition='Excellent', location='Mons, Belgium',
            image_url='https://images.unsplash.com/photo-1492724441997-5dc865305da7?w=800',
            starting_price=14000, category_id=cat['flat-glass'],
            end_time=now + timedelta(days=4),
        ),
        dict(
            title='Horn Glass Lehrannealing Lehr – Float Glass Annealing',
            description=(
                'Horn Glass Industries roller-hearth annealing lehr, length 48 m. '
                'For annealing float glass ribbon up to 3300 mm wide. '
                'Year 2012. Available as part of float glass line dismantling project.'
            ),
            manufacturer='Horn Glass Industries', model_number='RL-48', year=2012,
            condition='Fair', location='Aalst, Belgium',
            image_url='https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800',
            starting_price=120000, category_id=cat['flat-glass'],
            end_time=now + timedelta(days=20),
        ),
        dict(
            title='Bovone Straight Line Bevelling Machine',
            description=(
                'Bovone DLM 35 straight line bevelling machine. '
                'Produces bevels 5–60 mm wide on glass 4–25 mm thick. '
                'Year 2015, 10-spindle configuration. Good condition.'
            ),
            manufacturer='Bovone', model_number='DLM 35', year=2015,
            condition='Good', location='Tournai, Belgium',
            image_url='https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800',
            starting_price=19500, category_id=cat['grinding-polishing'],
            end_time=now + timedelta(days=7),
        ),
        dict(
            title='Glasmachine Screen-Printing Line for Glass',
            description=(
                'Semi-automatic screen-printing line for decorative glass. '
                'Max print area 1500 × 1000 mm. UV curing tunnel included. '
                'Year 2020. Ideal for architectural and furniture glass decoration.'
            ),
            manufacturer='Glasmachine', model_number='SPL-1500', year=2020,
            condition='Excellent', location='Namur, Belgium',
            image_url='https://images.unsplash.com/photo-1563770557593-d31a0b32d0b4?w=800',
            starting_price=11500, category_id=cat['flat-glass'],
            end_time=now + timedelta(days=13),
        ),
    ]

    auction_objs = []
    for i, ldata in enumerate(listings):
        a = Auction(created_by_id=admin.id, status='active', **ldata)
        db.session.add(a)
        auction_objs.append(a)

    db.session.flush()

    # ── Sample bids ───────────────────────────────────────────────────────
    sample_bids = [
        Bid(auction_id=auction_objs[0].id, user_id=user1.id, amount=47000, timestamp=now - timedelta(hours=5)),
        Bid(auction_id=auction_objs[0].id, user_id=user2.id, amount=49000, timestamp=now - timedelta(hours=3)),
        Bid(auction_id=auction_objs[1].id, user_id=user2.id, amount=29500, timestamp=now - timedelta(hours=8)),
        Bid(auction_id=auction_objs[3].id, user_id=user1.id, amount=78000, timestamp=now - timedelta(hours=2)),
        Bid(auction_id=auction_objs[5].id, user_id=user2.id, amount=95000, timestamp=now - timedelta(hours=1)),
    ]
    for bid in sample_bids:
        db.session.add(bid)

    db.session.flush()

    # Update current_bid for auctions that have bids
    auction_objs[0].current_bid = 49000
    auction_objs[1].current_bid = 29500
    auction_objs[3].current_bid = 78000
    auction_objs[5].current_bid = 95000

    db.session.commit()
    print('✅ Database seeded successfully.')
