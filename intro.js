(() => {
  const STORAGE_KEY = "yiso-cinematic-intro-v2";
  const intro = document.getElementById("yiso-intro");
  const site = document.querySelector("body > main");
  if (!intro || !site) return;

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
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const panelImages = [...intro.querySelectorAll(".yiso-intro__panel")].map((panel) => [
    ...panel.querySelectorAll(".yiso-intro__image")
  ]);
  let imageIndex = 0;
  let opening = false;
  let sliderTimer = 0;
  let cursorFrame = 0;
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

    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    ) + 48;
    const startClip = `circle(0px at ${x}px ${y}px)`;
    const endClip = `circle(${radius}px at ${x}px ${y}px)`;
    const duration = reducedMotion ? 120 : 1150;

    site.style.position = "relative";
    site.style.zIndex = "2147483644";
    site.style.clipPath = startClip;
    site.style.webkitClipPath = startClip;

    requestAnimationFrame(() => {
      const animation = site.animate(
        [
          { clipPath: startClip, WebkitClipPath: startClip },
          { clipPath: endClip, WebkitClipPath: endClip }
        ],
        { duration, easing: "cubic-bezier(.76, 0, .18, 1)", fill: "forwards" }
      );

      animation.finished.catch(() => {}).finally(() => {
        try {
          sessionStorage.setItem(STORAGE_KEY, "seen");
        } catch (_) {
          // The intro still works when storage is unavailable.
        }
        intro.remove();
        site.style.removeProperty("position");
        site.style.removeProperty("z-index");
        site.style.removeProperty("clip-path");
        site.style.removeProperty("-webkit-clip-path");
        document.documentElement.classList.add("yiso-intro-skip");
      });
    });
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
  }, { once: true });
})();
