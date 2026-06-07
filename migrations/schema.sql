CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL
);

CREATE TABLE riders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  vehicle TEXT,
  paypal_email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  radius REAL DEFAULT 1.5,
  agreed INTEGER DEFAULT 0
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  item TEXT NOT NULL,
  store TEXT NOT NULL,
  dropoff TEXT,
  value REAL,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  rider_id TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  pickup_photo_url TEXT,
  dropoff_photo_url TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (rider_id) REFERENCES riders(id)
);
