(async () => {
    const mascot = document.querySelector(".corner-photo");
    if (!mascot) return;

    const data = await fetch("/json/mascot.json").then(r => r.json());

    /* -------------------------------
       CHAT WINDOW (SMALLER + COLLAPSIBLE)
    --------------------------------*/
    const chat = document.createElement("div");
    Object.assign(chat.style, {
        position: "fixed",
        bottom: "80px",
        right: "20px",
        width: "240px",
        background: "rgba(0,0,0,0.85)",
        color: "#fff",
        padding: "10px",
        borderRadius: "10px",
        fontSize: "13px",
        lineHeight: "1.35",
        zIndex: "9999",
        backdropFilter: "blur(4px)",
        display: "none",
        maxHeight: "260px",
        overflow: "hidden",
        transition: "0.25s ease"
    });

    chat.innerHTML = `
        <div style="font-weight:600; margin-bottom:4px;">Scoot</div>

        <div id="scootLast" style="margin-bottom:6px; min-height:20px;"></div>

        <button id="toggleHistory" 
            style="background:none; border:none; color:#ffcc00; font-size:12px; cursor:pointer; margin-bottom:6px;">
            Show History
        </button>

        <div id="scootHistory" style="display:none; max-height:120px; overflow-y:auto; margin-bottom:6px;"></div>

        <input id="scootInput" type="text" placeholder="Ask Scoot…" 
            style="width:100%; padding:6px; border-radius:6px; border:none;">
    `;
    document.body.appendChild(chat);

    const lastMsg = chat.querySelector("#scootLast");
    const history = chat.querySelector("#scootHistory");
    const toggleHistory = chat.querySelector("#toggleHistory");
    const input = chat.querySelector("#scootInput");

    let historyOpen = false;

    toggleHistory.onclick = () => {
        historyOpen = !historyOpen;
        history.style.display = historyOpen ? "block" : "none";
        toggleHistory.innerText = historyOpen ? "Hide History" : "Show History";
    };

    /* -------------------------------
       SMALLER CHAT BUTTON
    --------------------------------*/
    const toggle = document.createElement("div");
    toggle.innerText = "💬";
    Object.assign(toggle.style, {
        position: "fixed",
        bottom: "12px",
        right: "160px",
        background: "#ffcc00",
        color: "#000",
        padding: "8px 10px",
        borderRadius: "50%",
        fontSize: "16px",
        cursor: "pointer",
        zIndex: "9999",
        fontWeight: "bold",
        boxShadow: "0 0 8px rgba(0,0,0,0.4)"
    });
    document.body.appendChild(toggle);

    let open = false;
    toggle.onclick = () => {
        open = !open;
        chat.style.display = open ? "block" : "none";
    };

    /* -------------------------------
       MESSAGE SYSTEM (SMALLER + LAST MESSAGE)
    --------------------------------*/
    function addMessage(text, sender = "scoot") {
        const bubble = document.createElement("div");
        bubble.style.marginBottom = "4px";
        bubble.style.padding = "6px 8px";
        bubble.style.borderRadius = "6px";
        bubble.style.maxWidth = "90%";
        bubble.style.fontSize = "12px";

        if (sender === "user") {
            bubble.style.background = "#ffcc00";
            bubble.style.color = "#000";
            bubble.style.marginLeft = "auto";
        } else {
            bubble.style.background = "rgba(255,255,255,0.15)";
        }

        bubble.innerText = text;
        history.appendChild(bubble);

        // Show last message only
        lastMsg.innerText = text;

        // Auto-hide history bubble after 20s
        setTimeout(() => bubble.remove(), 20000);
    }

    function say(text) {
        addMessage(text, "scoot");
        chat.style.display = "block";
        open = true;
    }

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /* -------------------------------
       PAGE DETECTION
    --------------------------------*/
    const path = window.location.pathname;
    let page = "home";
    if (path.includes("order")) page = "order";
    if (path.includes("signup") && path.includes("rider")) page = "riderSignup";
    if (path.includes("signup") && path.includes("client")) page = "clientSignup";
    if (path.includes("dashboard")) page = "riderDashboard";
    if (path.includes("admin")) page = "admin";

    /* -------------------------------
       Q&A ENGINE
    --------------------------------*/
    function normalize(t) { return t.toLowerCase().trim(); }

    function findAnswer(q) {
        q = normalize(q);

        const buckets = [data.qa.client, data.qa.rider, data.qa.general];

        for (const bucket of buckets) {
            for (const item of bucket) {
                for (const tag of item.tags) {
                    if (q.includes(normalize(tag))) return item.answer;
                }
            }
        }

        return data.errors.unknownQuestion;
    }

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const q = input.value.trim();
            if (!q) return;

            addMessage(q, "user");
            input.value = "";

            setTimeout(() => {
                say(findAnswer(q));
            }, 1500);
        }
    });

    /* -------------------------------
       INTRO + PAGE HINTS (SMALLER + DELAYED)
    --------------------------------*/
    setTimeout(() => say(pick(data.intro)), 3000);
    setTimeout(() => say(pick(data.pageHints[page])), 9000);

    /* -------------------------------
       MASCOT REACTIONS (SMALLER + DELAYED)
    --------------------------------*/
    mascot.addEventListener("mouseenter", () => {
        mascot.style.transform = "scale(1.05)";
        setTimeout(() => say(pick(data.reactions.hover)), 1200);
    });

    mascot.addEventListener("mouseleave", () => {
        mascot.style.transform = "scale(1)";
    });

    mascot.addEventListener("click", () => {
        setTimeout(() => say(pick(data.reactions.click)), 1200);
    });

    /* -------------------------------
       IDLE CHATTER (LESS FREQUENT)
    --------------------------------*/
    setInterval(() => {
        say(pick(data.reactions.idle));
    }, Math.random() * 40000 + 50000);

    /* -------------------------------
       PUBLIC API
    --------------------------------*/
    window.scoot = {
        success: (t) => data.success[t] && say(data.success[t]),
        error: (t) => data.errors[t] && say(data.errors[t]),
        hint: (t) => data.pageHints[t] && say(pick(data.pageHints[t]))
    };
})();
