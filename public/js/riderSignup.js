document.addEventListener("DOMContentLoaded", () => {

    const sendCodeBtn = document.getElementById("sendCodeBtn");
    const signupForm = document.getElementById("riderSignupForm");

    sendCodeBtn.addEventListener("click", async () => {
        const email = document.getElementById("paypal").value.trim();

        if (!email) {
            scoot.error("missingField");
            return;
        }

        const res = await fetch("/api/rider/send-paypal-code", {
            method: "POST",
            body: JSON.stringify({ email }),
        });

        const data = await res.json();

        if (data.success) {
            scoot.success("signupComplete");
        } else {
            scoot.error("network");
        }
    });

    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("name").value.trim();
        const vehicle = document.getElementById("vehicle").value;
        const paypal = document.getElementById("paypal").value.trim();
        const code = document.getElementById("paypalCode").value.trim();
        const password = document.getElementById("password").value;
        const confirm = document.getElementById("confirm").value;
        const terms = document.getElementById("terms").checked;

        if (!terms) {
            scoot.say("You must agree to the terms to ride.");
            return;
        }

        if (password !== confirm) {
            scoot.error("invalidPassword");
            return;
        }

        const res = await fetch("/api/rider/verify-paypal", {
            method: "POST",
            body: JSON.stringify({ email: paypal, code }),
        });

        const verify = await res.json();

        if (!verify.valid) {
            scoot.say("Your PayPal verification code is incorrect.");
            return;
        }

        const create = await fetch("/api/rider/create", {
            method: "POST",
            body: JSON.stringify({
                name,
                vehicle,
                paypal,
                password
            }),
        });

        const result = await create.json();

        if (result.success) {
            scoot.success("signupComplete");
            window.location.href = "/pages/rider/dashboard.html";
        } else {
            scoot.error("network");
        }
    });
});
