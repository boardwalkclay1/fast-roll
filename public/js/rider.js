// FAST ROLL — Rider Dashboard Logic
// Clean, modular, synced with app.js + worker + DB

const KEY = "fastRollRiderSystem";

/* ============================================================
   LOAD + SAVE
   ============================================================ */
function loadStore() {
    return JSON.parse(localStorage.getItem(KEY)) || {
        riders: [],
        jobs: [],
        reviews: [],
        orders: []
    };
}

function saveStore(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
}

/* ============================================================
   SESSION RIDER
   ============================================================ */
function getCurrentRider() {
    return getSession("rider") || null;
}

/* ============================================================
   PROFILE RENDER
   ============================================================ */
function renderRiderProfile(rider) {
    const el = document.getElementById("riderProfileSummary");
    const statusEl = document.getElementById("riderStatus");
    if (!el || !statusEl) return;

    el.innerHTML = `
        <strong>${rider.name}</strong><br>
        Vehicle: ${rider.vehicle || "N/A"}<br>
        PayPal: ${rider.paypal || "N/A"}<br>
        Deliveries: ${rider.totalDeliveries || 0}<br>
        Avg Speed: ${rider.avgSpeed ? rider.avgSpeed.toFixed(1) : 0} min<br>
        Bad Reviews: ${rider.badReviews || 0}
    `;

    statusEl.innerHTML = rider.suspended
        ? "Status: Suspended — pending admin review."
        : "Status: Active — You ride at your own risk. The Fast Roll is a connector, not a carrier.";
}

/* ============================================================
   RADIUS CONTROL
   ============================================================ */
function initRadius(rider) {
    const slider = document.getElementById("radiusSlider");
    const valueEl = document.getElementById("radiusValue");
    if (!slider || !valueEl) return;

    slider.value = rider.radiusMiles || 1.5;
    valueEl.textContent = `${slider.value} mi`;

    slider.addEventListener("input", () => {
        valueEl.textContent = `${slider.value} mi`;

        const data = loadStore();
        const rec = data.riders.find(r => r.id === rider.id);
        if (rec) {
            rec.radiusMiles = parseFloat(slider.value);
            saveStore(data);
        }

        if (window.FastRollMap?.updateRadius) {
            window.FastRollMap.updateRadius(parseFloat(slider.value));
        }
    });
}

/* ============================================================
   JOBS
   ============================================================ */
async function loadJobs(rider) {
    const jobList = document.getElementById("jobList");
    if (!jobList) return;

    const data = loadStore();
    const jobs = data.jobs.filter(j => j.status === "open");

    jobList.innerHTML = "";

    if (rider.suspended) {
        jobList.innerHTML = `<div class="rider-card">Your account is suspended.</div>`;
        return;
    }

    if (!jobs.length) {
        jobList.innerHTML = `<div class="rider-card">No jobs available.</div>`;
        return;
    }

    jobs.forEach(job => {
        const div = document.createElement("div");
        div.className = "rider-card";
        div.innerHTML = `
            <strong>${job.pickup} → ${job.dropoff}</strong><br>
            Payout: $${job.payout}<br><br>
            <button class="primary-btn" data-job="${job.id}">
                Accept Job
            </button>
        `;
        jobList.appendChild(div);
    });

    jobList.querySelectorAll("button[data-job]").forEach(btn => {
        btn.onclick = () => acceptJob(btn.getAttribute("data-job"), rider);
    });
}

function acceptJob(jobId, rider) {
    const data = loadStore();
    const job = data.jobs.find(j => j.id === jobId);
    if (!job) return;

    job.status = "active";
    job.riderName = rider.name;
    job.pickupTime = Date.now();

    const order = data.orders.find(o => o.jobId === job.id);
    if (order) {
        order.riderName = rider.name;
        order.status = "accepted";
    }

    saveStore(data);
    renderActiveDelivery(rider);
    loadJobs(rider);
}

/* ============================================================
   ACTIVE DELIVERY
   ============================================================ */
function renderActiveDelivery(rider) {
    const el = document.getElementById("activeDelivery");
    if (!el) return;

    const data = loadStore();
    const job = data.jobs.find(j => j.status === "active" && j.riderName === rider.name);

    if (!job) {
        el.innerHTML = "No active delivery.";
        return;
    }

    const elapsed = Math.round((Date.now() - job.pickupTime) / 60000);

    el.innerHTML = `
        <strong>${job.pickup} → ${job.dropoff}</strong><br>
        Time: ${elapsed} min<br><br>

        <label>Pickup Photo</label>
        <input type="file" id="pickupPhoto" accept="image/*"><br><br>

        <label>Dropoff Photo</label>
        <input type="file" id="dropoffPhoto" accept="image/*"><br><br>

        <button class="primary-btn" id="pickupBtn">Mark Picked Up</button>
        <button class="primary-btn" id="dropoffBtn">Mark Delivered</button>
    `;

    document.getElementById("pickupBtn").onclick = () => markPickedUp(job.id);
    document.getElementById("dropoffBtn").onclick = () => markDelivered(job.id, rider);
}

function markPickedUp(jobId) {
    const data = loadStore();
    const job = data.jobs.find(j => j.id === jobId);
    if (!job) return;

    job.pickupTime = Date.now();

    const order = data.orders.find(o => o.jobId === job.id);
    if (order) order.status = "picked_up";

    saveStore(data);
    location.reload();
}

function markDelivered(jobId, rider) {
    const data = loadStore();
    const job = data.jobs.find(j => j.id === jobId);
    if (!job) return;

    job.dropoffTime = Date.now();
    job.status = "completed";

    const minutes = Math.max(1, Math.round((job.dropoffTime - job.pickupTime) / 60000));

    const rec = data.riders.find(r => r.id === rider.id);
    if (rec) {
        rec.totalDeliveries += 1;
        rec.avgSpeed =
            rec.avgSpeed === 0
                ? minutes
                : (rec.avgSpeed * (rec.totalDeliveries - 1) + minutes) / rec.totalDeliveries;
    }

    const order = data.orders.find(o => o.jobId === job.id);
    if (order) order.status = "delivered";

    saveStore(data);
    location.href = "/pages/client/success.html";
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
    if (!location.pathname.includes("dashboard.html")) return;

    const rider = getCurrentRider();
    if (!rider) return (location.href = "/pages/rider/signup.html");

    renderRiderProfile(rider);
    initRadius(rider);
    loadJobs(rider);
    renderActiveDelivery(rider);

    if (window.FastRollMap?.init) {
        window.FastRollMap.init("mapContainer", rider);
    }
});
