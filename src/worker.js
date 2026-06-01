// THE FAST ROLL — Cloudflare Worker Backend
// Bindings expected:
// - env.DB  (D1)
// - env.BUCKET (R2)
// - env.PAYPAL_CLIENT_ID
// - env.PAYPAL_SECRET

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // JSON helper
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" }
      });

    // Route: CLIENT SIGNUP
    if (pathname === "/api/client/signup" && request.method === "POST") {
      const body = await request.json();
      const { name, email, phone, password } = body;

      const id = crypto.randomUUID();
      await env.DB
        .prepare(
          `INSERT INTO clients (id, name, email, phone, password_hash)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(id, name, email, phone, password) // hash in real prod
        .run();

      return json({ id, name, email, phone });
    }

    // Route: CLIENT LOGIN
    if (pathname === "/api/client/login" && request.method === "POST") {
      const body = await request.json();
      const { email, password } = body;

      const row = await env.DB
        .prepare(`SELECT * FROM clients WHERE email = ?`)
        .bind(email)
        .first();

      if (!row || row.password_hash !== password) {
        return json({ error: "Invalid credentials" }, 401);
      }

      return json({ id: row.id, name: row.name, email: row.email, phone: row.phone });
    }

    // Route: CLIENT ORDER
    if (pathname === "/api/client/order" && request.method === "POST") {
      const body = await request.json();
      const { clientId, item, store, dropoff, value } = body;

      const id = crypto.randomUUID();
      await env.DB
        .prepare(
          `INSERT INTO orders (id, client_id, item, store, dropoff, value, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending_receipt')`
        )
        .bind(id, clientId, item, store, dropoff, value)
        .run();

      return json({ id, clientId, item, store, dropoff, value, status: "pending_receipt" });
    }

    // Route: CLIENT RECEIPT UPLOAD
    if (pathname === "/api/client/receipt" && request.method === "POST") {
      const formData = await request.formData();
      const orderId = formData.get("orderId");
      const file = formData.get("receipt");

      if (!file || !orderId) return json({ error: "Missing data" }, 400);

      const key = `receipts/${orderId}-${Date.now()}.jpg`;
      await env.BUCKET.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type || "image/jpeg" }
      });

      const receiptUrl = `https://your-r2-public-domain/${key}`;

      await env.DB
        .prepare(
          `UPDATE orders SET receipt_url = ?, status = 'waiting_rider' WHERE id = ?`
        )
        .bind(receiptUrl, orderId)
        .run();

      return json({ success: true, receiptUrl });
    }

    // Route: CLIENT STATUS
    if (pathname === "/api/client/status" && request.method === "GET") {
      const orderId = url.searchParams.get("orderId");
      if (!orderId) return json({ error: "Missing orderId" }, 400);

      const order = await env.DB
        .prepare(`SELECT * FROM orders WHERE id = ?`)
        .bind(orderId)
        .first();

      if (!order) return json({ error: "Order not found" }, 404);

      const pickup = await env.DB
        .prepare(`SELECT pickup_photo_url, dropoff_photo_url FROM jobs WHERE order_id = ?`)
        .bind(orderId)
        .first();

      let message = "Waiting for rider…";
      if (order.status === "waiting_rider") message = "Waiting for a rider to accept your order.";
      if (order.status === "assigned") message = "Rider is on the way to pick up your item.";
      if (order.status === "picked_up") message = "Rider has picked up your item.";
      if (order.status === "delivered") message = "Your item has been delivered.";

      return json({
        status: order.status,
        message,
        pickupPhoto: pickup?.pickup_photo_url || null,
        dropoffPhoto: pickup?.dropoff_photo_url || null
      });
    }

    // Route: RIDER SIGNUP
    if (pathname === "/api/rider/signup" && request.method === "POST") {
      const body = await request.json();
      const { name, vehicle, paypal, password } = body;

      const id = crypto.randomUUID();
      await env.DB
        .prepare(
          `INSERT INTO riders (id, name, vehicle, paypal_email, password_hash)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(id, name, vehicle, paypal, password)
        .run();

      return json({ id, name, vehicle, paypal });
    }

    // Route: RIDER LOGIN (if needed)
    if (pathname === "/api/rider/login" && request.method === "POST") {
      const body = await request.json();
      const { email, password } = body;

      const row = await env.DB
        .prepare(`SELECT * FROM riders WHERE paypal_email = ?`)
        .bind(email)
        .first();

      if (!row || row.password_hash !== password) {
        return json({ error: "Invalid credentials" }, 401);
      }

      return json({ id: row.id, name: row.name, vehicle: row.vehicle, paypal: row.paypal_email });
    }

    // Route: RIDER JOBS
    if (pathname === "/api/rider/jobs" && request.method === "GET") {
      const jobs = await env.DB
        .prepare(
          `SELECT o.id, o.item, o.store, o.dropoff
           FROM orders o
           LEFT JOIN jobs j ON j.order_id = o.id
           WHERE o.status = 'waiting_rider' AND j.id IS NULL`
        )
        .all();

      return json(jobs.results || []);
    }

    // Route: RIDER ACCEPT JOB
    if (pathname === "/api/rider/accept" && request.method === "POST") {
      const body = await request.json();
      const { jobId, riderId } = body;

      const order = await env.DB
        .prepare(`SELECT * FROM orders WHERE id = ?`)
        .bind(jobId)
        .first();

      if (!order || order.status !== "waiting_rider") {
        return json({ error: "Job not available" }, 400);
      }

      const jobRecordId = crypto.randomUUID();
      await env.DB
        .prepare(
          `INSERT INTO jobs (id, order_id, rider_id, status)
           VALUES (?, ?, ?, 'assigned')`
        )
        .bind(jobRecordId, jobId, riderId)
        .run();

      await env.DB
        .prepare(`UPDATE orders SET status = 'assigned' WHERE id = ?`)
        .bind(jobId)
        .run();

      return json({ success: true, jobId, jobRecordId });
    }

    // Route: RIDER JOB DETAILS
    if (pathname === "/api/rider/job" && request.method === "GET") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Missing id" }, 400);

      const order = await env.DB
        .prepare(`SELECT * FROM orders WHERE id = ?`)
        .bind(id)
        .first();

      if (!order) return json({ error: "Order not found" }, 404);

      return json({
        id: order.id,
        item: order.item,
        store: order.store,
        dropoff: order.dropoff,
        receipt: order.receipt_url
      });
    }

    // Route: RIDER PICKUP PHOTO
    if (pathname === "/api/rider/pickup" && request.method === "POST") {
      const formData = await request.formData();
      const jobId = formData.get("jobId");
      const file = formData.get("photo");

      if (!file || !jobId) return json({ error: "Missing data" }, 400);

      const key = `pickup/${jobId}-${Date.now()}.jpg`;
      await env.BUCKET.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type || "image/jpeg" }
      });

      const urlPublic = `https://your-r2-public-domain/${key}`;

      await env.DB
        .prepare(
          `UPDATE jobs SET pickup_photo_url = ?, status = 'picked_up' WHERE order_id = ?`
        )
        .bind(urlPublic, jobId)
        .run();

      await env.DB
        .prepare(`UPDATE orders SET status = 'picked_up' WHERE id = ?`)
        .bind(jobId)
        .run();

      return json({ success: true, pickupPhoto: urlPublic });
    }

    // Route: RIDER DROPOFF PHOTO + COMPLETE + PAYOUT
    if (pathname === "/api/rider/dropoff" && request.method === "POST") {
      const formData = await request.formData();
      const jobId = formData.get("jobId");
      const file = formData.get("photo");

      if (!file || !jobId) return json({ error: "Missing data" }, 400);

      const key = `dropoff/${jobId}-${Date.now()}.jpg`;
      await env.BUCKET.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type || "image/jpeg" }
      });

      const urlPublic = `https://your-r2-public-domain/${key}`;

      await env.DB
        .prepare(
          `UPDATE jobs SET dropoff_photo_url = ?, status = 'delivered' WHERE order_id = ?`
        )
        .bind(urlPublic, jobId)
        .run();

      await env.DB
        .prepare(`UPDATE orders SET status = 'delivered' WHERE id = ?`)
        .bind(jobId)
        .run();

      // PAYOUT STUB — implement PayPal Payouts here
      // const job = await env.DB.prepare(`
      //   SELECT j.*, r.paypal_email, o.value
      //   FROM jobs j
      //   JOIN riders r ON r.id = j.rider_id
      //   JOIN orders o ON o.id = j.order_id
      //   WHERE j.order_id = ?
      // `).bind(jobId).first();
      //
      // await sendPayout(env, job.paypal_email, calculateRiderCut(job.value));

      return json({ success: true, dropoffPhoto: urlPublic });
    }

    // Fallback
    return new Response("Not found", { status: 404 });
  }
};

// OPTIONAL: helper for PayPal payouts (stub)
/*
async function sendPayout(env, paypalEmail, amount) {
  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_SECRET}`);
  const tokenRes = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  await fetch("https://api-m.paypal.com/v1/payments/payouts", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sender_batch_header: {
        email_subject: "Fast Roll Delivery Payout"
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: { value: amount.toFixed(2), currency: "USD" },
          receiver: paypalEmail,
          note: "Thanks for rolling with The Fast Roll."
        }
      ]
    })
  });
}

function calculateRiderCut(value) {
  const v = Number(value || 0);
  return v * 0.7; // 70% to rider, adjust as needed
}
*/
