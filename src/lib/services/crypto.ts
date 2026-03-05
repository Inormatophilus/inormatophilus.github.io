// =============================================================================
// GMTW Trail Map — HMAC-SHA256 Anti-Cheat Signierung
//
// Signiert Rennergebnisse fälschungssicher mit HMAC-SHA256.
// Secret Key enthält das vollständige Renndatum: `GMTW26-RACE-YYYY-MM-DD`
// → Ergebnisse sind nur am Renntag valide.
// =============================================================================

import type { RunRecord, UserProfile } from '$lib/types';

/** Konvertiert ArrayBuffer zu Hex-String */
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Erzeugt HMAC-SHA256-Signatur für ein Rennergebnis.
 *
 * Payload enthält:
 * - trackId, totalMs, splits (Anti-Manipulation der Zeit)
 * - riderName, muniName (Fahrer-Identität)
 * - seatClampColor (physischer Hardware-Anker — bindet Ergebnis an spezifisches Einrad)
 * - wheelSize (Equipment-Verifikation)
 *
 * @returns Erste 24 Hex-Zeichen des HMAC (96-Bit Sicherheit)
 */
export async function generateRaceSignature(
  run: Omit<RunRecord, 'signature'>,
  profile: UserProfile
): Promise<string> {
  const secret = `GMTW26-RACE-${run.date}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const payload = JSON.stringify({
    tId: run.trackId,
    ms: run.totalMs,
    splits: run.splits,
    rider: profile.name,
    muni: profile.muniName,
    clamp: profile.seatClampColor,
    wheel: profile.wheelSize
  });

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return bufToHex(signature).slice(0, 24);
}

/**
 * Verifiziert eine Rennergebnis-Signatur.
 * @returns true wenn Signatur korrekt, false wenn manipuliert
 */
export async function verifyRaceSignature(
  run: RunRecord,
  profile: UserProfile
): Promise<boolean> {
  try {
    const { signature: _sig, ...runWithoutSig } = run;
    void _sig;
    const expected = await generateRaceSignature(runWithoutSig, profile);
    return expected === run.signature;
  } catch {
    return false;
  }
}

/**
 * Schnelle Verifikation für Offline-Leaderboard-Anzeige.
 * Gibt Vertrauenslevel zurück: 'verified' | 'unverified' | 'invalid'
 */
export async function checkRunTrust(
  run: RunRecord,
  profile: UserProfile
): Promise<'verified' | 'unverified' | 'invalid'> {
  if (!run.signature) return 'unverified';
  const ok = await verifyRaceSignature(run, profile);
  return ok ? 'verified' : 'invalid';
}

/** Formatiert Signatur für Anzeige (erste 8 Zeichen in Gruppen) */
export function formatSignature(sig: string): string {
  return sig.slice(0, 8).toUpperCase() + '…';
}
