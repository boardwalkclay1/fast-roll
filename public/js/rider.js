// FAST ROLL — Rider Dashboard Logic
// Connected to: app.js (session), worker API, database

const KEY = "fastRollRiderSystem";

// Load + Save (local fallback)
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

// Get rider from session
function getCurrentRider() {
    const rider = getSession("rider");
    if (!rider) return null;
    return rider;
}

// Render profile
function renderRiderProfile(riderData) {
    const el = document.getElementById("riderProfileSummary");
    if (!el) return;

    el.innerHTML = `
        <strong>${riderData.name}</strong><br>
        Vehicle: ${riderData.vehicle || "N/A"}<br>
        PayPal: ${riderData.paypal || "N/A"}<br>
        Deliveries: ${riderData.totalDeliveries || 0}<br>
        Avg Speed: ${riderData.avgSpeed ? riderData.avgSpeed.toFixed(1) : 0} min<br>
        Bad Reviews: ${riderData.badReviews || 0}<br>
        Status: ${riderData.suspended ? "Suspended" : "Active"}
    `;
}

// Load jobs from worker
async function loadJobsFromAPI(riderId) {
    try {
        const res = await fetch(`/api/rider/jobs?riderId=${riderId}`);
        if (!res.ok) throw new Error("API failed");
        return await res.json();
    } catch (err) {
        const store = loadStore();
        return store.jobs.filter(j => j.status === "open");
    }
}

// Render available jobs
async function renderAvailableJobs(rider) {
    const jobList = document.getElementById("jobList");
    if (!jobList) return;

    const jobs = await loadJobsFromAPI(rider.id);

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
            <button class="primary-btn" onclick="acceptJobAPI('${job.id}')">
                Accept Job
            </button>
        `;
        jobList.appendChild(div);
    });
}

// Accept job via worker
async function acceptJobAPI(jobId) {
    const rider = getCurrentRider();
    if (!rider) return location.href = "/pages/rider/signup.html";

    const res = await fetch("/api/rider/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, riderId: rider.id })
    });

    if (!res.ok) return alert("Job already taken.");

    location.reload();
}

// Load active job
async function loadActiveJob(riderId) {
    try {
        const res = await fetch(`/api/rider/active?riderId=${riderId}`);
        if (!res.ok) throw new Error("API failed");
        return await res.json();
    } catch (err) {
        const store = loadStore();
        return store.jobs.find(j => j.status === "active" && j.riderName === riderId);
    }
}

// Render active delivery
async function renderActiveDelivery(rider) {
    const el = document.getElementById("activeDelivery");
    if (!el) return;

    const job = await loadActiveJob(rider.id);

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

        <button class="primary-btn" onclick="sendPickupPhoto('${job.id}')">
            Mark Picked Up
        </button>

        <button class="primary-btn" onclick="sendDropoffPhoto('${job.id}')">
            Mark Delivered
        </button>
    `;
}

// Upload pickup photo
async function sendPickupPhoto(jobId) {
    const file = document.getElementById("pickupPhoto").files[0];
    if (!file) return alert("Upload a pickup photo.");

    const formData = new FormData();
    formData.append("photo", file);
    formData.append("jobId", jobId);

    await fetch("/api/rider/pickup", { method: "POST", body: formData });
    location.reload();
}

// Upload dropoff photo
async function sendDropoffPhoto(jobId) {
    const file = document.getElementById("dropoffPhoto").files[0];
    if (!file) return alert("Upload a dropoff photo.");

    const formData = new FormData();
    formData.append("photo", file);
    formData.append("jobId", jobId);

    await fetch("/api/rider/dropoff", { method: "POST", body: formData });
    location.href = "/pages/client/success.html";
}

// INIT
document.addEventListener("DOMContentLoaded", async () => {
    if (!location.pathname.includes("dashboard.html")) return;

    const rider = getCurrentRider();
    if (!rider) return location.href = "/pages/rider/signup.html";

    renderRiderProfile(rider);
    await renderAvailableJobs(rider);
    await renderActiveDelivery(rider);
});
