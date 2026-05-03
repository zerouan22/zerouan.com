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

// ===== Gallery Lightbox =====
const buttons = document.querySelectorAll(".social-button, .nav-cta, .hero-cta");

buttons.forEach(btn => {
  btn.addEventListener("mouseenter", () => {
    btn.style.transform = "scale(1.05)";
  });

  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "";
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const triggers = document.querySelectorAll(".gallery-lightbox-trigger");
  const lightbox = document.getElementById("galleryLightbox");
  const lightboxImage = document.getElementById("lightboxImage");
  const closeButton = document.querySelector(".lightbox-close");

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const fullImage = trigger.dataset.full;

      if (!fullImage) return;

      lightboxImage.src = fullImage;
      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
    });
  });

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    lightboxImage.src = "";
  }

  closeButton.addEventListener("click", closeLightbox);

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLightbox();
    }
  });
});