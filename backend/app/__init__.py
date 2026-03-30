"""
ODMS Backend - Intelligent Order and Delivery Management System
Flask application factory module.
"""

import os

from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager, verify_jwt_in_request
from flask_cors import CORS
from .config import config_by_name

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()


def create_app(config_name='development'):
    """Application factory pattern for Flask app."""
    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    # Ensure testing DB override is applied early so SQLAlchemy binds correctly
    if config_name == 'testing' or os.environ.get('TESTING') == 'True':
        test_db = os.environ.get('TEST_DATABASE_URL') or 'sqlite:///:memory:'
        app.config['SQLALCHEMY_DATABASE_URI'] = test_db

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    # CORS setup
    # Reads from CORS_ORIGINS env var (comma-separated) but always includes
    # localhost and Vercel domains as a hardcoded safety net
    cors_origins = app.config.get('CORS_ORIGINS', '*')
    if isinstance(cors_origins, str) and cors_origins != '*':
        cors_origins = [o.strip() for o in cors_origins.split(',')]

    # Always include these regardless of env var
    always_allowed = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://intelligent-order-delivery-management-system-4jk3cf9fj.vercel.app",
        "https://*.vercel.app",
    ]

    if isinstance(cors_origins, list):
        # Merge, deduplicate
        cors_origins = list(set(cors_origins + always_allowed))
    else:
        # cors_origins was '*' — keep it as wildcard
        cors_origins = '*'

    CORS(app,
         resources={r"/api/*": {"origins": cors_origins}},
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization"],
         methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])

    # Register blueprints
    from .routes.orders import orders_bp
    from .routes.drivers import drivers_bp
    from .routes.heatmap import heatmap_bp
    from .routes.routes_api import routes_bp
    from .routes.analytics import analytics_bp
    from .routes.settings import settings_bp
    from .routes.health import health_bp
    from .routes.restaurant_api import restaurant_bp, public_restaurants_bp
    from .routes.auth import auth_bp
    from .routes.geocode import geocode_bp
    from .routes.driver_me import driver_me_bp
    from .routes.affiliation import affiliation_bp

    app.register_blueprint(orders_bp, url_prefix='/api/orders')
    app.register_blueprint(drivers_bp, url_prefix='/api/drivers')
    app.register_blueprint(heatmap_bp, url_prefix='/api/heatmap')
    app.register_blueprint(routes_bp, url_prefix='/api/routes')
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')
    app.register_blueprint(health_bp, url_prefix='/api')
    app.register_blueprint(restaurant_bp, url_prefix='/api/restaurant')
    app.register_blueprint(public_restaurants_bp, url_prefix='/api/restaurants')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(geocode_bp, url_prefix='/api')
    app.register_blueprint(driver_me_bp, url_prefix='/api/driver')
    app.register_blueprint(affiliation_bp, url_prefix='/api/affiliation')

    @app.before_request
    def _enforce_api_authentication():
        if app.config.get('TESTING'):
            return None
        if request.method == 'OPTIONS':
            return None

        path = request.path or ''
        if not path.startswith('/api'):
            return None
        if path.startswith('/api/health') or path.startswith('/api/auth') or path.startswith('/api/geocode'):
            return None

        verify_jwt_in_request()
        return None

    # Register error handlers
    from .utils.error_handlers import register_error_handlers
    register_error_handlers(app)

    should_restore_lifecycles = not app.debug or os.environ.get('WERKZEUG_RUN_MAIN') == 'true'
    if not app.config.get('TESTING') and should_restore_lifecycles:
        from .services.order_lifecycle import restore_active_lifecycles
        restore_active_lifecycles(app)

    return app
