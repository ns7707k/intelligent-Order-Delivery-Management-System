"""
Application configuration classes for different environments.
"""

import os
from datetime import timedelta
from dotenv import load_dotenv


BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
load_dotenv(os.path.join(BACKEND_DIR, '.env'))


class Config:
    """Base configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'odms-secret-key-change-in-production')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False
    JSON_SORT_KEYS = False
    CORS_ORIGINS = os.environ.get(
        'CORS_ORIGINS',
        'http://localhost:5173,http://localhost:3000,http://localhost:3001,http://localhost:3002'
    )
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'dev-secret-change-in-prod')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=12)

    # OR-Tools configuration
    ORTOOLS_TIME_LIMIT_SECONDS = int(os.environ.get('ORTOOLS_TIME_LIMIT_SECONDS', 5))
    ORTOOLS_FIRST_SOLUTION_STRATEGY = 'PATH_CHEAPEST_ARC'
    ORTOOLS_METAHEURISTIC = 'GUIDED_LOCAL_SEARCH'

    # VRP constraints
    MAX_DELIVERY_RADIUS_KM = float(os.environ.get('MAX_DELIVERY_RADIUS_KM', 15.0))
    VEHICLE_CAPACITY = int(os.environ.get('VEHICLE_CAPACITY', 5))
    SLA_MAX_DELIVERY_MINUTES = int(os.environ.get('SLA_MAX_DELIVERY_MINUTES', 45))

    # Voice confidence threshold
    VOICE_CONFIDENCE_THRESHOLD = float(os.environ.get('VOICE_CONFIDENCE_THRESHOLD', 0.8))

    # Pagination defaults
    DEFAULT_PAGE_SIZE = 20
    MAX_PAGE_SIZE = 100


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'sqlite:///odms_dev.db'
    )
    SQLALCHEMY_ECHO = False


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'TEST_DATABASE_URL',
        'sqlite:///odms_test.db'
    )


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')

    @classmethod
    def init_app(cls, app):
        Config.init_app(app)


config_by_name = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}
