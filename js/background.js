// Open the VoiceFlow side panel when the toolbar icon is clicked.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// The dedicated permission page reports when Chrome grants or blocks microphone access.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const permissionPageUrl = new URL(chrome.runtime.getURL("microphone-permission.html"));
    let cameFromPermissionPage = false;

    try {
        const senderUrl = new URL(sender.url || "");
        cameFromPermissionPage = senderUrl.origin === permissionPageUrl.origin &&
            senderUrl.pathname === permissionPageUrl.pathname;
    } catch (error) {
        // Ignore messages without a valid sender URL.
    }

    if (!cameFromPermissionPage || !message) {
        return;
    }

    let state = "";

    if (message.type === "VOICEFLOW_MIC_PERMISSION_GRANTED") {
        state = "granted";
    } else if (message.type === "VOICEFLOW_MIC_PERMISSION_BLOCKED") {
        state = "denied";
    } else {
        return;
    }

    // Keep only the permission state, not audio or microphone recordings.
    chrome.storage.local.set({ microphonePermissionState: state }).then(() => {
        chrome.runtime.sendMessage({
            type: "VOICEFLOW_MIC_PERMISSION_UPDATED",
            state
        }).catch(() => {
            // The side panel may be closed; it will re-check permission when opened.
        });

        sendResponse({ ok: true });
    }).catch(() => {
        sendResponse({ ok: false });
    });

    return true;
});
