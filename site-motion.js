(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const selectors = [
    ".manifesto-aside",
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
    ".belief-rail",
    ".about-image-band > div",
    ".numbers-panel-head",
    ".numbers-panel article",
    ".values-head",
    ".values-compass",
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
      const bounds = element.getBoundingClientRect();
      const isNearViewport = bounds.top < window.innerHeight * 1.25 && bounds.bottom > -window.innerHeight * .25;
      if (!element.classList.contains("is-visible") && isNearViewport) reveal(element);
    });
  }, 2500);
})();

(() => {
  const counters = Array.from(document.querySelectorAll("[data-counter]"));
  if (!counters.length) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canAnimate = "requestAnimationFrame" in window && "IntersectionObserver" in window && !reduceMotion;

  const valueNode = (counter) => counter.querySelector(".counter-value");
  const showFinalValue = (counter) => {
    const value = valueNode(counter);
    if (!value) return;
    value.textContent = counter.dataset.counter || value.textContent;
    counter.classList.remove("is-counting");
  };

  if (!canAnimate) {
    counters.forEach(showFinalValue);
    return;
  }

  const runCounter = (counter) => {
    if (counter.dataset.counterPlayed === "true") return;
    counter.dataset.counterPlayed = "true";

    const finalValue = counter.dataset.counter || "0";
    const target = Number.parseInt(finalValue, 10);
    const value = valueNode(counter);
    if (!value || !Number.isFinite(target)) return;

    const duration = 1250;
    const digitCount = finalValue.length;
    let startedAt = 0;
    let lastRendered = -1;

    counter.classList.add("is-counting");
    value.textContent = String(0).padStart(digitCount, "0");

    const frame = (time) => {
      if (!startedAt) startedAt = time;
      const elapsed = time - startedAt;
      const progress = Math.min(1, elapsed / duration);

      const current = Math.min(target, Math.floor(target * progress));
      if (current !== lastRendered) {
        value.textContent = String(current).padStart(digitCount, "0");
        lastRendered = current;
      }

      if (progress < 1) {
        window.requestAnimationFrame(frame);
      } else {
        showFinalValue(counter);
      }
    };

    window.requestAnimationFrame(frame);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      runCounter(entry.target);
      observer.unobserve(entry.target);
    });
  }, {
    threshold: .35,
    rootMargin: "0px 0px -8% 0px"
  });

  counters.forEach((counter) => {
    const value = valueNode(counter);
    if (value) value.textContent = String(0).padStart((counter.dataset.counter || "0").length, "0");
    observer.observe(counter);
  });
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

/* V5.8 — a restrained cinematic interface shared by every page. */
(() => {
  const root = document.documentElement;
  const body = document.body;
  if (!body || body.dataset.yisoEnhanced === "true") return;

  body.dataset.yisoEnhanced = "true";
  root.classList.add("yiso-design-ready");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const pageName = body.classList.contains("about-page")
    ? "ABOUT"
    : body.classList.contains("process-page")
      ? "PROCESS"
      : body.classList.contains("spaces-page")
        ? "PROJECT"
        : body.classList.contains("project-page")
          ? "PROJECT DETAIL"
          : body.classList.contains("inquiry-page")
            ? "PROJECT INQUIRY"
            : body.classList.contains("thanks-page")
              ? "THANK YOU"
              : "HOME";
  body.dataset.yisoPage = pageName;

  const progress = document.createElement("div");
  progress.className = "yiso-scroll-progress";
  progress.setAttribute("aria-hidden", "true");
  const progressBar = document.createElement("span");
  progress.append(progressBar);
  body.append(progress);

  const texture = document.createElement("div");
  texture.className = "yiso-screen-texture";
  texture.setAttribute("aria-hidden", "true");
  body.append(texture);

  const edgeLabel = document.createElement("div");
  edgeLabel.className = "yiso-edge-label";
  edgeLabel.setAttribute("aria-hidden", "true");
  const edgePage = document.createElement("span");
  edgePage.textContent = `YISO / ${pageName}`;
  const edgeYear = document.createElement("span");
  edgeYear.textContent = "BUSAN · 2026";
  edgeLabel.append(edgePage, edgeYear);
  body.append(edgeLabel);

  const sectionSelector = [
    ".manifesto",
    ".numbers",
    ".spaces",
    ".standard-section",
    ".process",
    ".contact",
    ".editorial-intro",
    ".about-image-band",
    ".numbers-panel",
    ".values-section",
    ".process-overview",
    ".process-proof",
    ".editorial-cta",
    ".archive",
    ".archive-contact",
    ".project-intro",
    ".project-gallery-section",
    ".next-project",
    ".inquiry-main"
  ].join(",");

  const sections = Array.from(document.querySelectorAll(sectionSelector));
  sections.forEach((section, index) => {
    section.classList.add("yiso-design-section");
    const marker = document.createElement("span");
    marker.className = "yiso-section-marker";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = String(index + 1).padStart(2, "0");
    section.append(marker);
  });

  if (!("IntersectionObserver" in window) || reduceMotion) {
    sections.forEach((section) => section.classList.add("design-in-view"));
  } else {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("design-in-view");
        sectionObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    sections.forEach((section) => sectionObserver.observe(section));
  }

  const spotlightTargets = Array.from(document.querySelectorAll([
    ".space-card",
    ".archive-card-link",
    ".gallery-item",
    ".project-meta > div",
    ".numbers-panel article",
    ".values-grid article",
    ".inquiry-step"
  ].join(",")));

  spotlightTargets.forEach((target) => {
    if (target.querySelector(":scope > .yiso-card-light")) return;
    const light = document.createElement("span");
    light.className = "yiso-card-light";
    light.setAttribute("aria-hidden", "true");
    target.append(light);

    if (!finePointer || reduceMotion) return;
    target.addEventListener("pointermove", (event) => {
      const bounds = target.getBoundingClientRect();
      target.style.setProperty("--yiso-spot-x", `${event.clientX - bounds.left}px`);
      target.style.setProperty("--yiso-spot-y", `${event.clientY - bounds.top}px`);
    }, { passive: true });
  });

  let pointer;
  if (finePointer && !reduceMotion) {
    pointer = document.createElement("span");
    pointer.className = "yiso-pointer";
    pointer.setAttribute("aria-hidden", "true");
    body.append(pointer);

    let pointerFrame = 0;
    let pointerX = -100;
    let pointerY = -100;
    let customCursorActive = false;
    const paintPointer = () => {
      pointer.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;
      pointerFrame = 0;
    };
    document.addEventListener("pointermove", (event) => {
      if (!customCursorActive) {
        root.classList.add("yiso-custom-cursor");
        customCursorActive = true;
      }
      pointerX = event.clientX;
      pointerY = event.clientY;
      pointer.classList.add("is-active");
      pointer.classList.toggle("is-interactive", Boolean(event.target instanceof Element && event.target.closest("a, button, input, textarea, .custom-select")));
      if (!pointerFrame) pointerFrame = window.requestAnimationFrame(paintPointer);
    }, { passive: true });
    document.addEventListener("pointerleave", () => {
      pointer.classList.remove("is-active", "is-interactive");
      root.classList.remove("yiso-custom-cursor");
      customCursorActive = false;
    }, { passive: true });
  }

  const header = document.querySelector(".global-header");
  let scrollFrame = 0;
  const paintScroll = () => {
    const maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
    const ratio = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    progressBar.style.transform = `scaleX(${ratio})`;
    header?.classList.toggle("is-condensed", window.scrollY > 32);
    scrollFrame = 0;
  };
  const requestScrollPaint = () => {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(paintScroll);
  };

  paintScroll();
  window.addEventListener("scroll", requestScrollPaint, { passive: true });
  window.addEventListener("resize", requestScrollPaint, { passive: true });
})();
