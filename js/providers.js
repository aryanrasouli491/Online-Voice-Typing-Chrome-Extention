// Provider adapters keep each company's API format separate.
(function () {
    const PROVIDER_MODELS = {
        groq: [
            {
                id: "whisper-large-v3-turbo",
                label: "Whisper Large V3 Turbo — Free-plan quota"
            },
            {
                id: "whisper-large-v3",
                label: "Whisper Large V3 — Free-plan quota"
            }
        ],
        gemini: [
            {
                id: "gemini-3.5-transcribe",
                label: "Gemini 3.5 Transcribe — Free-tier quota"
            }
        ],
        openrouter: [
            {
                id: "openai/whisper-large-v3-turbo",
                label: "Whisper Large V3 Turbo — usage-based"
            },
            {
                id: "openai/whisper-large-v3",
                label: "Whisper Large V3 — usage-based"
            },
            {
                id: "openai/whisper-1",
                label: "Whisper 1 — usage-based"
            }
        ]
    };

    const WHISPER_LANGUAGE_CODES = {
        fil: "tl"
    };

    // Only send language hints listed in the current Gemini transcription docs.
    // Languages without a confirmed code are left to Gemini's automatic detection.
    const GEMINI_LANGUAGE_CODES = {
        ar: "ar-EG",
        az: "az-AZ",
        bn: "bn-BD",
        cs: "cs-CZ",
        da: "da-DK",
        de: "de-DE",
        en: "en-US",
        es: "es-419",
        fa: "fa-IR",
        fil: "fil-PH",
        fr: "fr-FR",
        he: "he-IL",
        hi: "hi-IN",
        id: "id-ID",
        it: "it-IT",
        ja: "ja-JP",
        kk: "kk-KZ",
        ko: "ko-KR",
        mr: "mr-IN",
        ms: "ms-MY",
        nl: "nl-NL",
        no: "nb-NO",
        pl: "pl-PL",
        pt: "pt-BR",
        ro: "ro-RO",
        ru: "ru-RU",
        sv: "sv-SE",
        te: "te-IN",
        th: "th-TH",
        tr: "tr-TR",
        uk: "uk-UA",
        uz: "uz-UZ",
        vi: "vi-VN",
        zh: "cmn-Hans-CN"
    };
    function detectProviderFromKey(apiKey) {
        const key = (apiKey || "").trim();

        if (key.startsWith("gsk_")) {
            return "groq";
        }

        if (key.startsWith("sk-or-v1-") || key.startsWith("sk-or-")) {
            return "openrouter";
        }

        if (key.startsWith("AIza")) {
            return "gemini";
        }

        return "";
    }

    function getModels(provider) {
        return PROVIDER_MODELS[provider] || [];
    }

    function languageForWhisper(language) {
        if (!language || language === "auto") {
            return "";
        }

        return WHISPER_LANGUAGE_CODES[language] || language;
    }

    function getMimeType(blob, fileName) {
        const browserMimeType = blob && blob.type ? blob.type.split(";")[0].toLowerCase() : "";
        if (browserMimeType.startsWith("audio/")) {
            return browserMimeType;
        }
        if (browserMimeType === "video/mp4") {
            return "audio/mp4";
        }

        const fileExtension = (fileName || "").split(".").pop().toLowerCase();
        const mimeTypes = {
            webm: "audio/webm",
            wav: "audio/wav",
            mp3: "audio/mpeg",
            m4a: "audio/mp4",
            mp4: "audio/mp4",
            ogg: "audio/ogg",
            flac: "audio/flac",
            aac: "audio/aac",
            mpga: "audio/mpeg",
            mpeg: "audio/mpeg"
        };

        return mimeTypes[fileExtension] || "audio/webm";
    }

    function getAudioFormat(blob, fileName) {
        const fileExtension = (fileName || "").split(".").pop().toLowerCase();
        const allowedFormats = ["wav", "mp3", "flac", "m4a", "ogg", "webm", "aac", "mp4", "mpeg", "mpga"];

        if (allowedFormats.includes(fileExtension)) {
            if (fileExtension === "mp4") {
                return "m4a";
            }

            if (fileExtension === "mpeg" || fileExtension === "mpga") {
                return "mp3";
            }

            return fileExtension;
        }

        const mimeType = getMimeType(blob, fileName);

        if (mimeType.includes("webm")) {
            return "webm";
        }

        if (mimeType.includes("wav")) {
            return "wav";
        }

        if (mimeType.includes("mpeg")) {
            return "mp3";
        }

        if (mimeType.includes("mp4")) {
            return "m4a";
        }

        if (mimeType.includes("ogg")) {
            return "ogg";
        }

        if (mimeType.includes("flac")) {
            return "flac";
        }

        if (mimeType.includes("aac")) {
            return "aac";
        }

        return "webm";
    }

    async function fetchWithTimeout(url, options, timeoutMilliseconds = 90000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMilliseconds);

        try {
            return await fetch(url, {
                ...options,
                signal: controller.signal
            });
        } catch (error) {
            if (error.name === "AbortError") {
                throw new Error("The provider took too long to respond. Try a shorter segment or another model.");
            }

            throw new Error("Could not reach the provider. Check your internet connection and API access.");
        } finally {
            clearTimeout(timeoutId);
        }
    }

    // Provider messages can occasionally echo request details. Keep API keys out of
    // notifications, console output, and any error object passed back to the UI.
    function redactSensitiveText(value) {
        return String(value || "")
            .replace(/(authorization\s*[:=]\s*(?:bearer\s+)?)\S+/gi, "$1[redacted]")
            .replace(/([?&](?:api[_-]?key|key)=)[^&\s]+/gi, "$1[redacted]")
            .replace(/\b(gsk_[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{8,}|sk-or-v1-[A-Za-z0-9_-]{8,})\b/g, "[redacted API key]");
    }

    async function responseError(response) {
        let errorMessage = "Provider request failed with status " + response.status + ".";

        try {
            const errorBody = await response.json();
            const nestedMessage = errorBody.error && errorBody.error.message;
            const directMessage = errorBody.message;

            if (nestedMessage) {
                errorMessage = nestedMessage;
            } else if (directMessage) {
                errorMessage = directMessage;
            }
        } catch (error) {
            // Keep the simple status message when the provider returns no JSON.
        }

        const safeMessage = redactSensitiveText(errorMessage)
            .replace(/[\r\n\t]+/g, " ")
            .slice(0, 360);
        return new Error(safeMessage || "Provider request failed.");
    }

    function bufferToBase64(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer);
        const chunkSize = 0x8000;
        let binaryText = "";

        for (let index = 0; index < bytes.length; index += chunkSize) {
            const chunk = bytes.subarray(index, index + chunkSize);
            binaryText += String.fromCharCode(...chunk);
        }

        return btoa(binaryText);
    }

    async function transcribeWithGroq(audioBlob, options) {
        const formData = new FormData();
        const fileName = options.fileName || "voice-segment.webm";

        formData.append("file", audioBlob, fileName);
        formData.append("model", options.model);
        formData.append("response_format", "json");

        const language = languageForWhisper(options.language);

        if (language) {
            formData.append("language", language);
        }

        const contextText = (options.previousText || "").trim().slice(-160);

        if (contextText) {
            formData.append("prompt", contextText);
        }

        const response = await fetchWithTimeout(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + options.apiKey
                },
                body: formData
            }
        );

        if (!response.ok) {
            throw await responseError(response);
        }

        const result = await response.json();
        return (result.text || "").trim();
    }

    async function transcribeWithOpenRouter(audioBlob, options) {
        const audioBase64 = bufferToBase64(await audioBlob.arrayBuffer());
        const requestBody = {
            model: options.model,
            input_audio: {
                data: audioBase64,
                format: getAudioFormat(audioBlob, options.fileName)
            }
        };

        const language = languageForWhisper(options.language);

        if (language) {
            requestBody.language = language;
        }

        const response = await fetchWithTimeout(
            "https://openrouter.ai/api/v1/audio/transcriptions",
            {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + options.apiKey,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            throw await responseError(response);
        }

        const result = await response.json();
        return (result.text || "").trim();
    }

    async function uploadGeminiAudio(audioBlob, options) {
        const mimeType = getMimeType(audioBlob, options.fileName);
        const displayName = "voiceflow-audio-" + Date.now();
        const startResponse = await fetchWithTimeout(
            "https://generativelanguage.googleapis.com/upload/v1beta/files",
            {
                method: "POST",
                headers: {
                    "x-goog-api-key": options.apiKey,
                    "X-Goog-Upload-Protocol": "resumable",
                    "X-Goog-Upload-Command": "start",
                    "X-Goog-Upload-Header-Content-Length": String(audioBlob.size),
                    "X-Goog-Upload-Header-Content-Type": mimeType,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    file: {
                        display_name: displayName
                    }
                })
            }
        );

        if (!startResponse.ok) {
            throw await responseError(startResponse);
        }

        const uploadUrl = startResponse.headers.get("x-goog-upload-url") || startResponse.headers.get("location");

        if (!uploadUrl || !uploadUrl.startsWith("https://generativelanguage.googleapis.com/")) {
            throw new Error("Gemini did not return an accessible upload URL. Check Chrome permissions or use another provider.");
        }

        const uploadResponse = await fetchWithTimeout(
            uploadUrl,
            {
                method: "POST",
                headers: {
                    "X-Goog-Upload-Offset": "0",
                    "X-Goog-Upload-Command": "upload, finalize",
                    "Content-Type": mimeType
                },
                body: audioBlob
            }
        );

        if (!uploadResponse.ok) {
            throw await responseError(uploadResponse);
        }

        const uploadResult = await uploadResponse.json();
        return uploadResult.file || uploadResult;
    }

    async function deleteGeminiFile(fileName, apiKey) {
        if (!fileName) {
            return;
        }

        const cleanFileName = fileName.replace(/^files\//, "");
        const fileUrl = "https://generativelanguage.googleapis.com/v1beta/files/" + encodeURIComponent(cleanFileName);

        try {
            await fetchWithTimeout(
                fileUrl,
                {
                    method: "DELETE",
                    headers: {
                        "x-goog-api-key": apiKey
                    }
                },
                15000
            );
        } catch (error) {
            // File cleanup is best-effort. Never show a successful delete when it fails.
        }
    }

    async function transcribeWithGemini(audioBlob, options) {
        const uploadedFile = await uploadGeminiAudio(audioBlob, options);
        const fileUri = uploadedFile.uri;
        const fileName = uploadedFile.name;

        if (!fileUri) {
            throw new Error("Gemini uploaded the file but did not return a file URI.");
        }

        const transcriptionConfig = {
            mode: "smart"
        };

        if (options.language && options.language !== "auto") {
            const languageCode = GEMINI_LANGUAGE_CODES[options.language];

            if (languageCode) {
                transcriptionConfig.language_codes = [languageCode];
            }
        }

        try {
            const response = await fetchWithTimeout(
                "https://generativelanguage.googleapis.com/v1beta/interactions",
                {
                    method: "POST",
                    headers: {
                        "x-goog-api-key": options.apiKey,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: options.model,
                        input: [
                            {
                                type: "audio",
                                uri: fileUri,
                                mime_type: getMimeType(audioBlob, options.fileName)
                            }
                        ],
                        generation_config: {
                            transcription_config: transcriptionConfig
                        }
                    })
                }
            );

            if (!response.ok) {
                throw await responseError(response);
            }

            const result = await response.json();
            const outputParts = (result.outputs || [])
                .filter((output) => output.type === "text" && output.text)
                .map((output) => output.text);
            const outputText = result.output_text || outputParts.join(" ");

            return (outputText || "").trim();
        } finally {
            await deleteGeminiFile(fileName, options.apiKey);
        }
    }

    async function transcribeAudio(audioBlob, options) {
        if (!options.apiKey) {
            throw new Error("No API key is saved for the selected provider. Open More Options to add your key.");
        }

        if (!audioBlob || audioBlob.size === 0) {
            throw new Error("There is no audio data to transcribe.");
        }

        if (options.provider === "groq") {
            return transcribeWithGroq(audioBlob, options);
        }

        if (options.provider === "gemini") {
            return transcribeWithGemini(audioBlob, options);
        }

        if (options.provider === "openrouter") {
            return transcribeWithOpenRouter(audioBlob, options);
        }

        throw new Error("Unknown transcription provider.");
    }

    async function testApiConnection(provider, apiKey) {
        let url = "";
        let headers = {};

        if (provider === "groq") {
            url = "https://api.groq.com/openai/v1/models";
            headers.Authorization = "Bearer " + apiKey;
        } else if (provider === "openrouter") {
            url = "https://openrouter.ai/api/v1/models?output_modalities=transcription";
            headers.Authorization = "Bearer " + apiKey;
        } else if (provider === "gemini") {
            url = "https://generativelanguage.googleapis.com/v1beta/models";
            headers["x-goog-api-key"] = apiKey;
        } else {
            throw new Error("Select a supported provider first.");
        }

        const response = await fetchWithTimeout(
            url,
            {
                method: "GET",
                headers
            },
            25000
        );

        if (!response.ok) {
            throw await responseError(response);
        }

        return true;
    }

    window.VoiceFlowProviders = {
        getModels,
        detectProviderFromKey,
        transcribeAudio,
        testApiConnection
    };
})();
