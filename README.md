# Online Voice Typing | NR Company v2.3.0

Online Voice Typing is a standalone Chrome Manifest V3 extension for online speech-to-text. It is a lightweight, client-side NR Company project with no backend, account system, analytics, or bundled API key.

## Install for personal use or friends

1. Download the supplied ZIP package and extract it into a normal folder.
2. In Chrome, open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Select **Load unpacked**.
5. Choose the extracted folder that directly contains `manifest.json`.
6. Open the extension, go to **More Options → Transcription Settings**, and enter the user's own API key for a supported provider.
7. Enable microphone permission when prompted. Then separately enable **Online Voice Typing** to authorize online transcription.

The extension uses online transcription providers. It cannot bypass provider or network restrictions in a country or network; if a provider is blocked, the user needs a legally available supported provider or network. No API key is included in this package. Provider quotas, pricing, model access, and free allowances can change.

## Download, distribution, and source visibility

This is a public open-source repository. Anyone who installs an unpacked Chrome extension receives its HTML, CSS, JavaScript, images, and Manifest, so client-side code must never contain a real API key. Users should always create and use their own key. A local key file is ignored by Git, but Chrome profile storage is still not an encrypted secret vault.

For the shortest installation and API-key instructions, read [docs/USER_GUIDE.md](docs/USER_GUIDE.md). The About content is not editable in the extension UI; maintainers can update the marked `CONTACT DETAILS` block in `sidepanel.html` for future releases.

## Editing the NR Company About section

Open `sidepanel.html` and search for `CONTACT DETAILS`. The adjacent HTML comment marks the contact placeholders. Replace `ADD_OFFICIAL_EMAIL_HERE`, `ADD_OFFICIAL_WEBSITE_HERE`, and `ADD_OFFICIAL_PROFILE_HERE` before public release. The company and project descriptions are in the same `nr-about-block` section.

## Company profile shown in the extension

The app identifies the brand as **NR Company**, full name **Nooraqa Rasouli Company**, founded in Kabul, Afghanistan, in 2025 by Nooraqa Rasouli. It describes web systems, desktop software, local and online AI, Online/Offline Voice Typing, Attendance Management System, Smart Learning Platform, and Library Management System. This is presented as a planned company profile, not a claim of legal registration or that every listed product is already released.

## Current behavior

- HTML, CSS, and vanilla JavaScript; Manifest V3.
- Online transcription only; no local AI model is bundled.
- Microphone permission and consent to upload audio are separate.
- User-supplied provider keys are stored in the browser profile.
- Local transcript history is stored in the browser and does not save raw audio by default.

## Features and daily use

- Speech-to-text from a microphone, with real Pause, Resume, Stop, and mute controls.
- Audio-file transcription for supported audio formats up to 18 MB.
- User-selected Groq, Google Gemini, or OpenRouter provider and model.
- Transcript editing, copy, TXT export, active-page insertion, and bounded local history.
- Light/dark themes plus English, Dari/Persian, Pashto, Arabic, and Urdu interfaces.

Starting a successful new recording clears only the main editor. It does not remove saved settings, API keys, or transcript history. Use **More options → Transcription Settings** to select a provider and save your own matching API key, allow microphone access in the dedicated Chrome tab, enable **Online Voice Typing**, then start recording. For OpenRouter, confirm the metered-use notice before transcription.

## Privacy, security, and troubleshooting

- This is an online extension: a supported API, internet access, and a user-owned API key are required. Provider availability, pricing, quotas, retention, and regional access can change.
- Audio is sent only after online mode is enabled and the user starts a recording or explicitly transcribes a file. The extension cannot recall audio already submitted to a provider.
- API keys are stored in `chrome.storage.local`, which is not encrypted secret storage. Remove a key with its **Remove key** button and rotate/revoke it through the provider if it may be exposed.
- If microphone access is blocked, open Chrome microphone settings from the extension. For unavailable/busy microphones, reconnect the device, close competing applications, and check operating-system microphone privacy settings.
- A failed transcription can indicate an invalid key, missing model access, quota/billing limit, or network problem. A connection test does not guarantee model availability.

See `README_FA.txt` for Dari/Persian installation guidance, [docs/USER_GUIDE.md](docs/USER_GUIDE.md) for the canonical setup guide, and `docs/PRIVACY_AND_SECURITY.txt` for detailed data-flow and security limitations.

## Development and verification

No build step or runtime dependencies are required. Run the dependency-free checks before contributing:

```powershell
node tests/validate-extension.js
node tests/providers.test.js
Get-ChildItem js -Filter *.js | ForEach-Object { node --check $_.FullName }
```

The validation checks Manifest V3 metadata, shipped paths, duplicate IDs, local resources, translation keys, unsafe dynamic-code markers, and likely real credentials. It does not substitute for a physical microphone, installed Chrome, or live provider credentials.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before sending changes and use [SECURITY.md](SECURITY.md) for private security reporting.

## License

Released under the [MIT License](LICENSE). Copyright © 2026 NR Company / Nooraqa Rasouli.
