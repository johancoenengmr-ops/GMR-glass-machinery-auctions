from flask import Flask, jsonify, request
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

auctions = [
    {"id": 1, "title": "Glass Machinery Set A", "price": 5000, "status": "active"},
    {"id": 2, "title": "Glass Machinery Set B", "price": 7500, "status": "active"},
]

@app.route('/api/auctions', methods=['GET'])
def get_auctions():
    return jsonify(auctions)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
