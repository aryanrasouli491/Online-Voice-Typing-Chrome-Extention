// This file connects the interface, recorder, settings, and transcription providers.
(function () {
    const elements = {};
    let currentSettings = null;
    let isRecording = false;
    let isExplicitlyPaused = false;
    let recordingElapsedMs = 0;
    let recordingRunStartedAt = null;
    let currentSessionId = "";
    let currentSessionText = "";
    let sessionSpeechCount = 0;
    let processingChain = Promise.resolve();
    let pendingSegmentCount = 0;
    let selectedAudioFile = null;
    let toastTimeout = null;
    let timerInterval = null;
    let microphoneIsReady = false;
    let microphonePermissionPending = false;
    let microphonePermissionStatus = null;
    let startRequestPending = false;
    let sessionProviderSettings = null;
    let recordingStartPromise = null;
    let microphoneMuted = false;

    const MAX_AUDIO_FILE_BYTES = 18 * 1024 * 1024;
    const RTL_SPEECH_LANGUAGES = ["fa", "ps", "ar", "ur", "he"];

    function getElement(id) {
        return document.getElementById(id);
    }

    function translate(key) {
        return window.VoiceFlowI18n.translate(key);
    }

    function showToast(message, isError = false) {
        const toast = elements.toast;
        toast.textContent = message;
        toast.classList.toggle("is-error", isError);
        toast.classList.add("is-visible");

        if (toastTimeout) {
            clearTimeout(toastTimeout);
        }

        toastTimeout = setTimeout(() => {
            toast.classList.remove("is-visible");
        }, 3800);
    }

    function setRecordingStatus(message, statusType = "ready") {
        elements.recordingStatus.textContent = message;
        elements.statusDot.classList.toggle("is-recording", statusType === "recording");
        elements.statusDot.classList.toggle("is-processing", statusType === "processing");
        elements.waveform.classList.toggle("is-active", statusType === "recording");

        const headerStatusDot = document.querySelector(".header-status-dot");
        if (headerStatusDot) {
            headerStatusDot.classList.toggle("is-recording", statusType === "recording");
            headerStatusDot.classList.toggle("is-processing", statusType === "processing");
        }

        const headerStatus = document.querySelector(".header-status span:last-child");
        if (headerStatus) {
            const shortStatusKeys = {
                ready: "readyStatus",
                recording: "recordingStatusShort",
                processing: "processingStatusShort",
                paused: "pausedStatusShort"
            };
            const key = statusType === "ready" && isExplicitlyPaused ? "pausedStatusShort" : shortStatusKeys[statusType];
            headerStatus.textContent = translate(key || "readyStatus");
        }
    }

    function updateRecordingTimer() {
        if (!isRecording) {
            return;
        }

        const currentRunMs = recordingRunStartedAt ? Date.now() - recordingRunStartedAt : 0;
        const elapsedSeconds = Math.floor((recordingElapsedMs + currentRunMs) / 1000);
        const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
        const seconds = String(elapsedSeconds % 60).padStart(2, "0");
        elements.recordingTimer.textContent = minutes + ":" + seconds;
    }

    function updateTextCounts() {
        const transcript = elements.transcriptText.value;
        const trimmedTranscript = transcript.trim();
        const wordCount = trimmedTranscript ? trimmedTranscript.split(/\s+/u).length : 0;

        // The 5,000 character figure mirrors the reference design; it is a counter,
        // not a hard limit, so users can keep and edit longer transcripts.
        elements.characterCount.textContent = translate("characterCount")
            .replace("{count}", String(transcript.length));
        elements.textToolsStats.textContent = translate("textToolsStats")
            .replace("{words}", String(wordCount))
            .replace("{characters}", String(transcript.length));
    }

    function detectRtlText(text) {
        const rtlMatches = (text.match(/[\u0590-\u08FF]/gu) || []).length;
        const ltrMatches = (text.match(/[A-Za-z\u00C0-\u024F]/gu) || []).length;

        return rtlMatches > 0 && rtlMatches >= ltrMatches;
    }

    function applyTextDirection(textarea, text) {
        const selectedLanguage = elements.dictationLanguageSelect.value;
        const rtlByLanguage = RTL_SPEECH_LANGUAGES.includes(selectedLanguage);
        const rtlByText = selectedLanguage === "auto" && detectRtlText(text);
        const shouldUseRtl = rtlByLanguage || rtlByText;

        textarea.dir = shouldUseRtl ? "rtl" : "ltr";
        textarea.style.textAlign = shouldUseRtl ? "right" : "left";
    }

    function applyAppDirection() {
        const interfaceLanguage = elements.interfaceLanguageSelect.value;
        const rtlByInterface = window.VoiceFlowI18n.isRtlLanguage(interfaceLanguage);
        // The interface follows its own language setting. Speech language affects only
        // the transcript editor so an English interface is not flipped by Dari dictation.
        document.documentElement.dir = rtlByInterface ? "rtl" : "ltr";
        document.documentElement.lang = interfaceLanguage;
        applyTextDirection(elements.transcriptText, elements.transcriptText.value);
        applyTextDirection(elements.fileTranscriptText, elements.fileTranscriptText.value);
    }

    function displayView(viewName) {
        const views = {
            main: elements.mainView,
            options: elements.optionsView,
            settings: elements.settingsView,
            audio: elements.audioView,
            history: elements.historyView,
            "text-tools": elements.textToolsView,
            preferences: elements.preferencesView,
            privacy: elements.privacyView
        };

        Object.entries(views).forEach(([name, view]) => {
            const shouldShow = name === viewName;
            view.hidden = !shouldShow;
            view.classList.toggle("is-visible", shouldShow);
        });

        // Startup always begins on the compact main view.
        window.scrollTo({ top: 0, behavior: "auto" });
    }

    function applyTheme(theme) {
        const selectedTheme = theme === "dark" ? "dark" : "light";
        document.documentElement.dataset.theme = selectedTheme;
        elements.themeButton.setAttribute(
            "aria-label",
            selectedTheme === "dark" ? translate("switchToLight") : translate("switchToDark")
        );
        elements.themeButton.title = elements.themeButton.getAttribute("aria-label");
    }

    function updateProviderCostNote() {
        const provider = elements.providerSelect.value;
        const costKeys = {
            groq: "groqFreeNote",
            gemini: "geminiFreeNote",
            openrouter: "openRouterCostNote"
        };

        elements.providerCostNote.textContent = translate(costKeys[provider] || "openRouterCostNote");
        elements.openRouterCostConsentRow.hidden = provider !== "openrouter";
        elements.allowOpenRouterChargesCheckbox.checked = Boolean(currentSettings.allowMeteredOpenRouter);
    }

    function renderModels(selectedModel = "") {
        const provider = elements.providerSelect.value;
        const models = window.VoiceFlowProviders.getModels(provider);

        elements.modelSelect.replaceChildren();

        models.forEach((model) => {
            const option = document.createElement("option");
            option.value = model.id;
            option.textContent = model.label;
            elements.modelSelect.append(option);
        });

        const modelExists = models.some((model) => model.id === selectedModel);
        elements.modelSelect.value = modelExists ? selectedModel : (models[0] ? models[0].id : "");
        elements.modelSelect.disabled = models.length < 2;
    }

    function getProviderKeyControls() {
        return [
            {
                provider: "groq",
                input: elements.groqApiKeyInput,
                toggle: elements.toggleGroqKeyButton,
                saveButton: elements.saveGroqKeyButton,
                clearButton: elements.clearGroqKeyButton,
                status: elements.groqKeyStatus
            },
            {
                provider: "gemini",
                input: elements.geminiApiKeyInput,
                toggle: elements.toggleGeminiKeyButton,
                saveButton: elements.saveGeminiKeyButton,
                clearButton: elements.clearGeminiKeyButton,
                status: elements.geminiKeyStatus
            },
            {
                provider: "openrouter",
                input: elements.openrouterApiKeyInput,
                toggle: elements.toggleOpenrouterKeyButton,
                saveButton: elements.saveOpenrouterKeyButton,
                clearButton: elements.clearOpenrouterKeyButton,
                status: elements.openrouterKeyStatus
            }
        ];
    }

    async function refreshApiKeyStatus(providerFilter = "") {
        const providerControls = getProviderKeyControls();

        for (const control of providerControls) {
            if (providerFilter && control.provider !== providerFilter) {
                continue;
            }

            const savedKey = await window.VoiceFlowStorage.getApiKey(control.provider);
            const hasKey = Boolean(savedKey);

            control.status.textContent = hasKey
                ? translate("keyConfigured")
                : translate("keyNotConfigured");
            control.status.style.color = hasKey ? "var(--brand)" : "var(--text-muted)";
            control.input.value = "";
            control.input.placeholder = hasKey
                ? "••••••••••••••••"
                : translate("apiKeyPlaceholder");
            control.input.type = "password";
            control.toggle.setAttribute("aria-pressed", "false");
            control.toggle.textContent = translate("showKey");
        }
    }

    function updateOnlineControls() {
        const onlineEnabled = elements.onlineVoiceTypingCheckbox.checked;
        elements.onlineWarning.hidden = !onlineEnabled;
        elements.offlineNote.hidden = onlineEnabled;
    }

    function formatError(error) {
        const message = String(error && error.message ? error.message : "")
            .replace(/(authorization\s*[:=]\s*(?:bearer\s+)?)\S+/gi, "$1[redacted]")
            .replace(/([?&](?:api[_-]?key|key)=)[^&\s]+/gi, "$1[redacted]")
            .replace(/\b(gsk_[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{8,}|sk-or-v1-[A-Za-z0-9_-]{8,})\b/g, "[redacted API key]");
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("401") || lowerMessage.includes("unauthorized") || lowerMessage.includes("api key") || lowerMessage.includes("invalid key")) {
            return translate("apiTestFailed") + " " + message;
        }

        if (lowerMessage.includes("413") || lowerMessage.includes("too large") || lowerMessage.includes("payload")) {
            return translate("fileTooLarge");
        }

        return message || translate("unknownError");
    }

    async function openChromeMicrophoneSettings() {
        // Chrome manages blocked microphone permissions in its own settings page.
        // Opening settings does not grant permission automatically.
        try {
            const extensionOrigin = "chrome-extension://" + chrome.runtime.id;
            const settingsUrl = "chrome://settings/content/siteDetails?site=" + encodeURIComponent(extensionOrigin);
            await chrome.tabs.create({
                url: settingsUrl
            });
            showToast(translate("microphoneSettingsHelp"));
        } catch (error) {
            showToast(translate("microphoneSettingsHelp"), true);
        }
    }


    function updateMicrophonePermissionDisplay(state) {
        if (state === "granted") {
            microphoneIsReady = true;
            elements.permissionCard.classList.add("is-ready");
            elements.permissionCard.classList.remove("is-blocked");
            elements.permissionCardTitle.textContent = translate("microphoneReadyTitle");
            elements.permissionDescription.textContent = translate("microphoneReady");
            elements.enableMicrophoneButton.hidden = true;
            elements.openMicrophoneSettingsButton.hidden = true;
            elements.enableMicrophoneButton.textContent = translate("micReadyShort");
            return;
        }

        if (state === "denied") {
            microphoneIsReady = false;
            elements.permissionCard.classList.remove("is-ready");
            elements.permissionCard.classList.add("is-blocked");
            elements.permissionCardTitle.textContent = translate("microphoneBlockedTitle");
            elements.permissionDescription.textContent = translate("permissionDenied");
            elements.enableMicrophoneButton.hidden = true;
            elements.openMicrophoneSettingsButton.hidden = false;
            return;
        }

        microphoneIsReady = false;
        elements.permissionCard.classList.remove("is-ready", "is-blocked");
        elements.permissionCardTitle.textContent = translate("micPermissionTitle");
        elements.permissionDescription.textContent = translate("micPermissionDescription");
        elements.enableMicrophoneButton.hidden = false;
        elements.openMicrophoneSettingsButton.hidden = true;
        elements.enableMicrophoneButton.textContent = translate("enableMic");
    }

    async function enableMicrophone() {
        // Open a normal extension tab so Chrome can show its microphone permission prompt.
        // A second click inside that tab is required to keep the request tied to a user action.
        if (microphonePermissionPending) {
            return false;
        }

        if (microphoneIsReady) {
            return true;
        }

        microphonePermissionPending = true;
        elements.enableMicrophoneButton.disabled = true;

        try {
            const permissionPageUrl = chrome.runtime.getURL("microphone-permission.html");
            await chrome.tabs.create({
                url: permissionPageUrl,
                active: true
            });

            showToast(translate("microphonePermissionPageOpened"));
        } catch (error) {
            console.error("Online Voice Typing could not open the microphone permission page.");
            showToast(translate("microphoneSettingsHelp"), true);
        } finally {
            microphonePermissionPending = false;
            elements.enableMicrophoneButton.disabled = false;
        }

        // Recording starts only after the user returns and clicks Start.
        return false;
    }

    async function checkKnownMicrophonePermission() {
        if (!navigator.permissions || !navigator.permissions.query) {
            return;
        }

        try {
            const permission = await navigator.permissions.query({ name: "microphone" });

            // Subscribe only once, even if the user changes interface language.
            if (!microphonePermissionStatus) {
                microphonePermissionStatus = permission;
                microphonePermissionStatus.addEventListener("change", () => {
                    if (microphonePermissionStatus.state === "granted") {
                        updateMicrophonePermissionDisplay("granted");
                    } else if (microphonePermissionStatus.state === "denied") {
                        updateMicrophonePermissionDisplay("denied");
                    } else {
                        updateMicrophonePermissionDisplay("prompt");
                    }
                });
            }

            if (permission.state === "granted") {
                updateMicrophonePermissionDisplay("granted");
            } else if (permission.state === "denied") {
                updateMicrophonePermissionDisplay("denied");
            } else {
                updateMicrophonePermissionDisplay("prompt");
            }
        } catch (error) {
            // Some Chrome environments do not expose a queryable microphone permission.
        }
    }

    function combineTranscript(existingText, newText) {
        const firstText = existingText || "";
        const nextText = (newText || "").trim();

        if (!nextText) {
            return firstText;
        }

        if (!firstText.trim()) {
            return nextText;
        }

        if (/\s$/u.test(firstText)) {
            return firstText + nextText;
        }

        return firstText + " " + nextText;
    }

    async function saveCurrentSessionHistory() {
        if (!currentSessionId || !currentSessionText.trim()) {
            return;
        }

        const now = Date.now();
        await window.VoiceFlowStorage.saveHistoryEntry({
            id: currentSessionId,
            text: currentSessionText,
            title: currentSessionText.trim().slice(0, 58),
            mode: "microphone",
            createdAt: now,
            updatedAt: now
        });
    }

    function getTranscriptionSettings() {
        return {
            provider: elements.providerSelect.value,
            model: elements.modelSelect.value,
            language: elements.dictationLanguageSelect.value,
            apiKey: currentSettings.apiKeys[elements.providerSelect.value] || ""
        };
    }

    function queueTranscription(audioBlob, fileName, sessionSettings, historyId) {
        // Do not queue an audio segment after the user has disabled online sending.
        if (!elements.onlineVoiceTypingCheckbox.checked) {
            return Promise.resolve();
        }

        pendingSegmentCount += 1;

        const queuedTask = async () => {
            try {
                // A queued phrase may still be waiting when online mode is turned off.
                if (!elements.onlineVoiceTypingCheckbox.checked) {
                    return;
                }

                if (isRecording) {
                    setRecordingStatus(translate("transcribing"), "processing");
                }

                const responseText = await window.VoiceFlowProviders.transcribeAudio(audioBlob, {
                    ...sessionSettings,
                    fileName,
                    previousText: currentSessionText
                });

                if (responseText) {
                    elements.transcriptText.value = combineTranscript(
                        elements.transcriptText.value,
                        responseText
                    );
                    currentSessionText = combineTranscript(currentSessionText, responseText);
                    updateTextCounts();
                    applyAppDirection();
                    resizeTranscript();
                    await saveCurrentSessionHistory();
                }
            } catch (error) {
                console.error("Online Voice Typing transcription segment failed.");
                showToast(translate("segmentFailed") + " " + formatError(error), true);
            } finally {
                pendingSegmentCount = Math.max(0, pendingSegmentCount - 1);

                if (isRecording && !isExplicitlyPaused && pendingSegmentCount === 0) {
                    setRecordingStatus(translate("recording"), "recording");
                }
            }
        };

        processingChain = processingChain.then(queuedTask, queuedTask);
        return processingChain;
    }

    async function startRecording() {
        if (isRecording || microphonePermissionPending || startRequestPending) {
            return;
        }

        // Online consent is checked before any permission request or audio capture.
        // Microphone permission alone does not authorize uploading audio.
        if (!elements.onlineVoiceTypingCheckbox.checked) {
            showToast(translate("onlineModeRequired"), true);
            return;
        }

        // This guard prevents double clicks from creating simultaneous start requests.
        startRequestPending = true;

        try {
            currentSettings = await window.VoiceFlowStorage.loadSettings();
            const transcriptionSettings = getTranscriptionSettings();

            if (!transcriptionSettings.apiKey) {
                showToast(translate("apiKeyRequired"), true);
                displayView("settings");
                return;
            }

            if (transcriptionSettings.provider === "openrouter" && !currentSettings.allowMeteredOpenRouter) {
                showToast(translate("openRouterCostRequired"), true);
                displayView("settings");
                return;
            }

            // Re-check consent after any asynchronous step. The user may turn the option off
            // while the settings are loading or while a permission page is open.
            if (!elements.onlineVoiceTypingCheckbox.checked) {
                showToast(translate("onlineModeRequired"), true);
                return;
            }

            if (!microphoneIsReady) {
                const microphoneGranted = await enableMicrophone();

                if (!microphoneGranted) {
                    return;
                }
            }

            if (!elements.onlineVoiceTypingCheckbox.checked) {
                showToast(translate("onlineModeRequired"), true);
                return;
            }

            // A new recording starts with a clean editor, as requested. Do this only
            // after consent, provider configuration, and microphone access are confirmed.
            elements.transcriptText.value = "";
            updateTextCounts();
            applyAppDirection();
            resizeTranscript();

            sessionProviderSettings = transcriptionSettings;
            currentSessionId = "mic-" + Date.now();
            currentSessionText = "";
            microphoneMuted = false;
            window.VoiceFlowRecorder.setMuted(false);
            updateMicrophoneMuteButton();
            sessionSpeechCount = 0;
            pendingSegmentCount = 0;
            processingChain = Promise.resolve();
            isRecording = true;
            isExplicitlyPaused = false;
            recordingElapsedMs = 0;
            recordingRunStartedAt = null;
            elements.startRecordingButton.disabled = true;
            elements.startRecordingButton.hidden = true;
            elements.microphoneOrbButton.disabled = true;
            elements.microphoneOrbButton.classList.add("is-recording");
            elements.stopRecordingButton.hidden = false;
            elements.stopRecordingButton.disabled = false;
            elements.muteMicrophoneButton.hidden = false;
            elements.pauseRecordingButton.hidden = false;
            elements.recordingButtons.classList.add("has-secondary-controls");
            elements.pauseRecordingButton.disabled = true;
            elements.pauseRecordingButton.querySelector("span").textContent = translate("pauseRecording");
            elements.moreOptionsButton.disabled = true;
            elements.recordingTimer.textContent = "00:00";
            setRecordingStatus(translate("startingRecording"), "processing");

            try {
                const recorderCallbacks = {
                    onSegment(audioBlob, fileName) {
                        if (!elements.onlineVoiceTypingCheckbox.checked) {
                            return;
                        }

                        sessionSpeechCount += 1;
                        queueTranscription(audioBlob, fileName, sessionProviderSettings, currentSessionId);
                    },
                    onPause() {
                        if (isRecording) {
                            setRecordingStatus(translate("recordingPaused"), "processing");
                        }
                    },
                    onSpeechStarted() {
                        if (isRecording) {
                            setRecordingStatus(translate("recording"), "recording");
                        }
                    },
                    onError(error) {
                        showToast(formatError(error), true);
                    },
                    onStopped() {
                        if (isRecording) {
                            isRecording = false;
                            if (timerInterval) {
                                clearInterval(timerInterval);
                                timerInterval = null;
                            }
                            elements.startRecordingButton.disabled = false;
                            elements.startRecordingButton.hidden = false;
                            elements.microphoneOrbButton.disabled = false;
                            elements.microphoneOrbButton.classList.remove("is-recording");
                            elements.stopRecordingButton.hidden = true;
                            elements.stopRecordingButton.disabled = true;
                            elements.muteMicrophoneButton.hidden = true;
                            elements.pauseRecordingButton.hidden = true;
                            elements.recordingButtons.classList.remove("has-secondary-controls");
                            elements.pauseRecordingButton.disabled = true;
                            elements.moreOptionsButton.disabled = false;
                            isExplicitlyPaused = false;
                            recordingRunStartedAt = null;
                            setRecordingStatus(translate("readyToRecord"), "ready");
                        }
                    }
                };

                recordingStartPromise = window.VoiceFlowRecorder.start(recorderCallbacks);
                await recordingStartPromise;
                recordingStartPromise = null;

                if (isRecording) {
                    recordingRunStartedAt = Date.now();
                    updateRecordingTimer();
                    timerInterval = setInterval(updateRecordingTimer, 250);
                    elements.microphoneOrbButton.disabled = false;
                    elements.pauseRecordingButton.disabled = false;
                    setRecordingStatus(translate("recording"), "recording");
                }

                // The user may stop recording while the microphone is starting.
                if (!isRecording || !elements.onlineVoiceTypingCheckbox.checked) {
                    return;
                }
            } catch (error) {
                recordingStartPromise = null;
                isRecording = false;
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }
                elements.startRecordingButton.disabled = false;
                elements.startRecordingButton.hidden = false;
                elements.microphoneOrbButton.disabled = false;
                elements.microphoneOrbButton.classList.remove("is-recording");
                elements.stopRecordingButton.hidden = true;
                elements.stopRecordingButton.disabled = true;
                elements.muteMicrophoneButton.hidden = true;
                elements.pauseRecordingButton.hidden = true;
                elements.recordingButtons.classList.remove("has-secondary-controls");
                elements.pauseRecordingButton.disabled = true;
                elements.moreOptionsButton.disabled = false;
                isExplicitlyPaused = false;
                recordingRunStartedAt = null;
                recordingElapsedMs = 0;
                setRecordingStatus(translate("readyToRecord"), "ready");
                showToast(formatError(error), true);
            }
        } catch (error) {
            // Includes storage/configuration failures that happen before recording starts.
            showToast(formatError(error), true);
        } finally {
            startRequestPending = false;
        }
    }

    function updateMicrophoneMuteButton() {
        if (!elements.muteMicrophoneButton) {
            return;
        }
        const key = microphoneMuted ? "unmuteMicrophone" : "muteMicrophone";
        const label = translate(key);
        elements.muteMicrophoneButton.setAttribute("aria-label", label);
        elements.muteMicrophoneButton.title = label;
        elements.muteMicrophoneButton.classList.toggle("is-muted", microphoneMuted);
    }

    function toggleMicrophoneMute() {
        if (!isRecording) {
            return;
        }
        microphoneMuted = !microphoneMuted;
        window.VoiceFlowRecorder.setMuted(microphoneMuted);
        updateMicrophoneMuteButton();
        showToast(translate(microphoneMuted ? "microphoneMuted" : "microphoneUnmuted"));
    }

    async function togglePauseResumeRecording() {
        if (!isRecording) {
            await startRecording();
            return;
        }

        if (isExplicitlyPaused) {
            await resumeRecording();
        } else {
            await pauseRecording();
        }
    }

    async function pauseRecording() {
        if (!isRecording || isExplicitlyPaused || recordingStartPromise) {
            return;
        }

        isExplicitlyPaused = true;
        if (recordingRunStartedAt) {
            recordingElapsedMs += Date.now() - recordingRunStartedAt;
            recordingRunStartedAt = null;
        }
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        updateRecordingTimer();
        elements.pauseRecordingButton.disabled = true;
        elements.microphoneOrbButton.disabled = true;
        setRecordingStatus(translate("pausingRecording"), "processing");

        try {
            await window.VoiceFlowRecorder.pause();
            elements.microphoneOrbButton.classList.remove("is-recording");
            elements.pauseRecordingButton.querySelector("span").textContent = translate("resumeRecording");
            elements.pauseRecordingButton.disabled = false;
            elements.microphoneOrbButton.disabled = false;
            setRecordingStatus(translate("pausedRecording"), "ready");
        } catch (error) {
            isExplicitlyPaused = false;
            recordingRunStartedAt = Date.now();
            timerInterval = setInterval(updateRecordingTimer, 250);
            elements.pauseRecordingButton.querySelector("span").textContent = translate("pauseRecording");
            showToast(formatError(error), true);
            elements.pauseRecordingButton.disabled = false;
            elements.microphoneOrbButton.disabled = false;
            setRecordingStatus(translate("recording"), "recording");
        }
    }

    async function resumeRecording() {
        if (!isRecording || !isExplicitlyPaused) {
            return;
        }

        elements.pauseRecordingButton.disabled = true;
        elements.microphoneOrbButton.disabled = true;
        setRecordingStatus(translate("resumingRecording"), "processing");

        try {
            await window.VoiceFlowRecorder.resume();
            isExplicitlyPaused = false;
            elements.microphoneOrbButton.classList.add("is-recording");
            recordingRunStartedAt = Date.now();
            elements.pauseRecordingButton.querySelector("span").textContent = translate("pauseRecording");
            elements.pauseRecordingButton.disabled = false;
            elements.microphoneOrbButton.disabled = false;
            setRecordingStatus(translate("recording"), "recording");
            timerInterval = setInterval(updateRecordingTimer, 250);
        } catch (error) {
            // Keep the session paused so the user can retry Resume or press Stop.
            showToast(formatError(error), true);
            elements.pauseRecordingButton.querySelector("span").textContent = translate("resumeRecording");
            elements.pauseRecordingButton.disabled = false;
            elements.microphoneOrbButton.disabled = false;
            setRecordingStatus(translate("pausedRecording"), "ready");
        }
    }

    async function stopRecording() {
        if (!isRecording) {
            return;
        }

        isRecording = false;
        isExplicitlyPaused = false;
        if (recordingRunStartedAt) {
            recordingElapsedMs += Date.now() - recordingRunStartedAt;
            recordingRunStartedAt = null;
        }
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        elements.stopRecordingButton.disabled = true;
        elements.pauseRecordingButton.hidden = true;
        elements.pauseRecordingButton.disabled = true;
        elements.startRecordingButton.disabled = true;
        elements.moreOptionsButton.disabled = false;
        setRecordingStatus(translate("finalizing"), "processing");

        try {
            if (recordingStartPromise) {
                try {
                    await recordingStartPromise;
                } catch (startError) {
                    // The startup error is already shown by startRecording().
                }
            }

            await window.VoiceFlowRecorder.stop();
            await processingChain;
        } catch (error) {
            showToast(formatError(error), true);
        }

        elements.startRecordingButton.disabled = false;
        elements.startRecordingButton.hidden = false;
        elements.microphoneOrbButton.disabled = false;
        elements.microphoneOrbButton.classList.remove("is-recording");
        elements.stopRecordingButton.hidden = true;
        elements.stopRecordingButton.disabled = true;
        elements.pauseRecordingButton.hidden = true;
        elements.recordingButtons.classList.remove("has-secondary-controls");
        elements.pauseRecordingButton.disabled = true;
        elements.recordingTimer.textContent = "00:00";
        recordingElapsedMs = 0;
        recordingRunStartedAt = null;
        setRecordingStatus(translate("readyToRecord"), "ready");

        if (sessionSpeechCount === 0 && elements.onlineVoiceTypingCheckbox.checked) {
            showToast(translate("noSpeech"), true);
        }

        currentSessionId = "";
        currentSessionText = "";
        sessionProviderSettings = null;
    }

    async function copyText(text) {
        if (!text.trim()) {
            showToast(translate("textEmpty"), true);
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            showToast(translate("transcriptCopied"));
        } catch (error) {
            showToast(translate("clipboardFailed"), true);
        }
    }

    function downloadText(text, fileName) {
        if (!text.trim()) {
            showToast(translate("textEmpty"), true);
            return;
        }

        const textBlob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const downloadUrl = URL.createObjectURL(textBlob);
        const downloadLink = document.createElement("a");

        downloadLink.href = downloadUrl;
        downloadLink.download = fileName;
        document.body.append(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        URL.revokeObjectURL(downloadUrl);
        showToast(translate("downloaded"));
    }

    async function insertTextIntoPage() {
        const text = elements.transcriptText.value;

        if (!text.trim()) {
            showToast(translate("textEmpty"), true);
            return;
        }

        try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!activeTab || !activeTab.id) {
                throw new Error("No active browser tab was found.");
            }

            const results = await chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                func: (textToInsert) => {
                    const activeElement = document.activeElement;
                    const isTextInput = activeElement instanceof HTMLInputElement &&
                        ["text", "search", "email", "url", "tel"].includes(activeElement.type);
                    const isTextArea = activeElement instanceof HTMLTextAreaElement;
                    const isEditable = activeElement instanceof HTMLElement && activeElement.isContentEditable;

                    if (!isTextInput && !isTextArea && !isEditable) {
                        return false;
                    }

                    if (isEditable) {
                        activeElement.textContent = (activeElement.textContent || "") + textToInsert;
                    } else {
                        const separator = activeElement.value ? " " : "";
                        const currentStart = activeElement.selectionStart;
                        const currentEnd = activeElement.selectionEnd;

                        if (typeof currentStart === "number" && typeof currentEnd === "number") {
                            activeElement.setRangeText(separator + textToInsert, currentStart, currentEnd, "end");
                        } else {
                            activeElement.value += separator + textToInsert;
                        }
                    }

                    activeElement.dispatchEvent(new Event("input", { bubbles: true }));
                    activeElement.dispatchEvent(new Event("change", { bubbles: true }));
                    activeElement.focus();
                    return true;
                },
                args: [text]
            });

            if (!results[0] || !results[0].result) {
                throw new Error("The active element is not an editable text field.");
            }

            showToast(translate("textInserted"));
        } catch (error) {
            try {
                await navigator.clipboard.writeText(text);
                showToast(translate("insertFailed"));
            } catch (clipboardError) {
                showToast(translate("insertFailed"), true);
            }
        }
    }

    async function saveApiKey(provider) {
        const control = getProviderKeyControls().find((item) => item.provider === provider);
        if (!control) {
            return;
        }

        const apiKey = control.input.value.trim();
        if (!apiKey) {
            control.status.textContent = translate("apiKeyPlaceholder");
            control.status.style.color = "var(--danger, #dc3545)";
            control.input.focus();
            return;
        }

        // Key prefixes are a suggestion only. A mismatch is blocked so a key is
        // never accidentally saved under or sent to a different provider.
        const detectedProvider = window.VoiceFlowProviders.detectProviderFromKey(apiKey);
        if (detectedProvider && detectedProvider !== provider) {
            const providerName = detectedProvider === "gemini"
                ? "Google Gemini"
                : detectedProvider === "openrouter" ? "OpenRouter" : "Groq";
            control.status.textContent = translate("keyProviderMismatch").replace("{provider}", providerName);
            control.status.style.color = "var(--danger, #dc3545)";
            return;
        }

        control.saveButton.disabled = true;
        try {
            await window.VoiceFlowStorage.saveApiKey(provider, apiKey);
            currentSettings = await window.VoiceFlowStorage.loadSettings();
            control.input.value = "";
            await refreshApiKeyStatus(provider);
            showToast(translate("keySaved"));
        } catch (error) {
            control.status.textContent = formatError(error);
            control.status.style.color = "var(--danger, #dc3545)";
        } finally {
            control.saveButton.disabled = false;
        }
    }

    async function removeApiKey(provider) {
        const control = getProviderKeyControls().find((item) => item.provider === provider);
        if (!control) {
            return;
        }

        await window.VoiceFlowStorage.saveApiKey(provider, "");
        currentSettings = await window.VoiceFlowStorage.loadSettings();
        control.input.value = "";
        await refreshApiKeyStatus(provider);
        showToast(translate("keyRemoved"));
    }

    async function testConnection() {
        const provider = elements.providerSelect.value;
        const apiKey = (await window.VoiceFlowStorage.getApiKey(provider)).trim();

        if (!apiKey) {
            showToast(translate("apiKeyRequired"), true);
            return;
        }

        elements.testConnectionButton.disabled = true;
        elements.testConnectionButton.textContent = translate("testingConnection");

        try {
            await window.VoiceFlowProviders.testApiConnection(provider, apiKey);
            showToast(translate("apiTestSuccess"));
        } catch (error) {
            showToast(translate("apiTestFailed") + " " + formatError(error), true);
        } finally {
            elements.testConnectionButton.disabled = false;
            elements.testConnectionButton.textContent = translate("testConnection");
        }
    }

    async function updateSetting(key, value) {
        currentSettings = await window.VoiceFlowStorage.saveSettings({ [key]: value });
    }

    async function changeProvider() {
        const provider = elements.providerSelect.value;
        const availableModels = window.VoiceFlowProviders.getModels(provider);
        const defaultModel = availableModels[0] ? availableModels[0].id : "";

        renderModels(defaultModel);
        await window.VoiceFlowStorage.saveSettings({
            provider,
            model: defaultModel
        });

        currentSettings = await window.VoiceFlowStorage.loadSettings();
        updateProviderCostNote();
    }

    async function changeModel() {
        await updateSetting("model", elements.modelSelect.value);
    }

    async function changeDictationLanguage() {
        // Dictation language controls transcript hints and text direction only.
        // The interface language remains an independent user preference.
        await updateSetting("dictationLanguage", elements.dictationLanguageSelect.value);
        applyAppDirection();
    }

    async function changeInterfaceLanguage() {
        const language = elements.interfaceLanguageSelect.value;
        await updateSetting("interfaceLanguage", language);
        window.VoiceFlowI18n.applyInterfaceLanguage(language);
        applyAppDirection();
        updateTextCounts();
        await checkKnownMicrophonePermission();
    }

    async function changeOnlineMode() {
        const onlineEnabled = elements.onlineVoiceTypingCheckbox.checked;

        await updateSetting("onlineVoiceTyping", onlineEnabled);
        updateOnlineControls();

        if (!onlineEnabled && isRecording) {
            showToast(translate("onlineModeDisabledDuringRecording"), true);
            await stopRecording();
        }
    }

    async function renderHistory() {
        const history = await window.VoiceFlowStorage.loadHistory();
        elements.historyList.replaceChildren();

        if (history.length === 0) {
            const emptyMessage = document.createElement("div");
            emptyMessage.className = "empty-state";
            emptyMessage.textContent = translate("historyEmpty");
            elements.historyList.append(emptyMessage);
            return;
        }

        history.forEach((entry) => {
            const card = document.createElement("article");
            card.className = "history-item";

            const header = document.createElement("div");
            header.className = "history-item-header";

            const date = document.createElement("time");
            date.className = "history-item-date";
            date.dateTime = new Date(entry.createdAt).toISOString();
            date.textContent = new Date(entry.createdAt).toLocaleString();

            header.append(date);

            const preview = document.createElement("p");
            preview.className = "history-preview";
            preview.textContent = entry.text.slice(0, 300);

            const actions = document.createElement("div");
            actions.className = "history-actions";

            const openButton = document.createElement("button");
            openButton.className = "button button-secondary";
            openButton.type = "button";
            openButton.textContent = translate("openTranscript");
            openButton.addEventListener("click", async () => {
                elements.transcriptText.value = entry.text;
                updateTextCounts();
                applyAppDirection();
                resizeTranscript();
                displayView("main");
                showToast(translate("historyLoaded"));
            });

            const copyButton = document.createElement("button");
            copyButton.className = "button button-secondary";
            copyButton.type = "button";
            copyButton.textContent = translate("copyText");
            copyButton.addEventListener("click", () => copyText(entry.text));

            const deleteButton = document.createElement("button");
            deleteButton.className = "button button-quiet";
            deleteButton.type = "button";
            deleteButton.textContent = translate("delete");
            deleteButton.addEventListener("click", async () => {
                await window.VoiceFlowStorage.deleteHistoryEntry(entry.id);
                await renderHistory();
                showToast(translate("historyDeleted"));
            });

            actions.append(openButton, copyButton, deleteButton);
            card.append(header, preview, actions);
            elements.historyList.append(card);
        });
    }

    async function chooseAudioFile() {
        const file = elements.audioFileInput.files[0] || null;
        selectedAudioFile = file;

        if (!file) {
            elements.selectedFileName.textContent = translate("noFileSelected");
            elements.transcribeFileButton.disabled = true;
            return;
        }

        elements.selectedFileName.textContent = file.name + " · " + (file.size / (1024 * 1024)).toFixed(2) + " MB";
        const validType = file.type.startsWith("audio/") || /\.(webm|wav|mp3|m4a|ogg|flac|aac|mp4|mpeg|mpga)$/i.test(file.name);
        const fileIsSmallEnough = file.size <= MAX_AUDIO_FILE_BYTES;
        elements.transcribeFileButton.disabled = !validType || !fileIsSmallEnough;

        if (!validType) {
            showToast(translate("unsupportedAudio"), true);
        } else if (!fileIsSmallEnough) {
            showToast(translate("fileTooLarge"), true);
        }
    }

    async function transcribeSelectedFile() {
        if (!selectedAudioFile) {
            showToast(translate("noFile"), true);
            return;
        }

        if (!elements.onlineVoiceTypingCheckbox.checked) {
            showToast(translate("onlineModeRequired"), true);
            return;
        }

        if (selectedAudioFile.size > MAX_AUDIO_FILE_BYTES) {
            showToast(translate("fileTooLarge"), true);
            return;
        }

        currentSettings = await window.VoiceFlowStorage.loadSettings();
        const provider = elements.providerSelect.value;
        const apiKey = currentSettings.apiKeys[provider] || "";

        if (!apiKey) {
            showToast(translate("apiKeyRequired"), true);
            displayView("settings");
            return;
        }

        if (provider === "openrouter" && !currentSettings.allowMeteredOpenRouter) {
            showToast(translate("openRouterCostRequired"), true);
            displayView("settings");
            return;
        }

        const model = elements.modelSelect.value;
        const language = elements.dictationLanguageSelect.value;
        elements.transcribeFileButton.disabled = true;
        elements.transcribeFileButton.textContent = translate("fileTranscribing");

        try {
            const transcript = await window.VoiceFlowProviders.transcribeAudio(selectedAudioFile, {
                provider,
                model,
                language,
                apiKey,
                fileName: selectedAudioFile.name
            });

            elements.fileTranscriptText.value = transcript;
            applyAppDirection();

            if (transcript) {
                const now = Date.now();
                await window.VoiceFlowStorage.saveHistoryEntry({
                    id: "file-" + now,
                    text: transcript,
                    title: selectedAudioFile.name,
                    mode: "audio-file",
                    createdAt: now,
                    updatedAt: now
                });
            }

            showToast(translate("fileTranscribed"));
        } catch (error) {
            showToast(translate("transcriptionFailed") + " " + formatError(error), true);
        } finally {
            elements.transcribeFileButton.disabled = !selectedAudioFile;
            elements.transcribeFileButton.textContent = translate("transcribeFile");
        }
    }

    async function clearAllHistory() {
        const confirmed = window.confirm(translate("confirmClearHistory"));

        if (!confirmed) {
            return;
        }

        await window.VoiceFlowStorage.clearHistory();
        await renderHistory();
        showToast(translate("historyCleared"));
    }


    function setTranscriptExpanded(expanded) {
        const transcriptSection = elements.transcriptText.closest(".transcript-section");
        transcriptSection.classList.toggle("is-expanded", expanded);
        document.body.classList.toggle("transcript-expanded-open", expanded);
        elements.expandTranscriptButton.setAttribute("aria-expanded", String(expanded));

        const accessibleLabel = translate(expanded ? "collapseTranscript" : "expandTranscript");
        elements.expandTranscriptButton.setAttribute("aria-label", accessibleLabel);
        elements.expandTranscriptButton.title = accessibleLabel;

        if (expanded) {
            elements.transcriptText.focus();
        } else {
            resizeTranscript();
            elements.expandTranscriptButton.focus();
        }
    }

    function toggleExpandedTranscript() {
        const transcriptSection = elements.transcriptText.closest(".transcript-section");
        const isExpanded = transcriptSection.classList.contains("is-expanded");
        setTranscriptExpanded(!isExpanded);
    }

    function resizeTranscript() {
        if (!elements.transcriptText) {
            return;
        }

        const transcriptSection = elements.transcriptText.closest(".transcript-section");

        if (transcriptSection.classList.contains("is-expanded")) {
            elements.transcriptText.style.height = "";
            return;
        }

        elements.transcriptText.style.height = "auto";

        const shortPanel = window.matchMedia("(max-height: 760px)").matches;
        const minimumHeight = shortPanel ? 64 : 76;
        const maximumHeight = shortPanel ? 92 : 136;
        const requestedHeight = Math.max(minimumHeight, elements.transcriptText.scrollHeight + 10);

        elements.transcriptText.style.height = Math.min(requestedHeight, maximumHeight) + "px";
    }

    function cacheElements() {
        const ids = [
            "mainView", "optionsView", "settingsView", "audioView", "historyView", "textToolsView", "preferencesView", "privacyView",
            "themeButton", "headerMoreOptionsButton", "permissionCard", "permissionCardTitle", "permissionDescription",
            "enableMicrophoneButton", "openMicrophoneSettingsButton", "microphoneOrbButton", "muteMicrophoneButton", "recordingStatus", "statusDot", "recordingTimer", "waveform",
            "startRecordingButton", "pauseRecordingButton", "stopRecordingButton", "recordingButtons", "transcriptText", "characterCount", "textToolsStats", "expandTranscriptButton", "copyTextButton",
            "exportTextButton", "clearTextButton", "onlineVoiceTypingCheckbox", "onlineWarning", "offlineNote", "moreOptionsButton",
            "toast", "providerSelect", "modelSelect", "modelHelp", "providerCostNote", "openRouterCostConsentRow",
            "openTranscriptSettingsButton", "openTextToolsButton", "openPreferencesButton", "openPrivacyButton",
            "preferencesThemeButton", "preferencesMicrophoneButton", "copyToolsTextButton",
            "allowOpenRouterChargesCheckbox", "testConnectionButton",
            "groqApiKeyInput", "toggleGroqKeyButton", "saveGroqKeyButton", "clearGroqKeyButton", "groqKeyStatus",
            "geminiApiKeyInput", "toggleGeminiKeyButton", "saveGeminiKeyButton", "clearGeminiKeyButton", "geminiKeyStatus",
            "openrouterApiKeyInput", "toggleOpenrouterKeyButton", "saveOpenrouterKeyButton", "clearOpenrouterKeyButton", "openrouterKeyStatus",
            "dictationLanguageSelect",
            "interfaceLanguageSelect", "openAudioToolButton", "openHistoryButton", "downloadTextButton",
            "insertTextButton", "audioFileInput", "selectedFileName", "transcribeFileButton",
            "fileTranscriptText", "copyFileTextButton", "downloadFileTextButton", "historyList", "clearHistoryButton"
        ];

        ids.forEach((id) => {
            elements[id] = getElement(id);
        });
    }

    function addEventListeners() {
        const toggleTheme = async () => {
            const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
            applyTheme(nextTheme);
            await updateSetting("theme", nextTheme);
        };
        elements.themeButton.addEventListener("click", toggleTheme);
        elements.preferencesThemeButton.addEventListener("click", toggleTheme);
        elements.preferencesMicrophoneButton.addEventListener("click", enableMicrophone);

        elements.enableMicrophoneButton.addEventListener("click", enableMicrophone);
        elements.openMicrophoneSettingsButton.addEventListener("click", openChromeMicrophoneSettings);
        elements.microphoneOrbButton.addEventListener("click", togglePauseResumeRecording);
        elements.muteMicrophoneButton.addEventListener("click", toggleMicrophoneMute);
        elements.startRecordingButton.addEventListener("click", startRecording);
        elements.pauseRecordingButton.addEventListener("click", togglePauseResumeRecording);
        elements.expandTranscriptButton.addEventListener("click", toggleExpandedTranscript);
        document.addEventListener("keydown", (event) => {
            const transcriptSection = elements.transcriptText.closest(".transcript-section");

            if (event.key === "Escape" && transcriptSection.classList.contains("is-expanded")) {
                setTranscriptExpanded(false);
            }
        });
        elements.stopRecordingButton.addEventListener("click", stopRecording);

        elements.transcriptText.addEventListener("input", () => {
            updateTextCounts();
            applyAppDirection();
            resizeTranscript();
        });

        elements.copyTextButton.addEventListener("click", () => copyText(elements.transcriptText.value));
        elements.exportTextButton.addEventListener("click", () => {
            downloadText(elements.transcriptText.value, "voiceflow-transcript.txt");
        });
        elements.clearTextButton.addEventListener("click", () => {
            elements.transcriptText.value = "";
            updateTextCounts();
            applyAppDirection();
            resizeTranscript();
            showToast(translate("transcriptCleared"));
        });

        elements.onlineVoiceTypingCheckbox.addEventListener("change", changeOnlineMode);
        elements.moreOptionsButton.addEventListener("click", () => displayView("options"));
        elements.headerMoreOptionsButton.addEventListener("click", () => displayView("options"));
        elements.openTranscriptSettingsButton.addEventListener("click", () => displayView("settings"));
        elements.openTextToolsButton.addEventListener("click", () => displayView("text-tools"));
        elements.openPreferencesButton.addEventListener("click", () => displayView("preferences"));
        elements.openPrivacyButton.addEventListener("click", () => displayView("privacy"));

        document.querySelectorAll("[data-back-main]").forEach((button) => {
            button.addEventListener("click", () => displayView("main"));
        });

        document.querySelectorAll("[data-back-options]").forEach((button) => {
            button.addEventListener("click", () => displayView("options"));
        });

        elements.providerSelect.addEventListener("change", changeProvider);
        elements.modelSelect.addEventListener("change", changeModel);
        elements.allowOpenRouterChargesCheckbox.addEventListener("change", async () => {
            await updateSetting("allowMeteredOpenRouter", elements.allowOpenRouterChargesCheckbox.checked);
            updateProviderCostNote();
            if (elements.allowOpenRouterChargesCheckbox.checked) {
                showToast(translate("openRouterCostConsent"));
            }
        });
        getProviderKeyControls().forEach((control) => {
            control.input.addEventListener("input", () => {
                const detectedProvider = window.VoiceFlowProviders.detectProviderFromKey(control.input.value.trim());

                if (detectedProvider && detectedProvider !== control.provider) {
                    const providerName = detectedProvider === "gemini"
                        ? "Google Gemini"
                        : detectedProvider === "openrouter" ? "OpenRouter" : "Groq";
                    control.status.textContent = translate("keyProviderMismatch").replace("{provider}", providerName);
                    control.status.style.color = "var(--danger, #dc3545)";
                } else {
                    control.status.textContent = control.input.value.trim()
                        ? translate("keyNotSavedYet")
                        : translate("keyNotConfigured");
                    control.status.style.color = "var(--text-muted)";
                }
            });

            control.toggle.addEventListener("click", () => {
                const willShow = control.input.type === "password";
                control.input.type = willShow ? "text" : "password";
                control.toggle.setAttribute("aria-pressed", String(willShow));
                control.toggle.textContent = translate(willShow ? "hideKey" : "showKey");
            });
            control.saveButton.addEventListener("click", () => saveApiKey(control.provider));
            control.clearButton.addEventListener("click", () => removeApiKey(control.provider));
        });
        elements.testConnectionButton.addEventListener("click", testConnection);
        elements.dictationLanguageSelect.addEventListener("change", changeDictationLanguage);
        elements.interfaceLanguageSelect.addEventListener("change", changeInterfaceLanguage);

        elements.openAudioToolButton.addEventListener("click", () => displayView("audio"));
        elements.openHistoryButton.addEventListener("click", async () => {
            await renderHistory();
            displayView("history");
        });
        elements.downloadTextButton.addEventListener("click", () => {
            downloadText(elements.transcriptText.value, "voiceflow-transcript.txt");
        });
        elements.insertTextButton.addEventListener("click", insertTextIntoPage);
        elements.audioFileInput.addEventListener("change", chooseAudioFile);
        elements.transcribeFileButton.addEventListener("click", transcribeSelectedFile);
        elements.copyFileTextButton.addEventListener("click", () => copyText(elements.fileTranscriptText.value));
        elements.downloadFileTextButton.addEventListener("click", () => {
            downloadText(elements.fileTranscriptText.value, "voiceflow-audio-transcript.txt");
        });
        elements.clearHistoryButton.addEventListener("click", clearAllHistory);
        elements.copyToolsTextButton.addEventListener("click", () => copyText(elements.transcriptText.value));

        chrome.runtime.onMessage.addListener((message) => {
            if (!message || message.type !== "VOICEFLOW_MIC_PERMISSION_UPDATED") {
                return;
            }

            if (message.state === "granted") {
                updateMicrophonePermissionDisplay("granted");
                showToast(translate("microphoneReady"));
            } else if (message.state === "denied") {
                updateMicrophonePermissionDisplay("denied");
            }
        });

        // Resize the text area again whenever Chrome's side panel changes size.
        window.addEventListener("resize", resizeTranscript);
    }

    async function initialize() {
        cacheElements();
        currentSettings = await window.VoiceFlowStorage.loadSettings();

        elements.providerSelect.value = currentSettings.provider;
        renderModels(currentSettings.model);
        elements.allowOpenRouterChargesCheckbox.checked = Boolean(currentSettings.allowMeteredOpenRouter);
        updateProviderCostNote();
        elements.onlineVoiceTypingCheckbox.checked = Boolean(currentSettings.onlineVoiceTyping);
        elements.dictationLanguageSelect.value = currentSettings.dictationLanguage;
        elements.interfaceLanguageSelect.value = currentSettings.interfaceLanguage;
        elements.recordingTimer.textContent = "00:00";
        elements.startRecordingButton.hidden = false;
        elements.stopRecordingButton.hidden = true;
        elements.pauseRecordingButton.hidden = true;
        elements.pauseRecordingButton.disabled = true;
        elements.recordingButtons.classList.remove("has-secondary-controls");

        applyTheme(currentSettings.theme);
        window.VoiceFlowI18n.applyInterfaceLanguage(currentSettings.interfaceLanguage);
        updateOnlineControls();
        updateTextCounts();
        applyAppDirection();
        resizeTranscript();
        addEventListeners();
        await refreshApiKeyStatus();
        await checkKnownMicrophonePermission();

        // Always open the compact home screen, not the advanced workspace.
        displayView("main");
    }

    document.addEventListener("DOMContentLoaded", initialize);
})();
