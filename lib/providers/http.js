//===============
// Shared HTTP client for provider scrapers.
// Common browser headers + sensible timeouts. Each provider can override per-call.
//===============

const axios = require("axios");

const DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1"
};

const httpClient = axios.create({
    timeout: 10000,
    maxRedirects: 3,
    maxContentLength: 10 * 1024 * 1024
});

function get(url, options = {}) {
    return httpClient.get(url, {
        ...options,
        headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) }
    });
}

module.exports = {
    DEFAULT_HEADERS,
    get,
    httpClient
};
