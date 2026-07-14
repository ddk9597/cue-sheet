(() => {
  "use strict";

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const revealGroups = [
    { selector: ".about-hero-copy > *", origin: "left", step: 55, maxDelay: 220 },
    { selector: ".about-hero-visual", origin: "right", delay: 130 },
    { selector: ".about-quick-nav a", origin: "up", step: 45, maxDelay: 135 },
    { selector: ".about-story-section .about-section-heading", origin: "up" },
    { selector: ".about-promise-list article", origin: "right", step: 70, maxDelay: 140 },
    { selector: ".about-feature-section .about-section-heading", origin: "up" },
    { selector: ".about-feature-card", origin: "up", step: 60, maxDelay: 240 },
    { selector: ".about-workflow-section .about-section-heading", origin: "up" },
    { selector: ".about-workflow-list li", origin: "up", step: 70, maxDelay: 210 },
    { selector: ".about-audience-section .about-section-heading", origin: "up" },
    { selector: ".about-role-grid article", origin: "up", step: 70, maxDelay: 140 },
    { selector: ".about-final-cta", origin: "up" },
  ];
  const revealItems = collectRevealItems();

  if (reducedMotionQuery.matches || !("IntersectionObserver" in window)) {
    revealItems.forEach(showRevealItem);
    return;
  }

  document.documentElement.classList.add("about-motion-ready");

  const observer = new IntersectionObserver(handleIntersections, {
    threshold: 0.14,
    rootMargin: "0px 0px -8% 0px",
  });

  revealItems.forEach((item) => observer.observe(item));
  revealCurrentHashTarget();

  window.addEventListener("hashchange", revealCurrentHashTarget);
  reducedMotionQuery.addEventListener?.("change", handleMotionPreferenceChange);

  function collectRevealItems() {
    const items = new Set();

    revealGroups.forEach((group) => {
      const elements = document.querySelectorAll(group.selector);

      elements.forEach((element, index) => {
        const staggerDelay = group.delay ?? Math.min(index * (group.step || 0), group.maxDelay || 0);

        element.classList.add("about-reveal");
        element.dataset.aboutReveal = group.origin || "up";
        element.style.setProperty("--about-reveal-delay", `${staggerDelay}ms`);
        items.add(element);
      });
    });

    return [...items];
  }

  function handleIntersections(entries) {
    entries.forEach((entry) => {
      if (!entry.isIntersecting && entry.boundingClientRect.top >= 0) {
        return;
      }

      showRevealItem(entry.target);
      observer.unobserve(entry.target);
    });
  }

  function showRevealItem(element) {
    element.classList.add("about-is-visible");
  }

  function revealCurrentHashTarget() {
    const targetId = decodeURIComponent(window.location.hash.slice(1));

    if (!targetId) {
      return;
    }

    const target = document.getElementById(targetId);

    if (!target) {
      return;
    }

    if (target.classList.contains("about-reveal")) {
      showRevealItem(target);
      observer.unobserve(target);
    }

    target.querySelectorAll(".about-reveal").forEach((item) => {
      showRevealItem(item);
      observer.unobserve(item);
    });
  }

  function handleMotionPreferenceChange(event) {
    if (!event.matches) {
      return;
    }

    observer.disconnect();
    document.documentElement.classList.remove("about-motion-ready");
    revealItems.forEach(showRevealItem);
    window.removeEventListener("hashchange", revealCurrentHashTarget);
  }
})();
