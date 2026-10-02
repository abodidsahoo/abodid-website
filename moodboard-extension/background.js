const MENU_ID = "send-image-to-moodboard";
const DEFAULT_API_BASE = "https://abodid.com/api/integrations/moodboard";
const MAX_BYTES = 20 * 1024 * 1024;

const MIME_BY_EXTENSION = {
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const EXTENSION_BY_MIME = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const createMenu = () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Send image under pointer to Moodboard",
      contexts: ["all"],
    });
  });
};

chrome.runtime.onInstalled.addListener((details) => {
  createMenu();
  if (details.reason === "install") chrome.runtime.openOptionsPage();
});

chrome.runtime.onStartup.addListener(createMenu);

const notify = (message, isError = false) => chrome.notifications.create({
  type: "basic",
  iconUrl: "icon-128.png",
  title: isError ? "Moodboard upload failed" : "Moodboard",
  message,
});

const responseError = async (response, fallback) => {
  try {
    const body = await response.json();
    return body.error || fallback;
  } catch {
    return fallback;
  }
};

const inferFilename = (srcUrl, contentType) => {
  let filename = "";
  try {
    const url = new URL(srcUrl);
    filename = decodeURIComponent(url.pathname.split("/").pop() || "");
  } catch {
    // Data and blob URLs use the fallback filename below.
  }

  filename = filename
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

  const currentExtension = filename.split(".").pop()?.toLowerCase() || "";
  const expectedExtension = EXTENSION_BY_MIME[contentType];
  if (!filename || !MIME_BY_EXTENSION[currentExtension]) {
    filename = `web-image-${new Date().toISOString().replace(/[:.]/g, "-")}.${expectedExtension}`;
  }
  return filename;
};

const sendImageToMoodboard = async (srcUrl) => {
  const { apiBase = DEFAULT_API_BASE, token = "" } = await chrome.storage.local.get([
    "apiBase",
    "token",
  ]);
  if (!token) {
    await chrome.runtime.openOptionsPage();
    throw new Error("Add the Moodboard token in the extension settings first.");
  }

  const imageResponse = await fetch(srcUrl, {
    cache: "no-store",
    credentials: "omit",
  });
  if (!imageResponse.ok) {
    throw new Error(`The source image could not be downloaded (HTTP ${imageResponse.status}).`);
  }

  const imageBlob = await imageResponse.blob();
  const headerType = (imageResponse.headers.get("content-type") || "").split(";")[0].toLowerCase();
  const blobType = (imageBlob.type || "").split(";")[0].toLowerCase();
  const contentType = EXTENSION_BY_MIME[blobType]
    ? blobType
    : EXTENSION_BY_MIME[headerType]
      ? headerType
      : "";
  if (!contentType) {
    throw new Error("This image is not a supported JPEG, PNG, WebP, GIF, or AVIF file.");
  }
  if (imageBlob.size <= 0 || imageBlob.size > MAX_BYTES) {
    throw new Error("The image must be 20 MB or smaller.");
  }

  const filename = inferFilename(srcUrl, contentType);
  const authorization = `Bearer ${token}`;
  const base = apiBase.replace(/\/$/, "");
  const prepareResponse = await fetch(`${base}/prepare`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filename, contentType, size: imageBlob.size }),
  });
  if (!prepareResponse.ok) {
    throw new Error(await responseError(prepareResponse, "The upload could not be prepared."));
  }

  const prepared = await prepareResponse.json();
  const uploadResponse = await fetch(prepared.uploadUrl, {
    method: "PUT",
    headers: prepared.requiredHeaders,
    body: imageBlob,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Cloudflare R2 rejected the upload (HTTP ${uploadResponse.status}).`);
  }

  const completeResponse = await fetch(`${base}/complete`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      objectKey: prepared.objectKey,
      originalFilename: filename,
      expectedSize: imageBlob.size,
    }),
  });
  if (!completeResponse.ok) {
    throw new Error(await responseError(completeResponse, "The moodboard item could not be created."));
  }

  return filename;
};

const resolveImageFromPage = (tabId, frameId) => new Promise((resolve) => {
  chrome.tabs.sendMessage(
    tabId,
    { type: "resolve-moodboard-image" },
    { frameId: frameId || 0 },
    (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response?.image || null);
    },
  );
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  (async () => {
    const resolved = tab?.id
      ? await resolveImageFromPage(tab.id, info.frameId)
      : null;
    const imageUrl = resolved?.url || info.srcUrl || "";
    if (!imageUrl) {
      throw new Error("No image was found under the pointer. Reload this page once and try again.");
    }

    return sendImageToMoodboard(imageUrl);
  })()
    .then((filename) => notify(`${filename} was added to your mood board.`))
    .catch((error) => notify(error?.message || "The image could not be uploaded.", true));
});
