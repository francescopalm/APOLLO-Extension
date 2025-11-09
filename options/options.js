// Send API keys to Apollo and save to chrome.storage.sync
const sendOptions = () => {
  const openai = document.getElementById('openai-apikey').value;
  const virustotal = document.getElementById('vt-apikey').value;
  const bigdata = document.getElementById('bd-apikey').value;
  const apikeys = { "OPENAI_API_KEY": openai, "VT_API": virustotal, "DNS_API": bigdata }


  chrome.storage.sync.set(
    { openaiAPIKey: openai, virustotalAPIKey: virustotal, bigdataAPIKey: bigdata },
    () => { }
  );

  // Chiamata API Flask setapikey
  (async () => {
    try {
      const request = await fetch("http://127.0.0.1:5000/setapikey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apikeys)
      });
      const result = await request.json();

      console.log("Success:", result.success);
      if (result.success == true) {
        // Update status to let user know options were saved.
        const status = document.getElementById('status');
        status.textContent = 'API keys successfully set.';
        setTimeout(() => {
          status.textContent = '';
        }, 5000);
      }
    } catch (error) {
      console.error("Errore:", error);
      const status = document.getElementById('status');
      status.style.color = "red";
      status.textContent = 'Error: ' + error;
        setTimeout(() => {
          status.textContent = '';
        }, 5000);
      //sendResponse({ error: error.message });
    }
  })();
};

// Save options to chrome.storage.sync
const saveOptions = () => {
  const timeWindow = document.getElementById('time-window').value;
  const maxResults = document.getElementById('max-results').value;

  chrome.storage.sync.set(
    { time_window: timeWindow, max_results: maxResults },
    () => {}
  );
};


// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
  chrome.storage.sync.get(
    ['openaiAPIKey', 'virustotalAPIKey', 'bigdataAPIKey'],
    (items) => {
      document.getElementById('openai-apikey').value = items.openaiAPIKey;
      document.getElementById('vt-apikey').value = items.virustotalAPIKey;
      document.getElementById('bd-apikey').value = items.bigdataAPIKey;
    }
  );
};


const clearCache = async () => {
    try {
        await chrome.storage.local.clear();
        console.log("Cache succesfully cleared.");
        const status = document.getElementById('status');
        status.textContent = 'Cache cleared.';
        setTimeout(() => {
          status.textContent = '';
        }, 5000);
    } catch (error) {
        console.error("Error during cache cleaning: ", error);
    }
};


document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('send').addEventListener('click', sendOptions);
document.getElementById('clear-cache').addEventListener('click', clearCache);
document.getElementById('save').addEventListener('click', saveOptions);