# Security policy

Please do not publish API keys, recordings, transcripts, or a reproducible security issue in a public issue tracker. Contact the repository owner privately with a short description, affected version, impact, and safe reproduction steps.

The extension is client-side. User API keys are stored in Chrome local storage and cannot be treated as hardware-backed secrets. If a key may have been exposed, revoke or rotate it through its provider immediately.

See [docs/PRIVACY_AND_SECURITY.txt](docs/PRIVACY_AND_SECURITY.txt) for the supported providers, permissions, data flow, and known limitations.
