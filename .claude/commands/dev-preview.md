Start the GMTW Svelte dev server and take a visual screenshot.

Steps:
1. Start dev server: use preview_start with config from .claude/launch.json
2. Wait 3 seconds for server to be ready
3. Take screenshot with preview_screenshot
4. Check console for errors with preview_console_logs level="error"
5. Check the page structure with preview_snapshot

Report:
- Server status (port, any startup errors)
- Screenshot (embed it)
- Any console errors
- Key UI elements visible (TopBar, Map, FilterChips, FABs)

The app should show: dark themed map centered on Hohensyburg (51.4192, 7.4855), TopBar with MUNI badge, filter chips (ALLE/BEGINNER/MITTEL/EXPERT/LOGISTIK), and FAB buttons on the right.
