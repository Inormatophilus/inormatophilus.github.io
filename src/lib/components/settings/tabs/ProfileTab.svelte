<script lang="ts">
  import { app } from '$lib/stores/app.svelte';
  import { loadProfile, saveProfile } from '$lib/services/storage';
  import type { UserProfile, Lang } from '$lib/types';

  const LANGS: { id: Lang; flag: string; label: string }[] = [
    { id: 'de', flag: '🇩🇪', label: 'Deutsch' },
    { id: 'en', flag: '🇬🇧', label: 'English' },
    { id: 'fr', flag: '🇫🇷', label: 'Français' },
    { id: 'es', flag: '🇪🇸', label: 'Español' },
    { id: 'it', flag: '🇮🇹', label: 'Italiano' },
  ];

  const WHEEL_SIZES = ['19', '24', '26', '29', '36'];
  const AVATAR_EMOJIS = ['🦄', '🐻', '🦊', '🐼', '🐸', '🦁', '🐺', '🦝', '🐯', '🤖', '👾', '🥷'];

  let profile: UserProfile = $state(loadProfile() ?? {
    name: '',
    muniName: '',
    wheelSize: '24',
    color: '#c8ff00',
    brake: '',
    seatClampColor: '',
    special: '',
    avatarEmoji: '🦄',
    avatarBg: '#0b0e14',
    lang: app.lang,
    homeLat: undefined,
    homeLng: undefined,
  });

  function save() {
    saveProfile({ ...profile, lang: app.lang });
    app.toast('Profil gespeichert', 'success');
  }
</script>

<div style="padding-top:0.75rem">
  <!-- Avatar -->
  <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem">
    <div style="
      width:4rem;height:4rem;border-radius:50%;
      background:{profile.avatarBg};
      display:flex;align-items:center;justify-content:center;
      font-size:2rem;border:3px solid var(--ac);flex-shrink:0
    ">
      {profile.avatarEmoji}
    </div>
    <div>
      <div class="form-label">Avatar</div>
      <div class="emoji-grid" style="max-height:80px">
        {#each AVATAR_EMOJIS as em}
          <button
            class="emoji-option {profile.avatarEmoji === em ? 'selected' : ''}"
            onclick={() => { profile.avatarEmoji = em; save(); }}
          >{em}</button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Name -->
  <div class="form-row">
    <label class="form-label" for="profile-name">{app.t('name')}</label>
    <input id="profile-name" class="input" type="text" bind:value={profile.name} onchange={save} placeholder="Dein Name" />
  </div>

  <!-- Muni Name -->
  <div class="form-row">
    <label class="form-label" for="profile-muni">{app.t('muni_name')}</label>
    <input id="profile-muni" class="input" type="text" bind:value={profile.muniName} onchange={save} placeholder="Einrad-Name" />
  </div>

  <!-- Wheel Size -->
  <div class="form-row">
    <label class="form-label">{app.t('wheel_size')}</label>
    <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
      {#each WHEEL_SIZES as ws}
        <button
          class="chip {profile.wheelSize === ws ? 'active' : ''}"
          onclick={() => { profile.wheelSize = ws; save(); }}
        >{ws}"</button>
      {/each}
    </div>
  </div>

  <!-- Language -->
  <div class="form-row">
    <label class="form-label">{app.t('language')}</label>
    <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
      {#each LANGS as lang}
        <button
          class="chip {app.lang === lang.id ? 'active' : ''}"
          onclick={() => { app.setLang(lang.id); }}
          title={lang.label}
        >
          {lang.flag} {lang.id.toUpperCase()}
        </button>
      {/each}
    </div>
  </div>

  <!-- Seat Clamp Color (race HMAC field) -->
  <div class="form-row">
    <label class="form-label" for="profile-clamp">Sattelklemmfarbe (Race)</label>
    <input id="profile-clamp" class="input" type="text" bind:value={profile.seatClampColor} onchange={save}
      placeholder="z.B. Schwarz" />
    <span class="form-hint">Wird in Rennergebnisse eingebettet (Anti-Cheat)</span>
  </div>

  <!-- Color -->
  <div class="form-row">
    <label class="form-label" for="profile-color">{app.t('fav_color')}</label>
    <input id="profile-color" type="color" bind:value={profile.color} onchange={save}
      style="width:3rem;height:2rem;border:none;background:none;cursor:pointer" />
  </div>

  <button class="btn btn-primary w-full mt-4" onclick={save}>{app.t('save')}</button>
</div>
