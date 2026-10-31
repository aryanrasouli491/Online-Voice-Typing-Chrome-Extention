# Online Voice Typing | NR Company — v2.3.0

## Security and reliability

- Added an explicit Manifest V3 Content Security Policy that allows connections only to the configured transcription providers.
- Redacts recognizable API-key values, authorization headers, and key query parameters from provider error messages before they reach the UI or developer console.
- Added Git ignore rules for local API-key configuration and common private-key files.

## Project clarity

- Added the MIT License.
- Added one canonical user guide and a documentation map.
- Updated public-repository guidance and removed confusing private-repository wording.
- Moved the last inline logo styles into the shared stylesheet.
