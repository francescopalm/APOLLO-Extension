// Global constants for element IDs
const TOOLTIP_ID = 'phishing-alert-tooltip';
const ALERT_OVERLAY_ID = 'apollo-alert-overlay';

// Global variable for hide tooltip timeout
let hideTimeout;

// --- Initialization ---

// 1. Initial execution when the script loads
window.onload = async function () {
  console.log("Apollo Content Script loaded.");
  injectStyles();

  // Retrieve the active Gmail account email address
  const gmailAccount = getGmailAccountFromTab();

  // Notify the Service Worker that the content script is ready
  // This also triggers the initial OAuth status check
  try {
    const { status } = await chrome.runtime.sendMessage({ action: "checkServiceWorker", data: gmailAccount });
    console.log("Initial OAuth Status:", status);
  } catch (error) {
    console.warn("Service Worker might be starting. Message failed:", error.message);
  }
};

/**
 * Injects all dynamic CSS rules required for tooltips and alerts
 * into the document's <head> once.
 */
function injectStyles() {
  const STYLE_ID = 'apollo-phishing-styles';
  if (document.getElementById(STYLE_ID)) return; // Avoid duplicates

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
        /* --- Tooltip (Medium Risk) Styles --- */
        #${TOOLTIP_ID} {
          display: flex;
          position: absolute; 
          background: #fff;
          color: #b80000;
          text-align: center;
          padding: 5px 10px; 
          border-radius: 5px;
          border-style: solid;
          border-color: #b80000;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          z-index: 10000;
          pointer-events: auto;
          white-space: pre-wrap;
        }

        #${TOOLTIP_ID}::before {
            content: "";
            position: absolute;
            top: -10px;
            left: 5%; 
            transform: translateX(-50%); 
            width: 0;
            height: 0;
            border-left: 10px solid transparent;
            border-right: 10px solid transparent;
            border-bottom: 10px solid #b80000;
        }
        
        #${TOOLTIP_ID} .tooltip-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            line-height: 150%;
        }

        #${TOOLTIP_ID} .tooltip-icon {
            display: flex;
            flex-direction: column;
        }

        /* --- Phishing Alert (High Risk) Styles --- */
        #${ALERT_OVERLAY_ID} {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 999999;
        }
        .apollo-alert-box {
            background-color: #b80000;
            color: white;
            border-radius: 12px;
            max-width: 700px;
            width: 80%;
            position: relative;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            font-family: 'Roboto', Inter, sans-serif;
            text-align: left;
        }
        .apollo-alert-header {
            display: flex;
            align-items: flex-start;
            gap: 5px;
            border-bottom: 1px solid #fff;
            padding: 10px 25px;
        }
        .apollo-alert-header h1 {
            font-size: 26px;
            font-weight: bold; /* Ensure h1 is bold */
            color: white; /* Ensure color override */
        }
        .apollo-alert-icon {
            margin: auto 0;
        }
        .apollo-alert-icon svg {
            width: 36px;
            height: 36px;
        }
        .apollo-alert-body {
            padding: 10px 25px;
            font-size: 17px;
            line-height: 1.8;
        }
        .apollo-alert-body hr {
            width: 96%;
            color: #fff;
        }
        .apollo-alert-actions {
            display: flex;
            align-items: center;
            padding: 25px 25px;
        }
        .apollo-alert-details {
            display: none; /* Hidden by default */
            padding-bottom: 10px;
        }
        .apollo-alert-details p {
            padding: 0 25px;
            font-size: 17px;
            line-height: 1.8;
        }
        .apollo-alert-details a {
            color: white; /* Ensure link color matches */
        }
        .apollo-btn {
            padding: 13px 23px;
            font-weight: 500;
            font-size: 16px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
        }
        .apollo-btn-primary {
            background-color: white;
            color: #b80000;
        }
        .apollo-btn-secondary {
            text-decoration: underline;
            padding: 0;
            color: #fff;
            background-color: transparent;
        }
        .phishing-medium-risk:hover {
            cursor: not-allowed;
        }
        .phishing-medium-risk:active {
            pointer-events: none;
        }
        .spinner-icon {
            border: 2px solid rgba(0, 0, 0, 0.1);
            border-top-color: #555;
            border-radius: 50%;
            width: 10px;
            height: 10px;
            animation: spin 1s linear infinite; /* Animation */
            display: inline-block;
            vertical-align: middle;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
  document.head.appendChild(style);
}

// --- Global SVG Icon Definition (for Tooltip and Alert) ---

// Create the shared SVG warning icon definition
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const iconContainer = document.createElement("div");
const svg = document.createElementNS(SVG_NAMESPACE, "svg");
svg.setAttribute("xmlns", SVG_NAMESPACE);
svg.setAttribute("viewBox", "0 0 20 20");
svg.setAttribute("fill", "currentColor");
svg.setAttribute("style", "width: 36px; height: 36px");

const path = document.createElementNS(SVG_NAMESPACE, "path");
path.setAttribute("fill-rule", "evenodd");
path.setAttribute(
  "d",
  "M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
);
path.setAttribute("clip-rule", "evenodd");

svg.appendChild(path);
iconContainer.appendChild(svg);

// --- Tooltip Functions (Medium Risk) ---

function showTooltip(targetElement) {
  const tooltip = document.createElement('div');
  tooltip.id = TOOLTIP_ID;

  const tooltipContent = document.createElement('div');
  tooltipContent.className = 'tooltip-content'; // Apply style from injectStyles

  const MAX_CHAR_LENGTH = 50;
  const url = targetElement.href;
  let linkDisplayed = url;
  if (url.length > MAX_CHAR_LENGTH) {
    linkDisplayed = url.substring(0, MAX_CHAR_LENGTH) + '...';
  }
  tooltipContent.innerHTML = `FAKE WEBSITE, DON'T CLICK!<br>Link goes to:<br><a style="color: inherit" href="${url}">${linkDisplayed}</a>`;

  // Clone the global icon to prevent conflicts
  const iconClone = iconContainer.cloneNode(true);
  iconClone.className = 'tooltip-icon'; // Apply style from injectStyles

  // Position the tooltip
  const rect = targetElement.getBoundingClientRect();
  tooltip.style.left = (rect.left + window.scrollX) + 'px';
  tooltip.style.top = (rect.bottom + window.scrollY + 5) + 'px';

  tooltip.appendChild(iconClone);
  tooltip.appendChild(tooltipContent);
  document.body.appendChild(tooltip);


  tooltip.addEventListener('mouseenter', () => {
    clearTimeout(hideTimeout);
  })
  tooltip.addEventListener('mouseleave', () => {
    hideTooltip()
  })
}

function hideTooltip() {
  hideTimeout = setTimeout(() => {
    const existingTooltip = document.getElementById(TOOLTIP_ID);
    if (existingTooltip) {
      existingTooltip.remove();
    }
  }, 100); // 100ms

}

// --- Phishing Alert Functions ---

/**
 * Attaches the correct protection logic based on the phishing probability value.
 * @param {object} explanation - The explanation object from the API.
 * @param {number} phishingProbability - The phishing probability (0 to 100).
 */
function attachPhishingProtection(explanation, phishingProbability) {
  const emailBody = document.querySelector("div.a3s"); // Gmail's main body selector
  if (!emailBody) return;

  const links = emailBody.querySelectorAll("a[href]");

  // If no links, show the alert immediately.
  if (links.length === 0) {
    showPhishingAlert(explanation);

    // If medium risk (30-70), attach hover tooltips.
  } else if (phishingProbability >= 30 && phishingProbability <= 70) {
    links.forEach(link => {
      if (!link.classList.contains('phishing-medium-risk')) {
        const tooltip = (e) => showTooltip(e.currentTarget);
        link.addEventListener('mouseover', tooltip);
        link.addEventListener('mouseleave', hideTooltip);
        link.classList.add('phishing-medium-risk');
      }
    });
    // Otherwise (high risk), attach click-intercepting alerts.
  } else {
    links.forEach(link => {
      // Use a class to prevent duplicate listeners
      if (!link.classList.contains('phishing-high-risk')) {
        link.addEventListener("click", (e) => {
          const url = e.currentTarget.href;
          e.preventDefault();
          e.stopPropagation();
          console.log(explanation, url);
          showPhishingAlert(explanation, url);
        });
        link.classList.add('phishing-high-risk');
      }
    });
  }
}

/**
 * Creates and displays the full-screen phishing alert modal.
 * @param {object} explanation - The explanation object.
 * @param {string} [url] - The dangerous URL (if a link was clicked).
 */
function showPhishingAlert(explanation, url) {
  // Prevent duplicate overlays
  if (document.getElementById(ALERT_OVERLAY_ID)) return;

  // Create elements and assign classes (styles are in injectStyles)
  const overlay = document.createElement("div");
  overlay.id = ALERT_OVERLAY_ID;

  const box = document.createElement("div");
  box.className = "apollo-alert-box";

  // Header
  const wrapper = document.createElement("div");
  wrapper.className = "apollo-alert-header";

  const iconClone = iconContainer.cloneNode(true);
  iconClone.className = "apollo-alert-icon";

  const title = document.createElement("h1");
  title.textContent = "Deceptive website ahead";

  wrapper.appendChild(iconClone);
  wrapper.appendChild(title);

  // Body
  const feature = document.createElement("div");
  feature.className = "apollo-alert-body";

  const msg = document.createElement("p");
  msg.textContent = explanation.explanation;

  const divider = document.createElement("hr");

  feature.appendChild(msg);
  feature.appendChild(divider);

  // Actions
  const actions = document.createElement("div");
  actions.className = "apollo-alert-actions";

  const okBtn = document.createElement("button");
  okBtn.textContent = "Back to safety";
  okBtn.className = "apollo-btn apollo-btn-primary";
  okBtn.onclick = () => overlay.remove();

  actions.appendChild(okBtn); // "Back to safety" is always added

  // Details & Advanced (Only if a URL is provided)
  const visitWebsite = document.createElement("div");
  visitWebsite.className = "apollo-alert-details";

  if (url) {
    const detailsBtn = document.createElement("button");
    detailsBtn.textContent = "Show details";
    detailsBtn.className = "apollo-btn apollo-btn-secondary";
    detailsBtn.onclick = () => {
      const computedStyle = window.getComputedStyle(visitWebsite);
      const isHidden = computedStyle.getPropertyValue('display') === 'none';
      visitWebsite.style.display = isHidden ? "block" : "none";
      detailsBtn.textContent = isHidden ? "Hide details" : "Show details";
    };

    const continueMsg = document.createElement("p");
    continueMsg.innerHTML = `Click <a href="${url}" target="_blank">here</a> (not safe) to visit the linked website.`;

    visitWebsite.appendChild(continueMsg);

    // Adjust action layout
    actions.style.justifyContent = "space-between";
    actions.prepend(detailsBtn); // Add details button before 'okBtn'
  } else {
    // If no URL, just justify the 'okBtn' to the end
    actions.style.justifyContent = "flex-end";
  }

  // Assemble the modal
  box.appendChild(wrapper);
  box.appendChild(feature);
  box.appendChild(actions);
  if (url) {
    box.appendChild(visitWebsite);
  }
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// --- Classification Logic Functions ---

/**
 * Checks if the extension is authenticated and ready.
 * @returns {Promise<boolean>} True if the token is valid.
 */
async function isDelphiRunning() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getOAuthStatus" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Communication error with background:", chrome.runtime.lastError.message);
        return resolve(false); // Assume not running
      }
      resolve(response && response.oauthStatus === "VALID TOKEN");
    });
  });
}

/**
 * Starts the classification process by sending the message ID to the Service Worker.
 * @param {string} messageID - The Gmail message ID.
 */
function startClassification(messageID) {
  createClassificationLabel(messageID);
  chrome.runtime.sendMessage({ action: "sendMessageID", data: messageID }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Failed to get classification:", chrome.runtime.lastError.message);
      return;
    }
    if (response.error) {
      console.error("Analysis Error:", response.error);
      return;
    }
    showResult(response.result, messageID);
  });
}

/**
 * Displays "Classifying..." label in the Gmail UI.
 */
function createClassificationLabel(messageID) {
  const label = document.createElement('span');
  label.setAttribute('data-email-id', messageID);
  label.style.marginLeft = '8px';
  label.style.padding = "10px";
  label.style.textAlign = "center";
  label.style.background = "#f5f5f5";
  label.style.color = "#262626";
  label.textContent = 'Classifying ';

  // Add spinner icon
    const spinnerContainer = document.createElement('span');
    spinnerContainer.style.display = 'inline-block';
    spinnerContainer.style.marginRight = '5px';
    const spinner = document.createElement('span');
    spinner.className = 'spinner-icon';


  // .go is the selector for the Gmail header action bar
  // .gD if .go is not available
  const targetElement = document.querySelector(".go") || document.querySelector(".gD");
  spinnerContainer.appendChild(spinner);
  label.appendChild(spinnerContainer);
  targetElement?.appendChild(label);
}


/**
 * Displays the classification result (label) in the Gmail UI.
 * @param {object} result - The analysis result from the Service Worker.
 */
function showResult(result, messageID) {
  if(!document.querySelector(`span[data-email-id="${messageID}"]`)) {
    createClassificationLabel(messageID)
  }
  const label = document.querySelector(`span[data-email-id="${messageID}"]`);

  if (result.classification_result === "legit") {
    label.style.background = "#ecfcca";
    label.style.color = "#35530e";
    label.textContent = 'Legit';
  } else {
    label.style.background = "#ffc9c9";
    label.style.color = "#82181a";
    label.textContent = 'Phishing';
    label.style.fontWeight = "bold";

    // If phishing, attach the necessary UI protections (alerts/tooltips)
    attachPhishingProtection(result.feature_explain, result.phishing_probability);
  }
}

// --- DOM Observers and Listeners ---

// The MutationObserver watches for Gmail UI changes (e.g., opening an email)
const observer = new MutationObserver(async (mutationsList) => {
  for (const mutation of mutationsList) {
    if (mutation.type === "childList") {
      // Find the container that holds the message ID
      const messageIDContainer = document.querySelector("div.adn.ads");

      if (messageIDContainer && !messageIDContainer.dataset.processed) {
        messageIDContainer.dataset.processed = "true"; // Mark as processed
        const messageID = messageIDContainer.getAttribute('data-legacy-message-id');

        // Check if the extension is authenticated before proceeding
        const isRunning = await isDelphiRunning();
        if (isRunning) {
          // Check if this email is already in the local cache
          chrome.storage.local.get(messageID, (cacheEntry) => {
            if (cacheEntry[messageID]) {
              // Found in cache, display immediately
              showResult(cacheEntry[messageID], messageID);
            } else {
              // Not in cache, start API classification
              startClassification(messageID);
            }
          });
        }
      }
    }
  }
});

// Start observing the entire page for changes
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Listens for specific requests from the Service Worker (e.g., on tab switch)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getGmailAccount") {
    const gmailAccount = getGmailAccountFromTab();
    sendResponse({ gmailAccount });
  }
});

/**
 * Helper function to get the current Gmail account from the page's metadata.
 * @returns {string} The email address.
 */
function getGmailAccountFromTab() {
  const meta = document.getElementsByTagName("meta")[0];
  return meta.content;
}