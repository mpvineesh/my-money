// Live mutual-fund NAV via mfapi.in — free, CORS-enabled, no API key. Data is
// sourced from AMFI's daily NAV file. Browser can call it directly (no server proxy).

const BASE = 'https://api.mfapi.in/mf';
const LIST_CACHE_KEY = 'mf-scheme-list-v1';
const LIST_TTL_MS = 24 * 60 * 60 * 1000; // the full scheme list changes rarely

let listPromise = null;

// The full scheme list is large, so fetch it at most once per day (memory + localStorage).
export async function getSchemeList() {
  try {
    const cached = JSON.parse(localStorage.getItem(LIST_CACHE_KEY) || 'null');
    if (cached && Array.isArray(cached.list) && Date.now() - cached.at < LIST_TTL_MS) return cached.list;
  } catch { /* ignore bad cache */ }

  if (!listPromise) {
    listPromise = fetch(BASE)
      .then((r) => r.json())
      .then((list) => {
        try { localStorage.setItem(LIST_CACHE_KEY, JSON.stringify({ at: Date.now(), list })); } catch { /* ignore */ }
        return list;
      })
      .catch((err) => { listPromise = null; throw err; });
  }
  return listPromise;
}

export async function searchSchemes(query, limit = 25) {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 3) return [];
  const list = await getSchemeList();
  const out = [];
  for (const scheme of list) {
    if (String(scheme.schemeName).toLowerCase().includes(q)) {
      out.push({ schemeCode: String(scheme.schemeCode), schemeName: scheme.schemeName });
      if (out.length >= limit) break;
    }
  }
  return out;
}

// NAV on a specific date (nearest published NAV on/before isoDate, YYYY-MM-DD).
// Used when recording a SIP so units are bought at that day's NAV. Returns { nav, date }.
export async function fetchNavOnDate(schemeCode, isoDate) {
  const r = await fetch(`${BASE}/${schemeCode}`);
  if (!r.ok) throw new Error('NAV history fetch failed');
  const data = await r.json();
  const rows = data?.data || []; // dd-mm-yyyy, latest first
  const toIso = (ddmmyyyy) => {
    const [d, m, y] = String(ddmmyyyy).split('-');
    return `${y}-${m}-${d}`;
  };
  for (const row of rows) {
    const iso = toIso(row.date);
    if (iso <= isoDate) {
      const nav = Number(row.nav);
      if (Number.isFinite(nav)) return { nav, date: iso };
    }
  }
  const oldest = rows[rows.length - 1];
  const nav = Number(oldest?.nav);
  if (oldest && Number.isFinite(nav)) return { nav, date: toIso(oldest.date) };
  throw new Error('No NAV data');
}

// Latest NAV for a scheme: { schemeCode, schemeName, nav, date }.
export async function fetchLatestNav(schemeCode) {
  const r = await fetch(`${BASE}/${schemeCode}/latest`);
  if (!r.ok) throw new Error('NAV fetch failed');
  const data = await r.json();
  const latest = data?.data?.[0];
  const nav = Number(latest?.nav);
  if (!latest || !Number.isFinite(nav)) throw new Error('No NAV data');
  return { schemeCode: String(schemeCode), schemeName: data?.meta?.scheme_name || '', nav, date: latest.date };
}
