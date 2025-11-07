window.onload = async function () {
  console.log("Content Script loaded succesfully!");
  injectStyles();

  // Recupero l'indirizzo mail dell'account loggato in Gmail
  const gmail_account = getGmailAccountFromTab();
  const { status } = await chrome.runtime.sendMessage({ action: "checkServiceWorker", data: gmail_account });
  console.log(status);

}

function injectStyles() {
    const styleId = 'phishing-tooltip-styles';
    if (document.getElementById(styleId)) return; // Evita duplicati

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* Regole Tooltip */
        #phishing-alert-tooltip {
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
          pointer-events: none; /* Non blocca gli eventi mouse sul link sottostante */
          white-space: pre-wrap;
        }

        /* Regole Freccetta (Triangolino) */
        #phishing-alert-tooltip::before {
            content: "";
            position: absolute;
            
            /* Il tooltip appare SOTTO il link, quindi il triangolino deve puntare VERSO l'ALTO */
            top: -10px; /* Sposta 10px sopra il bordo */
            left: 5%; 
            transform: translateX(-50%); 
            
            width: 0;
            height: 0;
            /* Crea il triangolo puntando in alto */
            border-left: 10px solid transparent;
            border-right: 10px solid transparent;
            border-bottom: 10px solid #b80000;
        }
    `;
    document.head.appendChild(style);
}

const TOOLTIP_ID = 'phishing-alert-tooltip';

// 3️⃣ Crea il contenitore <div> dell'SVG
const iconContainer = document.createElement("div");
iconContainer.style.margin = "auto 0";

// 4️⃣ Crea l'SVG con il namespace corretto
const svgNS = "http://www.w3.org/2000/svg";
const svg = document.createElementNS(svgNS, "svg");
svg.setAttribute("xmlns", svgNS);
svg.setAttribute("viewBox", "0 0 20 20");
svg.setAttribute("fill", "currentColor");
svg.style.width = "36px";
svg.style.height = "36px";

// 5️⃣ Crea il path interno
const path = document.createElementNS(svgNS, "path");
path.setAttribute("fill-rule", "evenodd");
path.setAttribute(
  "d",
  "M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
);
path.setAttribute("clip-rule", "evenodd");

// 6️⃣ Inserisci il path dentro l'SVG e l'SVG nel contenitore
svg.appendChild(path);
iconContainer.appendChild(svg);

function showTooltip(targetElement) {

    const tooltip = document.createElement('div');
    tooltip.id = TOOLTIP_ID;
    
    const tooltipContent = document.createElement('div');
    // Formatta il messaggio nel tooltip, effettuando un troncamento nel caso di lunghezza > 50 caratteri
    const MAX_CHAR_LENGTH = 50;
    let linkDisplayed = targetElement.href;
    if(linkDisplayed.length > 50){
      linkDisplayed = linkDisplayed.substring(0, 50)  + '...';
    }
    tooltipContent.innerHTML = `FAKE WEBSITE, DON'T CLICK!\nLink goes to:\n<u>${linkDisplayed}</u>`;
    
    // Stile CSS


    tooltipContent.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        line-height: 150%;
    `

    iconContainer.style.cssText = `
        display: flex;
        flex-direction: column;
    `
    
    // Posizionamento sotto il link
    const rect = targetElement.getBoundingClientRect();
    tooltip.style.left = (rect.left + window.scrollX) + 'px';
    tooltip.style.top = (rect.bottom + window.scrollY + 5) + 'px';

    tooltip.appendChild(iconContainer);
    tooltip.appendChild(tooltipContent);

    document.body.appendChild(tooltip);
}

function hideTooltip() {
    const existingTooltip = document.getElementById(TOOLTIP_ID);
    if (existingTooltip) {
        existingTooltip.remove();
    }
}

function getGmailAccountFromTab() {
  const meta = document.getElementsByTagName("meta")[0];
  return meta.content;
}

function attachPhishingProtection(explanation, phishing_probability) {
  const mailBody = document.querySelector("div.a3s"); // seleziono il corpo della mail
  if (!mailBody) return;

  const links = mailBody.querySelectorAll("a[href]"); //seleziono tutti i link presenti nel body

  // Se nella mail non ci sono link, visualizza il warning alla sua apertura
  if (links.length == 0) {
    showPhishingAlert(explanation);
  // Altrimenti, se phishing_probability è compreso tra 30 e 70, sarà visualizzato il tooltip al passaggio del mouse.
  } else if (phishing_probability >= 30 && phishing_probability <= 70) {
    links.forEach(link => {
            // Evita listener multipli se la funzione viene chiamata più volte
            if (!link.classList.contains('phishing-medium-risk')) {
                
                // Funzione per mostrare il tooltip
                const tooltip = (e) => showTooltip(e.currentTarget);
                
                // Aggiungi i listener
                link.addEventListener('mouseover', tooltip);
                link.addEventListener('mouseout', hideTooltip);
                
                link.classList.add('phishing-medium-risk');
            }
        });
    // Altrimenti il warning sarà visualizzato al clic sul link all'interno della mail
  } else {
    links.forEach(link => {
      link.addEventListener("click", (e) => {
        const url = e.currentTarget.href;
        e.preventDefault();
        e.stopPropagation();
        showPhishingAlert(explanation, url)
      });
    });
  }


}

function showPhishingAlert(explanation, url) {
  // se già presente, non duplicarlo
  if (document.getElementById("phishing-alert-overlay")) return;


  // overlay nero semi-trasparente
  const overlay = document.createElement("div");
  overlay.id = "phishing-alert-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.zIndex = "999999";


  // box rosso centrale
  const box = document.createElement("div");
  box.style.backgroundColor = "#b80000"; // rosso avviso Chrome
  box.style.color = "white";
  //box.style.padding = "30px";
  box.style.borderRadius = "12px";
  box.style.maxWidth = "700px";
  box.style.width = "80%";
  box.style.position = "relative";
  box.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
  box.style.fontFamily = "Inter, sans-serif";
  box.style.textAlign = "left";


  // titolo
  const title = document.createElement("h1");
  title.style.fontSize = "26px";
  title.textContent = "Deceptive website ahead";

  // 2️⃣ Crea il wrapper per allineare titolo + icona
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "flex-start";
  wrapper.style.gap = "5px"; // piccolo spazio tra icona e testo
  wrapper.style.borderBottomStyle = "solid";
  wrapper.style.borderBottomWidth = "1px";
  wrapper.style.borderBottomColor = "#fff";
  wrapper.style.padding = "10px 25px";

  // 3️⃣ Crea il contenitore <div> dell'SVG
  const iconContainer = document.createElement("div");
  iconContainer.style.margin = "auto 0";

  // 4️⃣ Crea l'SVG con il namespace corretto
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("xmlns", svgNS);
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("fill", "currentColor");
  svg.style.width = "36px";
  svg.style.height = "36px";

  // 5️⃣ Crea il path interno
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("fill-rule", "evenodd");
  path.setAttribute(
    "d",
    "M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
  );
  path.setAttribute("clip-rule", "evenodd");

  // 6️⃣ Inserisci il path dentro l'SVG e l'SVG nel contenitore
  svg.appendChild(path);
  iconContainer.appendChild(svg);

  // 7️⃣ Inserisci icona e titolo nel wrapper
  wrapper.appendChild(iconContainer);
  wrapper.appendChild(title);


  // messaggio dinamico
  const feature = document.createElement("div");


  //const subtitle = document.createElement("h2");
  //subtitle.textContent = explanation.feature;
  //subtitle.style.fontSize = "16px";
  //subtitle.style.marginBottom = "0";

  const msg = document.createElement("p");
  msg.textContent = explanation.explanation;
  msg.style.padding = "10px 25px";
  msg.style.fontSize = "17px";
  msg.style.lineHeight = "1.8";


  const divider = document.createElement("hr")
  divider.style.width = "96%";
  divider.style.color = "#fff";



  //feature.appendChild(subtitle);
  feature.appendChild(msg);
  feature.appendChild(divider);




  // contenitore bottoni
  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.alignItems = "center";
  if (url) {
    actions.style.justifyContent = "space-between";
  } else {
    actions.style.justifyContent = "end";
  }
  actions.style.padding = "25px 25px"



  // pulsante "Back to safety"
  const okBtn = document.createElement("button");
  okBtn.textContent = "Back to safety";
  okBtn.style.padding = "13px 23px";
  okBtn.style.fontWeight = "500";
  okBtn.style.fontSize = "16px";
  okBtn.style.backgroundColor = "white";
  okBtn.style.color = "#b80000";
  okBtn.style.border = "none";
  okBtn.style.borderRadius = "10px";
  okBtn.style.cursor = "pointer";
  okBtn.onclick = () => overlay.remove();

  // pulsante "Show details"
  const detailsBtn = document.createElement("button");
  detailsBtn.textContent = "Show details";
  detailsBtn.style.textDecoration = "underline";
  detailsBtn.style.padding = "0";
  detailsBtn.style.fontWeight = "500";
  detailsBtn.style.fontSize = "16px";
  detailsBtn.style.color = "#fff";
  detailsBtn.style.backgroundColor = "transparent";
  detailsBtn.style.border = "none";
  detailsBtn.style.cursor = "pointer";
  detailsBtn.onclick = () => {
    if (visitWebsite.style.display == "none") {
      visitWebsite.style.display = "block"; // Mostra il div
      detailsBtn.textContent = "Hide details";
    }
    else {
      visitWebsite.style.display = "none"; // Nasconde il div
      detailsBtn.textContent = "Show details";
    }

  };

  if (url) {
    actions.appendChild(detailsBtn);
  }
  actions.appendChild(okBtn);


  // contenitore nascosto "click here (not safe) to visit"
  const visitWebsite = document.createElement("div");
  visitWebsite.id = "div-advanced";
  visitWebsite.style.display = "none";
  visitWebsite.style.paddingBottom = "10px";


  const continueMsg = document.createElement("p");
  continueMsg.innerHTML = `Click <a href="${url}" target="_blank" style="color: white">here</a> (not safe) to visit the linked website.`;
  continueMsg.style.padding = "0 25px";
  continueMsg.style.fontSize = "17px";
  continueMsg.style.lineHeight = "1.8";

  visitWebsite.appendChild(continueMsg);


  // monta tutto
  box.appendChild(wrapper);
  box.appendChild(feature);
  box.appendChild(actions);
  if (url) {
    box.appendChild(visitWebsite);
  }
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}


async function isDelphiRunning() {
  return new Promise((resolve, reject) => {

    chrome.runtime.sendMessage({ action: "getOAuthStatus" }, (response) => {

      // Gestione errori di comunicazione
      if (chrome.runtime.lastError) {
        console.error("Errore di comunicazione con il background:", chrome.runtime.lastError.message);
        return resolve(false); // Considera l'estensione non in esecuzione
      }

      // Risposta ricevuta (funzione di callback originale)
      if (response && response.oauthStatus === "VALID TOKEN") {
        resolve(true); // Risolve la Promise a 'true'
      } else {
        resolve(false); // Risolve la Promise a 'false'
      }
    });

  });
}
// Avvia l’osservazione del DOM di Gmail
const observer = new MutationObserver(async (mutationsList) => {

  for (const mutation of mutationsList) {
    if (mutation.type === "childList") {
      // Cerca l'elemento contenente il message-id da utilizzare con API Gmail
      const messageIDContainer = document.querySelector("div.adn.ads");
      const messageID = messageIDContainer ? messageIDContainer.getAttribute('data-legacy-message-id') : null;


      if (messageIDContainer && !messageIDContainer.dataset.processed) {
        messageIDContainer.dataset.processed = "true"; // Evita doppie elaborazioni
        console.log(messageID);

        // Controllo che Delphi sia in esecuzione attraverso l'analisi di oauth_status
        const isRunning = await isDelphiRunning();
        if (isRunning) {

          // Controllo se la classificazione è già presente in cache
          chrome.storage.local.get(messageID, (result) => {
            console.log(result[messageID] || []);
            if (result[messageID]) {
              showResult(result[messageID]);
            }
            else {
              startClassification();
            }
          });


          function startClassification() {
            chrome.runtime.sendMessage({ action: "sendMessageID", data: messageID },
              function (response) {
                console.log(response.result);
                showResult(response.result);
              });
          }

          function showResult(result) {
            const label = document.createElement('span');
            if (result.classification_result == "legit") {
              console.log(result.classification_result);
              label.style.background = "#ecfcca";
              label.style.padding = "10px";
              label.style.color = "#35530e";
              label.style.textAlign = "center";
              label.textContent = 'legit';
              label.style.marginLeft = '8px';

              document.querySelector(".go").appendChild(label);

            }
            else {
              console.log(result.classification_result);
              label.style.background = "#ffc9c9";
              label.style.padding = "10px";
              label.style.color = "#82181a";
              label.style.textAlign = "center";
              label.textContent = 'phishing';
              label.style.fontWeight = "bold";
              label.style.marginLeft = '8px';

              document.querySelector(".go").appendChild(label);
              attachPhishingProtection(result.feature_explain, result.phishing_probability);
            }
          }
        }
      }
    }
  }
});


// Avvia l'osservatore sull'intera pagina
observer.observe(document.body, {
  childList: true,
  subtree: true
});


// Ascolta i messaggi provenienti dal background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action === "getGmailAccount") {
    console.log("Content Script: Ricevuto ordine di rilettura DOM.");

    const gmail_account = getGmailAccountFromTab();
    sendResponse({
      gmail_account
    });

    // Non è necessario return true qui se sendResponse viene chiamato in modo sincrono.
  }
});