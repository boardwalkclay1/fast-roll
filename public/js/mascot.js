(async () => {
    const mascot = document.querySelector(".corner-photo");
    if (!mascot) return;

    const data = await fetch("/json/mascot.json").then(r => r.json());

    /* -------------------------------
       CHAT WINDOW + TOGGLE BUTTON
    --------------------------------*/
    const chatWrapper = document.createElement("div");
    Object.assign(chatWrapper.style, {
        position: "fixed",
        bottom: "90px",
        right: "20px",
        width: "260px",
        background: "rgba(0,0,0,0.85)",
        color: "#fff",
        padding: "12px",
        borderRadius: "12px",
        fontSize: "14px",
        lineHeight: "1.4",
        zIndex: "9999",
        backdropFilter: "blur(4px)",
        display: "none"
    });

    chatWrapper.innerHTML = `
        <div style="font-weight:600; margin-bottom:6px;">Scoot Chat</div>
        <div id="scootOutput" style="min-height:40px; margin-bottom:8px;"></div>
        <input id="scootInput" type="text" placeholder="Ask Scoot…" 
            style="width:100%; padding:6px; border-radius:6px; border:none; margin-bottom:6px;">
        <button id="scootSend" 
            style="width:100%; padding:6px; border-radius:6px; border:none; background:#ffcc00; color:#000; font-weight:600; cursor:pointer;">
            Send
        </button>
    `;
    document.body.appendChild(chatWrapper);

    const scootOutput = chatWrapper.querySelector("#scootOutput");
    const scootInput = chatWrapper.querySelector("#scootInput");
    const scootSend = chatWrapper.querySelector("#scootSend");

    /* -------------------------------
       TOGGLE BUTTON
    --------------------------------*/
    const toggleBtn = document.createElement("div");
    toggleBtn.innerText = "💬";
    Object.assign(toggleBtn.style, {
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
    document.body.appendChild(toggleBtn);

    let chatOpen = false;

    toggleBtn.onclick = () => {
        chatOpen = !chatOpen;
        chatWrapper.style.display = chatOpen ? "block" : "none";
    };

    /* -------------------------------
       MESSAGE SYSTEM (5 seconds)
    --------------------------------*/
    function say(text) {
        scootOutput.innerText = text;
        chatWrapper.style.display = "block";
        chatOpen = true;

        setTimeout(() => {
            scootOutput.innerText = "";
        }, 5000);
    }

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /* -------------------------------
       PAGE DETECTION
    --------------------------------*/
    const path = window.location.pathname;
    let pageType = "home";
    if (path.includes("order")) pageType = "order";
    if (path.includes("signup") && path.includes("rider")) pageType = "riderSignup";
    if (path.includes("signup") && path.includes("client")) pageType = "clientSignup";
    if (path.includes("dashboard")) pageType = "riderDashboard";
    if (path.includes("admin")) pageType = "admin";

    /* -------------------------------
       Q&A ENGINE
    --------------------------------*/
    function normalize(text) {
        return text.toLowerCase().trim();
    }

    function findAnswer(question) {
        const q = normalize(question);

        const buckets = [
            { list: data.qa.client },
            { list: data.qa.rider },
            { list: data.qa.general }
        ];

        for (const bucket of buckets) {
            for (const item of bucket.list) {
                for (const tag of item.tags) {
                    if (q.includes(normalize(tag))) {
                        return item.answer;
                    }
                }
            }
        }

        return data.errors.unknownQuestion;
    }

    scootSend.onclick = () => {
        const q = scootInput.value;
        if (!q) {
            say("Ask me something about orders, riders, payouts, or the Beltline.");
            return;
        }
        say(findAnswer(q));
        scootInput.value = "";
    };

    scootInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") scootSend.click();
    });

    /* -------------------------------
       INTRO + PAGE HINTS
    --------------------------------*/
    setTimeout(() => say(pick(data.intro)), 800);
    setTimeout(() => {
        const hints = data.pageHints[pageType];
        if (hints) say(pick(hints));
    }, 3000);

    /* -------------------------------
       MASCOT REACTIONS
    --------------------------------*/
    mascot.addEventListener("mouseenter", () => {
        say(pick(data.reactions.hover));
        mascot.style.transform = "scale(1.08)";
    });

    mascot.addEventListener("mouseleave", () => {
        mascot.style.transform = "scale(1)";
    });

    mascot.addEventListener("click", () => {
        say(pick(data.reactions.click));
    });

    /* -------------------------------
       IDLE CHATTER
    --------------------------------*/
    setInterval(() => {
        say(pick(data.reactions.idle));
    }, Math.random() * 10000 + 20000);

    /* -------------------------------
       PUBLIC API
    --------------------------------*/
    window.scoot = {
        success: (type) => data.success[type] && say(data.success[type]),
        error: (type) => data.errors[type] && say(data.errors[type]),
        hint: (topic) => data.pageHints[topic] && say(pick(data.pageHints[topic]))
    };
})();
