// FAST ROLL — Admin Logic
// Reads from fastRollRiderSystem (same store used by rider.js/client.js)

const ADMIN_KEY = "fastRollRiderSystem";

function adminLoad() {
    try {
        return JSON.parse(localStorage.getItem(ADMIN_KEY)) || {
            riders: [],
            jobs: [],
            reviews: [],
            orders: []
        };
    } catch (e) {
        return { riders: [], jobs: [], reviews: [], orders: [] };
    }
}

function adminSave(data) {
    localStorage.setItem(ADMIN_KEY, JSON.stringify(data));
}

function renderAdminRiders() {
    const data = adminLoad();
    const container = document.getElementById("adminRiders");
    if (!container) return;

    container.innerHTML = "";

    if (!data.riders.length) {
        container.innerHTML = '<div class="rider-card">No riders yet.</div>';
        return;
    }

    data.riders.forEach(rider => {
        const div = document.createElement("div");
        div.className = "rider-card";
        div.innerHTML = `
            <strong>${rider.name}</strong><br>
            Vehicle: ${rider.rideType || rider.vehicle || "N/A"}<br>
            PayPal: ${rider.paypal || "N/A"}<br>
            Deliveries: ${rider.totalDeliveries || 0}<br>
            Avg Speed: ${rider.avgSpeed ? rider.avgSpeed.toFixed(1) : 0} min<br>
            Bad Reviews: ${rider.badReviews || 0}<br>
            Status: ${rider.suspended ? "Suspended" : "Active"}<br><br>
            <button class="secondary-btn" data-rider="${rider.name}" data-action="toggle">
                ${rider.suspended ? "Unsuspend" : "Suspend"}
            </button>
        `;
        container.appendChild(div);
    });

    container.querySelectorAll("button[data-action='toggle']").forEach(btn => {
        btn.addEventListener("click", () => {
            const name = btn.getAttribute("data-rider");
            adminToggleRider(name);
        });
    });
}

function adminToggleRider(name) {
    const data = adminLoad();
    const rider = data.riders.find(r => r.name === name);
    if (!rider) return;

    rider.suspended = !rider.suspended;
    adminSave(data);
    renderAdminRiders();
}

function renderAdminReviews() {
    const data = adminLoad();
    const container = document.getElementById("adminReviews");
    if (!container) return;

    container.innerHTML = "";

    if (!data.reviews.length) {
        container.innerHTML = '<div class="rider-card">No reviews yet.</div>';
        return;
    }

    data.reviews.slice().reverse().forEach(review => {
        const div = document.createElement("div");
        div.className = "rider-card";
        div.innerHTML = `
            <strong>Rider:</strong> ${review.riderName}<br>
            <strong>Speed:</strong> ${review.speed}/5<br>
            <strong>Review:</strong> ${review.text || "(none)"}<br>
        `;
        container.appendChild(div);
    });
}

function renderAdminComplaints() {
    const data = adminLoad();
    const container = document.getElementById("adminComplaints");
    if (!container) return;

    container.innerHTML = "";

    const complaints = data.reviews.filter(r => r.complaint && r.complaint.trim().length > 0);

    if (!complaints.length) {
        container.innerHTML = '<div class="rider-card">No complaints filed.</div>';
        return;
    }

    complaints.slice().reverse().forEach(c => {
        const div = document.createElement("div");
        div.className = "rider-card";
        div.innerHTML = `
            <strong>Rider:</strong> ${c.riderName}<br>
            <strong>Complaint:</strong> ${c.complaint}<br>
        `;
        container.appendChild(div);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;
    if (!path.includes("/pages/admin/dashboard.html")) return;

    renderAdminRiders();
    renderAdminReviews();
    renderAdminComplaints();
});
