window.addEventListener("load", (event) => {

    document.querySelector('#classification').addEventListener('click', function () {
        console.log("Inizio classificazione batch.");

        startClassification();

    });
});

async function startClassification() {
    try {
        // Filtro GMAIL: mail ricevute nell'ultimo giorno e MAX 10 RISULTATI, se non diversamente settato
        const { time_window = 1, max_results = 10 } = await chrome.storage.sync.get(['time_window', 'max_results']);
        const query = `q=newer_than:${time_window}d&maxResults=${max_results}`;
        console.log("LA QUERY: " + query);

        chrome.storage.session.get('google_auth_token', function (result) {



            // Chiamata API messages.list
            fetch(
                'https://gmail.googleapis.com/gmail/v1/users/me/messages?' + query,
                {
                    headers: { Authorization: "Bearer " + result.google_auth_token }
                })
                .then((response) => response.json())
                .then(function (data) {
                    console.log(data);
                    console.log(`Trovate ${data.messages.length} mail recenti`);

                    // Chiamata API messages.get
                    for (const msg of data.messages) {
                        
                        // Controllo che la classificazione non sia già presente in cache
                        chrome.storage.local.get(msg.id, (result) => {
                            if (!result[msg.id]) {
                                chrome.runtime.sendMessage({ action: "sendMessageID", data: msg.id },
                                    function (response) {
                                        console.log("Operazione batch eseguita.")
                                        console.log(response.result);
                                    });
                            }

                        });

                    }

                });
        });
    }

    catch (error) {
        console.error("Errore nella classificazione:", error);
    }


}