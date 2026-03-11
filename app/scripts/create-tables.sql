-- ============================================================
--  Ayala Land Payments Portal — DDL
--  Matches schema defined in app/src/db/schema.ts
--  Generated from Drizzle migration (app/src/db/migrations/0000_early_shard.sql)
--
--  Run via:  cd app && node scripts/create-tables.js
--  Or use Drizzle Kit:  npx drizzle-kit migrate
-- ============================================================

-- Drop all tables in reverse dependency order
DROP TABLE IF EXISTS cash_flow_forecasts CASCADE;
DROP TABLE IF EXISTS payment_patterns CASCADE;
DROP TABLE IF EXISTS credit_risk_scores CASCADE;
DROP TABLE IF EXISTS delinquency_scores CASCADE;
DROP TABLE IF EXISTS payer_segments CASCADE;
DROP TABLE IF EXISTS insight_cards CASCADE;
DROP TABLE IF EXISTS three_way_matches CASCADE;
DROP TABLE IF EXISTS outgoing_payments CASCADE;
DROP TABLE IF EXISTS supplier_invoices CASCADE;
DROP TABLE IF EXISTS goods_receipts CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS escalations CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS qr_codes CASCADE;
DROP TABLE IF EXISTS incoming_payments CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- ─── ACCOUNTS RECEIVABLE ──────────────────────────────────────────────────────

CREATE TABLE customers (
  customer_id      SERIAL PRIMARY KEY,
  account_number   VARCHAR(20)  NOT NULL,
  type             VARCHAR(20)  NOT NULL,               -- TENANT | PROPERTY_MANAGER
  name             VARCHAR(200) NOT NULL,
  contact_person   VARCHAR(200),
  email            VARCHAR(200),
  phone            VARCHAR(20),
  business_type    VARCHAR(100),
  property_name    VARCHAR(200),
  unit_info        VARCHAR(200),
  status           VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at       TIMESTAMP DEFAULT NOW(),
  CONSTRAINT customers_account_number_unique UNIQUE (account_number)
);

CREATE TABLE contracts (
  contract_id      SERIAL PRIMARY KEY,
  customer_id      INTEGER      NOT NULL REFERENCES customers(customer_id),
  contract_number  VARCHAR(30)  NOT NULL,
  type             VARCHAR(20)  NOT NULL,               -- LEASE | CONCESSION | SERVICE
  description      TEXT,
  monthly_amount   NUMERIC(12,2) NOT NULL,
  start_date       DATE         NOT NULL,
  end_date         DATE         NOT NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at       TIMESTAMP DEFAULT NOW(),
  CONSTRAINT contracts_contract_number_unique UNIQUE (contract_number)
);
CREATE INDEX idx_contracts_customer ON contracts(customer_id);

CREATE TABLE invoices (
  invoice_id           SERIAL PRIMARY KEY,
  contract_id          INTEGER       NOT NULL REFERENCES contracts(contract_id),
  customer_id          INTEGER       NOT NULL REFERENCES customers(customer_id),
  invoice_number       VARCHAR(30)   NOT NULL,
  billing_period_start DATE          NOT NULL,
  billing_period_end   DATE          NOT NULL,
  due_date             DATE          NOT NULL,
  amount               NUMERIC(12,2) NOT NULL,
  balance_remaining    NUMERIC(12,2) NOT NULL,
  status               VARCHAR(20)   NOT NULL DEFAULT 'PENDING',  -- PENDING | PAID | PARTIAL | OVERDUE
  issued_at            TIMESTAMP DEFAULT NOW(),
  CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number)
);
CREATE INDEX idx_invoices_customer  ON invoices(customer_id);
CREATE INDEX idx_invoices_contract  ON invoices(contract_id);
CREATE INDEX idx_invoices_status    ON invoices(status);
CREATE INDEX idx_invoices_due_date  ON invoices(due_date);

CREATE TABLE incoming_payments (
  payment_id                SERIAL PRIMARY KEY,
  invoice_id                INTEGER       NOT NULL REFERENCES invoices(invoice_id),
  customer_id               INTEGER       NOT NULL REFERENCES customers(customer_id),
  amount                    NUMERIC(12,2) NOT NULL,
  payment_method            VARCHAR(20)   NOT NULL,  -- BANK_TRANSFER | CHECK | ONLINE | AUTO_DEBIT
  payment_date              TIMESTAMP DEFAULT NOW(),
  stripe_payment_intent_id  VARCHAR(200),
  reference_number          VARCHAR(100),
  status                    VARCHAR(20)   NOT NULL DEFAULT 'PENDING',  -- PENDING | CONFIRMED | FAILED
  confirmed_at              TIMESTAMP
);
CREATE INDEX idx_payments_invoice  ON incoming_payments(invoice_id);
CREATE INDEX idx_payments_customer ON incoming_payments(customer_id);

CREATE TABLE qr_codes (
  qr_id              SERIAL PRIMARY KEY,
  invoice_id         INTEGER       NOT NULL REFERENCES invoices(invoice_id),
  customer_id        INTEGER       NOT NULL REFERENCES customers(customer_id),
  contract_number    VARCHAR(30)   NOT NULL,
  account_identifier VARCHAR(20)   NOT NULL,
  amount             NUMERIC(12,2) NOT NULL,
  encoded_url        TEXT          NOT NULL,
  created_at         TIMESTAMP DEFAULT NOW(),
  expires_at         TIMESTAMP     NOT NULL
);

CREATE TABLE documents (
  document_id        SERIAL PRIMARY KEY,
  customer_id        INTEGER     NOT NULL REFERENCES customers(customer_id),
  invoice_id         INTEGER     REFERENCES invoices(invoice_id),
  payment_id         INTEGER     REFERENCES incoming_payments(payment_id),
  file_url           TEXT        NOT NULL,
  file_name          VARCHAR(200) NOT NULL,
  file_type          VARCHAR(50)  NOT NULL,
  ocr_result         JSONB,
  ocr_status         VARCHAR(20)  NOT NULL DEFAULT 'PENDING',  -- PENDING | PROCESSING | COMPLETED | FAILED
  validation_result  JSONB,
  uploaded_at        TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_documents_customer ON documents(customer_id);

CREATE TABLE escalations (
  escalation_id     SERIAL PRIMARY KEY,
  document_id       INTEGER     NOT NULL REFERENCES documents(document_id),
  customer_id       INTEGER     NOT NULL REFERENCES customers(customer_id),
  invoice_id        INTEGER     REFERENCES invoices(invoice_id),
  type              VARCHAR(30) NOT NULL,    -- INVOICE_DISPUTE | PAYMENT_VERIFICATION | DOCUMENT_MISMATCH | etc.
  description       TEXT        NOT NULL,
  ai_analysis       JSONB,
  status            VARCHAR(20) NOT NULL DEFAULT 'OPEN',  -- OPEN | IN_PROGRESS | RESOLVED | CLOSED
  assigned_to       VARCHAR(200),
  resolution_notes  TEXT,
  created_at        TIMESTAMP DEFAULT NOW(),
  resolved_at       TIMESTAMP
);
CREATE INDEX idx_escalations_status   ON escalations(status);
CREATE INDEX idx_escalations_customer ON escalations(customer_id);

-- ─── ACCOUNTS PAYABLE ─────────────────────────────────────────────────────────

CREATE TABLE suppliers (
  supplier_id    SERIAL PRIMARY KEY,
  name           VARCHAR(200) NOT NULL,
  category       VARCHAR(100) NOT NULL,
  type           VARCHAR(30)  NOT NULL,
  contact_person VARCHAR(200),
  email          VARCHAR(200),
  phone          VARCHAR(20),
  tax_id         VARCHAR(30),
  bank_details   JSONB,
  status         VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE purchase_orders (
  po_id             SERIAL PRIMARY KEY,
  po_number         VARCHAR(30)   NOT NULL,
  supplier_id       INTEGER       NOT NULL REFERENCES suppliers(supplier_id),
  project_name      VARCHAR(200)  NOT NULL,
  description       TEXT,
  total_amount      NUMERIC(12,2) NOT NULL,
  issued_date       DATE          NOT NULL,
  expected_delivery DATE,
  status            VARCHAR(30)   NOT NULL DEFAULT 'OPEN',  -- OPEN | APPROVED | PARTIAL | RECEIVED | CLOSED
  created_at        TIMESTAMP DEFAULT NOW(),
  CONSTRAINT purchase_orders_po_number_unique UNIQUE (po_number)
);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);

CREATE TABLE goods_receipts (
  receipt_id        SERIAL PRIMARY KEY,
  po_id             INTEGER       NOT NULL REFERENCES purchase_orders(po_id),
  supplier_id       INTEGER       NOT NULL REFERENCES suppliers(supplier_id),
  receipt_number    VARCHAR(30)   NOT NULL,
  received_date     DATE          NOT NULL,
  received_by       VARCHAR(200),
  description       TEXT,
  quantity_received NUMERIC(12,2),
  unit              VARCHAR(20),
  amount            NUMERIC(12,2) NOT NULL,
  condition_notes   TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_gr_po ON goods_receipts(po_id);

CREATE TABLE supplier_invoices (
  supplier_invoice_id SERIAL PRIMARY KEY,
  supplier_id         INTEGER       NOT NULL REFERENCES suppliers(supplier_id),
  po_id               INTEGER       NOT NULL REFERENCES purchase_orders(po_id),
  invoice_number      VARCHAR(50)   NOT NULL,
  amount              NUMERIC(12,2) NOT NULL,
  submitted_date      DATE          NOT NULL,
  due_date            DATE          NOT NULL,
  payment_status      VARCHAR(20)   NOT NULL DEFAULT 'UNPAID',  -- UNPAID | PARTIAL | PAID
  amount_paid         NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_date        DATE
);
CREATE INDEX idx_si_supplier ON supplier_invoices(supplier_id);
CREATE INDEX idx_si_po       ON supplier_invoices(po_id);

CREATE TABLE outgoing_payments (
  outgoing_payment_id  SERIAL PRIMARY KEY,
  supplier_invoice_id  INTEGER       NOT NULL REFERENCES supplier_invoices(supplier_invoice_id),
  supplier_id          INTEGER       NOT NULL REFERENCES suppliers(supplier_id),
  amount               NUMERIC(12,2) NOT NULL,
  payment_method       VARCHAR(20)   NOT NULL,  -- BANK_TRANSFER | CHECK | WIRE
  payment_date         TIMESTAMP DEFAULT NOW(),
  reference_number     VARCHAR(100),
  approved_by          VARCHAR(200),
  status               VARCHAR(20)   NOT NULL DEFAULT 'PENDING',  -- PENDING | COMPLETED | FAILED
  created_at           TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_op_supplier_invoice ON outgoing_payments(supplier_invoice_id);

CREATE TABLE three_way_matches (
  match_id            SERIAL PRIMARY KEY,
  po_id               INTEGER       NOT NULL REFERENCES purchase_orders(po_id),
  receipt_id          INTEGER       NOT NULL REFERENCES goods_receipts(receipt_id),
  supplier_invoice_id INTEGER       NOT NULL REFERENCES supplier_invoices(supplier_invoice_id),
  supplier_id         INTEGER       NOT NULL REFERENCES suppliers(supplier_id),
  match_status        VARCHAR(20)   NOT NULL DEFAULT 'PENDING_REVIEW',  -- FULL_MATCH | PARTIAL_MATCH | MISMATCH | PENDING_REVIEW
  po_amount           NUMERIC(12,2) NOT NULL,
  receipt_amount      NUMERIC(12,2) NOT NULL,
  invoice_amount      NUMERIC(12,2) NOT NULL,
  discrepancies       JSONB,
  ai_notes            TEXT,
  reviewed_by         VARCHAR(200),
  reviewed_at         TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_twm_status   ON three_way_matches(match_status);
CREATE INDEX idx_twm_supplier ON three_way_matches(supplier_id);

-- ─── ML OUTPUT TABLES ─────────────────────────────────────────────────────────

CREATE TABLE payer_segments (
  segment_id         SERIAL PRIMARY KEY,
  customer_id        INTEGER       NOT NULL REFERENCES customers(customer_id),
  segment_name       VARCHAR(50)   NOT NULL,  -- CHAMPION | LOYAL | AT_RISK | LAPSED | PROMISING
  regularity_score   NUMERIC(5,2)  NOT NULL,
  amount_score       NUMERIC(5,2)  NOT NULL,
  timeliness_score   NUMERIC(5,2)  NOT NULL,
  cluster_id         INTEGER       NOT NULL,
  scored_at          TIMESTAMP DEFAULT NOW(),
  CONSTRAINT payer_segments_customer_id_unique UNIQUE (customer_id)
);

CREATE TABLE delinquency_scores (
  delinquency_id   SERIAL PRIMARY KEY,
  customer_id      INTEGER       NOT NULL REFERENCES customers(customer_id),
  risk_score       NUMERIC(5,4)  NOT NULL,
  risk_level       VARCHAR(10)   NOT NULL,  -- LOW | MEDIUM | HIGH
  days_overdue_avg NUMERIC(6,1),
  missed_payments  INTEGER DEFAULT 0,
  payment_trend    VARCHAR(20),             -- IMPROVING | STABLE | DETERIORATING
  top_risk_factor  VARCHAR(100),
  scored_at        TIMESTAMP DEFAULT NOW(),
  CONSTRAINT delinquency_scores_customer_id_unique UNIQUE (customer_id)
);
CREATE INDEX idx_delinquency_risk ON delinquency_scores(risk_level);

CREATE TABLE credit_risk_scores (
  credit_risk_id      SERIAL PRIMARY KEY,
  customer_id         INTEGER       NOT NULL REFERENCES customers(customer_id),
  risk_score          NUMERIC(5,4)  NOT NULL,
  risk_level          VARCHAR(10)   NOT NULL,  -- LOW | MEDIUM | HIGH
  outstanding_balance NUMERIC(12,2),
  credit_utilization  NUMERIC(5,2),
  avg_days_overdue    NUMERIC(6,1),
  payment_trend       VARCHAR(20),             -- IMPROVING | STABLE | DETERIORATING
  scored_at           TIMESTAMP DEFAULT NOW(),
  CONSTRAINT credit_risk_scores_customer_id_unique UNIQUE (customer_id)
);
CREATE INDEX idx_credit_risk_level ON credit_risk_scores(risk_level);

CREATE TABLE insight_cards (
  id                  SERIAL PRIMARY KEY,
  severity            VARCHAR(15)  NOT NULL,   -- CRITICAL | HIGH | MEDIUM | LOW | INFO
  title               VARCHAR(200) NOT NULL,
  body                TEXT         NOT NULL,
  action              TEXT,
  related_entity_type VARCHAR(20),             -- INVOICE | CONTRACT | CUSTOMER | PO | null
  related_entity_id   INTEGER,
  related_params      JSONB,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMP DEFAULT NOW(),
  expires_at          TIMESTAMP
);
CREATE INDEX idx_insight_cards_active ON insight_cards(is_active, created_at);

CREATE TABLE cash_flow_forecasts (
  forecast_id       SERIAL PRIMARY KEY,
  forecast_date     DATE          NOT NULL,
  predicted_inflow  NUMERIC(14,2) NOT NULL,
  predicted_outflow NUMERIC(14,2) NOT NULL,
  confidence_lower  NUMERIC(14,2),
  confidence_upper  NUMERIC(14,2),
  based_on_period   VARCHAR(50),
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payment_patterns (
  pattern_id           SERIAL PRIMARY KEY,
  customer_id          INTEGER      NOT NULL REFERENCES customers(customer_id),
  avg_days_to_pay      NUMERIC(6,1),
  preferred_method     VARCHAR(20),
  typical_payment_day  INTEGER,
  partial_payment_rate NUMERIC(5,2),
  scored_at            TIMESTAMP DEFAULT NOW(),
  CONSTRAINT payment_patterns_customer_id_unique UNIQUE (customer_id)
);
