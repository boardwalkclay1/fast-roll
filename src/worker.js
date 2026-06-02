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

    /* ---------------------------------------------------------
       UTIL
    --------------------------------------------------------- */
    const parseJSON = async (req) => await req.json();
    const parseForm = async (req) => await req.formData();
    const uuid = () => crypto.randomUUID();

    // simple fee + weight helpers (distance can be added later)
    const getBaseLimits = () => ({
      maxValue: 50,   // starter limit
      maxWeight: 8    // starter weight limit (lbs)
    });

    const calculateExtraWeightFee = (weight, maxWeight) => {
      if (!weight || weight <= maxWeight) return 0;
      const extra = weight - maxWeight;
      return extra * 1.5; // $1.50 per extra lb
    };

    const calculateDeliveryFee = (value, extraWeightFee) => {
      const base = 5;              // base fee
      const valueComponent = value * 0.2; // simple value-based component
      return base + valueComponent + extraWeightFee;
    };

    const calculateRiderPayout = (order) => {
      const deliveryFee = order.delivery_fee || 0;
      const extraWeightFee = order.extra_weight_fee || 0;
      const tipPre = order.tip_pre || 0;
      const tipPost = order.tip_post || 0;
      return (deliveryFee * 0.7) + extraWeightFee + tipPre + tipPost;
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
       CLIENT ORDER CREATION (value + weight + tip_pre)
    --------------------------------------------------------- */
    if (path === "/api/client/order" && method === "POST") {
      const { clientId, item, store, dropoff, value, weight, tipPre } = await parseJSON(request);

      const id = uuid();
      const numericValue = Number(value || 0);
      const numericWeight = Number(weight || 0);
      const numericTipPre = Number(tipPre || 0);

      const limits = getBaseLimits();

      if (numericValue > limits.maxValue) {
        return json({ error: "Item value exceeds current limit." }, 400);
      }

      const extraWeightFee = calculateExtraWeightFee(numericWeight, limits.maxWeight);
      const deliveryFee = calculateDeliveryFee(numericValue, extraWeightFee);

      await env.DB.prepare(
        `INSERT INTO orders (
           id, client_id, item, store, dropoff,
           value, weight, tip_pre, tip_post,
           extra_weight_fee, delivery_fee, status
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'pending_receipt')`
      ).bind(
        id,
        clientId,
        item,
        store,
        dropoff,
        numericValue,
        numericWeight,
        numericTipPre,
        extraWeightFee,
        deliveryFee
      ).run();

      return json({
        id,
        clientId,
        item,
        store,
        dropoff,
        value: numericValue,
        weight: numericWeight,
        tipPre: numericTipPre,
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
       CLIENT STATUS
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
      const numericTipPost = Number(tipPost || 0);

      await env.DB.prepare(
        `UPDATE orders SET tip_post = COALESCE(tip_post, 0) + ? WHERE id = ?`
      ).bind(numericTipPost, orderId).run();

      return json({ success: true });
    }

    /* ---------------------------------------------------------
       RIDER SIGNUP
    --------------------------------------------------------- */
    if (path === "/api/rider/signup" && method === "POST") {
      const { name, vehicle, paypal, password } = await parseJSON(request);

      const id = uuid();
      await env.DB.prepare(
        `INSERT INTO riders (id, name, vehicle, paypal_email, password_hash)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(id, name, vehicle, paypal, password).run();

      return json({ id, name, vehicle, paypal });
    }

    /* ---------------------------------------------------------
       RIDER LOGIN
    --------------------------------------------------------- */
    if (path === "/api/rider/login" && method === "POST") {
      const { email, password } = await parseJSON(request);

      const row = await env.DB.prepare(
        `SELECT * FROM riders WHERE paypal_email = ?`
      ).bind(email).first();

      if (!row || row.password_hash !== password)
        return json({ error: "Invalid login" }, 401);

      return json({
        id: row.id,
        name: row.name,
        vehicle: row.vehicle,
        paypal: row.paypal_email
      });
    }

    /* ---------------------------------------------------------
       RIDER JOB LIST (include tip_pre + estimated payout)
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

      const results = (jobs.results || []).map((o) => {
        const payout = calculateRiderPayout({
          delivery_fee: o.delivery_fee || 0,
          extra_weight_fee: o.extra_weight_fee || 0,
          tip_pre: o.tip_pre || 0,
          tip_post: 0
        });
        return {
          id: o.id,
          item: o.item,
          store: o.store,
          dropoff: o.dropoff,
          tip_pre: o.tip_pre || 0,
          estimatedPayout: payout
        };
      });

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

      return json({ success: true, jobRecordId });
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
       RIDER DROPOFF PHOTO + COMPLETE
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

      // here you can later call PayPal payouts using calculateRiderPayout(order)
      return json({ success: true });
    }

    return new Response("Not found", { status: 404 });
  }
};
