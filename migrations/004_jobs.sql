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
