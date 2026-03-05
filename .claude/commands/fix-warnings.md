Fix all Svelte compiler warnings in the GMTW Svelte app.

First run: cd /c/Users/Jaman/PycharmProjects/GMTW/GMTW26/gmtw-svelte && npm run build 2>&1 | grep "vite-plugin-svelte"

Then fix each warning category:

1. **Legacy svelte-ignore** — replace `a11y-click-events-have-key-events` with `a11y_click_events_have_key_events` (dashes → underscores)
2. **Self-closing tags** — `<canvas ... />` → `<canvas ...></canvas>`, `<input ... />` OK (void element)
3. **state_referenced_locally** — wrap in `$derived()` or use `$props()` snapshot
4. **attribute_quoted** — remove quotes from component props: `title="..."` → `title={...}`
5. **a11y_label_has_associated_control** — add `for="input-id"` to label + `id="input-id"` to input
6. **a11y_role_supports_aria_props_implicit** — remove incompatible aria attributes

Fix files directly. Run build again to confirm warnings reduced.
Report: N warnings fixed, N remaining (with explanation why those remain).
