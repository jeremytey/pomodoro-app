// settings.js
// ✅ Single, authoritative settings manager + modal navigation

// -------- Settings store --------
const Settings = {
  durations: {
    get: () =>
      JSON.parse(localStorage.getItem("timerDurations")) || {
        pomodoro: 25,
        short: 5,
        long: 15,
      },
    save: (durations) => {
      localStorage.setItem("timerDurations", JSON.stringify(durations));
      window.dispatchEvent(
        new CustomEvent("durationsUpdated", { detail: durations })
      );
    },
  },
  theme: {
    get: () => localStorage.getItem("selectedTheme") || "default",
    save: (theme) => {
      localStorage.setItem("selectedTheme", theme);
      applyTheme(theme);
      window.dispatchEvent(new CustomEvent("themeUpdated", { detail: theme }));
    },
  },
  sound: {
    get: () => localStorage.getItem("alarmSound") || "bell",
    save: (sound) => {
      localStorage.setItem("alarmSound", sound);
      window.dispatchEvent(new CustomEvent("soundUpdated", { detail: sound }));
    },
  },
};

// -------- Themes --------
const themes = {
  default: {
    font: "'Orbitron', sans-serif",
    fontSize: "6rem",
    timerColor: "#00f5d4",
    backgroundColor: "rgba(20, 20, 30, 0.9)",
    accentColor: "#00f5d4",
    containerBg:
      "linear-gradient(145deg, rgba(20, 20, 30, 0.9), rgba(30, 30, 45, 0.9))",
    buttonColor: "#00f5d4",
    buttonGradient: "linear-gradient(145deg, #00f5d4, #00d4b4)",
    buttonShadow: "0 6px #00bfa5, 0 0 15px rgba(0, 245, 212, 0.6)",
    textShadow: "0 0 20px rgba(0, 245, 212, 0.6)",
  },
  minimal: {
    font: "'Roboto Mono', monospace",
    fontSize: "6rem",
    timerColor: "#ffffff",
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    accentColor: "#888888",
    containerBg:
      "linear-gradient(145deg, rgba(0, 0, 0, 0.95), rgba(20, 20, 20, 0.95))",
    buttonColor: "#ffffff",
    buttonGradient: "linear-gradient(145deg, #ffffff, #e0e0e0)",
    buttonShadow: "0 6px #888888, 0 0 15px rgba(255, 255, 255, 0.3)",
    textShadow: "none",
  },
  darkAcademia: {
    font: "'Playfair Display', serif",
    fontSize: "6.5rem",
    timerColor: "#c9a875",
    backgroundColor: "rgba(28, 25, 23, 0.95)",
    accentColor: "#8b7355",
    containerBg:
      "linear-gradient(145deg, rgba(28, 25, 23, 0.95), rgba(40, 35, 30, 0.95))",
    buttonColor: "#c9a875",
    buttonGradient: "linear-gradient(145deg, #c9a875, #b89665)",
    buttonShadow: "0 6px #8b7355, 0 0 15px rgba(201, 168, 117, 0.4)",
    textShadow: "0 0 20px rgba(201, 168, 117, 0.4)",
  },
  forest: {
    font: "'Quicksand', sans-serif",
    fontSize: "6rem",
    timerColor: "#90be6d",
    backgroundColor: "rgba(37, 50, 35, 0.9)",
    accentColor: "#6b9742",
    containerBg:
      "linear-gradient(145deg, rgba(37, 50, 35, 0.9), rgba(45, 60, 42, 0.9))",
    buttonColor: "#90be6d",
    buttonGradient: "linear-gradient(145deg, #90be6d, #80ae5d)",
    buttonShadow: "0 6px #6b9742, 0 0 15px rgba(144, 190, 109, 0.5)",
    textShadow: "0 0 20px rgba(144, 190, 109, 0.5)",
  },
};

function applyTheme(themeName) {
  const theme = themes[themeName];
  if (!theme) return;
  const root = document.documentElement;
  root.style.setProperty("--font-family", theme.font);
  root.style.setProperty("--timer-color", theme.timerColor);
  root.style.setProperty("--background-color", theme.backgroundColor);
  root.style.setProperty("--accent-color", theme.accentColor);
  root.style.setProperty("--container-bg", theme.containerBg);
  root.style.setProperty("--button-color", theme.buttonColor);
  root.style.setProperty("--timer-font-size", theme.fontSize);
  root.style.setProperty("--timer-shadow", theme.textShadow);
  root.style.setProperty("--button-gradient", theme.buttonGradient || "");
  root.style.setProperty("--button-shadow", theme.buttonShadow || "");
  document.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === themeName);
  });
}

// -------- Modal helpers --------
const MODAL_FADE_MS = 250;

function showModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove("hidden");
    requestAnimationFrame(() => modal.classList.add("show"));
  }
}

function hideModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove("show");
    setTimeout(() => modal.classList.add("hidden"), MODAL_FADE_MS);
  }
}

function hideAllModals() {
  document.querySelectorAll(".modal.show").forEach((m) => hideModal(m.id));
}

function swapModals(fromId, toId) {
  const from = document.getElementById(fromId);
  const to = document.getElementById(toId);

  if (from && to) {
    showModal(toId);
    hideModal(fromId);
  }
}

// -------- UI init --------
function loadSettingsUI() {
  const durations = Settings.durations.get();
  const theme = Settings.theme.get();
  const sound = Settings.sound.get();

  const pIn = document.getElementById("pomodoro-length");
  const sIn = document.getElementById("short-break-length");
  const lIn = document.getElementById("long-break-length");

  if (pIn) pIn.value = durations.pomodoro;
  if (sIn) sIn.value = durations.short;
  if (lIn) lIn.value = durations.long;

  document.querySelectorAll(".theme-btn").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.theme === theme)
  );
  document.querySelectorAll(".sound-btn").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.sound === sound)
  );

  applyTheme(theme);
}

// -------- Event wiring --------
document.addEventListener("DOMContentLoaded", () => {
  loadSettingsUI();

  const settingsBtn = document.getElementById("settings-btn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => showModal("settings-modal"));
  }

  document.querySelectorAll(".settings-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const setting = btn.dataset.setting;
      swapModals("settings-modal", `${setting}-modal`);
    });
  });

  const saveBtn = document.getElementById("save-durations");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const p = parseInt(document.getElementById("pomodoro-length").value) || 25;
      const s = parseInt(document.getElementById("short-break-length").value) || 5;
      const l = parseInt(document.getElementById("long-break-length").value) || 15;
      const newDur = { pomodoro: p, short: s, long: l };
      Settings.durations.save(newDur);
      hideModal("duration-modal");
    });
  }

  document.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      Settings.theme.save(btn.dataset.theme);
      hideModal("theme-modal");
    });
  });

  document.querySelectorAll(".sound-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      Settings.sound.save(btn.dataset.sound);
      hideModal("sound-modal");
    });
  });

  document.querySelectorAll(".close-modal").forEach((x) => {
    x.addEventListener("click", () => {
      hideModal(x.dataset.modal);
    });
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) hideModal(modal.id);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideAllModals();
  });

  window.addEventListener("themeUpdated", loadSettingsUI);
  window.addEventListener("soundUpdated", loadSettingsUI);
  window.addEventListener("durationsUpdated", loadSettingsUI);
});
