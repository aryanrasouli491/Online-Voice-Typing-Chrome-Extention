# Online Voice Typing — NR Company v2.1.0

Online Voice Typing is a standalone Chrome Manifest V3 extension for online speech-to-text. The product interface now uses NR Company branding and includes a fixed About section describing the planned company, its founder, and its software projects.

## Install for personal use or friends

1. Download the supplied ZIP package and extract it into a normal folder.
2. In Chrome, open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Select **Load unpacked**.
5. Choose the extracted folder that directly contains `manifest.json`.
6. Open the extension, go to **More Options → Transcription Settings**, and enter the user's own API key for a supported provider.
7. Enable microphone permission when prompted. Then separately enable **Online Voice Typing** to authorize online transcription.

The extension uses online transcription providers. It cannot bypass provider or network restrictions in a country or network; if a provider is blocked, the user needs a legally available supported provider or network. No API key is included in this package. Provider quotas, pricing, model access, and free allowances can change.

## GitHub privacy and distribution

- Keep the canonical development repository **Private** if you do not want the public to browse its files. Do not invite people as collaborators unless you want them to access that repository.
- A private repository cannot be downloaded by friends who have no repository access. For easier sharing, give them a separate release ZIP or publish the extension through the Chrome Web Store after meeting its requirements.
- Important limitation: a Chrome extension loaded unpacked contains its HTML, CSS, JavaScript, images, and manifest on the user's computer. Those files can be inspected or changed locally. A private GitHub repository protects the canonical repository; it does not make client-side extension code secret.
- The About content is not editable through the extension UI. To change it for future downloads, edit the marked section in `sidepanel.html`, update the package, and distribute the new version. Existing installations will not automatically receive changes from your private repository.
- Never commit real API keys. Users should create and store their own keys. Direct client-side API keys are not completely secret from a person who can inspect their own browser profile or extension files.

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

See `README_FA.txt` for Dari/Persian installation guidance and `docs/PRIVACY_AND_SECURITY.txt` for security limitations.
