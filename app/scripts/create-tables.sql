-- Drop tables if they exist (reverse dependency order)
DROP TABLE IF EXISTS insight_cards CASCADE;
DROP TABLE IF EXISTS demand_forecasts CASCADE;
DROP TABLE IF EXISTS product_associations CASCADE;
DROP TABLE IF EXISTS credit_risk_scores CASCADE;
DROP TABLE IF EXISTS churn_scores CASCADE;
DROP TABLE IF EXISTS customer_segments CASCADE;
DROP TABLE IF EXISTS wholesale_payments CASCADE;
DROP TABLE IF EXISTS transaction_items CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS branches CASCADE;

-- Core tables
CREATE TABLE branches (
  branch_id VARCHAR(10) PRIMARY KEY,
  branch_name VARCHAR(100) NOT NULL,
  address VARCHAR(300),
  municipality VARCHAR(100) NOT NULL,
  province VARCHAR(100) NOT NULL DEFAULT 'Batangas',
  opening_date DATE,
  floor_area_sqm INTEGER,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE products (
  product_id VARCHAR(20) PRIMARY KEY,
  product_name VARCHAR(200) NOT NULL,
  brand VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  department VARCHAR(50) NOT NULL,
  retail_price DECIMAL(8,2) NOT NULL,
  wholesale_price DECIMAL(8,2) NOT NULL,
  supplier VARCHAR(200),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE customers (
  customer_id VARCHAR(20) PRIMARY KEY,
  customer_type VARCHAR(10) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(200),
  loyalty_card_number VARCHAR(20),
  wholesale_member_id VARCHAR(20),
  business_name VARCHAR(200),
  barangay VARCHAR(100),
  municipality VARCHAR(100),
  registration_date DATE NOT NULL,
  credit_limit DECIMAL(10,2),
  credit_terms_days INTEGER,
  status VARCHAR(10) NOT NULL DEFAULT 'active'
);

CREATE TABLE transactions (
  transaction_id VARCHAR(30) PRIMARY KEY,
  customer_id VARCHAR(20) REFERENCES customers(customer_id),
  branch_id VARCHAR(10) NOT NULL REFERENCES branches(branch_id),
  transaction_date TIMESTAMP NOT NULL,
  transaction_type VARCHAR(10) NOT NULL,
  payment_method VARCHAR(10) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  items_count INTEGER NOT NULL,
  loyalty_points_earned INTEGER DEFAULT 0
);
CREATE INDEX idx_transactions_customer ON transactions(customer_id);
CREATE INDEX idx_transactions_branch ON transactions(branch_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);

CREATE TABLE transaction_items (
  item_id BIGSERIAL PRIMARY KEY,
  transaction_id VARCHAR(30) NOT NULL REFERENCES transactions(transaction_id),
  product_id VARCHAR(20) NOT NULL REFERENCES products(product_id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(8,2) NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,
  is_wholesale_price BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_transaction_items_txn ON transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_product ON transaction_items(product_id);

CREATE TABLE wholesale_payments (
  payment_id VARCHAR(20) PRIMARY KEY,
  customer_id VARCHAR(20) NOT NULL REFERENCES customers(customer_id),
  amount_paid DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  days_overdue INTEGER DEFAULT 0,
  outstanding_balance DECIMAL(10,2) NOT NULL
);
CREATE INDEX idx_wholesale_payments_customer ON wholesale_payments(customer_id);

-- ML output tables
CREATE TABLE customer_segments (
  customer_id VARCHAR(20) PRIMARY KEY REFERENCES customers(customer_id),
  segment_name VARCHAR(50) NOT NULL,
  rfm_recency INTEGER NOT NULL,
  rfm_frequency INTEGER NOT NULL,
  rfm_monetary DECIMAL(10,2) NOT NULL,
  r_score INTEGER NOT NULL,
  f_score INTEGER NOT NULL,
  m_score INTEGER NOT NULL,
  cluster_id INTEGER NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE churn_scores (
  customer_id VARCHAR(20) PRIMARY KEY REFERENCES customers(customer_id),
  churn_probability DECIMAL(5,4) NOT NULL,
  risk_level VARCHAR(10) NOT NULL,
  days_since_last INTEGER NOT NULL,
  frequency_change DECIMAL(5,2),
  basket_change DECIMAL(5,2),
  top_risk_factor VARCHAR(100),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_churn_scores_risk ON churn_scores(risk_level);

CREATE TABLE credit_risk_scores (
  customer_id VARCHAR(20) PRIMARY KEY REFERENCES customers(customer_id),
  risk_score DECIMAL(5,4) NOT NULL,
  risk_level VARCHAR(10) NOT NULL,
  outstanding_balance DECIMAL(10,2),
  credit_utilization DECIMAL(5,2),
  avg_days_overdue DECIMAL(5,1),
  payment_trend VARCHAR(20),
  top_risk_factor VARCHAR(100),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_credit_risk_scores_risk ON credit_risk_scores(risk_level);

CREATE TABLE product_associations (
  id SERIAL PRIMARY KEY,
  product_a_id VARCHAR(20) NOT NULL REFERENCES products(product_id),
  product_b_id VARCHAR(20) NOT NULL REFERENCES products(product_id),
  support DECIMAL(6,4) NOT NULL,
  confidence_a_to_b DECIMAL(6,4) NOT NULL,
  confidence_b_to_a DECIMAL(6,4) NOT NULL,
  lift DECIMAL(8,4) NOT NULL,
  transaction_type VARCHAR(10) NOT NULL,
  branch_id VARCHAR(10),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (product_a_id, product_b_id, transaction_type, branch_id)
);
CREATE INDEX idx_product_associations_products ON product_associations(product_a_id, product_b_id);

CREATE TABLE demand_forecasts (
  id SERIAL PRIMARY KEY,
  product_id VARCHAR(20) REFERENCES products(product_id),
  category VARCHAR(100),
  branch_id VARCHAR(10) REFERENCES branches(branch_id),
  forecast_date DATE NOT NULL,
  predicted_quantity DECIMAL(10,2) NOT NULL,
  lower_bound DECIMAL(10,2),
  upper_bound DECIMAL(10,2),
  based_on_period VARCHAR(50),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE insight_cards (
  id SERIAL PRIMARY KEY,
  severity VARCHAR(15) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  action TEXT,
  related_intent VARCHAR(50),
  related_params JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);
CREATE INDEX idx_insight_cards_active ON insight_cards(is_active, created_at);
