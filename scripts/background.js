import { checkOAuth } from "./oauth.js";
let google_auth_token = null;


// Unico listener per tutti i messaggi
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // DEBUG: Check running
    if (message.action === "checkServiceWorker") {
        console.log("Background Script loaded succesfully! Start INIT Routine");
        console.log(message.data);
        // Salvo l'account attivo utilizzato in Gmail
        chrome.storage.session.set({ gmailAccount: message.data });
        (async () => {
            const oauth_status = await checkOAuth();
            sendResponse({ status: oauth_status });
            chrome.storage.session.set({ oauth_status: oauth_status });
        })()
        return true;
    }


    // Gestione token Gmail
    if (message.type === "TOKEN_READY") {
        google_auth_token = message.accessToken;
        chrome.storage.session.set({ google_auth_token: message.accessToken });
        (async () => {
            const oauth_status = await checkOAuth();
            sendResponse({ status: oauth_status });
            chrome.storage.session.set({ oauth_status: oauth_status });
        })()
        return true;
    }

    if (message.type === "TOKEN_REMOVE") {
        google_auth_token = null;
        chrome.storage.session.remove("userInfo");
        chrome.storage.session.remove("google_auth_token");
        sendResponse({ success: true });
        return true;
    }

    // Controllo se oauth_status è nello stato di "VALID TOKEN"
    if (message.action === "getOAuthStatus") {
        (async () => {
            
            const result = await chrome.storage.session.get('oauth_status');
            sendResponse({ 
                oauthStatus: result.oauth_status 
            });
        })()    

        // Ritorno true per indicare che sendResponse sarà chiamata in modo asincrono
        return true; 
    }


    // Gestione analisi email
    if (message.action === "sendMessageID") {
        (async () => {
            try {
                // Prima fetch - Gmail API
                const gmailResponse = await fetch(
                    'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + message.data + "?format=raw",
                    {
                        headers: { Authorization: "Bearer " + google_auth_token }
                    }
                );
                const data = await gmailResponse.json();
                console.log(data);

                // Seconda fetch - Analisi
                const analysisResponse = await fetch("http://127.0.0.1:5000/analyze", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data.raw)
                });
                const result = await analysisResponse.json();

                console.log("Risultato analisi:", result.label);

                // Salvo il risultato in local storage
                const responseData = {
                    classification_result: result.label,
                    feature_explain: result.explanation[0],
                    phishing_probability: result.phishing_probability,
                    created_at: Date.now()
                };

                await chrome.storage.local.set({ [message.data]: responseData });
                console.log("Dato salvato con successo!");

                // Invio risposta al Content Script
                console.log("Responding...");
                sendResponse({ result: responseData });

            } catch (error) {
                console.error("Errore:", error);
                sendResponse({ error: error.message });
            }
        })();

        // Ritorno true per utilizzo di sendResponse() in modo asincrono
        return true;
    }

    // Se il messaggio non corrisponde a nessuna azione, non fare nulla
    return false;
});

// Listener per evento di cambio tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    
    const tabId = activeInfo.tabId;
    // Ottieni i dati della tab appena attivata
    const tab = await chrome.tabs.get(tabId);

    // 1. Verifica: La tab attivata è Gmail?
    if (tab.url && tab.url.startsWith('https://mail.google.com/')) {
        console.log(`Tab Gmail riattivata (ID: ${tabId}). Richiesta di lettura DOM...`);
        
        try {
            // 2. Invia il messaggio al content script della tab attiva
            const response = await chrome.tabs.sendMessage(tabId, { action: "getGmailAccount" });

            if (response) {
                chrome.storage.session.set({ gmailAccount: response.gmail_account });
                const {userInfo} = await chrome.storage.session.get('userInfo');
                if(response.gmail_account === userInfo){
                    chrome.storage.session.set({ oauth_status: "VALID TOKEN" });
                } else if(userInfo != undefined) {
                    chrome.storage.session.set({ oauth_status: "MAIL ACCOUNT MISMATCH" });
                }

            } else {
                console.log("Il content script non ha restituito un valore valido.");
            }

        } catch (error) {
            // Questo errore può verificarsi se il content script non è stato iniettato correttamente
            // o se la tab è stata appena aperta e non ha completato il caricamento.
            console.error("Errore durante l'invio/ricezione del messaggio al content script:", error.message);
        }
    }
});