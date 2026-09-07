(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const selectors = [
    ".manifesto > .section-label",
    ".manifesto-copy",
    ".numbers-intro",
    ".number-list article",
    ".all-spaces-wrap",
    ".spaces > .section-label",
    ".spaces-heading",
    ".space-card",
    ".standard-head",
    ".standard-list article",
    ".process-head",
    ".process-grid article",
    ".process-note",
    ".contact-intro",
    ".contact-button",
    ".contact-bottom",
    ".editorial-hero-inner",
    ".split-heading",
    ".about-image-band > div",
    ".numbers-panel-head",
    ".numbers-panel article",
    ".values-head",
    ".values-grid article",
    ".process-overview-head",
    ".process-detail",
    ".process-proof-copy",
    ".editorial-cta > p",
    ".editorial-cta > h2",
    ".editorial-cta > a",
    ".archive-hero > *",
    ".archive-title-row",
    ".archive-card",
    ".archive-contact > *",
    ".project-hero-content",
    ".project-intro-inner",
    ".project-gallery-head",
    ".gallery-item",
    ".next-project-content",
    ".inquiry-hero-content",
    ".inquiry-aside",
    ".form-top",
    ".form-section",
    ".form-consent",
    ".form-submit",
    ".submit-note",
    "main.thanks-shell > *"
  ];
  const items = Array.from(document.querySelectorAll(selectors.join(",")));

  if (!items.length) return;

  items.forEach((element, index) => {
    element.classList.add("motion-item");
    element.style.setProperty("--motion-delay", `${(index % 3) * 70}ms`);
  });

  if (reduceMotion || !("IntersectionObserver" in window)) {
    items.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  document.documentElement.classList.add("motion-ready");

  let observer;
  const reveal = (element) => {
    element.classList.add("is-visible");
    observer?.unobserve(element);
  };

  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) reveal(entry.target);
    });
  }, {
    threshold: 0.08,
    rootMargin: "0px 0px -5% 0px"
  });

  items.forEach((element) => observer.observe(element));

  window.setTimeout(() => {
    items.forEach((element) => {
      if (!element.classList.contains("is-visible")) reveal(element);
    });
  }, 2500);
})();

(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const useInertia = window.matchMedia("(pointer: fine) and (min-width: 901px)").matches;

  if (reduceMotion || !useInertia || !("requestAnimationFrame" in window)) return;

  const root = document.documentElement;
  let current = window.scrollY;
  let destination = current;
  let frame = 0;
  let previousTime = 0;

  root.classList.add("inertia-scroll");

  const scrollLimit = () => Math.max(0, root.scrollHeight - window.innerHeight);
  const clamp = (value) => Math.min(scrollLimit(), Math.max(0, value));

  const cancelInertia = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    current = window.scrollY;
    destination = current;
  };

  const animate = (time) => {
    const elapsed = previousTime ? Math.min(32, time - previousTime) : 16.67;
    const easing = 1 - Math.pow(0.88, elapsed / 16.67);
    const distance = destination - current;

    previousTime = time;
    current += distance * easing;

    if (Math.abs(distance) < 0.35) {
      current = destination;
      window.scrollTo(0, current);
      frame = 0;
      previousTime = 0;
      return;
    }

    window.scrollTo(0, current);
    frame = window.requestAnimationFrame(animate);
  };

  const startInertia = (nextDestination) => {
    destination = clamp(nextDestination);
    if (frame) return;
    current = window.scrollY;
    previousTime = 0;
    frame = window.requestAnimationFrame(animate);
  };

  const normalizeWheel = (event) => {
    let delta = event.deltaY;
    if (event.deltaMode === 1) delta *= 16;
    if (event.deltaMode === 2) delta *= window.innerHeight;
    return Math.max(-180, Math.min(180, delta));
  };

  const shouldKeepNativeScroll = (origin, delta) => {
    if (!(origin instanceof Element)) return false;
    if (origin.closest("dialog[open], textarea, select, input[type='number'], [contenteditable='true'], [data-native-scroll]")) return true;

    let element = origin;
    while (element && element !== document.body) {
      const overflowY = window.getComputedStyle(element).overflowY;
      const isScrollable = /auto|scroll|overlay/.test(overflowY) && element.scrollHeight > element.clientHeight + 1;

      if (isScrollable) {
        const canScrollUp = delta < 0 && element.scrollTop > 0;
        const canScrollDown = delta > 0 && element.scrollTop + element.clientHeight < element.scrollHeight - 1;
        if (canScrollUp || canScrollDown) return true;
      }

      element = element.parentElement;
    }

    return false;
  };

  window.addEventListener("wheel", (event) => {
    if (event.ctrlKey || event.metaKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

    const delta = normalizeWheel(event);
    if (!delta || shouldKeepNativeScroll(event.target, delta)) return;

    event.preventDefault();
    startInertia(destination + delta);
  }, { passive: false });

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target instanceof Element ? event.target.closest("a[href^='#']") : null;
    if (!link || link.classList.contains("skip-link")) return;

    const hash = link.getAttribute("href");
    if (!hash) return;

    let target;
    if (hash === "#") {
      target = root;
    } else {
      try {
        target = document.getElementById(decodeURIComponent(hash.slice(1)));
      } catch {
        return;
      }
    }

    if (!target) return;

    event.preventDefault();
    startInertia(window.scrollY + target.getBoundingClientRect().top);

    try {
      window.history.pushState(null, "", hash);
    } catch {
      // File previews can restrict history updates; scrolling should still work.
    }
  });

  window.addEventListener("scroll", () => {
    if (!frame) {
      current = window.scrollY;
      destination = current;
    }
  }, { passive: true });

  window.addEventListener("resize", cancelInertia, { passive: true });
  window.addEventListener("hashchange", cancelInertia, { passive: true });
  window.addEventListener("keydown", cancelInertia, { passive: true });
  window.addEventListener("pointerdown", cancelInertia, { passive: true });
  window.addEventListener("touchstart", cancelInertia, { passive: true });
})();
