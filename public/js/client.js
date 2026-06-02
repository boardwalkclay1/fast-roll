// FAST ROLL — Client System
// Clean, simple, and fully compatible with rider.js

const KEY = "fastRollRiderSystem";

// Load + Save
function load() {
    return JSON.parse(localStorage.getItem(KEY)) || {
        riders: [],
        jobs: [],
        reviews: [],
        orders: []
    };
}
function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
}

// Create a new order
function createOrder(clientName, item, store, receiptFile) {
    const data = load();

    const orderId = "ORD" + Date.now();
    const jobId = "JOB" + Date.now();

    const order = {
        id: orderId,
        clientName,
        item,
        store,
        receiptPhoto: receiptFile ? receiptFile.name : null,
        status: "pending",
        riderName: null,
        jobId
    };

    data.orders.push(order);

    // Create a job for riders
    data.jobs.push({
        id: jobId,
        pickup: store,
        dropoff: clientName + " (client)",
        payout: 5, // base payout, rider keeps 75%
        status: "open",
        riderName: null,
        pickupTime: null,
        dropoffTime: null
    });

    save(data);
    return orderId;
}

// Get order status
function getOrderStatus(orderId) {
    const data = load();
    return data.orders.find(o => o.id === orderId) || null;
}

// Update order when rider accepts job
function linkOrderToRider(jobId, riderName) {
    const data = load();
    const order = data.orders.find(o => o.jobId === jobId);
    if (!order) return;

    order.riderName = riderName;
    order.status = "accepted";

    save(data);
}

// Update order when picked up
function markOrderPickedUp(jobId) {
    const data = load();
    const order = data.orders.find(o => o.jobId === jobId);
    if (!order) return;

    order.status = "picked_up";
    save(data);
}

// Update order when delivered
function markOrderDelivered(jobId) {
    const data = load();
    const order = data.orders.find(o => o.jobId === jobId);
    if (!order) return;

    order.status = "delivered";
    save(data);
}

// Render order confirmation page
function initOrderPage() {
    const form = document.getElementById("clientOrderForm");
    if (!form) return;

    form.addEventListener("submit", e => {
        e.preventDefault();

        const clientName = document.getElementById("clientName").value;
        const item = document.getElementById("itemName").value;
        const store = document.getElementById("storeName").value;
        const receipt = document.getElementById("receiptUpload").files[0];

        const orderId = createOrder(clientName, item, store, receipt);

        alert("Order created! Your order ID is: " + orderId);
        form.reset();
    });
}

// Render order status page
function initOrderStatusPage() {
    const form = document.getElementById("orderStatusForm");
    const result = document.getElementById("orderStatusResult");

    if (!form || !result) return;

    form.addEventListener("submit", e => {
        e.preventDefault();

        const orderId = document.getElementById("orderIdLookup").value;
        const order = getOrderStatus(orderId);

        if (!order) {
            result.innerHTML = "Order not found.";
            return;
        }

        result.innerHTML = `
            <strong>Order ID:</strong> ${order.id}<br>
            <strong>Status:</strong> ${order.status}<br>
            <strong>Rider:</strong> ${order.riderName || "Not assigned yet"}<br><br>
            ${order.status === "delivered" ? `
                <button class="primary-btn" onclick="location.href='/pages/client/review.html'">
                    Leave Review
                </button>
            ` : ""}
        `;
    });
}

// Router
document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;

    if (path.includes("order.html")) initOrderPage();
    if (path.includes("status.html")) initOrderStatusPage();
});
