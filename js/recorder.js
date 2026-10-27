// Captures microphone audio and splits speech into phrases after natural silence.
// The explicit Pause button stops microphone capture; Resume opens a new capture stream.
(function () {
    const SILENCE_PAUSE_MS = 1100;
    const SPEECH_LEVEL_THRESHOLD = 0.025;
    const MIN_AUDIO_BYTES = 700;

    let sessionState = "idle";
    let mediaStream = null;
    let audioContext = null;
    let analyser = null;
    let audioSource = null;
    let audioSamples = null;
    let animationFrameId = 0;
    let activeRecorder = null;
    let lastVoiceTime = 0;
    let lastAudioIsSpeech = false;
    let previousSpeechDetected = false;
    let recorderStopPending = false;
    let callbacks = {};
    let stopPromiseResolver = null;
    let pausePromiseResolver = null;
    let microphoneMuted = false;

    function chooseMimeType() {
        const supportedTypes = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/mp4"
        ];

        for (const mimeType of supportedTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                return mimeType;
            }
        }

        return "";
    }

    function stopSpeechMonitor() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = 0;
        }
    }

    // Releases only the active microphone/audio-analysis resources.
    // It does not change the logical session state or discard callbacks.
    function releaseCaptureResources() {
        stopSpeechMonitor();

        if (mediaStream) {
            mediaStream.getTracks().forEach((track) => track.stop());
            mediaStream = null;
        }

        if (audioSource) {
            try {
                audioSource.disconnect();
            } catch (error) {
                // A disconnected source is already released.
            }
            audioSource = null;
        }

        if (audioContext && audioContext.state !== "closed") {
            audioContext.close().catch(() => {});
        }

        audioContext = null;
        analyser = null;
        audioSamples = null;
        lastVoiceTime = 0;
        lastAudioIsSpeech = false;
        previousSpeechDetected = false;
    }

    function finishSession() {
        releaseCaptureResources();
        activeRecorder = null;
        recorderStopPending = false;
        sessionState = "idle";

        if (typeof callbacks.onStopped === "function") {
            callbacks.onStopped();
        }

        if (stopPromiseResolver) {
            stopPromiseResolver();
            stopPromiseResolver = null;
        }

        if (pausePromiseResolver) {
            pausePromiseResolver();
            pausePromiseResolver = null;
        }
    }

    function deliverSegment(recorder, segmentChunks, preferredMimeType) {
        const outputType = recorder.mimeType || preferredMimeType || "audio/webm";
        const audioBlob = new Blob(segmentChunks, { type: outputType });

        if (!recorder.voiceDetected || audioBlob.size < MIN_AUDIO_BYTES) {
            return;
        }

        if (typeof callbacks.onSegment !== "function") {
            return;
        }

        const extension = outputType.includes("mp4") ? "m4a" : "webm";
        callbacks.onSegment(audioBlob, "voice-segment." + extension);
    }

    function startNewSegment(startedDuringSpeech) {
        if (sessionState !== "recording" || !mediaStream || activeRecorder) {
            return;
        }

        try {
            const mimeType = chooseMimeType();
            const recorderOptions = mimeType ? { mimeType } : undefined;
            const recorder = new MediaRecorder(mediaStream, recorderOptions);
            const segmentChunks = [];

            recorder.voiceDetected = Boolean(startedDuringSpeech);
            activeRecorder = recorder;

            recorder.addEventListener("dataavailable", (event) => {
                if (event.data && event.data.size > 0) {
                    segmentChunks.push(event.data);
                }
            });

            recorder.addEventListener("error", (event) => {
                if (typeof callbacks.onError === "function") {
                    callbacks.onError(event.error || new Error("The browser recorder failed."));
                }
            });

            // The final dataavailable event is delivered before stop, so the full segment
            // is assembled before it is sent to the transcription queue.
            recorder.addEventListener("stop", () => {
                deliverSegment(recorder, segmentChunks, mimeType);

                if (activeRecorder === recorder) {
                    activeRecorder = null;
                }
                recorderStopPending = false;

                if (sessionState === "stopping") {
                    finishSession();
                    return;
                }

                if (sessionState === "pausing") {
                    releaseCaptureResources();
                    sessionState = "paused";
                    if (pausePromiseResolver) {
                        pausePromiseResolver();
                        pausePromiseResolver = null;
                    }
                    return;
                }

                if (sessionState !== "recording") {
                    return;
                }

                // Speech may resume while the previous recorder is finishing.
                if (lastAudioIsSpeech && !activeRecorder) {
                    startNewSegment(true);
                }
            });

            recorder.start();
        } catch (error) {
            if (typeof callbacks.onError === "function") {
                callbacks.onError(error);
            }
            sessionState = "stopping";
            finishSession();
        }
    }

    function getAudioLevel() {
        if (!analyser || !audioSamples) {
            return 0;
        }

        analyser.getByteTimeDomainData(audioSamples);
        let total = 0;

        for (let index = 0; index < audioSamples.length; index += 1) {
            const normalizedSample = (audioSamples[index] - 128) / 128;
            total += normalizedSample * normalizedSample;
        }

        return Math.sqrt(total / audioSamples.length);
    }

    function monitorSpeech() {
        if (sessionState !== "recording" || !analyser) {
            return;
        }

        const currentTime = performance.now();
        const audioLevel = getAudioLevel();
        const speechDetected = audioLevel >= SPEECH_LEVEL_THRESHOLD;
        lastAudioIsSpeech = speechDetected;

        if (speechDetected && !previousSpeechDetected && typeof callbacks.onSpeechStarted === "function") {
            callbacks.onSpeechStarted();
        }

        previousSpeechDetected = speechDetected;

        if (speechDetected) {
            lastVoiceTime = currentTime;

            if (activeRecorder && activeRecorder.state === "recording") {
                activeRecorder.voiceDetected = true;
            } else if (!activeRecorder) {
                startNewSegment(true);
            }
        } else if (
            activeRecorder &&
            activeRecorder.state === "recording" &&
            activeRecorder.voiceDetected &&
            currentTime - lastVoiceTime >= SILENCE_PAUSE_MS
        ) {
            // Natural silence ends a phrase, but the microphone remains active.
            recorderStopPending = true;
            activeRecorder.stop();

            if (typeof callbacks.onPause === "function") {
                callbacks.onPause();
            }
        }

        animationFrameId = requestAnimationFrame(monitorSpeech);
    }

    async function acquireCaptureResources() {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        // Keep the user's mute choice across Pause/Resume, including a newly opened stream.
        mediaStream.getAudioTracks().forEach((track) => {
            track.enabled = !microphoneMuted;
        });

        try {
            audioContext = new AudioContext();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            audioSamples = new Uint8Array(analyser.fftSize);
            audioSource = audioContext.createMediaStreamSource(mediaStream);
            audioSource.connect(analyser);
            await audioContext.resume();
        } catch (error) {
            releaseCaptureResources();
            throw new Error("Your browser could not start the audio analyser. Check Chrome audio support and microphone settings.");
        }
    }

    async function start(eventCallbacks) {
        if (sessionState !== "idle") {
            return;
        }

        callbacks = eventCallbacks || {};
        microphoneMuted = false;
        sessionState = "requesting";

        try {
            await acquireCaptureResources();
            sessionState = "recording";
            lastVoiceTime = performance.now();
            lastAudioIsSpeech = false;
            previousSpeechDetected = false;
            recorderStopPending = false;

            // Start a segment immediately so the first spoken word is not deliberately delayed.
            startNewSegment(false);
            if (sessionState !== "recording") {
                throw new Error("The browser could not start audio recording. Check microphone access and try again.");
            }
            animationFrameId = requestAnimationFrame(monitorSpeech);
        } catch (error) {
            releaseCaptureResources();
            sessionState = "idle";
            throw error;
        }
    }

    async function pause() {
        if (sessionState !== "recording") {
            return;
        }

        sessionState = "pausing";
        stopSpeechMonitor();

        return new Promise((resolve) => {
            pausePromiseResolver = resolve;

            if (activeRecorder) {
                if (activeRecorder.state === "recording") {
                    recorderStopPending = true;
                    activeRecorder.stop();
                }
                // Stop microphone capture immediately, including when a natural-silence
                // segment was already waiting for its stop event.
                if (mediaStream) {
                    mediaStream.getTracks().forEach((track) => track.stop());
                }
            } else {
                releaseCaptureResources();
                sessionState = "paused";
                pausePromiseResolver();
                pausePromiseResolver = null;
            }
            // If a natural-silence segment is already stopping, its stop event resolves pause.
        });
    }

    async function resume() {
        if (sessionState !== "paused") {
            return;
        }

        sessionState = "requesting";

        try {
            await acquireCaptureResources();
            sessionState = "recording";
            lastVoiceTime = performance.now();
            lastAudioIsSpeech = false;
            previousSpeechDetected = false;
            recorderStopPending = false;
            startNewSegment(false);
            if (sessionState !== "recording") {
                throw new Error("The browser could not resume audio recording. Try Resume again.");
            }
            animationFrameId = requestAnimationFrame(monitorSpeech);
        } catch (error) {
            releaseCaptureResources();
            sessionState = "paused";
            throw error;
        }
    }

    function stop() {
        if (sessionState === "idle") {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            stopPromiseResolver = resolve;
            sessionState = "stopping";
            stopSpeechMonitor();

            if (activeRecorder && activeRecorder.state === "recording") {
                recorderStopPending = true;
                activeRecorder.stop();
            } else if (!activeRecorder) {
                finishSession();
            }
            // If MediaRecorder is already stopping, its stop event finishes the session.
        });
    }

    function setMuted(muted) {
        microphoneMuted = Boolean(muted);
        if (mediaStream) {
            mediaStream.getAudioTracks().forEach((track) => {
                track.enabled = !microphoneMuted;
            });
        }
        return microphoneMuted;
    }

    window.VoiceFlowRecorder = {
        start,
        setMuted,
        isMuted() {
            return microphoneMuted;
        },
        pause,
        resume,
        stop,
        getState() {
            return sessionState;
        },
        isActive() {
            return sessionState === "recording";
        }
    };
})();
