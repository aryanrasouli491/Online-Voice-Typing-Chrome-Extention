# Online Voice Typing | NR Company — v2.2.0

## Changed

- Unified remaining user-facing permission and About text under the Online Voice Typing | NR Company identity.
- Updated the dedicated microphone permission tab to use the saved side-panel language and theme.
- Incremented the Manifest version to 2.2.0.

## Fixed

- A microphone device that ends unexpectedly now stops the active recording session and reports a clear error instead of leaving the interface in a stale recording state.

## Quality

- Added repeatable dependency-free validation for Manifest resources, local links, IDs, translation keys, unsafe dynamic-code markers, and likely real credentials.
- Added contribution and private security-reporting guidance.
