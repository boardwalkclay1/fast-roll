/* ============================================================
   THE FAST ROLL — CORE FRONT-END LOGIC (app.js)
   Works alongside: client.js (client flow) + rider.js (rider flow)
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

        if (password !== confirm) {
            alert("Passwords do not match.");
            return;
        }

        if (!terms) {
            alert("You must agree to the terms.");
            return;
        }

        const res = await fetch("/api/client/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, phone, password })
        });

        if (!res.ok) {
            alert("Signup failed.");
            return;
        }

        const data = await res.json();
        saveSession("client", data);

        window.location.href = "/pages/client/order.html";
    });
}


/* ============================================================
   CLIENT LOGIN
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

        if (!res.ok) {
            alert("Invalid login.");
            return;
        }

        const data = await res.json();
        saveSession("client", data);

        window.location.href = "/pages/client/order.html";
    });
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

        if (password !== confirm) {
            alert("Passwords do not match.");
            return;
        }

        if (!terms) {
            alert("You must agree to the rider rules.");
            return;
        }

        const res = await fetch("/api/rider/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, vehicle, paypal, password })
        });

        if (!res.ok) {
            alert("Signup failed.");
            return;
        }

        const data = await res.json();
        saveSession("rider", data);

        window.location.href = "/pages/rider/dashboard.html";
    });
}


/* ============================================================
   RIDER LOGIN
   ============================================================ */

const riderLoginForm = $("riderLoginForm");

if (riderLoginForm) {
    riderLoginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = $("name").value.trim();
        const password = $("password").value;

        const res = await fetch("/api/rider/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, password })
        });

        if (!res.ok) {
            alert("Invalid login.");
            return;
        }

        const data = await res.json();
        saveSession("rider", data);

        window.location.href = "/pages/rider/dashboard.html";
    });
}


/* ============================================================
   CLIENT TIP AFTER DELIVERY (success page)
   ============================================================ */

async function sendPostTip(amount) {
    const order = getSession("order");
    if (!order) {
        alert("No order found.");
        return;
    }

    const tipValue = Number(amount || 0);
    if (!tipValue || tipValue <= 0) {
        alert("Enter a valid tip amount.");
        return;
    }

    const res = await fetch("/api/client/tip-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, tipPost: tipValue })
    });

    if (!res.ok) {
        alert("Tip failed. Try again.");
        return;
    }

    alert("Thanks for tipping your rider!");
}
