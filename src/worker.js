export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" }
      });

    const parseJSON = async (req) => await req.json();
    const parseForm = async (req) => await req.formData();
    const uuid = () => crypto.randomUUID();

    /* ---------------------------------------------------------
       LIMITS + FEES
    --------------------------------------------------------- */
    const BASE_LIMITS = {
      maxValue: 50,
      maxWeight: 8
    };

    const calculateExtraWeightFee = (weight, maxWeight) => {
      if (!weight || weight <= maxWeight) return 0;
      return (weight - maxWeight) * 1.5;
    };

    const calculateDeliveryFee = (value, extraWeightFee) => {
      const base = 5;
      const valueComponent = value * 0.2;
      return base + valueComponent + extraWeightFee;
    };

    const calculateRiderPayout = (order) => {
      return (
        (order.delivery_fee || 0) * 0.7 +
        (order.extra_weight_fee || 0) +
        (order.tip_pre || 0) +
        (order.tip_post || 0)
      );
    };

    /* ---------------------------------------------------------
       CLIENT SIGNUP
    --------------------------------------------------------- */
    if (path === "/api/client/signup" && method === "POST") {
      const { name, email, phone, password } = await parseJSON(request);

      const id = uuid();
      await env.DB.prepare(
        `INSERT INTO clients (id, name, email, phone, password_hash)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(id, name, email, phone, password).run();

      return json({ id, name, email, phone });
    }

    /* ---------------------------------------------------------
       CLIENT LOGIN
    --------------------------------------------------------- */
    if (path === "/api/client/login" && method === "POST") {
      const { email, password } = await parseJSON(request);

      const row = await env.DB.prepare(
        `SELECT * FROM clients WHERE email = ?`
      ).bind(email).first();

      if (!row || row.password_hash !== password)
        return json({ error: "Invalid login" }, 401);

      return json({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone
      });
    }

    /* ---------------------------------------------------------
       CLIENT ORDER CREATION
    --------------------------------------------------------- */
    if (path === "/api/client/order" && method === "POST") {
      const { clientId, item, store, dropoff, value, weight, tipPre } =
        await parseJSON(request);

      if (!clientId)
        return json({ error: "Client not authenticated" }, 401);

      const client = await env.DB.prepare(
        `SELECT id FROM clients WHERE id = ?`
      ).bind(clientId).first();

      if (!client)
        return json({ error: "Invalid client" }, 401);

      const id = uuid();
      const v = Number(value || 0);
      const w = Number(weight || 0);
      const t = Number(tipPre || 0);

      if (v > BASE_LIMITS.maxValue)
        return json({ error: "Item value exceeds limit." }, 400);

      const extraWeightFee = calculateExtraWeightFee(w, BASE_LIMITS.maxWeight);
      const deliveryFee = calculateDeliveryFee(v, extraWeightFee);

      await env.DB.prepare(
        `INSERT INTO orders (
          id, client_id, item, store, dropoff,
          value, weight, tip_pre, tip_post,
          extra_weight_fee, delivery_fee,
          receipt_url, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, 'pending_receipt')`
      ).bind(
        id,
        clientId,
        item,
        store,
        dropoff,
        v,
        w,
        t,
        extraWeightFee,
        deliveryFee
      ).run();

      return json({
        id,
        clientId,
        item,
        store,
        dropoff,
        value: v,
        weight: w,
        tipPre: t,
        extraWeightFee,
        deliveryFee,
        status: "pending_receipt"
      });
    }

    /* ---------------------------------------------------------
       CLIENT RECEIPT UPLOAD
    --------------------------------------------------------- */
    if (path === "/api/client/receipt" && method === "POST") {
      const form = await parseForm(request);
      const orderId = form.get("orderId");
      const file = form.get("receipt");

      if (!file) return json({ error: "Missing file" }, 400);

      const key = `receipts/${orderId}-${Date.now()}.jpg`;
      await env.BUCKET.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type }
      });

      const urlPublic = `${env.PUBLIC_URL}/${key}`;

      await env.DB.prepare(
        `UPDATE orders SET receipt_url = ?, status = 'waiting_rider' WHERE id = ?`
      ).bind(urlPublic, orderId).run();

      return json({ success: true, receiptUrl: urlPublic });
    }

    /* ---------------------------------------------------------
       CLIENT ORDER STATUS
    --------------------------------------------------------- */
    if (path === "/api/client/status" && method === "GET") {
      const orderId = url.searchParams.get("orderId");

      const order = await env.DB.prepare(
        `SELECT * FROM orders WHERE id = ?`
      ).bind(orderId).first();

      if (!order) return json({ error: "Order not found" }, 404);

      const job = await env.DB.prepare(
        `SELECT pickup_photo_url, dropoff_photo_url FROM jobs WHERE order_id = ?`
      ).bind(orderId).first();

      let message = "Waiting for rider…";
      if (order.status === "assigned") message = "Rider accepted your order.";
      if (order.status === "picked_up") message = "Rider picked up your item.";
      if (order.status === "delivered") message = "Delivered.";

      return json({
        status: order.status,
        message,
        pickupPhoto: job?.pickup_photo_url || null,
        dropoffPhoto: job?.dropoff_photo_url || null
      });
    }

    /* ---------------------------------------------------------
       CLIENT TIP AFTER DELIVERY
    --------------------------------------------------------- */
    if (path === "/api/client/tip-post" && method === "POST") {
      const { orderId, tipPost } = await parseJSON(request);
      const t = Number(tipPost || 0);

      await env.DB.prepare(
        `UPDATE orders SET tip_post = COALESCE(tip_post, 0) + ? WHERE id = ?`
      ).bind(t, orderId).run();

      return json({ success: true });
    }

    /* ---------------------------------------------------------
       RIDER SIGNUP
    --------------------------------------------------------- */
    if (path === "/api/rider/signup" && method === "POST") {
      const {
        name,
        vehicle,
        payoutMethod,
        payoutDetails,
        password
      } = await parseJSON(request);

      const id = uuid();

      await env.DB.prepare(
        `INSERT INTO riders (id, name, vehicle, payout_method, payout_details, password_hash, deliveries)
         VALUES (?, ?, ?, ?, ?, ?, 0)`
      ).bind(
        id,
        name,
        vehicle,
        payoutMethod,
        JSON.stringify(payoutDetails),
        password
      ).run();

      return json({ id, name, vehicle, payoutMethod });
    }

    /* ---------------------------------------------------------
       RIDER LOGIN
    --------------------------------------------------------- */
    if (path === "/api/rider/login" && method === "POST") {
      const { email, password } = await parseJSON(request);

      const row = await env.DB.prepare(
        `SELECT * FROM riders WHERE payout_details LIKE ?`
      ).bind(`%${email}%`).first();

      if (!row || row.password_hash !== password)
        return json({ error: "Invalid login" }, 401);

      return json({
        id: row.id,
        name: row.name,
        vehicle: row.vehicle,
        payoutMethod: row.payout_method,
        payoutDetails: row.payout_details
      });
    }

    /* ---------------------------------------------------------
       RIDER JOB LIST
    --------------------------------------------------------- */
    if (path === "/api/rider/jobs" && method === "GET") {
      const jobs = await env.DB.prepare(
        `SELECT
           o.id,
           o.item,
           o.store,
           o.dropoff,
           o.tip_pre,
           o.delivery_fee,
           o.extra_weight_fee
         FROM orders o
         LEFT JOIN jobs j ON j.order_id = o.id
         WHERE o.status = 'waiting_rider' AND j.id IS NULL`
      ).all();

      const results = (jobs.results || []).map((o) => ({
        id: o.id,
        item: o.item,
        store: o.store,
        dropoff: o.dropoff,
        tip_pre: o.tip_pre || 0,
        estimatedPayout: calculateRiderPayout({
          delivery_fee: o.delivery_fee,
          extra_weight_fee: o.extra_weight_fee,
          tip_pre: o.tip_pre,
          tip_post: 0
        })
      }));

      return json(results);
    }

    /* ---------------------------------------------------------
       RIDER ACCEPT JOB
    --------------------------------------------------------- */
    if (path === "/api/rider/accept" && method === "POST") {
      const { jobId, riderId } = await parseJSON(request);

      const order = await env.DB.prepare(
        `SELECT * FROM orders WHERE id = ?`
      ).bind(jobId).first();

      if (!order || order.status !== "waiting_rider")
        return json({ error: "Job unavailable" }, 400);

      const jobRecordId = uuid();

      await env.DB.prepare(
        `INSERT INTO jobs (id, order_id, rider_id, status)
         VALUES (?, ?, ?, 'assigned')`
      ).bind(jobRecordId, jobId, riderId).run();

      await env.DB.prepare(
        `UPDATE orders SET status = 'assigned' WHERE id = ?`
      ).bind(jobId).run();

      return json({ success: true });
    }

    /* ---------------------------------------------------------
       RIDER JOB DETAILS
    --------------------------------------------------------- */
    if (path === "/api/rider/job" && method === "GET") {
      const id = url.searchParams.get("id");

      const order = await env.DB.prepare(
        `SELECT * FROM orders WHERE id = ?`
      ).bind(id).first();

      if (!order) return json({ error: "Not found" }, 404);

      return json({
        id: order.id,
        item: order.item,
        store: order.store,
        dropoff: order.dropoff,
        receipt: order.receipt_url
      });
    }

    /* ---------------------------------------------------------
       RIDER PICKUP PHOTO
    --------------------------------------------------------- */
    if (path === "/api/rider/pickup" && method === "POST") {
      const form = await parseForm(request);
      const jobId = form.get("jobId");
      const file = form.get("photo");

      const key = `pickup/${jobId}-${Date.now()}.jpg`;
      await env.BUCKET.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type }
      });

      const urlPublic = `${env.PUBLIC_URL}/${key}`;

      await env.DB.prepare(
        `UPDATE jobs SET pickup_photo_url = ?, status = 'picked_up' WHERE order_id = ?`
      ).bind(urlPublic, jobId).run();

      await env.DB.prepare(
        `UPDATE orders SET status = 'picked_up' WHERE id = ?`
      ).bind(jobId).run();

      return json({ success: true });
    }

    /* ---------------------------------------------------------
       RIDER DROPOFF PHOTO + PAYOUT WEBHOOK
    --------------------------------------------------------- */
    if (path === "/api/rider/dropoff" && method === "POST") {
      const form = await parseForm(request);
      const jobId = form.get("jobId");
      const file = form.get("photo");

      const key = `dropoff/${jobId}-${Date.now()}.jpg`;
      await env.BUCKET.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type }
      });

      const urlPublic = `${env.PUBLIC_URL}/${key}`;

      await env.DB.prepare(
        `UPDATE jobs SET dropoff_photo_url = ?, status = 'delivered' WHERE order_id = ?`
      ).bind(urlPublic, jobId).run();

      await env.DB.prepare(
        `UPDATE orders SET status = 'delivered' WHERE id = ?`
      ).bind(jobId).run();

      const order = await env.DB.prepare(
        `SELECT * FROM orders WHERE id = ?`
      ).bind(jobId).first();

      const job = await env.DB.prepare(
        `SELECT * FROM jobs WHERE order_id = ?`
      ).bind(jobId).first();

      const rider = await env.DB.prepare(
        `SELECT * FROM riders WHERE id = ?`
      ).bind(job.rider_id).first();

      const payout = calculateRiderPayout(order);

      try {
        await fetch("https://eoia3h2q6lvocds.m.pipedream.net", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "delivery_completed",
            orderId: order.id,
            riderId: rider.id,
            payout,
            payoutMethod: rider.payout_method,
            payoutDetails: rider.payout_details,
            tipPre: order.tip_pre || 0,
            tipPost: order.tip_post || 0,
            deliveryFee: order.delivery_fee || 0,
            extraWeightFee: order.extra_weight_fee || 0
          })
        });
      } catch (err) {
        console.log("Pipedream webhook failed:", err);
      }

      await env.DB.prepare(
        `UPDATE riders SET deliveries = deliveries + 1 WHERE id = ?`
      ).bind(rider.id).run();

      return json({ success: true });
    }

    return new Response("Not found", { status: 404 });
  }
};
