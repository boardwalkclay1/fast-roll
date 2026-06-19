(async () => {
    const mascot = document.querySelector(".corner-photo");
    if (!mascot) return;

    const data = await fetch("/json/mascot.json").then(r => r.json());

    /* -------------------------------
       CHAT WINDOW
    --------------------------------*/
    const chat = document.createElement("div");
    Object.assign(chat.style, {
        position: "fixed",
        bottom: "90px",
        right: "20px",
        width: "280px",
        background: "rgba(0,0,0,0.85)",
        color: "#fff",
        padding: "12px",
        borderRadius: "12px",
        fontSize: "14px",
        lineHeight: "1.4",
        zIndex: "9999",
        backdropFilter: "blur(4px)",
        display: "none",
        maxHeight: "320px",
        overflowY: "auto"
    });

    chat.innerHTML = `
        <div style="font-weight:600; margin-bottom:6px;">Scoot Chat</div>
        <div id="scootHistory" style="margin-bottom:8px;"></div>
        <div id="scootTyping" style="font-size:12px; opacity:0.7; display:none;">${data.typing[0]}</div>
        <input id="scootInput" type="text" placeholder="Ask Scoot…" 
            style="width:100%; padding:6px; border-radius:6px; border:none; margin-top:8px;">
    `;
    document.body.appendChild(chat);

    const history = chat.querySelector("#scootHistory");
    const typing = chat.querySelector("#scootTyping");
    const input = chat.querySelector("#scootInput");

    /* -------------------------------
       TOGGLE BUTTON
    --------------------------------*/
    const toggle = document.createElement("div");
    toggle.innerText = "💬";
    Object.assign(toggle.style, {
        position: "fixed",
        bottom: "12px",
        right: "210px",
        background: "#ffcc00",
        color: "#000",
        padding: "10px 14px",
        borderRadius: "50%",
        fontSize: "20px",
        cursor: "pointer",
        zIndex: "9999",
        fontWeight: "bold",
        boxShadow: "0 0 10px rgba(0,0,0,0.4)"
    });
    document.body.appendChild(toggle);

    let open = false;
    toggle.onclick = () => {
        open = !open;
        chat.style.display = open ? "block" : "none";
    };

    /* -------------------------------
       MESSAGE SYSTEM
    --------------------------------*/
    function addMessage(text, sender = "scoot") {
        const bubble = document.createElement("div");
        bubble.style.marginBottom = "6px";
        bubble.style.padding = "8px 10px";
        bubble.style.borderRadius = "8px";
        bubble.style.maxWidth = "90%";

        if (sender === "user") {
            bubble.style.background = "#ffcc00";
            bubble.style.color = "#000";
            bubble.style.marginLeft = "auto";
        } else {
            bubble.style.background = "rgba(255,255,255,0.15)";
        }

        bubble.innerText = text;
        history.appendChild(bubble);
        chat.scrollTop = chat.scrollHeight;

        setTimeout(() => bubble.remove(), 25000); // 5× slower
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

            typing.style.display = "block";
            typing.innerText = pick(data.typing);

            setTimeout(() => {
                typing.style.display = "none";
                say(findAnswer(q));
            }, 3000); // 5× slower
        }
    });

    /* -------------------------------
       INTRO + PAGE HINTS
    --------------------------------*/
    setTimeout(() => say(pick(data.intro)), 4000); // 5× slower
    setTimeout(() => say(pick(data.pageHints[page])), 15000); // 5× slower

    /* -------------------------------
       MASCOT REACTIONS
    --------------------------------*/
    mascot.addEventListener("mouseenter", () => {
        setTimeout(() => say(pick(data.reactions.hover)), 2000); // slower
        mascot.style.transform = "scale(1.08)";
    });

    mascot.addEventListener("mouseleave", () => {
        mascot.style.transform = "scale(1)";
    });

    mascot.addEventListener("click", () => {
        setTimeout(() => say(pick(data.reactions.click)), 2000); // slower
    });

    /* -------------------------------
       IDLE CHATTER
    --------------------------------*/
    setInterval(() => {
        say(pick(data.reactions.idle));
    }, Math.random() * 50000 + 60000); // 5× slower

    /* -------------------------------
       PUBLIC API
    --------------------------------*/
    window.scoot = {
        success: (t) => data.success[t] && say(data.success[t]),
        error: (t) => data.errors[t] && say(data.errors[t]),
        hint: (t) => data.pageHints[t] && say(pick(data.pageHints[t]))
    };
})();
