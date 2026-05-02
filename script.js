// ===== ZEROUAN INC. CORE SCRIPT =====

// Debug init
console.log("ZEROUAN INC. loaded");

// ===== Smooth interactions =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", function (e) {
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

// ===== Button feedback =====
const buttons = document.querySelectorAll(".social-button, .nav-cta, .hero-cta");

buttons.forEach(btn => {
  btn.addEventListener("mouseenter", () => {
    btn.style.transform = "scale(1.05)";
  });

  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "";
  });
});