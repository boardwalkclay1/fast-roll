-- ============================================================
-- INDEXES FOR FAST ROLL (PERFORMANCE OPTIMIZED)
-- ============================================================

-- Orders: status lookup (used for rider job list)
CREATE INDEX IF NOT EXISTS idx_orders_status
ON orders(status);

-- Jobs: lookup by order_id (used for status, pickup, dropoff)
CREATE INDEX IF NOT EXISTS idx_jobs_order
ON jobs(order_id);

-- Jobs: lookup by rider_id (future rider dashboard)
CREATE INDEX IF NOT EXISTS idx_jobs_rider
ON jobs(rider_id);

-- Clients: login lookup
CREATE INDEX IF NOT EXISTS idx_clients_email
ON clients(email);

-- Riders: login lookup + payout lookup
CREATE INDEX IF NOT EXISTS idx_riders_paypal
ON riders(paypal_email);
