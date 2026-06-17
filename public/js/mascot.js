(async () => {
    const mascot = document.querySelector(".corner-photo");
    if (!mascot) return;

    const data = await fetch("/json/mascot.json").then(r => r.json());

    // Session memory
    const memory = {
        greeted: false,
        lastHintTime: 0,
        mood: "chill"
    };

    // Create bubble
    const bubble = document.createElement("div");
    bubble.className = "mascot-bubble";
    Object.assign(bubble.style, {
        position: "fixed",
        bottom: "200px",
        right: "40px",
        maxWidth: "260px",
        padding: "12px 16px",
        background: "rgba(0,0,0,0.75)",
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
        setTimeout(() => bubble.style.display = "none", 4500);
    }

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // Detect page
    const path = window.location.pathname;
    let pageType = "home";

    if (path.includes("order")) pageType = "order";
    if (path.includes("signup")) pageType = "riderSignup";
    if (path.includes("dashboard")) pageType = "riderDashboard";
    if (path.includes("admin")) pageType = "admin";

    // Mood engine
    function updateMood() {
        const moods = Object.keys(data.personality.moods);
        memory.mood = pick(moods);
    }

    setInterval(updateMood, 15000);

    // Intro
    setTimeout(() => {
        say(pick(data.intro));
        memory.greeted = true;
    }, 800);

    // Page hint
    setTimeout(() => {
        const hints = data.pageHints[pageType];
        if (hints) say(pick(hints));
    }, 3000);

    // Hover
    mascot.addEventListener("mouseenter", () => {
        say(pick(data.reactions.hover));
        mascot.style.transform = "scale(1.12)";
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
    }, Math.random() * 8000 + 15000);

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
        },
        mood: () => memory.mood
    };
})();
