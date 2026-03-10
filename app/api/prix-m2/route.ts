import { NextRequest, NextResponse } from "next/server";

// Sources :
// Géocodage → api-adresse.data.gouv.fr (BAN officielle)
// Prix DVF  → files.data.gouv.fr/geo-dvf/ (DGFiP, données par commune)

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address || address.trim().length < 5) {
    return NextResponse.json({ error: "Adresse trop courte" }, { status: 400 });
  }

  // ── 1. Géocodage ────────────────────────────────────────────
  let lat: number,
    lon: number,
    city: string,
    postcode: string,
    citycode: string;

  try {
    const geoRes = await fetchTimeout(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`,
      6000
    );
    if (!geoRes.ok) throw new Error(`HTTP ${geoRes.status}`);
    const geoData = await geoRes.json();
    if (!geoData.features?.length) {
      return NextResponse.json(
        { error: "Adresse introuvable. Vérifiez la ville et le code postal." },
        { status: 404 }
      );
    }
    const feat = geoData.features[0];
    [lon, lat] = feat.geometry.coordinates;
    city = feat.properties.city ?? "";
    postcode = feat.properties.postcode ?? "";
    citycode = feat.properties.citycode ?? "";
  } catch (e) {
    return NextResponse.json(
      { error: `Géocodage impossible : ${errMsg(e)}` },
      { status: 502 }
    );
  }

  if (!citycode) {
    return NextResponse.json(
      { error: "Code INSEE introuvable pour cette adresse." },
      { status: 404 }
    );
  }

  // ── 2. Code département ──────────────────────────────────────
  // INSEE commune code: 5 chars. Dep = first 2 (or 3 for DOM-TOM 97x, Corse 2A/2B)
  let dep: string;
  if (/^(2A|2B)/i.test(citycode)) {
    dep = citycode.slice(0, 2).toLowerCase();
  } else if (citycode.startsWith("97")) {
    dep = citycode.slice(0, 3);
  } else {
    dep = citycode.slice(0, 2);
  }

  // ── 3. Téléchargement CSV DVF par commune ────────────────────
  // URL: files.data.gouv.fr/geo-dvf/latest/csv/{année}/communes/{dep}/{citycode}.csv
  const currentYear = new Date().getFullYear();
  let csvText: string | null = null;
  let usedYear = 0;
  let lastTriedUrl = "";

  for (const year of [currentYear - 1, currentYear - 2, currentYear - 3]) {
    const url = `https://files.data.gouv.fr/geo-dvf/latest/csv/${year}/communes/${dep}/${citycode}.csv`;
    lastTriedUrl = url;
    try {
      const res = await fetchTimeout(url, 12000);
      if (res.ok) {
        const text = await res.text();
        if (text.trim().length > 200) {
          csvText = text;
          usedYear = year;
          break;
        }
      }
    } catch {
      // try next year
    }
  }

  if (!csvText) {
    return NextResponse.json(
      {
        error: `Données DVF introuvables pour ${city} (${citycode}). Dernière URL testée : ${lastTriedUrl}`,
      },
      { status: 404 }
    );
  }

  // ── 4. Parsing CSV ───────────────────────────────────────────
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) {
    return NextResponse.json({ error: "Fichier DVF vide." }, { status: 404 });
  }

  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, ""));

  const i = {
    nature: headers.indexOf("nature_mutation"),
    type: headers.indexOf("type_local"),
    val: headers.indexOf("valeur_fonciere"),
    surf: headers.indexOf("surface_reelle_bati"),
    date: headers.indexOf("date_mutation"),
  };

  if ([i.nature, i.type, i.val, i.surf].some((x) => x === -1)) {
    return NextResponse.json(
      {
        error: `Colonnes DVF inattendues. Trouvées : ${headers.slice(0, 8).join(", ")}`,
      },
      { status: 500 }
    );
  }

  const prices: number[] = [];
  let lastDate = "";

  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (
      cols[i.nature] === "Vente" &&
      ["Appartement", "Maison"].includes(cols[i.type])
    ) {
      const val = parseFr(cols[i.val]);
      const surf = parseFr(cols[i.surf]);
      if (val > 10_000 && surf > 5) {
        prices.push(val / surf);
        const d = i.date !== -1 ? cols[i.date] : "";
        if (d > lastDate) lastDate = d;
      }
    }
  }

  if (prices.length < 3) {
    return NextResponse.json(
      {
        error: `Pas assez de ventes résidentielles à ${city} : ${prices.length} transaction${prices.length > 1 ? "s" : ""} trouvée${prices.length > 1 ? "s" : ""}.`,
      },
      { status: 404 }
    );
  }

  // ── 5. Statistiques (trim 10% outliers de chaque côté) ───────
  prices.sort((a, b) => a - b);
  const trim = Math.max(1, Math.floor(prices.length * 0.1));
  const trimmed = prices.slice(trim, prices.length - trim);

  const avg = Math.round(trimmed.reduce((s, v) => s + v, 0) / trimmed.length);
  const min = Math.round(trimmed[0]);
  const max = Math.round(trimmed[trimmed.length - 1]);

  const lastUpdate = lastDate
    ? new Date(lastDate).toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      })
    : `Données ${usedYear}`;

  void lat; void lon; // used only for geocoding, keep for future proximity search

  return NextResponse.json({
    prixM2: avg,
    min,
    max,
    count: prices.length,
    city,
    postcode,
    radiusKm: 0,
    lastUpdate,
    year: usedYear,
  });
}

// ── Helpers ──────────────────────────────────────────────────

function parseFr(s: string): number {
  return parseFloat(s.replace(",", ".")) || 0;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function fetchTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}
