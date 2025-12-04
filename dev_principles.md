# Development Principles

## UI State Persistence

If a user can resize, move, collapse, or configure any UI element, that configuration MUST survive application restart.

This ensures users don't have to repeatedly adjust the UI to their preferences every time they open the application.

## Use System UI Components

If there are system UI components available with functionality close to desired, they should be used whenever possible.

## Honor All User Choices from Option Dialogs

When using option dialogs (file picker, font picker, color picker, etc.), ALL user selections from that dialog MUST be captured and applied. If a font dialog allows selecting font family, size, and style - all three must be saved and used, not just the family name.

## Use System Look and Feel

UI elements should match the native Windows appearance. Use system icons (via Shell API), system colors, and default control styles rather than custom styling that deviates from the platform's visual language.

## Match System Theme

All UI must match system theme as close as possible unless specified otherwise. This means using system colors, fonts, and visual styles that correspond to the user's Windows theme settings. Never hardcode colors - use system color resources (e.g., SystemColors in WPF) so the UI automatically adapts to the user's theme.

## File Browser Shows Full System

Unless specified otherwise, a file browser must show the complete filesystem starting from root (drives on Windows). The tree should expand to reveal the target location (last used folder or user's home directory by default). Users should never be restricted to a subset of the filesystem.

Use the reusable file browser control from [ds_csharp_file_browser](https://github.com/dsodol/ds_csharp_file_browser) - a WPF TreeView-based component with system icons and on-demand loading.

## Version Display with Build Info

The application must display version information in the UI including: version number, build number, and build date/time. The build number must auto-increment on every build. This helps identify exactly which build is running during development and troubleshooting.

## Log Panel by Default

When creating a UI application, include a log panel by default to display application logs. This aids debugging during development and helps users understand what the application is doing. The log should capture key events, errors, and state changes. The log panel follows the same theme as the rest of the application (light background, dark text).

## Panels Must Be Resizable and Collapsible

Every panel added to the UI must be resizable (via splitter/drag handle) and collapsible (via toggle button or header click). Panel state (size, collapsed) must be persisted per the UI State Persistence principle.

## Light Theme by Default

The application theme is light by default. All UI elements should use light backgrounds and dark text unless explicitly designed for a specific purpose (like terminal/console panels which may use dark backgrounds for readability).
