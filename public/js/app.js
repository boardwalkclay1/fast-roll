// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        document.querySelector(link.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Buttons
document.getElementById("orderBtn").addEventListener("click", () => {
    alert("Order flow coming next — PayPal checkout + receipt upload.");
});

document.getElementById("riderBtn").addEventListener("click", () => {
    alert("Rider onboarding coming next — sign-up + PayPal payout setup.");
});

document.getElementById("joinRiders").addEventListener("click", () => {
    alert("Rider onboarding module loading soon.");
});
