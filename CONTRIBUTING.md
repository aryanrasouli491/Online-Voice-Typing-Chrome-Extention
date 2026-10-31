# Contributing to Online Voice Typing | NR Company

Thank you for improving the project.

1. Create a focused branch from the current default branch.
2. Keep the HTML/CSS/vanilla JavaScript architecture unless a documented compatibility need requires otherwise.
3. Test the affected workflow and run `node tests/validate-extension.js`, `node tests/providers.test.js`, plus `node --check` for changed JavaScript files.
4. Never commit API keys, browser profile data, recordings, transcripts, or generated ZIP files.
5. Explain user-visible changes, testing performed, and any limitations in the pull request.

For changes involving microphone capture, provider requests, permissions, storage, or privacy copy, include a manual Chrome test when you have access to the required device/account. Do not claim a real provider or microphone test without performing it.
