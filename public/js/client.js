// FAST ROLL — Client System
// Clean, synced with rider.js + admin.js + app.js

const KEY = "fastRollRiderSystem";

// Load + Save (shared store)
function loadStore() {
    const base = JSON.parse(localStorage.getItem(KEY)) || {};
    return {
        riders: base.riders || [],
        jobs: base.jobs || [],
        reviews: base.reviews || [],
        orders: base.orders || [],
        clientProfiles: base.clientProfiles || []
    };
}

function saveStore(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
}

/* ============================================================
   CREATE ORDER
   ============================================================ */

function createOrder(clientId, clientName, item, store, receiptFile) {
    const data = loadStore();

    const orderId = "ORD" + Date.now();
    const jobId = "JOB" + Date.now();

    const order = {
        id: orderId,
        clientId,
        clientName,
        item,
        store,
        receiptPhoto: receiptFile ? receiptFile.name : null,
        status: "pending",
        riderName: null,
        jobId
    };

    data.orders.push(order);

    data.jobs.push({
        id: jobId,
        pickup: store,
        dropoff: clientName + " (client)",
        payout: 5,
        status: "open",
        riderName: null,
        pickupTime: null,
        dropoffTime: null
    });

    saveStore(data);

    // Save to session for success page
    if (typeof saveSession === "function") {
        saveSession("order", order);
    }

    return orderId;
}

/* ============================================================
   GET ORDER STATUS
   ============================================================ */

function getOrderStatus(orderId) {
    const data = loadStore();
    return data.orders.find(o => o.id === orderId) || null;
}

/* ============================================================
   ORDER PAGE
   ============================================================ */

function initOrderPage() {
    const form = document.getElementById("clientOrderForm");
    if (!form) return;

    const client = getSession("client");
    if (!client) return location.href = "/pages/client/signup.html";

    form.addEventListener("submit", e => {
        e.preventDefault();

        const clientName = document.getElementById("clientName").value.trim();
        const item = document.getElementById("itemName").value.trim();
        const store = document.getElementById("storeName").value.trim();
        const receipt = document.getElementById("receiptUpload").files[0] || null;

        if (!clientName || !item || !store) {
            alert("Fill out all fields.");
            return;
        }

        const orderId = createOrder(client.id, clientName, item, store, receipt);

        alert("Order created! Your order ID is: " + orderId);
        form.reset();
    });
}

/* ============================================================
   ORDER STATUS PAGE
   ============================================================ */

function initOrderStatusPage() {
    const form = document.getElementById("orderStatusForm");
    const result = document.getElementById("orderStatusResult");

    if (!form || !result) return;

    form.addEventListener("submit", e => {
        e.preventDefault();

        const orderId = document.getElementById("orderIdLookup").value.trim();
        if (!orderId) {
            result.innerHTML = "Enter an order ID.";
            return;
        }

        const order = getOrderStatus(orderId);

        if (!order) {
            result.innerHTML = "Order not found.";
            return;
        }

        result.innerHTML = `
            <strong>Order ID:</strong> ${order.id}<br>
            <strong>Status:</strong> ${order.status}<br>
            <strong>Rider:</strong> ${order.riderName || "Not assigned yet"}<br><br>

            ${
                order.status === "delivered"
                    ? `<button class="primary-btn" onclick="location.href='/pages/client/success.html'">
                           Delivery Complete — Continue
                       </button>`
                    : ""
            }
        `;
    });
}

/* ============================================================
   ROUTER
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;

    if (path.includes("order.html")) initOrderPage();
    if (path.includes("status.html")) initOrderStatusPage();
});
