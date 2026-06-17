(async () => {
    const mascot = document.querySelector(".corner-photo");
    if (!mascot) return;

    const data = await fetch("/json/mascot.json").then(r => r.json());

    // Bubble
    const bubble = document.createElement("div");
    bubble.className = "mascot-bubble";
    Object.assign(bubble.style, {
        position: "fixed",
        bottom: "200px",
        right: "40px",
        maxWidth: "280px",
        padding: "12px 16px",
        background: "rgba(0,0,0,0.8)",
        color: "#fff",
        borderRadius: "12px",
        fontSize: "14px",
        lineHeight: "1.4",
        zIndex: "9999",
        display: "none",
        backdropFilter: "blur(4px)"
    });
    document.body.appendChild(bubble);

    function say(text) {
        bubble.innerText = text;
        bubble.style.display = "block";
        setTimeout(() => bubble.style.display = "none", 5000);
    }

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // Detect page
    const path = window.location.pathname;
    let pageType = "home";
    if (path.includes("order")) pageType = "order";
    if (path.includes("signup") && path.includes("rider")) pageType = "riderSignup";
    if (path.includes("signup") && path.includes("client")) pageType = "clientSignup";
    if (path.includes("dashboard")) pageType = "riderDashboard";
    if (path.includes("admin")) pageType = "admin";

    // Q&A UI
    const qaWrapper = document.createElement("div");
    Object.assign(qaWrapper.style, {
        position: "fixed",
        bottom: "12px",
        right: "220px",
        width: "220px",
        background: "rgba(0,0,0,0.75)",
        color: "#fff",
        padding: "8px 10px",
        borderRadius: "10px",
        fontSize: "13px",
        zIndex: "9998",
        backdropFilter: "blur(4px)"
    });

    qaWrapper.innerHTML = `
        <div style="margin-bottom:6px; font-weight:600;">Ask Scoot</div>
        <input type="text" id="scootQuestion" placeholder="Ask about orders or riding…" style="width:100%; padding:6px 8px; border-radius:6px; border:none; margin-bottom:6px; font-size:12px;">
        <button id="scootAskBtn" style="width:100%; padding:6px 8px; border-radius:6px; border:none; background:#ffcc00; color:#000; font-weight:600; font-size:12px; cursor:pointer;">
            Ask
        </button>
    `;
    document.body.appendChild(qaWrapper);

    const questionInput = qaWrapper.querySelector("#scootQuestion");
    const askBtn = qaWrapper.querySelector("#scootAskBtn");

    function normalize(text) {
        return text.toLowerCase().trim();
    }

    function findAnswer(question) {
        const q = normalize(question);

        const buckets = [
            { type: "client", list: data.qa.client },
            { type: "rider", list: data.qa.rider },
            { type: "general", list: data.qa.general }
        ];

        for (const bucket of buckets) {
            for (const item of bucket.list) {
                if (!item.tags) continue;
                for (const tag of item.tags) {
                    if (q.includes(normalize(tag))) {
                        return item.answer;
                    }
                }
            }
        }

        return data.errors.unknownQuestion;
    }

    askBtn.addEventListener("click", () => {
        const q = questionInput.value;
        if (!q) {
            say("Ask me something about orders, riders, payouts, or the Beltline.");
            return;
        }
        const answer = findAnswer(q);
        say(answer);
    });

    questionInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            askBtn.click();
        }
    });

    // Intro + hints
    setTimeout(() => {
        say(pick(data.intro));
    }, 800);

    setTimeout(() => {
        const hints = data.pageHints[pageType];
        if (hints) say(pick(hints));
    }, 3200);

    // Hover
    mascot.addEventListener("mouseenter", () => {
        say(pick(data.reactions.hover));
        mascot.style.transform = "scale(1.08)";
    });

    mascot.addEventListener("mouseleave", () => {
        mascot.style.transform = "scale(1)";
    });

    // Click
    mascot.addEventListener("click", () => {
        say(pick(data.reactions.click));
    });

    // Idle chatter
    setInterval(() => {
        say(pick(data.reactions.idle));
    }, Math.random() * 10000 + 20000);

    // Public API
    window.scoot = {
        success: (type) => {
            if (data.success[type]) say(data.success[type]);
        },
        error: (type) => {
            if (data.errors[type]) say(data.errors[type]);
        },
        hint: (topic) => {
            if (data.pageHints[topic]) say(pick(data.pageHints[topic]));
        }
    };
})();
