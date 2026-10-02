const DEFAULT_API_BASE = "https://abodid.com/api/integrations/moodboard";

const form = document.getElementById("settings-form");
const apiBaseInput = document.getElementById("api-base");
const tokenInput = document.getElementById("token");
const status = document.getElementById("status");

const showStatus = (message, state) => {
  status.textContent = message;
  status.dataset.state = state;
};

chrome.storage.local.get(["apiBase", "token"]).then(({ apiBase, token }) => {
  apiBaseInput.value = apiBase || DEFAULT_API_BASE;
  tokenInput.value = token || "";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const apiBase = apiBaseInput.value.trim().replace(/\/$/, "");
  const token = tokenInput.value.trim();

  if (!apiBase.startsWith("https://") || token.length < 32) {
    showStatus("Use the HTTPS API address and a token of at least 32 characters.", "error");
    return;
  }

  await chrome.storage.local.set({ apiBase, token });
  showStatus("Saved. The right-click action is ready.", "success");
});
