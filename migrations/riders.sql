CREATE TABLE riders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  vehicle TEXT,
  paypal_email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  radius REAL DEFAULT 1.5,
  agreed INTEGER DEFAULT 0
);
