function isRestrictedUrl(url?: string): boolean {
    if (!url) return true;
    return (
        url.startsWith('chrome://') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('edge://') ||
        url.startsWith('about:') ||
        url.includes('chromewebstore.google.com') ||
        url.includes('chrome.google.com/webstore')
    );
}

// Listen for toolbar extension icon clicks to toggle slide-out drawer on the tab
chrome.action.onClicked.addListener((tab) => {
    const tabId = tab.id;
    if (!tabId) return;

    if (isRestrictedUrl(tab.url)) {
        return;
    }

    // Send toggle message to the content script
    chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_DRAWER' }, () => {
        const lastError = chrome.runtime.lastError;

        if (lastError) {


            chrome.scripting.insertCSS({
                target: { tabId },
                files: ["content.css"]
            }).then(() => {
                return chrome.scripting.executeScript({
                    target: { tabId },
                    files: ["content.js"]
                })
            }).then(() => {
                // Wait slightly for DOM initialization inside the tab
                setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_DRAWER' }, () => {
                        void chrome.runtime.lastError;
                    });
                }, 150);
            }).catch(() => {});
        }
    });
});
