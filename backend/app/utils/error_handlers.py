"""
Global error handlers for the Flask application.
Provides consistent JSON error responses for all endpoints.
"""

from flask import jsonify
from werkzeug.exceptions import HTTPException


def register_error_handlers(app):
    """Register error handlers on the Flask app."""

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            'error': 'Bad Request',
            'message': str(error.description) if hasattr(error, 'description') else 'Invalid request',
        }), 400

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'error': 'Not Found',
            'message': str(error.description) if hasattr(error, 'description') else 'Resource not found',
        }), 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({
            'error': 'Method Not Allowed',
            'message': 'The request method is not allowed for this endpoint',
        }), 405

    @app.errorhandler(422)
    def unprocessable_entity(error):
        return jsonify({
            'error': 'Unprocessable Entity',
            'message': str(error.description) if hasattr(error, 'description') else 'Invalid data',
        }), 422

    @app.errorhandler(500)
    def internal_server_error(error):
        return jsonify({
            'error': 'Internal Server Error',
            'message': 'An unexpected error occurred. Please try again.',
        }), 500

    @app.errorhandler(HTTPException)
    def handle_http_exception(error):
        return jsonify({
            'error': error.name,
            'message': error.description,
        }), error.code

    @app.errorhandler(Exception)
    def handle_generic_exception(error):
        app.logger.error(f'Unhandled exception: {error}', exc_info=True)
        return jsonify({
            'error': 'Internal Server Error',
            'message': 'An unexpected error occurred.',
        }), 500
