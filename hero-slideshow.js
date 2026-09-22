(() => {
  const slides = [...document.querySelectorAll(".hero-image .hero-slide")];
  if (slides.length < 2) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const interval = reducedMotion ? 5000 : 2700;
  const intro = document.getElementById("yiso-intro");
  const waitsForIntro = Boolean(intro && !document.documentElement.classList.contains("yiso-intro-skip"));
  let activeIndex = 0;
  let timer = 0;

  const showNext = () => {
    const previous = slides[activeIndex];
    activeIndex = (activeIndex + 1) % slides.length;
    const next = slides[activeIndex];

    previous.classList.remove("is-active");
    next.classList.remove("is-active");
    void next.offsetWidth;
    next.classList.add("is-active");
  };

  const start = (restartCurrent = false) => {
    if (timer) return;
    if (restartCurrent) {
      const current = slides[activeIndex];
      current.classList.remove("is-active");
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

  window.addEventListener("pagehide", stop, { once: true });
  if (waitsForIntro) {
    window.addEventListener("yiso:home-opening", () => start(true), { once: true });
  } else {
    start(true);
  }
})();
