import {
  pgTable,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  date,
  timestamp,
  serial,
  bigserial,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core'

// ─── CORE TABLES ─────────────────────────────────────────────

export const branches = pgTable('branches', {
  branchId: varchar('branch_id', { length: 10 }).primaryKey(),
  branchName: varchar('branch_name', { length: 100 }).notNull(),
  address: varchar('address', { length: 300 }),
  municipality: varchar('municipality', { length: 100 }).notNull(),
  province: varchar('province', { length: 100 }).notNull().default('Batangas'),
  openingDate: date('opening_date'),
  floorAreaSqm: integer('floor_area_sqm'),
  isActive: boolean('is_active').default(true),
})

export const products = pgTable('products', {
  productId: varchar('product_id', { length: 20 }).primaryKey(),
  productName: varchar('product_name', { length: 200 }).notNull(),
  brand: varchar('brand', { length: 100 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  subcategory: varchar('subcategory', { length: 100 }),
  department: varchar('department', { length: 50 }).notNull(),
  retailPrice: decimal('retail_price', { precision: 8, scale: 2 }).notNull(),
  wholesalePrice: decimal('wholesale_price', { precision: 8, scale: 2 }).notNull(),
  supplier: varchar('supplier', { length: 200 }),
  isActive: boolean('is_active').default(true),
})

export const customers = pgTable('customers', {
  customerId: varchar('customer_id', { length: 20 }).primaryKey(),
  customerType: varchar('customer_type', { length: 10 }).notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 200 }),
  loyaltyCardNumber: varchar('loyalty_card_number', { length: 20 }),
  wholesaleMemberId: varchar('wholesale_member_id', { length: 20 }),
  businessName: varchar('business_name', { length: 200 }),
  barangay: varchar('barangay', { length: 100 }),
  municipality: varchar('municipality', { length: 100 }),
  registrationDate: date('registration_date').notNull(),
  creditLimit: decimal('credit_limit', { precision: 10, scale: 2 }),
  creditTermsDays: integer('credit_terms_days'),
  status: varchar('status', { length: 10 }).notNull().default('active'),
})

export const transactions = pgTable(
  'transactions',
  {
    transactionId: varchar('transaction_id', { length: 30 }).primaryKey(),
    customerId: varchar('customer_id', { length: 20 }).references(() => customers.customerId),
    branchId: varchar('branch_id', { length: 10 })
      .notNull()
      .references(() => branches.branchId),
    transactionDate: timestamp('transaction_date').notNull(),
    transactionType: varchar('transaction_type', { length: 10 }).notNull(),
    paymentMethod: varchar('payment_method', { length: 10 }).notNull(),
    totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
    itemsCount: integer('items_count').notNull(),
    loyaltyPointsEarned: integer('loyalty_points_earned').default(0),
  },
  (table) => [
    index('idx_transactions_customer').on(table.customerId),
    index('idx_transactions_branch').on(table.branchId),
    index('idx_transactions_date').on(table.transactionDate),
    index('idx_transactions_type').on(table.transactionType),
  ],
)

export const transactionItems = pgTable(
  'transaction_items',
  {
    itemId: bigserial('item_id', { mode: 'number' }).primaryKey(),
    transactionId: varchar('transaction_id', { length: 30 })
      .notNull()
      .references(() => transactions.transactionId),
    productId: varchar('product_id', { length: 20 })
      .notNull()
      .references(() => products.productId),
    quantity: integer('quantity').notNull(),
    unitPrice: decimal('unit_price', { precision: 8, scale: 2 }).notNull(),
    lineTotal: decimal('line_total', { precision: 10, scale: 2 }).notNull(),
    isWholesalePrice: boolean('is_wholesale_price').default(false),
  },
  (table) => [
    index('idx_transaction_items_txn').on(table.transactionId),
    index('idx_transaction_items_product').on(table.productId),
  ],
)

export const wholesalePayments = pgTable(
  'wholesale_payments',
  {
    paymentId: varchar('payment_id', { length: 20 }).primaryKey(),
    customerId: varchar('customer_id', { length: 20 })
      .notNull()
      .references(() => customers.customerId),
    amountPaid: decimal('amount_paid', { precision: 10, scale: 2 }).notNull(),
    paymentDate: date('payment_date').notNull(),
    daysOverdue: integer('days_overdue').default(0),
    outstandingBalance: decimal('outstanding_balance', { precision: 10, scale: 2 }).notNull(),
  },
  (table) => [
    index('idx_wholesale_payments_customer').on(table.customerId),
  ],
)

// ─── ML OUTPUT TABLES ────────────────────────────────────────

export const customerSegments = pgTable('customer_segments', {
  customerId: varchar('customer_id', { length: 20 })
    .primaryKey()
    .references(() => customers.customerId),
  segmentName: varchar('segment_name', { length: 50 }).notNull(),
  rfmRecency: integer('rfm_recency').notNull(),
  rfmFrequency: integer('rfm_frequency').notNull(),
  rfmMonetary: decimal('rfm_monetary', { precision: 10, scale: 2 }).notNull(),
  rScore: integer('r_score').notNull(),
  fScore: integer('f_score').notNull(),
  mScore: integer('m_score').notNull(),
  clusterId: integer('cluster_id').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const churnScores = pgTable(
  'churn_scores',
  {
    customerId: varchar('customer_id', { length: 20 })
      .primaryKey()
      .references(() => customers.customerId),
    churnProbability: decimal('churn_probability', { precision: 5, scale: 4 }).notNull(),
    riskLevel: varchar('risk_level', { length: 10 }).notNull(),
    daysSinceLast: integer('days_since_last').notNull(),
    frequencyChange: decimal('frequency_change', { precision: 5, scale: 2 }),
    basketChange: decimal('basket_change', { precision: 5, scale: 2 }),
    topRiskFactor: varchar('top_risk_factor', { length: 100 }),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_churn_scores_risk').on(table.riskLevel),
  ],
)

export const creditRiskScores = pgTable(
  'credit_risk_scores',
  {
    customerId: varchar('customer_id', { length: 20 })
      .primaryKey()
      .references(() => customers.customerId),
    riskScore: decimal('risk_score', { precision: 5, scale: 4 }).notNull(),
    riskLevel: varchar('risk_level', { length: 10 }).notNull(),
    outstandingBalance: decimal('outstanding_balance', { precision: 10, scale: 2 }),
    creditUtilization: decimal('credit_utilization', { precision: 5, scale: 2 }),
    avgDaysOverdue: decimal('avg_days_overdue', { precision: 5, scale: 1 }),
    paymentTrend: varchar('payment_trend', { length: 20 }),
    topRiskFactor: varchar('top_risk_factor', { length: 100 }),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_credit_risk_scores_risk').on(table.riskLevel),
  ],
)

export const productAssociations = pgTable(
  'product_associations',
  {
    id: serial('id').primaryKey(),
    productAId: varchar('product_a_id', { length: 20 })
      .notNull()
      .references(() => products.productId),
    productBId: varchar('product_b_id', { length: 20 })
      .notNull()
      .references(() => products.productId),
    support: decimal('support', { precision: 6, scale: 4 }).notNull(),
    confidenceAToB: decimal('confidence_a_to_b', { precision: 6, scale: 4 }).notNull(),
    confidenceBToA: decimal('confidence_b_to_a', { precision: 6, scale: 4 }).notNull(),
    lift: decimal('lift', { precision: 8, scale: 4 }).notNull(),
    transactionType: varchar('transaction_type', { length: 10 }).notNull(),
    branchId: varchar('branch_id', { length: 10 }),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_product_associations_products').on(table.productAId, table.productBId),
    unique('product_associations_unique').on(
      table.productAId,
      table.productBId,
      table.transactionType,
      table.branchId,
    ),
  ],
)

export const demandForecasts = pgTable('demand_forecasts', {
  id: serial('id').primaryKey(),
  productId: varchar('product_id', { length: 20 }).references(() => products.productId),
  category: varchar('category', { length: 100 }),
  branchId: varchar('branch_id', { length: 10 }).references(() => branches.branchId),
  forecastDate: date('forecast_date').notNull(),
  predictedQuantity: decimal('predicted_quantity', { precision: 10, scale: 2 }).notNull(),
  lowerBound: decimal('lower_bound', { precision: 10, scale: 2 }),
  upperBound: decimal('upper_bound', { precision: 10, scale: 2 }),
  basedOnPeriod: varchar('based_on_period', { length: 50 }),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const insightCards = pgTable(
  'insight_cards',
  {
    id: serial('id').primaryKey(),
    severity: varchar('severity', { length: 15 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),
    action: text('action'),
    relatedIntent: varchar('related_intent', { length: 50 }),
    relatedParams: jsonb('related_params'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    expiresAt: timestamp('expires_at'),
  },
  (table) => [
    index('idx_insight_cards_active').on(table.isActive, table.createdAt),
  ],
)
