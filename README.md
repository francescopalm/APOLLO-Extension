
# APOLLO Chrome Extension

A Chrome extension designed to actively mitigate the risks of phishing and advanced social engineering attacks in the Gmail web client. It leverages a backend Large Language Model (LLM) engine (based on APOLLO project) to perform deep semantic analysis of email content, providing dynamic, highly effective warnings to the end-user.

## Features

* **LLM-Based Classification:** Uses APOLLO as a classification engine for semantic analysis of email RAW content, including MIME headers, to detect subtle social engineering cues.

* **Polymorphic behavior:** Implements a graduated mitigation system based on the phishing_probability score (0-100%).

    * High Risk (>70%): Triggers an intrusive full-screen modal overlay that prevents interaction and displays the LLM-generated explanation.
    * Medium Risk (30%–70%): Activates a security tooltip on link mouseover that visually blocks interaction without interrupting the workflow.

* **Caching & Low Latency:** Utilizes a predictive batch processing mechanism to pre-analyze recent emails, storing results in local storage to achieve near-zero latency when an email is opened.

* **Security & Compliance:** Implements the full OAuth 2.0/OIDC flow for secure, scoped access (gmail.readonly) and strictly adheres to the Chrome Manifest V3 architecture.

## Architecture Overview

APOLLO operates on the following architecture to bridge the gap between the browser's JavaScript environment and the Python APOLLO project.

1. **Front-end (Chrome Extension):** The Service Worker handles background logic, authorization, and communication with the API. The Content Script is injected only into mail.google.com to observe the DOM (via MutationObserver) and render the dynamic warnings.

2. **Middleware (Flask framework):** A lightweight Flask server acts as middleware. It receives email RAW content in JSON, invokes the APOLLO Python model, and returns the classification result in JSON format as well.

3. **Core Model (APOLLO):** Executes the LLM classification, often incorporating Retrieval Augmented Generation (RAG) via external APIs (e.g., VirusTotal) for real-time link reputation checks.

---

## Authors and Acknowledgements

* **Author:** Francesco Palmisano.
* **Thesis Advisors:** Prof. Giuseppe Desolda, Prof. Francesco Greco.
* **Base Project:** [APOLLO](https://github.com/IVU-Laboratory/APOLLO).



