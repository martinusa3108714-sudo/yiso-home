(() => {
  const STORAGE_KEY = "yiso-cinematic-intro-v4";
  const intro = document.getElementById("yiso-intro");
  if (!intro) return;
  const site = document.querySelector("body > main");

  const query = new URLSearchParams(window.location.search);
  const forceIntro = query.get("intro") === "1";
  let alreadySeen = false;

  try {
    alreadySeen = sessionStorage.getItem(STORAGE_KEY) === "seen";
  } catch (_) {
    alreadySeen = false;
  }

  if (alreadySeen && !forceIntro) {
    intro.remove();
    document.documentElement.classList.add("yiso-intro-skip");
    return;
  }

  document.documentElement.classList.remove("yiso-intro-skip");
  if (site) site.classList.add("yiso-home-under-intro");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const panelImages = [...intro.querySelectorAll(".yiso-intro__panel")].map((panel) => [
    ...panel.querySelectorAll(".yiso-intro__image")
  ]);
  let imageIndex = 0;
  let opening = false;
  let sliderTimer = 0;
  let cursorFrame = 0;
  let revealFrame = 0;
  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;

  const swapImages = () => {
    imageIndex = imageIndex === 0 ? 1 : 0;
    panelImages.forEach((images) => {
      images.forEach((image, index) => image.classList.toggle("is-active", index === imageIndex));
    });
  };

  if (!reducedMotion) sliderTimer = window.setInterval(swapImages, 3000);

  const paintCursor = () => {
    intro.style.setProperty("--cursor-x", `${pointerX}px`);
    intro.style.setProperty("--cursor-y", `${pointerY}px`);
    cursorFrame = 0;
  };

  intro.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    intro.classList.add("is-pointer-active");
    if (!cursorFrame) cursorFrame = requestAnimationFrame(paintCursor);
  });

  intro.addEventListener("pointerleave", () => intro.classList.remove("is-pointer-active"));
  intro.addEventListener("pointerdown", () => intro.classList.add("is-pressing"));
  intro.addEventListener("pointerup", () => intro.classList.remove("is-pressing"));
  intro.addEventListener("pointercancel", () => intro.classList.remove("is-pressing"));

  const openSite = (x, y) => {
    if (opening) return;
    opening = true;
    window.clearInterval(sliderTimer);
    intro.classList.add("is-opening");
    if (site) {
      void site.offsetWidth;
      site.classList.add("is-entering");
    }
    window.dispatchEvent(new CustomEvent("yiso:home-opening"));

    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    ) + 120;
    const duration = reducedMotion ? 180 : 1320;
    const startedAt = performance.now();

    const finishOpening = () => {
      try {
        sessionStorage.setItem(STORAGE_KEY, "seen");
      } catch (_) {
        // The intro still works when storage is unavailable.
      }
      if (site) site.classList.remove("yiso-home-under-intro", "is-entering");
      intro.remove();
      document.documentElement.classList.add("yiso-intro-skip");
      window.dispatchEvent(new CustomEvent("yiso:home-entered"));
    };

    const paintReveal = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3.4);
      const currentRadius = radius * eased;
      const edge = currentRadius + 8;
      const mask = `radial-gradient(circle at ${x}px ${y}px, transparent 0, transparent ${currentRadius}px, #000 ${edge}px)`;
      const fadeProgress = Math.max(0, (progress - .76) / .24);
      const fadeEased = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);

      // Only the intro overlay is masked. The website below is never clipped,
      // so no reveal state can remain after the intro is removed.
      intro.style.maskImage = mask;
      intro.style.webkitMaskImage = mask;
      intro.style.opacity = String(1 - fadeEased);

      if (progress < 1) {
        revealFrame = requestAnimationFrame(paintReveal);
      } else {
        revealFrame = 0;
        finishOpening();
      }
    };

    revealFrame = requestAnimationFrame(paintReveal);
  };

  intro.addEventListener("click", (event) => openSite(event.clientX, event.clientY));
  intro.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openSite(window.innerWidth / 2, window.innerHeight / 2);
  });

  window.addEventListener("pagehide", () => {
    window.clearInterval(sliderTimer);
    if (cursorFrame) cancelAnimationFrame(cursorFrame);
    if (revealFrame) cancelAnimationFrame(revealFrame);
  }, { once: true });
})();
