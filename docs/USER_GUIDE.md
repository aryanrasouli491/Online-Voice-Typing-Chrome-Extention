# Online Voice Typing | NR Company — User Guide

Online Voice Typing turns speech or a selected audio file into editable text through a provider you choose. It is an **online** tool: it needs internet access and your own API key. It does not include an offline speech-recognition model.

## 1. Download and install

1. Download this repository as a ZIP from GitHub, then extract it to a normal folder. Do not select the ZIP itself in Chrome.
2. In Chrome, open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Select **Load unpacked**.
5. Choose the extracted folder that contains `manifest.json`.
6. Open the extension using its toolbar icon.

When you download a future update, replace the folder or update it with Git, then select **Reload** on the extension card in `chrome://extensions`.

## 2. Get your own API key

The extension does not supply an API key. Create one from the provider you intend to use:

- **Groq:** create a Groq account and API key in its official console.
- **Google Gemini:** create a Gemini API key in Google AI Studio or the official Google Cloud workflow.
- **OpenRouter:** create an OpenRouter API key in its official account dashboard. Transcription can incur charges, so review pricing and set account limits first.

Never paste an API key into GitHub issues, chat messages, screenshots, or source files. The extension saves a key in your local Chrome profile after you select **Save key**; use **Remove key** to delete it from the extension.

## 3. Configure and record

1. Open **More options → Transcription Settings**.
2. Choose a provider and model, paste the matching key, and select **Save key**. You can use **Test API connection** before recording.
3. Return to the main screen and select **Enable microphone**. In the tab Chrome opens, allow microphone access.
4. Turn on **Online Voice Typing**. This is separate from microphone permission and authorizes sending audio to the selected provider.
5. Select **Start recording**, speak naturally, pause briefly between phrases, and select **Stop** when finished.

Use Pause/Resume when needed. Mute disables the extension's active microphone track; Stop releases microphone resources. A successful new recording clears the editor but does not remove saved keys, preferences, or history.

## 4. Work with text

- Edit the result directly in the transcript box.
- Use **Copy** or **Export** to keep it.
- Use **More options → Text Tools → Insert into webpage** to insert text into a focused compatible field. Chrome-protected pages and some custom editors may block this; the extension attempts to copy the text instead.
- Use **Audio File to Text** for a supported file smaller than 18 MB.

## 5. Privacy and safe use

- Audio is sent only while Online Voice Typing is enabled and you start recording or explicitly transcribe a chosen file.
- Audio, transcript quality, quotas, prices, retention, and regional availability are controlled by the provider you select. Read that provider's current terms before sending sensitive audio.
- API keys stored in `chrome.storage.local` are local to the current profile but are **not** encrypted hardware-backed secrets. Do not share a configured Chrome profile or an unpacked folder containing local settings.
- This project takes reasonable security measures, but no client-side extension can truthfully promise absolute security. Use restricted keys and provider spending limits where available.

## 6. Troubleshooting

| Problem | What to do |
| --- | --- |
| Microphone is blocked | Open Chrome microphone settings from the extension, allow access, then return and try again. |
| No microphone or microphone busy | Reconnect the device, close other applications using it, and check operating-system microphone privacy settings. |
| API test or transcription fails | Check the provider, saved key, model access, network connection, quota, and billing status. A connection test does not guarantee transcription availability. |
| Text cannot be inserted | Focus a normal text field first. Chrome-protected pages and custom editors may not allow insertion. |

For technical and security details, see [PRIVACY_AND_SECURITY.txt](PRIVACY_AND_SECURITY.txt).
