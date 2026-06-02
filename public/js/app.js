/* ============================================================
   THE FAST ROLL — FULL FRONT-END LOGIC
   Handles: client signup, login, order, receipt upload,
   status polling, rider signup, login, dashboard, job flow,
   weight, tips (pre + post), and session.
   ============================================================ */


/* ============================================================
   UTILITIES
   ============================================================ */

function $(id) {
    return document.getElementById(id);
}

function qs(selector) {
    return document.querySelector(selector);
}

function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

function saveSession(type, data) {
    localStorage.setItem(type, JSON.stringify(data));
}

function getSession(type) {
    const data = localStorage.getItem(type);
    return data ? JSON.parse(data) : null;
}

function clearSession(type) {
    localStorage.removeItem(type);
}


/* ============================================================
   CLIENT SIGNUP
   ============================================================ */

const clientSignupForm = $("clientSignupForm");

if (clientSignupForm) {
    clientSignupForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = $("name").value.trim();
        const email = $("email").value.trim();
        const phone = $("phone").value.trim();
        const password = $("password").value;
        const confirm = $("confirm").value;
        const terms = $("terms").checked;

        if (password !== confirm) return alert("Passwords do not match.");
        if (!terms) return alert("You must agree to the terms.");

        const res = await fetch("/api/client/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, phone, password })
        });

        if (!res.ok) return alert("Signup failed.");

        const data = await res.json();
        saveSession("client", data);

        window.location.href = "/pages/client/order.html";
    });
}


/* ============================================================
   CLIENT LOGIN (if you add login.html later)
   ============================================================ */

const clientLoginForm = $("clientLoginForm");

if (clientLoginForm) {
    clientLoginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = $("email").value.trim();
        const password = $("password").value;

        const res = await fetch("/api/client/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        if (!res.ok) return alert("Invalid login.");

        const data = await res.json();
        saveSession("client", data);

        window.location.href = "/pages/client/order.html";
    });
}


/* ============================================================
   CLIENT ORDER CREATION (with weight + tipPre)
   ============================================================ */

const orderForm = $("orderForm");

if (orderForm) {
    const tipPreSelect = $("tipPre");
    const customTipWrapper = $("customTipWrapper");
    const tipCustomInput = $("tipCustom");

    if (tipPreSelect && customTipWrapper) {
        tipPreSelect.addEventListener("change", () => {
            customTipWrapper.style.display =
                tipPreSelect.value === "custom" ? "block" : "none";
        });
    }

    orderForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const client = getSession("client");
        if (!client) return window.location.href = "/pages/client/signup.html";

        const item = $("item").value.trim();
        const store = $("store").value.trim();
        const dropoff = $("dropoff").value.trim();
        const value = Number($("value").value);
        const weight = Number($("weight") ? $("weight").value : 0);

        let tipPre = 0;
        if (tipPreSelect) {
            if (tipPreSelect.value === "custom" && tipCustomInput) {
                tipPre = Number(tipCustomInput.value || 0);
            } else {
                tipPre = Number(tipPreSelect.value || 0);
            }
        }

        const res = await fetch("/api/client/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                clientId: client.id,
                item,
                store,
                dropoff,
                value,
                weight,
                tipPre
            })
        });

        if (!res.ok) return alert("Order failed.");

        const data = await res.json();
        saveSession("order", data);

        window.location.href = "/pages/client/receipt.html";
    });
}


/* ============================================================
   CLIENT RECEIPT UPLOAD
   ============================================================ */

const receiptForm = $("receiptForm");

if (receiptForm) {
    receiptForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const order = getSession("order");
        if (!order) return window.location.href = "/pages/client/order.html";

        const file = $("receipt").files[0];
        if (!file) return alert("Please upload a receipt image.");

        const formData = new FormData();
        formData.append("receipt", file);
        formData.append("orderId", order.id);

        const res = await fetch("/api/client/receipt", {
            method: "POST",
            body: formData
        });

        if (!res.ok) return alert("Upload failed.");

        window.location.href = "/pages/client/status.html";
    });
}


/* ============================================================
   CLIENT ORDER STATUS POLLING
   ============================================================ */

const statusBox = $("statusBox");

if (statusBox) {
    const order = getSession("order");
    if (!order) window.location.href = "/pages/client/order.html";

    async function pollStatus() {
        const res = await fetch(`/api/client/status?orderId=${order.id}`);
        const data = await res.json();

        $("statusBox").innerHTML = `<h3>Status: ${data.status}</h3>`;
        $("statusDetails").innerText = data.message;

        if (data.pickupPhoto) {
            $("pickupPhoto").src = data.pickupPhoto;
            $("pickupPhoto").style.display = "block";
            $("proofContainer").style.display = "block";
        }

        if (data.dropoffPhoto) {
            $("dropoffPhoto").src = data.dropoffPhoto;
            $("dropoffPhoto").style.display = "block";
        }

        if (data.status === "delivered") {
            window.location.href = "/pages/client/success.html";
        }
    }

    pollStatus();
    setInterval(pollStatus, 5000);
}


/* ============================================================
   CLIENT TIP AFTER DELIVERY (success page)
   ============================================================ */

async function sendPostTip(amount) {
    const order = getSession("order");
    if (!order) return alert("No order found.");

    const tipValue = Number(amount || 0);
    if (!tipValue || tipValue <= 0) return alert("Enter a valid tip amount.");

    const res = await fetch("/api/client/tip-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, tipPost: tipValue })
    });

    if (!res.ok) return alert("Tip failed. Try again.");

    alert("Thanks for tipping your rider!");
}


/* ============================================================
   RIDER SIGNUP
   ============================================================ */

const riderSignupForm = $("riderSignupForm");

if (riderSignupForm) {
    riderSignupForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = $("name").value.trim();
        const vehicle = $("vehicle").value;
        const paypal = $("paypal").value.trim();
        const password = $("password").value;
        const confirm = $("confirm").value;
        const terms = $("terms").checked;

        if (password !== confirm) return alert("Passwords do not match.");
        if (!terms) return alert("You must agree to the rider rules.");

        const res = await fetch("/api/rider/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, vehicle, paypal, password })
        });

        if (!res.ok) return alert("Signup failed.");

        const data = await res.json();
        saveSession("rider", data);

        window.location.href = "/pages/rider/dashboard.html";
    });
}


/* ============================================================
   RIDER DASHBOARD — JOB LIST (showing tip + payout if provided)
   ============================================================ */

const jobsList = $("jobsList");

if (jobsList) {
    async function loadJobs() {
        const rider = getSession("rider");
        if (!rider) return window.location.href = "/pages/rider/signup.html";

        const res = await fetch(`/api/rider/jobs?riderId=${rider.id}`);
        const jobs = await res.json();

        jobsList.innerHTML = "";

        jobs.forEach(job => {
            const div = document.createElement("div");
            div.className = "rider-card";

            const tipPre = job.tip_pre || 0;
            const estPayout = job.estimatedPayout || null;

            div.innerHTML = `
                <strong>${job.item}</strong><br>
                Pickup: ${job.store}<br>
                Dropoff: ${job.dropoff}<br>
                ${tipPre ? `Tip (pre): $${tipPre}<br>` : ""}
                ${estPayout ? `Est. Payout: $${estPayout.toFixed ? estPayout.toFixed(2) : estPayout}<br>` : ""}
                <button class="primary-btn" onclick="acceptJob('${job.id}')">Accept Job</button>
            `;
            jobsList.appendChild(div);
        });
    }

    loadJobs();
    setInterval(loadJobs, 5000);
}

async function acceptJob(jobId) {
    const rider = getSession("rider");
    if (!rider) return window.location.href = "/pages/rider/signup.html";

    const res = await fetch("/api/rider/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, riderId: rider.id })
    });

    if (!res.ok) return alert("Job already taken.");

    window.location.href = `/pages/rider/job.html?id=${jobId}`;
}


/* ============================================================
   RIDER ACTIVE JOB PAGE
   ============================================================ */

const jobDetails = $("jobDetails");

if (jobDetails) {
    const jobId = getQueryParam("id");

    async function loadJob() {
        const res = await fetch(`/api/rider/job?id=${jobId}`);
        const job = await res.json();

        jobDetails.innerHTML = `
            <h3>${job.item}</h3>
            <p><strong>Pickup:</strong> ${job.store}</p>
            <p><strong>Dropoff:</strong> ${job.dropoff}</p>
            <p><strong>Receipt:</strong></p>
            <img src="${job.receipt}" style="width:100%; margin-top:10px;" />
        `;
    }

    loadJob();
}


/* ============================================================
   RIDER PICKUP PHOTO
   ============================================================ */

const pickupForm = $("pickupForm");

if (pickupForm) {
    pickupForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const jobId = getQueryParam("id");
        const file = $("pickupPhoto").files[0];
        if (!file) return alert("Upload a pickup photo.");

        const formData = new FormData();
        formData.append("photo", file);
        formData.append("jobId", jobId);

        await fetch("/api/rider/pickup", {
            method: "POST",
            body: formData
        });

        pickupForm.style.display = "none";
        $("dropoffForm").style.display = "block";
    });
}


/* ============================================================
   RIDER DROPOFF PHOTO
   ============================================================ */

const dropoffForm = $("dropoffForm");

if (dropoffForm) {
    dropoffForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const jobId = getQueryParam("id");
        const file = $("dropoffPhoto").files[0];
        if (!file) return alert("Upload a dropoff photo.");

        const formData = new FormData();
        formData.append("photo", file);
        formData.append("jobId", jobId);

        await fetch("/api/rider/dropoff", {
            method: "POST",
            body: formData
        });

        window.location.href = "/pages/client/success.html";
    });
}
