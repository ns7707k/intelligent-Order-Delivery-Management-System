# ODMS Backend

**Intelligent Order and Delivery Management System** - Python Flask API Server

## Technology Stack

- **Flask** - API Server
- **SQLAlchemy** - ORM with PostgreSQL
- **Google OR-Tools** - Vehicle Routing Problem (VRP) Solver
- **Flask-Migrate** - Database migrations (Alembic)
- **Pandas** - ETL data processing

## Quick Start

### 1. Prerequisites

- Python 3.10+
- PostgreSQL 14+

### 2. Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Database Setup

```bash
# Create PostgreSQL database
psql -U postgres -c "CREATE DATABASE odms_dev;"

# Initialize tables
cd ..
python database/init_db.py init

# Seed demo data
python database/seed.py
```

### 4. Run the Server

```bash
cd backend
python run.py
```

Server starts at: **http://localhost:5000**

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| **GET** | `/api/health` | Health check |
| **GET** | `/api/orders` | List all orders |
| **GET** | `/api/orders/<id>` | Get order by ID |
| **POST** | `/api/orders` | Create new order |
| **PATCH** | `/api/orders/<id>` | Update order status |
| **GET** | `/api/drivers` | List all drivers |
| **GET** | `/api/drivers/available` | Get available drivers |
| **GET** | `/api/drivers/<id>` | Get driver details |
| **POST** | `/api/drivers` | Create new driver |
| **PUT** | `/api/drivers/<id>` | Update driver |
| **GET** | `/api/heatmap/live` | Live order heatmap data |
| **GET** | `/api/heatmap/predictive` | Predictive heatmap data |
| **POST** | `/api/routes/optimize` | Trigger route optimization |
| **GET** | `/api/routes/active` | Get active routes |
| **GET** | `/api/analytics/summary` | Analytics dashboard data |
| **GET** | `/api/settings` | Get all settings |
| **PUT** | `/api/settings` | Update settings |

## Environment Variables

Copy `.env.example` to `.env` and configure:

```
DATABASE_URL=postgresql://postgres.<project-ref>:<url-encoded-password>@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?sslmode=require
SECRET_KEY=your-secret-key
CORS_ORIGINS=http://localhost:5173
```

### Supabase Setup

1. In Supabase SQL Editor, run `database/supabase/schema.sql`.
2. Set `DATABASE_URL` in `backend/.env` using your Supabase pooler URI.
3. URL-encode special characters in password (for example `@` becomes `%40`).

## ETL Pipeline

```bash
# Process Amazon dataset
python data_pipeline/etl_pipeline.py path/to/amazon_dataset.csv

# Replay historical orders
python data_pipeline/replay_engine.py --count 30 --speed 10
```

## Route Optimization

The system uses Google OR-Tools to solve the Vehicle Routing Problem:
- **First Solution Strategy**: Path Cheapest Arc
- **Metaheuristic**: Guided Local Search (GLS)
- **Trigger**: Automatically when an order status changes to "Ready"
- **Assignment Logic**: Closest driver to the food waiting the longest

## Testing

```bash
cd backend
pytest tests/ -v --cov=app
```
