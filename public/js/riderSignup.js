document.addEventListener("DOMContentLoaded", () => {

    const sendCodeBtn = document.getElementById("sendCodeBtn");
    const signupForm = document.getElementById("riderSignupForm");

    /* ---------------------------------------------------------
       SEND PAYPAL VERIFICATION CODE
    --------------------------------------------------------- */
    sendCodeBtn.addEventListener("click", async () => {
        const email = document.getElementById("paypal").value.trim();

        if (!email) {
            scoot.error("missingField");
            return;
        }

        const res = await fetch("/api/rider/send-paypal-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });

        let data = {};
        try {
            data = await res.json();
        } catch (e) {
            scoot.error("network");
            return;
        }

        if (data.success) {
            scoot.success("signupComplete");
        } else {
            scoot.error("network");
        }
    });

    /* ---------------------------------------------------------
       SIGNUP SUBMIT
    --------------------------------------------------------- */
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

        /* ---------------------------------------------------------
           VERIFY PAYPAL CODE
        --------------------------------------------------------- */
        const verifyRes = await fetch("/api/rider/verify-paypal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: paypal, code })
        });

        let verify = {};
        try {
            verify = await verifyRes.json();
        } catch (e) {
            scoot.error("network");
            return;
        }

        if (!verify.valid) {
            scoot.say("Your PayPal verification code is incorrect.");
            return;
        }

        /* ---------------------------------------------------------
           CREATE RIDER ACCOUNT
        --------------------------------------------------------- */
        const createRes = await fetch("/api/rider/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name,
                vehicle,
                paypal,
                password
            })
        });

        let result = {};
        try {
            result = await createRes.json();
        } catch (e) {
            scoot.error("network");
            return;
        }

        if (result.success) {
            scoot.success("signupComplete");
            window.location.href = "/pages/rider/dashboard.html";
        } else {
            scoot.error("network");
        }
    });
});
