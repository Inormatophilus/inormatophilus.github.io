Audit a Svelte component for Svelte 5 correctness and GMTW design system compliance.

Component to audit: $ARGUMENTS

Read the file, then check:

**Svelte 5 Runes:**
- [ ] Uses `$state()`, `$derived()`, `$effect()` (not `$:`, `writable`, etc.)
- [ ] Props via `let {...}: Props = $props()` interface
- [ ] Events via props callbacks (`onclose: () => void`) not `createEventDispatcher`
- [ ] `$effect` cleanup with return function for event listeners
- [ ] No `{#await}` without error handling

**TypeScript:**
- [ ] Proper types for all props
- [ ] No implicit `any`
- [ ] Leaflet dynamic import typed: `typeof import('leaflet')`

**CSS/Design:**
- [ ] Uses CSS variables (`--s1`, `--ac`, `--tx`, etc.)
- [ ] Dark/light theme compatible
- [ ] Mobile-first (touch targets >= 44px)
- [ ] `font-family: var(--fh)` for headers/badges

**Performance:**
- [ ] Large lists use `{#each ... (item.id)}` with key
- [ ] Leaflet layer ops in `$effect` not render
- [ ] No DOM queries in `$effect` without cleanup

Report findings as: OK / Warning / Error per category.
Provide specific fix for each issue found.
