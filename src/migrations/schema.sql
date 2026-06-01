CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  password_hash TEXT
);

CREATE TABLE riders (
  id TEXT PRIMARY KEY,
  name TEXT,
  vehicle TEXT,
  paypal_email TEXT UNIQUE,
  password_hash TEXT
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  item TEXT,
  store TEXT,
  dropoff TEXT,
  value REAL,
  receipt_url TEXT,
  status TEXT
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  rider_id TEXT,
  status TEXT,
  pickup_photo_url TEXT,
  dropoff_photo_url TEXT
);
