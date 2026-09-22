(() => {
  const slides = [...document.querySelectorAll(".hero-image .hero-slide")];
  if (slides.length < 2) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const interval = reducedMotion ? 7000 : 5400;
  const crossfadeDuration = reducedMotion ? 300 : 1850;
  const intro = document.getElementById("yiso-intro");
  const waitsForIntro = Boolean(intro && !document.documentElement.classList.contains("yiso-intro-skip"));
  let activeIndex = 0;
  let timer = 0;
  let cleanupTimer = 0;

  const showNext = () => {
    const previous = slides[activeIndex];
    activeIndex = (activeIndex + 1) % slides.length;
    const next = slides[activeIndex];

    previous.classList.add("is-leaving");
    next.classList.remove("is-active", "is-leaving");
    void next.offsetWidth;
    next.classList.add("is-active");

    window.clearTimeout(cleanupTimer);
    cleanupTimer = window.setTimeout(() => {
      previous.classList.remove("is-active", "is-leaving");
      cleanupTimer = 0;
    }, crossfadeDuration);
  };

  const start = (restartCurrent = false) => {
    if (timer) return;
    if (restartCurrent) {
      const current = slides[activeIndex];
      current.classList.remove("is-active", "is-leaving");
      void current.offsetWidth;
      current.classList.add("is-active");
    }
    timer = window.setInterval(showNext, interval);
  };

  const stop = () => {
    window.clearInterval(timer);
    timer = 0;
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (!waitsForIntro || !document.getElementById("yiso-intro")) start();
  });

  window.addEventListener("pagehide", () => {
    stop();
    window.clearTimeout(cleanupTimer);
  }, { once: true });
  if (waitsForIntro) {
    window.addEventListener("yiso:home-opening", () => start(true), { once: true });
  } else {
    start(true);
  }
})();
