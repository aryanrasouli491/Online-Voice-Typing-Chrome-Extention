// Small, validated storage helpers for settings and bounded transcript history.
(function () {
    const SETTINGS_STORAGE_KEY = "voiceFlowSettings";
    const HISTORY_STORAGE_KEY = "voiceFlowHistory";
    const MAX_HISTORY_ITEMS = 20;
    const MAX_HISTORY_TEXT_CHARS = 200000;

    const VALID_PROVIDERS = ["groq", "gemini", "openrouter"];
    const VALID_THEMES = ["dark", "light"];
    const VALID_INTERFACE_LANGUAGES = ["en", "fa", "ps", "ar", "ur"];
    const VALID_DICTATION_LANGUAGES = [
        "auto", "en", "fa", "ps", "ar", "ur", "hi", "es", "fr", "de", "it", "pt", "ru", "tr", "zh", "ja", "ko", "id", "bn", "nl", "pl", "uk", "vi", "th", "ms", "sw", "el", "he", "ro", "hu", "cs", "sv", "da", "fi", "no", "ta", "te", "mr", "az", "uz", "kk", "fil"
    ];
    const VALID_MODELS = [
        "whisper-large-v3-turbo",
        "whisper-large-v3",
        "gemini-3.5-transcribe",
        "openai/whisper-large-v3-turbo",
        "openai/whisper-large-v3",
        "openai/whisper-1"
    ];

    const defaultSettings = {
        provider: "groq",
        model: "whisper-large-v3-turbo",
        onlineVoiceTyping: false,
        allowMeteredOpenRouter: false,
        theme: "dark",
        dictationLanguage: "auto",
        interfaceLanguage: "en",
        apiKeys: {
            groq: "",
            gemini: "",
            openrouter: ""
        }
    };

    function isPlainObject(value) {
        return Boolean(value) && typeof value === "object" && !Array.isArray(value);
    }

    function safeStoredString(value, maxLength = 500) {
        if (typeof value !== "string") {
            return "";
        }
        return value.trim().slice(0, maxLength);
    }

    function normalizeSettings(value) {
        const saved = isPlainObject(value) ? value : {};
        const savedKeys = isPlainObject(saved.apiKeys) ? saved.apiKeys : {};
        const provider = VALID_PROVIDERS.includes(saved.provider) ? saved.provider : defaultSettings.provider;
        const model = VALID_MODELS.includes(saved.model) ? saved.model : defaultSettings.model;
        const theme = VALID_THEMES.includes(saved.theme) ? saved.theme : defaultSettings.theme;
        const dictationLanguage = VALID_DICTATION_LANGUAGES.includes(saved.dictationLanguage)
            ? saved.dictationLanguage
            : defaultSettings.dictationLanguage;
        const interfaceLanguage = VALID_INTERFACE_LANGUAGES.includes(saved.interfaceLanguage)
            ? saved.interfaceLanguage
            : defaultSettings.interfaceLanguage;

        return {
            provider,
            model,
            onlineVoiceTyping: saved.onlineVoiceTyping === true,
            allowMeteredOpenRouter: saved.allowMeteredOpenRouter === true,
            theme,
            dictationLanguage,
            interfaceLanguage,
            apiKeys: {
                groq: safeStoredString(savedKeys.groq),
                gemini: safeStoredString(savedKeys.gemini),
                openrouter: safeStoredString(savedKeys.openrouter)
            }
        };
    }

    async function loadSettings() {
        const storedValues = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
        return normalizeSettings(storedValues[SETTINGS_STORAGE_KEY]);
    }

    async function saveSettings(changes) {
        const currentSettings = await loadSettings();
        const allowedChanges = isPlainObject(changes) ? changes : {};
        const nextSettings = {
            ...currentSettings,
            provider: allowedChanges.provider ?? currentSettings.provider,
            model: allowedChanges.model ?? currentSettings.model,
            onlineVoiceTyping: allowedChanges.onlineVoiceTyping ?? currentSettings.onlineVoiceTyping,
            allowMeteredOpenRouter: allowedChanges.allowMeteredOpenRouter ?? currentSettings.allowMeteredOpenRouter,
            theme: allowedChanges.theme ?? currentSettings.theme,
            dictationLanguage: allowedChanges.dictationLanguage ?? currentSettings.dictationLanguage,
            interfaceLanguage: allowedChanges.interfaceLanguage ?? currentSettings.interfaceLanguage,
            apiKeys: {
                ...currentSettings.apiKeys,
                ...(isPlainObject(allowedChanges.apiKeys) ? allowedChanges.apiKeys : {})
            }
        };
        const normalized = normalizeSettings(nextSettings);

        await chrome.storage.local.set({
            [SETTINGS_STORAGE_KEY]: normalized
        });

        return normalized;
    }

    async function getApiKey(provider) {
        if (!VALID_PROVIDERS.includes(provider)) {
            return "";
        }
        const settings = await loadSettings();
        return settings.apiKeys[provider] || "";
    }

    async function saveApiKey(provider, apiKey) {
        if (!VALID_PROVIDERS.includes(provider)) {
            throw new Error("Select a supported provider before saving its API key.");
        }

        const settings = await loadSettings();
        const apiKeys = {
            ...settings.apiKeys,
            [provider]: safeStoredString(apiKey)
        };

        return saveSettings({ apiKeys });
    }

    function normalizeHistoryEntry(entry) {
        if (!isPlainObject(entry)) {
            return null;
        }

        const id = safeStoredString(entry.id, 100);
        const text = typeof entry.text === "string" ? entry.text.slice(0, MAX_HISTORY_TEXT_CHARS) : "";
        const createdAt = Number(entry.createdAt);
        const updatedAt = Number(entry.updatedAt);

        // Date supports timestamps only within this finite millisecond range.
        // Reject out-of-range stored values so rendering cannot fail at toISOString().
        const maximumDateTimestamp = 8640000000000000;
        const validCreatedAt = Number.isFinite(createdAt)
            && createdAt > 0
            && createdAt <= maximumDateTimestamp;
        const validUpdatedAt = Number.isFinite(updatedAt)
            && updatedAt > 0
            && updatedAt <= maximumDateTimestamp;

        if (!id || !text.trim() || !validCreatedAt) {
            return null;
        }

        return {
            id,
            text,
            title: safeStoredString(entry.title, 100) || text.trim().slice(0, 58),
            mode: entry.mode === "audio-file" ? "audio-file" : "microphone",
            createdAt,
            updatedAt: validUpdatedAt ? updatedAt : createdAt
        };
    }

    async function loadHistory() {
        const savedValues = await chrome.storage.local.get(HISTORY_STORAGE_KEY);
        const history = Array.isArray(savedValues[HISTORY_STORAGE_KEY]) ? savedValues[HISTORY_STORAGE_KEY] : [];

        return history
            .map(normalizeHistoryEntry)
            .filter(Boolean)
            .sort((first, second) => second.updatedAt - first.updatedAt)
            .slice(0, MAX_HISTORY_ITEMS);
    }

    async function saveHistoryEntry(entry) {
        const normalizedEntry = normalizeHistoryEntry(entry);
        if (!normalizedEntry) {
            return loadHistory();
        }

        const currentHistory = await loadHistory();
        const existingIndex = currentHistory.findIndex((item) => item.id === normalizedEntry.id);
        const nextHistory = [...currentHistory];

        if (existingIndex >= 0) {
            nextHistory[existingIndex] = normalizedEntry;
        } else {
            nextHistory.unshift(normalizedEntry);
        }

        nextHistory.sort((first, second) => second.updatedAt - first.updatedAt);
        const boundedHistory = nextHistory.slice(0, MAX_HISTORY_ITEMS);

        await chrome.storage.local.set({
            [HISTORY_STORAGE_KEY]: boundedHistory
        });

        return boundedHistory;
    }

    async function deleteHistoryEntry(id) {
        const safeId = safeStoredString(id, 100);
        const currentHistory = await loadHistory();
        const nextHistory = currentHistory.filter((item) => item.id !== safeId);

        await chrome.storage.local.set({
            [HISTORY_STORAGE_KEY]: nextHistory
        });

        return nextHistory;
    }

    async function clearHistory() {
        await chrome.storage.local.set({
            [HISTORY_STORAGE_KEY]: []
        });
    }

    window.VoiceFlowStorage = {
        loadSettings,
        saveSettings,
        getApiKey,
        saveApiKey,
        loadHistory,
        saveHistoryEntry,
        deleteHistoryEntry,
        clearHistory
    };
})();
