Install or configure a development tool on this Windows 10 system.

Tool requested: $ARGUMENTS

Steps:
1. Check if tool is already installed: run `where $ARGUMENTS` or `$ARGUMENTS --version`
2. If not installed, determine the best install method:
   - Node packages: `npm install -g <package>` or `npx <package>`
   - System tools: check for winget (`winget install <tool>`) or scoop (`scoop install <tool>`)
   - If neither available: provide direct download link and manual steps
3. After install: verify with version check
4. If configuration needed: show the config file path and minimal config

Windows-specific notes:
- Shell is bash (Git Bash), NOT PowerShell or CMD
- Paths use forward slashes in bash: /c/Users/...
- Windows paths in config files: C:\Users\...
- npm global: C:\Users\Jaman\AppData\Roaming\npm
- Node/npm available (used for Svelte build)

Report: installed version + any config needed for the GMTW project.
