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
