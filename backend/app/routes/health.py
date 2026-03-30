"""
Health Check API Blueprint.
Endpoint:
  GET /api/health - Server health check
"""

from flask import Blueprint, jsonify
from app import db
from datetime import datetime, timezone

health_bp = Blueprint('health', __name__)


@health_bp.route('/health', methods=['GET'])
def health_check():
    """Server health check endpoint."""
    db_status = 'ok'
    try:
        db.session.execute(db.text('SELECT 1'))
    except Exception as e:
        db_status = f'error: {str(e)}'

    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'database': db_status,
        'version': '1.0.0',
    })
