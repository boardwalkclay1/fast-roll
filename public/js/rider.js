// FAST ROLL — Rider Dashboard Logic
// Clean, modular, synced with app.js

const KEY = "fastRollRiderSystem";

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

function getCurrentRider() {
    return getSession("rider") || null;
}

function getRiderRecord(sessionRider) {
    const data = loadStore();
    let rec = data.riders.find(r => r.id === sessionRider.id);
    if (!rec) {
        rec = {
            id: sessionRider.id,
            name: sessionRider.name,
            vehicle: sessionRider.vehicle || "",
            paypal: sessionRider.paypal || "",
            totalDeliveries: 0,
            avgSpeed: 0,
            badReviews: 0,
            suspended: false,
            radiusMiles: 1.5,
            agreed: false,
            notifications: false
        };
        data.riders.push(rec);
        saveStore(data);
    }
    return rec;
}

/* DASHBOARD PROFILE + STATUS */
function renderRiderProfile(rec) {
    const el = document.getElementById("riderProfileSummary");
    const statusEl = document.getElementById("riderStatus");
    if (!el || !statusEl) return;

    el.innerHTML = `
        <strong>${rec.name}</strong><br>
        Vehicle: ${rec.vehicle || "N/A"}<br>
        PayPal: ${rec.paypal || "N/A"}<br>
        Deliveries: ${rec.totalDeliveries || 0}<br>
        Avg Speed: ${rec.avgSpeed ? rec.avgSpeed.toFixed(1) : 0} min<br>
        Bad Reviews: ${rec.badReviews || 0}
    `;

    statusEl.innerHTML = rec.suspended
        ? "Status: Suspended — pending admin review."
        : (rec.agreed
            ? "Status: Active — You ride at your own risk. The Fast Roll is a connector, not a carrier."
            : "Status: Incomplete — You must accept the Rider Agreement before taking jobs.");
}

/* RADIUS */
function initRadius(rec) {
    const slider = document.getElementById("radiusSlider");
    const valueEl = document.getElementById("radiusValue");
    if (!slider || !valueEl) return;

    slider.value = rec.radiusMiles || 1.5;
    valueEl.textContent = `${slider.value} mi`;

    slider.addEventListener("input", () => {
        valueEl.textContent = `${slider.value} mi`;
        const data = loadStore();
        const r = data.riders.find(x => x.id === rec.id);
        if (r) {
            r.radiusMiles = parseFloat(slider.value);
            saveStore(data);
        }
        if (window.FastRollMap?.updateRadius) {
            window.FastRollMap.updateRadius(parseFloat(slider.value));
        }
    });
}

/* JOBS */
function loadJobs(rec) {
    const jobList = document.getElementById("jobList");
    if (!jobList) return;

    const data = loadStore();
    const jobs = data.jobs.filter(j => j.status === "open");

    jobList.innerHTML = "";

    if (rec.suspended) {
        jobList.innerHTML = `<div class="rider-card">Your account is suspended.</div>`;
        return;
    }
    if (!rec.agreed) {
        jobList.innerHTML = `<div class="rider-card">You must accept the Rider Agreement before taking jobs.</div>`;
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
        btn.onclick = () => acceptJob(btn.getAttribute("data-job"), rec);
    });
}

function acceptJob(jobId, rec) {
    const data = loadStore();
    const job = data.jobs.find(j => j.id === jobId);
    if (!job) return;

    job.status = "active";
    job.riderName = rec.name;
    job.pickupTime = Date.now();

    const order = data.orders.find(o => o.jobId === job.id);
    if (order) {
        order.riderName = rec.name;
        order.status = "accepted";
    }

    saveStore(data);
    renderActiveDelivery(rec);
    loadJobs(rec);
}

/* ACTIVE DELIVERY */
function renderActiveDelivery(rec) {
    const el = document.getElementById("activeDelivery");
    if (!el) return;

    const data = loadStore();
    const job = data.jobs.find(j => j.status === "active" && j.riderName === rec.name);

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
    document.getElementById("dropoffBtn").onclick = () => markDelivered(job.id, rec);
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

function markDelivered(jobId, rec) {
    const data = loadStore();
    const job = data.jobs.find(j => j.id === jobId);
    if (!job) return;

    job.dropoffTime = Date.now();
    job.status = "completed";

    const minutes = Math.max(1, Math.round((job.dropoffTime - job.pickupTime) / 60000));

    const r = data.riders.find(x => x.id === rec.id);
    if (r) {
        r.totalDeliveries += 1;
        r.avgSpeed =
            r.avgSpeed === 0
                ? minutes
                : (r.avgSpeed * (r.totalDeliveries - 1) + minutes) / r.totalDeliveries;
    }

    const order = data.orders.find(o => o.jobId === job.id);
    if (order) order.status = "delivered";

    saveStore(data);
    location.href = "/pages/client/success.html";
}

/* PROFILE PAGE */
function initRiderProfilePage(rec) {
    const form = document.getElementById("riderProfileForm");
    if (!form) return;

    document.getElementById("profileName").value = rec.name || "";
    document.getElementById("profileVehicle").value = rec.vehicle || "longboard";
    document.getElementById("profilePaypal").value = rec.paypal || "";

    form.addEventListener("submit", e => {
        e.preventDefault();
        const data = loadStore();
        const r = data.riders.find(x => x.id === rec.id);
        if (!r) return;

        r.name = document.getElementById("profileName").value.trim();
        r.vehicle = document.getElementById("profileVehicle").value;
        r.paypal = document.getElementById("profilePaypal").value.trim();

        saveStore(data);
        alert("Profile saved.");
    });
}

/* SETTINGS PAGE */
function initRiderSettingsPage(rec) {
    const form = document.getElementById("riderSettingsForm");
    if (!form) return;

    const radiusInput = document.getElementById("settingsRadius");
    const notifInput = document.getElementById("settingsNotifications");

    radiusInput.value = rec.radiusMiles || 1.5;
    notifInput.checked = !!rec.notifications;

    form.addEventListener("submit", e => {
        e.preventDefault();
        const data = loadStore();
        const r = data.riders.find(x => x.id === rec.id);
        if (!r) return;

        r.radiusMiles = parseFloat(radiusInput.value) || 1.5;
        r.notifications = notifInput.checked;

        saveStore(data);
        alert("Settings saved.");
    });
}

/* AGREEMENT PAGE */
function initRiderAgreementPage(rec) {
    const form = document.getElementById("riderAgreementForm");
    if (!form) return;

    const checkbox = document.getElementById("agreementAccept");

    const data = loadStore();
    const r = data.riders.find(x => x.id === rec.id);
    if (r && r.agreed) checkbox.checked = true;

    form.addEventListener("submit", e => {
        e.preventDefault();
        if (!checkbox.checked) {
            alert("You must accept the agreement to continue.");
            return;
        }

        const data = loadStore();
        const r = data.riders.find(x => x.id === rec.id);
        if (r) {
            r.agreed = true;
            saveStore(data);
        }

        alert("Agreement accepted.");
        location.href = "/pages/rider/dashboard.html";
    });
}

/* ROUTER */
document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;

    if (!path.includes("/pages/rider/")) return;

    const sessionRider = getCurrentRider();
    if (!sessionRider && !path.includes("signup.html")) {
        location.href = "/pages/rider/signup.html";
        return;
    }

    const rec = sessionRider ? getRiderRecord(sessionRider) : null;

    if (path.includes("dashboard.html") && rec) {
        renderRiderProfile(rec);
        initRadius(rec);
        loadJobs(rec);
        renderActiveDelivery(rec);
        if (window.FastRollMap?.init) {
            window.FastRollMap.init("mapContainer", rec);
        }
    }

    if (path.includes("profile.html") && rec) {
        initRiderProfilePage(rec);
    }

    if (path.includes("settings.html") && rec) {
        initRiderSettingsPage(rec);
    }

    if (path.includes("agreement.html") && rec) {
        initRiderAgreementPage(rec);
    }

    // how-it-works.html is static; no JS needed beyond session guard
});
