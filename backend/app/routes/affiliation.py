from flask import Blueprint, request, jsonify
from app import db
from app.models.affiliation_request import AffiliationRequest
from app.models.driver import Driver
from flask_jwt_extended import jwt_required
from app.utils.auth import require_role, get_current_driver_id, get_current_restaurant_id
from datetime import datetime, timezone

affiliation_bp = Blueprint('affiliation', __name__)


@affiliation_bp.route('/apply', methods=['POST'])
@jwt_required()
@require_role('driver')
def apply_affiliation():
    driver_id = get_current_driver_id()
    data = request.get_json() or {}
    restaurant_id = data.get('restaurant_id')
    if not restaurant_id:
        return jsonify({'error': 'restaurant_id required'}), 400
    # Prevent duplicate pending requests
    existing = AffiliationRequest.query.filter_by(
        driver_id=driver_id, restaurant_id=restaurant_id, status='pending'
    ).first()
    if existing:
        return jsonify({'error': 'Already applied and pending'}), 409
    req = AffiliationRequest(driver_id=driver_id, restaurant_id=restaurant_id, status='pending')
    db.session.add(req)
    db.session.commit()
    return jsonify(req.to_dict()), 201


@affiliation_bp.route('/my-requests', methods=['GET'])
@jwt_required()
@require_role('driver')
def my_affiliation_requests():
    driver_id = get_current_driver_id()
    reqs = AffiliationRequest.query.filter_by(driver_id=driver_id).order_by(
        AffiliationRequest.created_at.desc()
    ).all()
    return jsonify([r.to_dict() for r in reqs])


@affiliation_bp.route('/restaurant/requests', methods=['GET'])
@jwt_required()
@require_role('restaurant_admin')
def restaurant_affiliation_requests():
    restaurant_id = get_current_restaurant_id()
    reqs = AffiliationRequest.query.filter_by(
        restaurant_id=restaurant_id, status='pending'
    ).order_by(AffiliationRequest.created_at.desc()).all()
    return jsonify([r.to_dict() for r in reqs])


@affiliation_bp.route('/restaurant/requests/<int:req_id>/approve', methods=['POST'])
@jwt_required()
@require_role('restaurant_admin')
def approve_affiliation(req_id):
    restaurant_id = get_current_restaurant_id()
    req = AffiliationRequest.query.filter_by(
        id=req_id, restaurant_id=restaurant_id, status='pending'
    ).first_or_404()
    req.status = 'approved'
    req.updated_at = datetime.now(timezone.utc)
    driver = Driver.query.get(req.driver_id)
    if driver:
        driver.restaurant_id = restaurant_id
    db.session.commit()
    return jsonify(req.to_dict())


@affiliation_bp.route('/restaurant/requests/<int:req_id>/reject', methods=['POST'])
@jwt_required()
@require_role('restaurant_admin')
def reject_affiliation(req_id):
    restaurant_id = get_current_restaurant_id()
    req = AffiliationRequest.query.filter_by(
        id=req_id, restaurant_id=restaurant_id, status='pending'
    ).first_or_404()
    req.status = 'rejected'
    req.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(req.to_dict())
