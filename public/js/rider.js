// FAST ROLL — Rider System
// Clean, modular, synced with admin + client data model

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

// Get or create rider
function getRider(name) {
    const data = load();
    let rider = data.riders.find(r => r.name === name);
    if (!rider) {
        rider = {
            name,
            paypal: "",
            rideType: "",
            totalDeliveries: 0,
            avgSpeed: 0,
            badReviews: 0,
            suspended: false
        };
        data.riders.push(rider);
        save(data);
    }
    return rider;
}

// Seed jobs if empty (dev only)
function seedJobs() {
    const data = load();
    if (data.jobs.length === 0) {
        data.jobs = [
            { id: "JOB1", pickup: "Ponce City Market", dropoff: "Krog Street Market", payout: 8, status: "open" },
            { id: "JOB2", pickup: "Old Fourth Ward", dropoff: "Inman Park", payout: 6, status: "open" }
        ];
        save(data);
    }
}

// Accept job
function acceptJob(jobId, riderName) {
    const data = load();
    const job = data.jobs.find(j => j.id === jobId);
    if (!job) return;

    job.status = "active";
    job.riderName = riderName;
    job.pickupTime = Date.now();

    // Link order if exists
    const order = data.orders.find(o => o.jobId === job.id);
    if (order) {
        order.riderName = riderName;
        order.status = "accepted";
    }

    save(data);
}

// Mark pickup
function markPickedUp(jobId) {
    const data = load();
    const job = data.jobs.find(j => j.id === jobId);
    if (!job) return;

    job.pickupTime = Date.now();

    const order = data.orders.find(o => o.jobId === job.id);
    if (order) {
        order.status = "picked_up";
    }

    save(data);
}

// Mark delivered
function markDelivered(jobId) {
    const data = load();
    const job = data.jobs.find(j => j.id === jobId);
    if (!job) return;

    const rider = data.riders.find(r => r.name === job.riderName);
    if (!rider) return;

    job.dropoffTime = Date.now();
    job.status = "completed";

    const minutes = Math.max(
        1,
        Math.round((job.dropoffTime - (job.pickupTime || job.dropoffTime)) / 60000)
    );

    rider.totalDeliveries += 1;
    rider.avgSpeed =
        rider.avgSpeed === 0
            ? minutes
            : (rider.avgSpeed * (rider.totalDeliveries - 1) + minutes) /
              rider.totalDeliveries;

    const order = data.orders.find(o => o.jobId === job.id);
    if (order) {
        order.status = "delivered";
    }

    save(data);
}

// Submit review
function submitReview(riderName, speed, text, complaint) {
    const data = load();
    const rider = getRider(riderName);

    data.reviews.push({ riderName, speed, text, complaint });

    if (speed <= 2 || (complaint && complaint.trim().length > 0)) {
        rider.badReviews += 1;
        if (rider.badReviews >= 5) {
            rider.suspended = true;
        }
    }

    save(data);
}

// Render dashboard
function initDashboard() {
    seedJobs();

    const riderName =
        (localStorage.getItem("currentRiderName") || "").trim() ||
        (getSession && getSession("rider")?.name) ||
        "Rider";

    const data = load();
    const rider = getRider(riderName);

    const profileEl = document.getElementById("riderProfileSummary");
    const jobList = document.getElementById("jobList");
    const activeDiv = document.getElementById("activeDelivery");

    if (!profileEl || !jobList || !activeDiv) return;

    profileEl.innerHTML = `
        ${rider.name}<br>
        Deliveries: ${rider.totalDeliveries}<br>
        Avg Speed: ${rider.avgSpeed ? rider.avgSpeed.toFixed(1) : 0} min<br>
        Bad Reviews: ${rider.badReviews}<br>
        Status: ${rider.suspended ? "Suspended" : "Active"}
    `;

    jobList.innerHTML = "";

    if (rider.suspended) {
        jobList.innerHTML =
            '<div class="rider-card">Your account is suspended pending review.</div>';
        activeDiv.innerHTML = "No active delivery.";
        return;
    }

    data.jobs
        .filter(j => j.status === "open")
        .forEach(job => {
            const div = document.createElement("div");
            div.className = "rider-card";
            div.innerHTML = `
                <strong>${job.pickup} → ${job.dropoff}</strong><br>
                Payout: $${job.payout}<br><br>
                <button class="primary-btn"
                    onclick="acceptJob('${job.id}', '${rider.name}'); location.reload();">
                    Accept Job
                </button>
            `;
            jobList.appendChild(div);
        });

    const active = data.jobs.find(
        j => j.status === "active" && j.riderName === rider.name
    );

    if (!active) {
        activeDiv.innerHTML = "No active delivery.";
        return;
    }

    const elapsed = Math.round(
        (Date.now() - (active.pickupTime || Date.now())) / 60000
    );

    activeDiv.innerHTML = `
        <strong>${active.pickup} → ${active.dropoff}</strong><br>
        Time: ${elapsed} min<br><br>

        <label>Pickup Photo</label>
        <input type="file" accept="image/*"><br><br>

        <label>Dropoff Photo</label>
        <input type="file" accept="image/*"><br><br>

        <button class="primary-btn"
            onclick="markPickedUp('${active.id}'); location.reload();">
            Mark Picked Up
        </button>

        <button class="primary-btn"
            onclick="markDelivered('${active.id}'); location.reload();">
            Mark Delivered
        </button>
    `;
}

// Review page
function initReviewPage() {
    const form = document.getElementById("reviewForm");
    if (!form) return;

    form.addEventListener("submit", e => {
        e.preventDefault();

        const riderName = document.getElementById("reviewRiderName").value.trim();
        const speed = parseInt(
            document.getElementById("reviewSpeed").value,
            10
        );
        const text = document.getElementById("reviewText").value.trim();
        const complaint = document
            .getElementById("complaintText")
            .value.trim();

        if (!riderName || !speed) {
            alert("Rider name and speed rating are required.");
            return;
        }

        submitReview(riderName, speed, text, complaint);

        alert("Review submitted. Thank you.");
        form.reset();
    });
}

// Router
document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;

    if (path.includes("dashboard.html")) initDashboard();
    if (path.includes("review.html")) initReviewPage();
});
