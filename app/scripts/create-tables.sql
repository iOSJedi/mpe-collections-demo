-- ============================================================
--  Ayala Land Payments Portal — DDL
--  Matches schema defined in app/src/db/schema.ts
--  Generated from Drizzle migration (app/src/db/migrations/0000_early_shard.sql)
--
--  Run via:  cd app && node scripts/create-tables.js
--  Or use Drizzle Kit:  npx drizzle-kit migrate
-- ============================================================

-- Drop all tables in reverse dependency order
DROP TABLE IF EXISTS cash_flow_forecasts_col CASCADE;
DROP TABLE IF EXISTS payment_patterns_col CASCADE;
DROP TABLE IF EXISTS credit_risk_scores_col CASCADE;
DROP TABLE IF EXISTS delinquency_scores_col CASCADE;
DROP TABLE IF EXISTS payer_segments_col CASCADE;
DROP TABLE IF EXISTS insight_cards_col CASCADE;
DROP TABLE IF EXISTS three_way_matches_col CASCADE;
DROP TABLE IF EXISTS outgoing_payments_col CASCADE;
DROP TABLE IF EXISTS supplier_invoices_col CASCADE;
DROP TABLE IF EXISTS goods_receipts_col CASCADE;
DROP TABLE IF EXISTS purchase_orders_col CASCADE;
DROP TABLE IF EXISTS suppliers_col CASCADE;
DROP TABLE IF EXISTS escalations_col CASCADE;
DROP TABLE IF EXISTS documents_col CASCADE;
DROP TABLE IF EXISTS qr_codes_col CASCADE;
DROP TABLE IF EXISTS incoming_payments_col CASCADE;
DROP TABLE IF EXISTS invoices_col CASCADE;
DROP TABLE IF EXISTS contracts_col CASCADE;
DROP TABLE IF EXISTS customers_col CASCADE;

-- ─── ACCOUNTS RECEIVABLE ──────────────────────────────────────────────────────

CREATE TABLE customers_col (
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
  CONSTRAINT customers_col_account_number_unique UNIQUE (account_number)
);

CREATE TABLE contracts_col (
  contract_id      SERIAL PRIMARY KEY,
  customer_id      INTEGER      NOT NULL REFERENCES customers_col(customer_id),
  contract_number  VARCHAR(30)  NOT NULL,
  type             VARCHAR(20)  NOT NULL,               -- LEASE | CONCESSION | SERVICE
  description      TEXT,
  monthly_amount   NUMERIC(12,2) NOT NULL,
  start_date       DATE         NOT NULL,
  end_date         DATE         NOT NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at       TIMESTAMP DEFAULT NOW(),
  CONSTRAINT contracts_col_contract_number_unique UNIQUE (contract_number)
);
CREATE INDEX idx_contracts_customer_col ON contracts_col(customer_id);

CREATE TABLE invoices_col (
  invoice_id           SERIAL PRIMARY KEY,
  contract_id          INTEGER       NOT NULL REFERENCES contracts_col(contract_id),
  customer_id          INTEGER       NOT NULL REFERENCES customers_col(customer_id),
  invoice_number       VARCHAR(30)   NOT NULL,
  billing_period_start DATE          NOT NULL,
  billing_period_end   DATE          NOT NULL,
  due_date             DATE          NOT NULL,
  amount               NUMERIC(12,2) NOT NULL,
  balance_remaining    NUMERIC(12,2) NOT NULL,
  status               VARCHAR(20)   NOT NULL DEFAULT 'PENDING',  -- PENDING | PAID | PARTIAL | OVERDUE
  issued_at            TIMESTAMP DEFAULT NOW(),
  CONSTRAINT invoices_col_invoice_number_unique UNIQUE (invoice_number)
);
CREATE INDEX idx_invoices_customer_col  ON invoices_col(customer_id);
CREATE INDEX idx_invoices_contract_col  ON invoices_col(contract_id);
CREATE INDEX idx_invoices_status_col    ON invoices_col(status);
CREATE INDEX idx_invoices_due_date_col  ON invoices_col(due_date);

CREATE TABLE incoming_payments_col (
  payment_id                SERIAL PRIMARY KEY,
  invoice_id                INTEGER       NOT NULL REFERENCES invoices_col(invoice_id),
  customer_id               INTEGER       NOT NULL REFERENCES customers_col(customer_id),
  amount                    NUMERIC(12,2) NOT NULL,
  payment_method            VARCHAR(20)   NOT NULL,  -- BANK_TRANSFER | CHECK | ONLINE | AUTO_DEBIT
  payment_date              TIMESTAMP DEFAULT NOW(),
  stripe_payment_intent_id  VARCHAR(200),
  reference_number          VARCHAR(100),
  status                    VARCHAR(20)   NOT NULL DEFAULT 'PENDING',  -- PENDING | CONFIRMED | FAILED
  confirmed_at              TIMESTAMP
);
CREATE INDEX idx_payments_invoice_col  ON incoming_payments_col(invoice_id);
CREATE INDEX idx_payments_customer_col ON incoming_payments_col(customer_id);

CREATE TABLE qr_codes_col (
  qr_id              SERIAL PRIMARY KEY,
  invoice_id         INTEGER       NOT NULL REFERENCES invoices_col(invoice_id),
  customer_id        INTEGER       NOT NULL REFERENCES customers_col(customer_id),
  contract_number    VARCHAR(30)   NOT NULL,
  account_identifier VARCHAR(20)   NOT NULL,
  amount             NUMERIC(12,2) NOT NULL,
  encoded_url        TEXT          NOT NULL,
  created_at         TIMESTAMP DEFAULT NOW(),
  expires_at         TIMESTAMP     NOT NULL
);

CREATE TABLE documents_col (
  document_id        SERIAL PRIMARY KEY,
  customer_id        INTEGER     NOT NULL REFERENCES customers_col(customer_id),
  invoice_id         INTEGER     REFERENCES invoices_col(invoice_id),
  payment_id         INTEGER     REFERENCES incoming_payments_col(payment_id),
  file_url           TEXT        NOT NULL,
  file_name          VARCHAR(200) NOT NULL,
  file_type          VARCHAR(50)  NOT NULL,
  ocr_result         JSONB,
  ocr_status         VARCHAR(20)  NOT NULL DEFAULT 'PENDING',  -- PENDING | PROCESSING | COMPLETED | FAILED
  validation_result  JSONB,
  uploaded_at        TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_documents_customer_col ON documents_col(customer_id);

CREATE TABLE escalations_col (
  escalation_id     SERIAL PRIMARY KEY,
  document_id       INTEGER     NOT NULL REFERENCES documents_col(document_id),
  customer_id       INTEGER     NOT NULL REFERENCES customers_col(customer_id),
  invoice_id        INTEGER     REFERENCES invoices_col(invoice_id),
  type              VARCHAR(30) NOT NULL,    -- INVOICE_DISPUTE | PAYMENT_VERIFICATION | DOCUMENT_MISMATCH | etc.
  description       TEXT        NOT NULL,
  ai_analysis       JSONB,
  status            VARCHAR(20) NOT NULL DEFAULT 'OPEN',  -- OPEN | IN_PROGRESS | RESOLVED | CLOSED
  assigned_to       VARCHAR(200),
  resolution_notes  TEXT,
  created_at        TIMESTAMP DEFAULT NOW(),
  resolved_at       TIMESTAMP
);
CREATE INDEX idx_escalations_status_col   ON escalations_col(status);
CREATE INDEX idx_escalations_customer_col ON escalations_col(customer_id);

-- ─── ACCOUNTS PAYABLE ─────────────────────────────────────────────────────────

CREATE TABLE suppliers_col (
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

CREATE TABLE purchase_orders_col (
  po_id             SERIAL PRIMARY KEY,
  po_number         VARCHAR(30)   NOT NULL,
  supplier_id       INTEGER       NOT NULL REFERENCES suppliers_col(supplier_id),
  project_name      VARCHAR(200)  NOT NULL,
  description       TEXT,
  total_amount      NUMERIC(12,2) NOT NULL,
  issued_date       DATE          NOT NULL,
  expected_delivery DATE,
  status            VARCHAR(30)   NOT NULL DEFAULT 'OPEN',  -- OPEN | APPROVED | PARTIAL | RECEIVED | CLOSED
  created_at        TIMESTAMP DEFAULT NOW(),
  CONSTRAINT purchase_orders_col_po_number_unique UNIQUE (po_number)
);
CREATE INDEX idx_po_supplier_col ON purchase_orders_col(supplier_id);

CREATE TABLE goods_receipts_col (
  receipt_id        SERIAL PRIMARY KEY,
  po_id             INTEGER       NOT NULL REFERENCES purchase_orders_col(po_id),
  supplier_id       INTEGER       NOT NULL REFERENCES suppliers_col(supplier_id),
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
CREATE INDEX idx_gr_po_col ON goods_receipts_col(po_id);

CREATE TABLE supplier_invoices_col (
  supplier_invoice_id SERIAL PRIMARY KEY,
  supplier_id         INTEGER       NOT NULL REFERENCES suppliers_col(supplier_id),
  po_id               INTEGER       NOT NULL REFERENCES purchase_orders_col(po_id),
  invoice_number      VARCHAR(50)   NOT NULL,
  amount              NUMERIC(12,2) NOT NULL,
  submitted_date      DATE          NOT NULL,
  due_date            DATE          NOT NULL,
  payment_status      VARCHAR(20)   NOT NULL DEFAULT 'UNPAID',  -- UNPAID | PARTIAL | PAID
  amount_paid         NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_date        DATE,
  created_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_si_supplier_col ON supplier_invoices_col(supplier_id);
CREATE INDEX idx_si_po_col       ON supplier_invoices_col(po_id);

CREATE TABLE outgoing_payments_col (
  outgoing_payment_id  SERIAL PRIMARY KEY,
  supplier_invoice_id  INTEGER       NOT NULL REFERENCES supplier_invoices_col(supplier_invoice_id),
  supplier_id          INTEGER       NOT NULL REFERENCES suppliers_col(supplier_id),
  amount               NUMERIC(12,2) NOT NULL,
  payment_method       VARCHAR(20)   NOT NULL,  -- BANK_TRANSFER | CHECK | WIRE
  payment_date         TIMESTAMP DEFAULT NOW(),
  reference_number     VARCHAR(100),
  approved_by          VARCHAR(200),
  status               VARCHAR(20)   NOT NULL DEFAULT 'PENDING',  -- PENDING | COMPLETED | FAILED
  created_at           TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_op_supplier_invoice_col ON outgoing_payments_col(supplier_invoice_id);

CREATE TABLE three_way_matches_col (
  match_id            SERIAL PRIMARY KEY,
  po_id               INTEGER       NOT NULL REFERENCES purchase_orders_col(po_id),
  receipt_id          INTEGER       NOT NULL REFERENCES goods_receipts_col(receipt_id),
  supplier_invoice_id INTEGER       NOT NULL REFERENCES supplier_invoices_col(supplier_invoice_id),
  supplier_id         INTEGER       NOT NULL REFERENCES suppliers_col(supplier_id),
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
CREATE INDEX idx_twm_status_col   ON three_way_matches_col(match_status);
CREATE INDEX idx_twm_supplier_col ON three_way_matches_col(supplier_id);

-- ─── ML OUTPUT TABLES ─────────────────────────────────────────────────────────

CREATE TABLE payer_segments_col (
  segment_id         SERIAL PRIMARY KEY,
  customer_id        INTEGER       NOT NULL REFERENCES customers_col(customer_id),
  segment_name       VARCHAR(50)   NOT NULL,  -- CHAMPION | LOYAL | AT_RISK | LAPSED | PROMISING
  regularity_score   NUMERIC(5,2)  NOT NULL,
  amount_score       NUMERIC(5,2)  NOT NULL,
  timeliness_score   NUMERIC(5,2)  NOT NULL,
  cluster_id         INTEGER       NOT NULL,
  scored_at          TIMESTAMP DEFAULT NOW(),
  CONSTRAINT payer_segments_col_customer_id_unique UNIQUE (customer_id)
);

CREATE TABLE delinquency_scores_col (
  delinquency_id   SERIAL PRIMARY KEY,
  customer_id      INTEGER       NOT NULL REFERENCES customers_col(customer_id),
  risk_score       NUMERIC(5,4)  NOT NULL,
  risk_level       VARCHAR(10)   NOT NULL,  -- LOW | MEDIUM | HIGH
  days_overdue_avg NUMERIC(6,1),
  missed_payments  INTEGER DEFAULT 0,
  payment_trend    VARCHAR(20),             -- IMPROVING | STABLE | DETERIORATING
  top_risk_factor  VARCHAR(100),
  scored_at        TIMESTAMP DEFAULT NOW(),
  CONSTRAINT delinquency_scores_col_customer_id_unique UNIQUE (customer_id)
);
CREATE INDEX idx_delinquency_risk_col ON delinquency_scores_col(risk_level);

CREATE TABLE credit_risk_scores_col (
  credit_risk_id      SERIAL PRIMARY KEY,
  customer_id         INTEGER       NOT NULL REFERENCES customers_col(customer_id),
  risk_score          NUMERIC(5,4)  NOT NULL,
  risk_level          VARCHAR(10)   NOT NULL,  -- LOW | MEDIUM | HIGH
  outstanding_balance NUMERIC(12,2),
  credit_utilization  NUMERIC(5,2),
  avg_days_overdue    NUMERIC(6,1),
  payment_trend       VARCHAR(20),             -- IMPROVING | STABLE | DETERIORATING
  scored_at           TIMESTAMP DEFAULT NOW(),
  CONSTRAINT credit_risk_scores_col_customer_id_unique UNIQUE (customer_id)
);
CREATE INDEX idx_credit_risk_level_col ON credit_risk_scores_col(risk_level);

CREATE TABLE insight_cards_col (
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
CREATE INDEX idx_insight_cards_active_col ON insight_cards_col(is_active, created_at);

CREATE TABLE cash_flow_forecasts_col (
  forecast_id       SERIAL PRIMARY KEY,
  forecast_date     DATE          NOT NULL,
  predicted_inflow  NUMERIC(14,2) NOT NULL,
  predicted_outflow NUMERIC(14,2) NOT NULL,
  confidence_lower  NUMERIC(14,2),
  confidence_upper  NUMERIC(14,2),
  based_on_period   VARCHAR(50),
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payment_patterns_col (
  pattern_id           SERIAL PRIMARY KEY,
  customer_id          INTEGER      NOT NULL REFERENCES customers_col(customer_id),
  avg_days_to_pay      NUMERIC(6,1),
  preferred_method     VARCHAR(20),
  typical_payment_day  INTEGER,
  partial_payment_rate NUMERIC(5,2),
  scored_at            TIMESTAMP DEFAULT NOW(),
  CONSTRAINT payment_patterns_col_customer_id_unique UNIQUE (customer_id)
);
