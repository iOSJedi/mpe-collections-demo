CREATE TABLE "cash_flow_forecasts" (
	"forecast_id" serial PRIMARY KEY NOT NULL,
	"forecast_date" date NOT NULL,
	"predicted_inflow" numeric(14, 2) NOT NULL,
	"predicted_outflow" numeric(14, 2) NOT NULL,
	"confidence_lower" numeric(14, 2),
	"confidence_upper" numeric(14, 2),
	"based_on_period" varchar(50),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"contract_id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"contract_number" varchar(30) NOT NULL,
	"type" varchar(20) NOT NULL,
	"description" text,
	"monthly_amount" numeric(12, 2) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "contracts_contract_number_unique" UNIQUE("contract_number")
);
--> statement-breakpoint
CREATE TABLE "credit_risk_scores" (
	"credit_risk_id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"risk_score" numeric(5, 4) NOT NULL,
	"risk_level" varchar(10) NOT NULL,
	"outstanding_balance" numeric(12, 2),
	"credit_utilization" numeric(5, 2),
	"avg_days_overdue" numeric(6, 1),
	"payment_trend" varchar(20),
	"scored_at" timestamp DEFAULT now(),
	CONSTRAINT "credit_risk_scores_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"customer_id" serial PRIMARY KEY NOT NULL,
	"account_number" varchar(20) NOT NULL,
	"type" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"contact_person" varchar(200),
	"email" varchar(200),
	"phone" varchar(20),
	"business_type" varchar(100),
	"property_name" varchar(200),
	"unit_info" varchar(200),
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "customers_account_number_unique" UNIQUE("account_number")
);
--> statement-breakpoint
CREATE TABLE "delinquency_scores" (
	"delinquency_id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"risk_score" numeric(5, 4) NOT NULL,
	"risk_level" varchar(10) NOT NULL,
	"days_overdue_avg" numeric(6, 1),
	"missed_payments" integer DEFAULT 0,
	"payment_trend" varchar(20),
	"top_risk_factor" varchar(100),
	"scored_at" timestamp DEFAULT now(),
	CONSTRAINT "delinquency_scores_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"document_id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"invoice_id" integer,
	"payment_id" integer,
	"file_url" text NOT NULL,
	"file_name" varchar(200) NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"ocr_result" jsonb,
	"ocr_status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"validation_result" jsonb,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"escalation_id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"invoice_id" integer,
	"type" varchar(30) NOT NULL,
	"description" text NOT NULL,
	"ai_analysis" jsonb,
	"status" varchar(20) DEFAULT 'OPEN' NOT NULL,
	"assigned_to" varchar(200),
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "goods_receipts" (
	"receipt_id" serial PRIMARY KEY NOT NULL,
	"po_id" integer NOT NULL,
	"supplier_id" integer NOT NULL,
	"receipt_number" varchar(30) NOT NULL,
	"received_date" date NOT NULL,
	"received_by" varchar(200),
	"description" text,
	"quantity_received" numeric(12, 2),
	"unit" varchar(20),
	"amount" numeric(12, 2) NOT NULL,
	"condition_notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "incoming_payments" (
	"payment_id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" varchar(20) NOT NULL,
	"payment_date" timestamp DEFAULT now(),
	"stripe_payment_intent_id" varchar(200),
	"reference_number" varchar(100),
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"confirmed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "insight_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"severity" varchar(15) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"action" text,
	"related_entity_type" varchar(20),
	"related_entity_id" integer,
	"related_params" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"invoice_id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"invoice_number" varchar(30) NOT NULL,
	"billing_period_start" date NOT NULL,
	"billing_period_end" date NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"balance_remaining" numeric(12, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"issued_at" timestamp DEFAULT now(),
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "outgoing_payments" (
	"outgoing_payment_id" serial PRIMARY KEY NOT NULL,
	"supplier_invoice_id" integer NOT NULL,
	"supplier_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" varchar(20) NOT NULL,
	"payment_date" timestamp DEFAULT now(),
	"reference_number" varchar(100),
	"approved_by" varchar(200),
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payer_segments" (
	"segment_id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"segment_name" varchar(50) NOT NULL,
	"regularity_score" numeric(5, 2) NOT NULL,
	"amount_score" numeric(5, 2) NOT NULL,
	"timeliness_score" numeric(5, 2) NOT NULL,
	"cluster_id" integer NOT NULL,
	"scored_at" timestamp DEFAULT now(),
	CONSTRAINT "payer_segments_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "payment_patterns" (
	"pattern_id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"avg_days_to_pay" numeric(6, 1),
	"preferred_method" varchar(20),
	"typical_payment_day" integer,
	"partial_payment_rate" numeric(5, 2),
	"scored_at" timestamp DEFAULT now(),
	CONSTRAINT "payment_patterns_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"po_id" serial PRIMARY KEY NOT NULL,
	"po_number" varchar(30) NOT NULL,
	"supplier_id" integer NOT NULL,
	"project_name" varchar(200) NOT NULL,
	"description" text,
	"total_amount" numeric(12, 2) NOT NULL,
	"issued_date" date NOT NULL,
	"expected_delivery" date,
	"status" varchar(30) DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "qr_codes" (
	"qr_id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"contract_number" varchar(30) NOT NULL,
	"account_identifier" varchar(20) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"encoded_url" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_invoices" (
	"supplier_invoice_id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"po_id" integer NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"submitted_date" date NOT NULL,
	"due_date" date NOT NULL,
	"payment_status" varchar(20) DEFAULT 'UNPAID' NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"payment_date" date,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"supplier_id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(100) NOT NULL,
	"type" varchar(30) NOT NULL,
	"contact_person" varchar(200),
	"email" varchar(200),
	"phone" varchar(20),
	"tax_id" varchar(30),
	"bank_details" jsonb,
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "three_way_matches" (
	"match_id" serial PRIMARY KEY NOT NULL,
	"po_id" integer NOT NULL,
	"receipt_id" integer NOT NULL,
	"supplier_invoice_id" integer NOT NULL,
	"supplier_id" integer NOT NULL,
	"match_status" varchar(20) DEFAULT 'PENDING_REVIEW' NOT NULL,
	"po_amount" numeric(12, 2) NOT NULL,
	"receipt_amount" numeric(12, 2) NOT NULL,
	"invoice_amount" numeric(12, 2) NOT NULL,
	"discrepancies" jsonb,
	"ai_notes" text,
	"reviewed_by" varchar(200),
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_risk_scores" ADD CONSTRAINT "credit_risk_scores_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delinquency_scores" ADD CONSTRAINT "delinquency_scores_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_invoice_id_invoices_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("invoice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_payment_id_incoming_payments_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."incoming_payments"("payment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_document_id_documents_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("document_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_invoice_id_invoices_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("invoice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_po_id_purchase_orders_po_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("po_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_suppliers_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("supplier_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incoming_payments" ADD CONSTRAINT "incoming_payments_invoice_id_invoices_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("invoice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incoming_payments" ADD CONSTRAINT "incoming_payments_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_id_contracts_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("contract_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outgoing_payments" ADD CONSTRAINT "outgoing_payments_supplier_invoice_id_supplier_invoices_supplier_invoice_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("supplier_invoice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outgoing_payments" ADD CONSTRAINT "outgoing_payments_supplier_id_suppliers_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("supplier_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payer_segments" ADD CONSTRAINT "payer_segments_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_patterns" ADD CONSTRAINT "payment_patterns_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("supplier_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_invoice_id_invoices_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("invoice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_suppliers_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("supplier_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_po_id_purchase_orders_po_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("po_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "three_way_matches" ADD CONSTRAINT "three_way_matches_po_id_purchase_orders_po_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("po_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "three_way_matches" ADD CONSTRAINT "three_way_matches_receipt_id_goods_receipts_receipt_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."goods_receipts"("receipt_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "three_way_matches" ADD CONSTRAINT "three_way_matches_supplier_invoice_id_supplier_invoices_supplier_invoice_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("supplier_invoice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "three_way_matches" ADD CONSTRAINT "three_way_matches_supplier_id_suppliers_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("supplier_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_contracts_customer" ON "contracts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_credit_risk_level" ON "credit_risk_scores" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "idx_delinquency_risk" ON "delinquency_scores" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "idx_documents_customer" ON "documents" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_escalations_status" ON "escalations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_escalations_customer" ON "escalations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_gr_po" ON "goods_receipts" USING btree ("po_id");--> statement-breakpoint
CREATE INDEX "idx_payments_invoice" ON "incoming_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_payments_customer" ON "incoming_payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_insight_cards_active" ON "insight_cards" USING btree ("is_active","created_at");--> statement-breakpoint
CREATE INDEX "idx_invoices_customer" ON "invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_contract" ON "invoices" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invoices_due_date" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_op_supplier_invoice" ON "outgoing_payments" USING btree ("supplier_invoice_id");--> statement-breakpoint
CREATE INDEX "idx_po_supplier" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_si_supplier" ON "supplier_invoices" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_si_po" ON "supplier_invoices" USING btree ("po_id");--> statement-breakpoint
CREATE INDEX "idx_twm_status" ON "three_way_matches" USING btree ("match_status");--> statement-breakpoint
CREATE INDEX "idx_twm_supplier" ON "three_way_matches" USING btree ("supplier_id");