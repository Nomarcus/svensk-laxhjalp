/**
 * Tolka Firestore-tidsstämplar från Admin SDK / klient (Timestamp med toDate,
 * plain { seconds, nanoseconds }, ISO-sträng eller millisekunder).
 */
export function firestoreFieldTimeMs(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'object') return null;

  const o = v as {
    toDate?: () => Date;
    seconds?: unknown;
    nanoseconds?: unknown;
    _seconds?: unknown;
    _nanoseconds?: unknown;
  };
  if (typeof o.toDate === 'function') {
    const d = o.toDate();
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d.getTime();
  }
  const sec =
    typeof o.seconds === 'number'
      ? o.seconds
      : typeof o._seconds === 'number'
        ? o._seconds
        : null;
  if (sec != null) {
    const nano =
      typeof o.nanoseconds === 'number'
        ? o.nanoseconds
        : typeof o._nanoseconds === 'number'
          ? o._nanoseconds
          : 0;
    return sec * 1000 + Math.floor(nano / 1e6);
  }
  return null;
}

export function firestoreDocTimeMs(data: Record<string, unknown>, key: string): number | null {
  return firestoreFieldTimeMs(data[key]);
}
