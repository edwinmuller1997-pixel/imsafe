import React, { useState, useMemo, useEffect, useRef } from "react";

/* ============================================================
   IMSAFE.SE — v7 "Pilotens väg"
   Omdesignad kring pilotens verkliga flöde på fältet:

   ① PILOTEN (IMSAFE)  →  ② LÄGET (riskfaktorer)  →
   ③ BRIEFING & LEGALT  →  ④ FLYGPLANET (walkaround)  →
   ⑤ BEDÖMNING (skapas på knapptryck – inte i realtid)

   UX-principer:
   · Stegen bygger på varandra – som en checklista på disk
   · Nästa oavbockade punkt är alltid markerad ("fingret på raden")
   · Resultatet är en medveten handling: "Skapa min bedömning"
     (commitment-ritual i stället för realtidsmätare)
   · Ändrar du underlaget efteråt ogiltigförklaras bedömningen
   · Åtgärdsruta längst ner: konkreta actions för att sänka risken
   ============================================================ */

/* Två paletter: dag och Night Panel (bevarar mörkerseendet i hangaren) */
const LIGHT = {
  bg: "#F4F5F8", card: "#FFFFFF", ink: "#101828", inkSoft: "#8A94A6", ink2: "#3D4756",
  blue: "#0B5CD6", green: "#1F9D55", orange: "#DD7F0B", red: "#DE3B3B",
  purple: "#7C4DDB", teal: "#0E9BAA", indigo: "#4F46E5", gold: "#C79100",
  line: "rgba(16,24,40,0.10)", fill: "rgba(16,24,40,0.045)",
  grad: "linear-gradient(135deg,#0B5CD6,#4F46E5)",
  cardBorder: "rgba(16,24,40,0.06)",
  cardShadow: "0 1px 2px rgba(16,24,40,0.04), 0 12px 32px rgba(16,24,40,0.05)",
  navGlass: "rgba(248,249,251,0.88)",
};
const DARK = {
  bg: "#0C1117", card: "#161D26", ink: "#E9EDF3", inkSoft: "#7E8A9A", ink2: "#C3CBD6",
  blue: "#4D8DF0", green: "#34B56F", orange: "#E9962E", red: "#E85B5B",
  purple: "#9B7BE8", teal: "#2FB4C4", indigo: "#7B74F0", gold: "#D9AF3B",
  line: "rgba(233,237,243,0.10)", fill: "rgba(233,237,243,0.06)",
  grad: "linear-gradient(135deg,#4D8DF0,#7B74F0)",
  cardBorder: "rgba(233,237,243,0.08)",
  cardShadow: "0 1px 2px rgba(0,0,0,0.4), 0 12px 32px rgba(0,0,0,0.35)",
  navGlass: "rgba(16,22,30,0.88)",
};
const C = { ...LIGHT };
const SF = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif" };
const mono = { fontFamily: "'SF Mono', ui-monospace, Menlo, monospace" };

/* ---------- Ljud ---------- */
let _ctx = null;
function tone(freq, dur = 0.08, delay = 0, type = "sine", vol = 0.07) {
  try {
    _ctx = _ctx || new (window.AudioContext || window.webkitAudioContext)();
    const o = _ctx.createOscillator(), g = _ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, _ctx.currentTime + delay);
    g.gain.linearRampToValueAtTime(vol, _ctx.currentTime + delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, _ctx.currentTime + delay + dur);
    o.connect(g); g.connect(_ctx.destination);
    o.start(_ctx.currentTime + delay); o.stop(_ctx.currentTime + delay + dur + 0.05);
  } catch {}
}
const SND = {
  tick: () => tone(880, 0.06, 0, "sine", 0.05),
  untick: () => tone(440, 0.05, 0, "sine", 0.03),
  step: () => { tone(660, 0.09); tone(990, 0.12, 0.08); },
  done: () => { tone(660, 0.1); tone(880, 0.1, 0.09); tone(1320, 0.18, 0.18, "sine", 0.09); },
  badge: () => { tone(523, 0.12); tone(659, 0.12, 0.1); tone(784, 0.12, 0.2); tone(1046, 0.25, 0.3, "sine", 0.1); },
  xp: () => tone(1200, 0.05, 0, "triangle", 0.04),
  verdict: () => { tone(392, 0.12); tone(523, 0.12, 0.11); tone(659, 0.22, 0.22, "sine", 0.09); },
  nogo: () => { tone(392, 0.15); tone(523, 0.3, 0.14, "sine", 0.08); },
};

/* ---------- Gamification ---------- */
const LEVELS = [
  { xp: 0, name: "Elev", icon: "🐣" }, { xp: 150, name: "Solopilot", icon: "🛫" },
  { xp: 400, name: "Befälhavare", icon: "👨‍✈️" }, { xp: 900, name: "Kapten", icon: "⭐" },
  { xp: 1800, name: "Safety Pro", icon: "🛡️" }, { xp: 3500, name: "Legendar", icon: "🏆" },
];
const BADGES = [
  { id: "first", name: "Första kollen", desc: "Slutför din första genomgång", icon: "✅" },
  { id: "allday", name: "Full koll", desc: "Alla fem steg klara samma dag", icon: "💯" },
  { id: "streak3", name: "3 i rad", desc: "3 dagars säkerhetsstreak", icon: "🔥" },
  { id: "streak7", name: "Veckan", desc: "7 dagars streak", icon: "🔥" },
  { id: "streak30", name: "Månaden", desc: "30 dagars streak", icon: "🌋" },
  { id: "nogo", name: "Rätt beslut", desc: "Ställde in en flygning pga risk – starkaste airmanship som finns", icon: "🧠" },
  { id: "debrief5", name: "Debriefaren", desc: "5 sparade debriefer", icon: "📝" },
  { id: "flights10", name: "Loggmästare", desc: "10 sparade flygningar", icon: "✈️" },
  { id: "walk", name: "Runt planet", desc: "Första kompletta walkaround", icon: "🔍" },
];
const DAILY_TIPS = [
  "Sätt en hård vändpunkt innan start: 'under X ft molnbas vänder jag'. Beslut fattade på marken håller i luften.",
  "Läs TAF:en baklänges: börja med hur dagen slutar. De flesta VFR→IMC-haverier sker på hemvägen.",
  "Säg dina personliga minima högt till passagerarna före start. Då är det lättare att hålla dem.",
  "En avbruten landning är alltid ett godkänt facit. Öva en frivillig go-around då och då.",
  "Förgasarvärme före varje planéring – även en solig dag. Fukt + lågt gaspådrag räcker.",
  "Tre landningar på 90 dagar är lagens minimum för pax – inte ett kvitto på att du är varm.",
  "Bränsle i tanken är tid att tänka. Tanka för hjärnan, inte bara för sträckan.",
  "Trötthet syns inte i spegeln. Sov du under 6 timmar? Då är IMSAFE inte grön.",
  "Get-there-itis botas med en plan B som du faktiskt gillar. Boka den mentalt före start.",
  "Titta ut 80 % av tiden i trafikvarvet. Skärmen talar om var trafiken var – fönstret var den är.",
];

/* ---------- Data ---------- */
const ACCIDENT_DATA = [
  { cat: "Loss of control i luften (LOC-I)", shareFatal: 32, lethality: 65, note: "Stall/spinn – ofta lågt i trafikvarvet. Största dödsorsaken." },
  { cat: "VFR in i IMC / väder", shareFatal: 20, lethality: 86, note: "Få händelser – nästan alltid dödliga." },
  { cat: "CFIT – flygning in i terräng", shareFatal: 12, lethality: 75, note: "Låg höjd, mörker, dålig sikt." },
  { cat: "Start & landning", shareFatal: 10, lethality: 8, note: "Vanligast totalt – men sällan dödlig." },
  { cat: "Bränslehantering", shareFatal: 7, lethality: 15, note: "Nästan alltid förebyggbart." },
  { cat: "Motorbortfall (tekniskt)", shareFatal: 9, lethality: 20, note: "Höjd och terrängval avgör." },
  { cat: "Kollision i luften", shareFatal: 4, lethality: 60, note: "Trafikvarv och nära fält." },
  { cat: "Övrigt", shareFatal: 6, lethality: 25, note: "Markkollision, förgasaris m.m." },
];
const BARRIERS = [
  { id: "pilot", name: "Pilot", color: C.purple, factors: [
    { key: "imsafe", label: "IMSAFE ej helt grön", w: 4, fix: "Flyg inte idag – eller kort lokalflygning med instruktör." },
    { key: "lowRecent", label: "< 10 h senaste 90 dagarna", w: 3, fix: "Boka PC-timme, eller börja med 3 varv EK i lugnt väder." },
    { key: "recency90", label: "90-dagarsregeln utan marginal (FCL.060)", w: 2, fix: "Flyg starter/landningar solo först." },
    { key: "newType", label: "< 10 h på typen", w: 3, fix: "Läs POH-nödprocedurer + höj minima 50 % tills 10 h på typ." },
    { key: "noDryFly", label: "Ingen torrflygning gjord", w: 1, fix: "5 min nu: blunda och flyg trafikvarvet och en go-around." },
  ]},
  { id: "wx", name: "Väder & miljö", color: C.blue, factors: [
    { key: "marginal", label: "Sikt/molnbas nära dina minima", w: 5, fix: "Vänta. Sätt hård vändpunkt: 'under X ft bas vänder jag'." },
    { key: "deterio", label: "Prognosen försämras (TAF/LHP)", w: 4, fix: "Flyg långa benet först, eller lägg returen 3 h före försämringen." },
    { key: "xwind", label: "Sidvind/byar över din gräns", w: 3, fix: "Välj fält med bättre vindriktning eller senare ankomst." },
    { key: "dusk", label: "Skymning eller mörker", w: 4, fix: "Landa senast 30 min före solnedgång – helig marginal." },
    { key: "terrain", label: "Terräng/vatten utan nödalternativ", w: 2, fix: "Rutt längs fält/vägar, flyg högre. Vatten: flytvästar på." },
    { key: "icing", label: "Risk för förgasaris/isbildning", w: 3, fix: "Förgasarvärme proaktivt och före varje planéring." },
  ]},
  { id: "acft", name: "Flygplan", color: C.green, factors: [
    { key: "fuelTight", label: "Bränslereserv under din gräns", w: 4, fix: "Tanka fullt eller mellanlanda. Billigaste försäkringen." },
    { key: "nearMtow", label: "Nära MTOW eller bakre CG", w: 2, fix: "Flytta last framåt eller lämna en väska hemma." },
    { key: "defect", label: "Kvarstående anmärkning", w: 3, fix: "Ring teknikern. Ingen friskrivning = inget flyg." },
    { key: "unfamiliarEquip", label: "Ovan avionik/utrustning", w: 2, fix: "15 min på marken: programmera hela rutten före start." },
  ]},
  { id: "plan", name: "Planering & press", color: C.orange, factors: [
    { key: "pressure", label: "Tidspress/passagerartryck", w: 4, fix: "Säg högt: 'Vi kan behöva vända eller ta bilen.'" },
    { key: "newAd", label: "Ny/obekant flygplats", w: 2, fix: "Plate + satellitbild, rita varvet, ring vid oklarhet." },
    { key: "grassShort", label: "Gräs/kort bana utan beräkning", w: 2, fix: "POH-beräkning med faktorer (gräs +20 %, vått +30 %)." },
    { key: "noAltn", label: "Ingen tydlig plan B", w: 3, fix: "Välj alternativ, skriv upp frekvens + kurs dit." },
    { key: "noBrief", label: "Ofullständig briefing", w: 2, fix: "10 min: NOTAM + TAF + PPR via länkarna i Mer." },
  ]},
];
const IMSAFE_ITEMS = [
  { key: "illness", label: "Illness – fri från sjukdom", target: "Nej" },
  { key: "medication", label: "Medication – inga påverkande mediciner", target: "Nej" },
  { key: "stress", label: "Stress – under kontroll", target: "Nej" },
  { key: "alcohol", label: "Alcohol – 8 h flaska→spak, < 0,2 ‰", target: "Nej" },
  { key: "fatigue", label: "Fatigue – utvilad", target: "Ja" },
  { key: "eating", label: "Eating – ätit & druckit", target: "Ja" },
];
const LEGAL_ITEMS = [
  { key: "license", label: "Certifikat + SEP-behörighet giltig", ref: "Part-FCL" },
  { key: "medical", label: "Medical giltigt", ref: "Part-MED" },
  { key: "recency", label: "90-dagarsregeln för pax uppfylld", ref: "FCL.060" },
  { key: "docsAboard", label: "Dokument ombord: reg.bevis, ARC, radiotillstånd, försäkring, AFM", ref: "NCO.GEN.135" },
  { key: "techlog", label: "Techlog: gångtid OK, inga öppna anmärkningar", ref: "" },
];
const PREFLIGHT_ITEMS = [
  { key: "notam", label: "NOTAM – hela rutten + alternativ", hint: "Aroweb" },
  { key: "airspace", label: "Luftrum: R-områden, TMA, drönarzoner", hint: "" },
  { key: "wx", label: "Väder: METAR/TAF · LHP · SWC · SMHI", hint: "" },
  { key: "myweblog", label: "MyWeblog – bokning", hint: "" },
  { key: "massbalance", label: "Massa & balans + prestanda", hint: "NCO.POL" },
  { key: "fuelplan", label: "Bränsle: trip + 30 min dag / 45 min natt", hint: "NCO.OP.125" },
  { key: "freq", label: "Frekvenser + transponderkoder", hint: "" },
  { key: "ppr", label: "PPR / öppettider", hint: "" },
  { key: "dryfly", label: "Torrflygning – visualisera trafikvarv", hint: "" },
  { key: "ipad", label: "SkyDemon: rutt + kartor nedladdade", hint: "" },
  { key: "paxbrief", label: "Passagerarbriefing", hint: "NCO.OP.130" },
];
const WALKAROUND = [
  { group: "Vätskor", color: C.blue, icon: "💧", items: [
    { key: "oil", label: "Olja – nivå inom gränser, lock åtdraget" },
    { key: "fuelQty", label: "Bränslemängd – visuellt verifierad i båda tankarna" },
    { key: "drain", label: "Dränering – alla punkter, fritt från vatten & partiklar" },
    { key: "fuelCaps", label: "Tanklock stängda & låsta" },
    { key: "leaks", label: "Inga droppar/fläckar under motor eller vingar" },
  ]},
  { group: "Elektronik", color: C.purple, icon: "⚡", items: [
    { key: "master", label: "Master på – batterispänning OK" },
    { key: "lights", label: "Belysning: beacon, strobe, nav, landningsljus" },
    { key: "pitot", label: "Pitotvärme – känn att den blir varm (kort test)" },
    { key: "stall", label: "Stallvarnare – testad" },
    { key: "flaps", label: "Klaffar – kör ut/in, symmetriskt" },
  ]},
  { group: "Skick", color: C.green, icon: "🔍", items: [
    { key: "prop", label: "Propeller – inga hack, sprickor eller spel" },
    { key: "cowl", label: "Motorkåpa – fäst, inga lösa föremål" },
    { key: "wings", label: "Vingar & roder – ytor hela, fria rörelser" },
    { key: "tires", label: "Däck – tryck, mönster, inga trådar" },
    { key: "struts", label: "Fjäderben – rätt utskjut, inget läckage" },
    { key: "static", label: "Statiska portar & pitot – fria" },
    { key: "tiedown", label: "Förtöjning, klossar, pitotskydd BORTTAGNA" },
  ]},
];
const MIN_DEFS = [
  { key: "xwind", label: "Sidvind", unit: "kt", def: 12, min: 0, max: 25, step: 1, dir: "max", legal: "POH-demo är inte din gräns" },
  { key: "gust", label: "Byvind totalt", unit: "kt", def: 20, min: 5, max: 40, step: 1, dir: "max", legal: "" },
  { key: "vis", label: "Sikt", unit: "km", def: 8, min: 5, max: 30, step: 1, dir: "min", legal: "SERA: minst 5 km" },
  { key: "cloud", label: "Molnbas", unit: "ft", def: 2000, min: 600, max: 5000, step: 100, dir: "min", legal: "G: fri från moln · CTR: bas ≥ 1500 ft" },
  { key: "fuel", label: "Bränslereserv vid landning", unit: "min", def: 60, min: 30, max: 120, step: 5, dir: "min", legal: "NCO.OP.125: 30 dag / 45 natt" },
  { key: "rwy", label: "Banlängd", unit: "m", def: 800, min: 400, max: 2000, step: 50, dir: "min", legal: "Kräver prestandaberäkning" },
];
const VMC_ROWS = [
  { space: "C, D, E (under FL100)", vis: "5 km", cloud: "1 500 m horis. · 1 000 ft vert." },
  { space: "G över 900 m AMSL", vis: "5 km", cloud: "1 500 m horis. · 1 000 ft vert." },
  { space: "G under 900 m AMSL", vis: "5 km*", cloud: "Fri från moln, marken i sikte" },
  { space: "Över FL100", vis: "8 km", cloud: "1 500 m horis. · 1 000 ft vert." },
];
const AIRPORTS = ["ESSB Bromma", "ESKN Skavsta", "ESOW Västerås", "ESSA Arlanda", "ESGG Landvetter", "ESGP Säve", "ESMS Malmö", "ESSL Linköping", "ESSP Norrköping", "ESOE Örebro", "ESKC Uppsala/Sundbro", "ESMK Kristianstad", "ESMQ Kalmar", "ESSV Visby", "ESNZ Östersund", "ESNU Umeå", "ESPA Luleå", "ESOK Karlstad", "ESGJ Jönköping", "ESSU Eskilstuna", "ESMX Växjö"];
const BLOG_CATS = ["Alla", "Väder", "Airmanship", "Teknik", "Regler", "Haverilärdomar"];
const BLOG_SEED = [
  { id: 1, cat: "Väder", title: "Så läser du LHP som ett proffs", excerpt: "Platshållare – tolka områdesprognosen mot dina minima.", date: "2026-07-01", read: "5 min" },
  { id: 2, cat: "Airmanship", title: "Vändpunkten: konsten att säga nej i luften", excerpt: "Platshållare – beslutspunkter och sunk cost.", date: "2026-06-20", read: "4 min" },
  { id: 3, cat: "Haverilärdomar", title: "Tre SHK-rapporter varje VFR-pilot borde läsa", excerpt: "Platshållare – lärdomar från svenska haverier.", date: "2026-06-10", read: "7 min" },
];
const DEBRIEF_CHECK = [
  { key: "goals", label: "Passet utvärderat mot målen" },
  { key: "tem", label: "Hot & fel identifierade (TEM)" },
  { key: "learn", label: "En konkret lärdom noterad" },
  { key: "acft", label: "Flygplanets skick OK – ev. anmärkning rapporterad" },
  { key: "logged", label: "Tider förda i loggbok/MyWeblog" },
];
const PREP_FIELDS = [
  { key: "goal", label: "Mål med passet", ph: "T.ex. 5 landningar varav 2 avbrutna" },
  { key: "moments", label: "Övningar & moment", ph: "Trafikvarv, PFL, brant sväng…" },
  { key: "focus", label: "Personligt fokus", ph: "Fartkontroll på final, callouts…" },
  { key: "threats", label: "Kända hot idag (TEM)", ph: "Byig vind, mycket skoltrafik…" },
];

/* ---------- Steg-definition ---------- */
const STEPS = [
  { id: 0, name: "Piloten", icon: "🧍", color: C.purple, q: "Är jag i skick att flyga idag?", time: "~30 sek" },
  { id: 1, name: "Risker", icon: "🌤", color: C.blue, q: "Vilka hot finns idag? Var ärlig – varje kryss får en åtgärd.", time: "~1 min" },
  { id: 2, name: "Briefing", icon: "📋", color: C.indigo, q: "Papper, briefing och planering på plats?", time: "~2 min" },
  { id: 3, name: "Planet", icon: "🛩", color: C.green, q: "Runt planet – i lugn takt. Låt ingen stressa dig.", time: "vid planet" },
  { id: 4, name: "Beslut", icon: "⚖️", color: C.gold, q: "Dags att väga ihop allt.", time: "~30 sek" },
];

/* ---------- UI-komponenter ---------- */
function Card({ children, style = {} }) {
  return <div className="rounded-2xl mb-4" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, ...style }}>{children}</div>;
}
function CardHead({ title, sub, right }) {
  return (
    <div className="flex items-start justify-between px-4 pt-4 pb-2 gap-3">
      <div>
        <h2 className="text-[17px] font-semibold" style={{ ...SF, color: C.ink }}>{title}</h2>
        {sub && <p className="text-[13px] mt-0.5" style={{ color: C.inkSoft }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}
function Ring({ pct, color, size = 44 }) {
  const r = 16, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44">
      <circle cx="22" cy="22" r={r} fill="none" stroke={C.fill} strokeWidth="5" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
        transform="rotate(-90 22 22)" style={{ transition: "stroke-dashoffset .5s ease" }} />
      <text x="22" y="26" textAnchor="middle" fontSize="11" style={SF} fontWeight="600" fill={C.ink}>{Math.round(pct * 100)}</text>
    </svg>
  );
}
function Stepper({ value, onChange, min, max, step, unit, color = C.blue }) {
  const b = { width: 32, height: 32, borderRadius: 10, background: C.fill, color: C.blue, fontSize: 19, fontWeight: 500, lineHeight: 1 };
  return (
    <div className="flex items-center gap-1.5">
      <button style={b} className="active:opacity-50" onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <div className="text-center" style={{ minWidth: 70 }}>
        <span style={{ ...SF, fontSize: 17, fontWeight: 600, color }}>{value}</span>
        <span style={{ ...SF, fontSize: 12, color: C.inkSoft }}> {unit}</span>
      </div>
      <button style={b} className="active:opacity-50" onClick={() => onChange(Math.min(max, value + step))}>+</button>
    </div>
  );
}
function LinkRow({ href, title, sub, color = C.blue }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 active:opacity-60" style={{ borderTop: `0.5px solid ${C.line}`, textDecoration: "none" }}>
      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-[15px]" style={{ background: color + "1A", color }}>↗</span>
      <span className="flex-1">
        <span className="block text-[15px] font-medium" style={{ ...SF, color: C.ink }}>{title}</span>
        {sub && <span className="block text-[12px]" style={{ color: C.inkSoft }}>{sub}</span>}
      </span>
      <span style={{ color: "rgba(60,60,67,0.3)" }}>›</span>
    </a>
  );
}
const inputF = () => ({ ...SF, width: "100%", padding: "11px 13px", borderRadius: 12, border: "none", background: C.fill, color: C.ink, fontSize: 15, appearance: "none", WebkitAppearance: "none", outline: "none" });

function Confetti({ show }) {
  if (!show) return null;
  const colors = [C.blue, C.green, C.orange, C.purple, C.gold, C.teal];
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 60 }}>
      {Array.from({ length: 46 }).map((_, i) => (
        <span key={i} style={{
          position: "absolute", left: `${(i * 37) % 100}%`, top: "-12px",
          width: 8 + (i % 3) * 3, height: 12 + (i % 4) * 3,
          background: colors[i % colors.length], borderRadius: 2,
          animation: `imsafeFall ${1.6 + (i % 5) * 0.3}s ${(i % 7) * 0.08}s ease-in forwards`,
          transform: `rotate(${i * 47}deg)`,
        }} />
      ))}
    </div>
  );
}
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="fixed left-1/2 pointer-events-none" style={{ top: 70, transform: "translateX(-50%)", zIndex: 70, animation: "imsafePop .3s ease-out" }}>
      <div className="px-4 py-2.5 rounded-full flex items-center gap-2 shadow-lg" style={{ background: "rgba(28,28,30,0.92)", backdropFilter: "blur(10px)", color: "#fff", ...SF }}>
        <span className="text-[16px]">{toast.icon}</span>
        <span className="text-[14px] font-semibold">{toast.text}</span>
      </div>
    </div>
  );
}

/* ============================================================ */

export default function ImsafeApp() {
  const [tab, setTab] = useState("fly");
  const [step, setStep] = useState(0);
  const [assessed, setAssessed] = useState(false);
  const [decision, setDecision] = useState(null); // "go" | "nogo"
  const [moreView, setMoreView] = useState("menu");
  const [expandedBarrier, setExpandedBarrier] = useState("pilot");
  const [seenIntro, setSeenIntro] = useState(true); // sätts från lagring
  const [lastAssessment, setLastAssessment] = useState(null);
  const [risks, setRisks] = useState({});
  const [imsafe, setImsafe] = useState({});
  const [legal, setLegal] = useState({});
  const [pre, setPre] = useState({});
  const [walk, setWalk] = useState({});
  const [minVals, setMinVals] = useState(Object.fromEntries(MIN_DEFS.map((m) => [m.key, m.def])));
  const [surfaceOk, setSurfaceOk] = useState("asfalt");
  const [dep, setDep] = useState("ESSB Bromma");
  const [dst, setDst] = useState("ESGP Säve");
  const [news, setNews] = useState({ status: "idle", text: "" });
  const [blogCat, setBlogCat] = useState("Alla");
  const [posts, setPosts] = useState(BLOG_SEED);
  const [draft, setDraft] = useState({ title: "", cat: "Väder", excerpt: "" });
  const [showDraft, setShowDraft] = useState(false);
  const [user, setUser] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [flights, setFlights] = useState([]);
  const [prep, setPrep] = useState({});
  const [showNewFlight, setShowNewFlight] = useState(false);
  const [nf, setNf] = useState({ date: new Date().toISOString().slice(0, 10), from: "ESSB", to: "ESSB", acft: "", tTach: "", tBlock: "", note: "" });
  const [openFlight, setOpenFlight] = useState(null);
  const [dbDraft, setDbDraft] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [game, setGame] = useState({ xp: 0, streak: 0, lastDay: null, badges: [], soundOn: true, nogoCount: 0 });
  const [night, setNight] = useState(false);
  /* Applicera tema INNAN render läser C */
  Object.assign(C, night ? DARK : LIGHT);
  useEffect(() => { document.body.style.background = C.bg; }, [night]);
  const [confetti, setConfetti] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const celebrated = useRef({});

  function showToast(icon, text) {
    setToast({ icon, text });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }
  function addXP(n, label) {
    setGame((g) => ({ ...g, xp: g.xp + n }));
    if (game.soundOn) SND.xp();
    if (label && user) showToast("✨", `+${n} XP · ${label}`);
  }
  function award(id) {
    setGame((g) => {
      if (g.badges.includes(id)) return g;
      const b = BADGES.find((x) => x.id === id);
      if (g.soundOn) SND.badge();
      setTimeout(() => showToast(b.icon, `Utmärkelse: ${b.name}!`), 300);
      setConfetti(true); setTimeout(() => setConfetti(false), 2600);
      return { ...g, badges: [...g.badges, id], xp: g.xp + 75 };
    });
  }
  function touchStreak() {
    const today = new Date().toISOString().slice(0, 10);
    setGame((g) => {
      if (g.lastDay === today) return g;
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      const streak = g.lastDay === yesterday ? g.streak + 1 : 1;
      if (streak >= 3) setTimeout(() => award("streak3"), 100);
      if (streak >= 7) setTimeout(() => award("streak7"), 100);
      if (streak >= 30) setTimeout(() => award("streak30"), 100);
      return { ...g, streak, lastDay: today };
    });
  }

  /* --- Lagring --- */
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("imsafe-profile-v7");
        if (r?.value) {
          const d = JSON.parse(r.value);
          if (d.user) setUser(d.user);
          if (d.flights) setFlights(d.flights);
          if (d.minVals) setMinVals((v) => ({ ...v, ...d.minVals }));
          if (d.prep) setPrep(d.prep);
          if (d.game) setGame((g) => ({ ...g, ...d.game }));
          if (typeof d.step === "number") setStep(d.step);
          if (d.lastAssessment) setLastAssessment(d.lastAssessment);
          if (d.night) setNight(true);
          setSeenIntro(!!d.seenIntro);
        } else { setSeenIntro(false); }
      } catch { setSeenIntro(false); }
      setLoaded(true);
    })();
  }, []);
  useEffect(() => {
    if (!loaded) return;
    (async () => { try { await window.storage.set("imsafe-profile-v7", JSON.stringify({ user, flights, minVals, prep, game, step, seenIntro, lastAssessment, night })); } catch {} })();
  }, [user, flights, minVals, prep, game, step, seenIntro, lastAssessment, night, loaded]);

  /* --- IMSAFE-resultatet importeras automatiskt som riskfaktor --- */
  const imsafePctPre = IMSAFE_ITEMS.filter((i) => imsafe[i.key]).length / IMSAFE_ITEMS.length;
  const effRisks = useMemo(() => ({ ...risks, imsafe: imsafePctPre < 1 }), [risks, imsafePctPre]);

  const AUTO_INFO = {
    imsafe: { go: 0, ok: "IMSAFE grön – hämtas från steg 1", bad: "IMSAFE är inte komplett – tryck för att gå till steg 1" },
  };

  /* --- Riskmodell (beräknas alltid, VISAS först vid bedömning) --- */
  const model = useMemo(() => {
    const layers = BARRIERS.map((b) => {
      const max = b.factors.reduce((s, f) => s + f.w, 0);
      const score = b.factors.reduce((s, f) => s + (effRisks[f.key] ? f.w : 0), 0);
      return { ...b, score, max, pen: score / max };
    });
    const protection = layers.reduce((p, l) => p * (1 - l.pen), 1);
    const riskPct = Math.round((1 - protection) * 100);
    let level, color, advice, verdict;
    if (riskPct <= 25) { level = "LÅG"; color = C.green; verdict = "GO"; advice = "Barriärerna är intakta. Flyg som planerat och håll dina minima."; }
    else if (riskPct <= 55) { level = "FÖRHÖJD"; color = C.orange; verdict = "GO MED VILLKOR"; advice = "Flygbart – om du först neutraliserar minst en faktor i åtgärdsrutan nedan och sätter tydliga beslutspunkter."; }
    else if (riskPct <= 80) { level = "HÖG"; color = "#E8642C"; verdict = "TVEKSAMT"; advice = "Flera barriärer är kraftigt försvagade. Ändra förutsättningarna på riktigt innan du ens överväger start."; }
    else { level = "KRITISK"; color = C.red; verdict = "NO-GO"; advice = "Det här är profilen i haverirapporterna. Ställ in. Ingen flygning måste göras idag."; }
    const aligned = layers.every((l) => l.pen > 0.4);
    const active = BARRIERS.flatMap((b) => b.factors.filter((f) => effRisks[f.key]).map((f) => ({ ...f, barrier: b.name, color: b.color }))).sort((a, b2) => b2.w - a.w);
    return { layers, protection, riskPct, level, color, advice, verdict, aligned, active };
  }, [effRisks]);

  /* Om underlaget ändras efter bedömning → ogiltigförklara */
  useEffect(() => { if (assessed) { setAssessed(false); setDecision(null); setShownPct(null); } /* eslint-disable-next-line */ }, [risks, imsafe, walk, legal, pre]);

  const imsafePct = IMSAFE_ITEMS.filter((i) => imsafe[i.key]).length / IMSAFE_ITEMS.length;
  const legalPct = LEGAL_ITEMS.filter((i) => legal[i.key]).length / LEGAL_ITEMS.length;
  const prePct = PREFLIGHT_ITEMS.filter((i) => pre[i.key]).length / PREFLIGHT_ITEMS.length;
  const briefPct = (LEGAL_ITEMS.filter((i) => legal[i.key]).length + PREFLIGHT_ITEMS.filter((i) => pre[i.key]).length) / (LEGAL_ITEMS.length + PREFLIGHT_ITEMS.length);
  const walkAll = WALKAROUND.flatMap((g) => g.items);
  const walkPct = walkAll.filter((i) => walk[i.key]).length / walkAll.length;
  const stepPct = [imsafePct, 1, briefPct, walkPct, assessed ? 1 : 0]; // Läget har inget "klart"-krav
  const stepDone = [imsafePct === 1, true, briefPct === 1, walkPct === 1, assessed];
  const depIcao = dep.slice(0, 4), dstIcao = dst.slice(0, 4);
  const lvl = LEVELS.filter((l) => game.xp >= l.xp).slice(-1)[0];
  const nextLvl = LEVELS.find((l) => l.xp > game.xp);
  const lvlPct = nextLvl ? (game.xp - lvl.xp) / (nextLvl.xp - lvl.xp) : 1;
  const tipOfDay = DAILY_TIPS[Math.floor(Date.now() / 864e5) % DAILY_TIPS.length];
  const hour = new Date().getHours();
  const greeting = hour < 10 ? "God morgon" : hour < 18 ? "Hej" : "God kväll";

  /* Fira klara steg */
  useEffect(() => {
    [["imsafe", imsafePct], ["brief", briefPct], ["walk", walkPct]].forEach(([id, pct]) => {
      if (pct === 1 && !celebrated.current[id]) {
        celebrated.current[id] = true;
        if (game.soundOn) SND.step();
        addXP(25, "Steg klart"); touchStreak(); award("first");
        if (id === "walk") award("walk");
      }
      if (pct < 1) celebrated.current[id] = false;
    });
    // eslint-disable-next-line
  }, [imsafePct, briefPct, walkPct]);

  const [shownPct, setShownPct] = useState(null); // null = ingen pågående uppräkning
  function makeAssessment() {
    setAssessed(true);
    setLastAssessment({ date: new Date().toISOString().slice(0, 10), verdict: model.verdict, riskPct: model.riskPct, decision: null });
    addXP(20, "Bedömning skapad"); touchStreak();
    /* Uppräkning 0 → slutvärde på ~0,9 s, sedan utlåtande + ljud */
    const target = model.riskPct;
    setShownPct(0);
    if (game.soundOn) tone(520, 0.06, 0, "sine", 0.05);
    const t0 = performance.now();
    const dur = 900;
    const tick = (t) => {
      const f = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - f, 3);
      setShownPct(Math.round(eased * target));
      if (f < 1) requestAnimationFrame(tick);
      else {
        setShownPct(null);
        if (game.soundOn) SND.verdict();
        if (imsafePct === 1 && briefPct === 1 && walkPct === 1) { award("allday"); setConfetti(true); setTimeout(() => setConfetti(false), 2400); }
      }
    };
    requestAnimationFrame(tick);
  }
  function decide(d) {
    setDecision(d);
    setLastAssessment((a) => a ? { ...a, decision: d } : a);
    if (d === "nogo") {
      if (game.soundOn) SND.nogo();
      setGame((g) => ({ ...g, nogoCount: g.nogoCount + 1, xp: g.xp + 50 }));
      if (user) showToast("🧠", "+50 XP · Starkaste beslutet i flygningen");
      award("nogo");
    } else {
      if (game.soundOn) SND.done();
      addXP(15, "Beslut fattat");
    }
  }
  function createReport() { addXP(10, "Rapport skapad"); setTimeout(() => window.print(), 200); }

  /* Swipe vänster/höger mellan stegen (som en iOS-app) */
  const touchX = useRef(null);
  function goStep(n) {
    if (n < 0 || n > 4 || n === step) return;
    setStep(n);
    if (game.soundOn) SND.step();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function onTouchStart(e) { touchX.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 60) return;
    goStep(step + (dx < 0 ? 1 : -1));
  }

  async function fetchNews() {
    setNews({ status: "loading", text: "" });
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 1200,
          messages: [{ role: "user", content: "Sök på webben efter de senaste nyheterna (1-2 månader) inom allmänflyg och flygsäkerhet relevanta för en svensk VFR-privatpilot: EASA-regler, Transportstyrelsen, luftrumsändringar, SHK-rapporter. Svara på svenska, punktlista max 6: **rubrik** – 1-2 meningar + relevans. Om inget hittas: hänvisa till EASA:s och Transportstyrelsens nyhetssidor." }],
          tools: [{ type: "web_search_20250305", name: "web_search" }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      setNews({ status: "done", text: text || "Inga nyheter kunde hämtas just nu." });
    } catch {
      setNews({ status: "error", text: "Kunde inte hämta nyheter. Besök easa.europa.eu och transportstyrelsen.se direkt." });
    }
  }

  /* ---------- Checkrad med "fingret på nästa rad" ---------- */
  function Row({ checked, onChange, children, trailing, color = C.blue, highlight = false }) {
    return (
      <label className="flex items-center gap-3 px-4 py-3 cursor-pointer active:opacity-60"
        style={{
          borderTop: `0.5px solid ${C.line}`,
          background: highlight ? color + "0C" : "transparent",
          boxShadow: highlight ? `inset 3px 0 0 ${color}` : "none",
          transition: "all .25s",
        }}>
        <span className="w-[24px] h-[24px] rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: checked ? color : "transparent",
            border: checked ? "none" : `1.5px solid ${highlight ? color : "rgba(60,60,67,0.3)"}`,
            transition: "all .15s", transform: checked ? "scale(1.05)" : "scale(1)",
          }}>
          {checked && <svg width="13" height="13" viewBox="0 0 12 12"><path d="M2 6.5L4.7 9 10 3.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </span>
        <input type="checkbox" className="hidden" checked={checked} onChange={onChange} />
        <span className="flex-1 text-[15px]" style={{ ...SF, color: C.ink, fontWeight: highlight ? 600 : 400 }}>{children}</span>
        {trailing}
      </label>
    );
  }
  function toggle(state, set, key, e) {
    const on = e.target.checked;
    set({ ...state, [key]: on });
    if (game.soundOn) (on ? SND.tick() : SND.untick());
    if (on) addXP(2);
  }
  /* Checklista med markerad nästa punkt */
  function Checklist({ items, state, set, color, trail }) {
    const firstOpen = items.find((i) => !state[i.key])?.key;
    return items.map((i) => (
      <Row key={i.key} checked={!!state[i.key]} color={color} highlight={i.key === firstOpen}
        onChange={(e) => toggle(state, set, i.key, e)}
        trailing={trail && trail(i) ? <span className="text-[11px] flex-shrink-0" style={{ ...mono, color: C.inkSoft }}>{trail(i)}</span> : null}>
        {i.label}
      </Row>
    ));
  }

  /* ---------- Premium-ostar ---------- */
  function CheeseBoard() {
    const W = 380, H = 210;
    const slicePath = "M14,6 Q30,0 46,5 Q62,10 61,26 L63,120 Q64,142 50,150 Q34,158 18,151 Q2,144 4,124 L2,28 Q1,10 14,6 Z";
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: 560 }}>
        <defs>
          <linearGradient id="chBody" x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor="#FBE79B" /><stop offset="45%" stopColor="#F4D468" /><stop offset="100%" stopColor="#E4B93F" />
          </linearGradient>
          <linearGradient id="chRind" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#C79A2E" /><stop offset="100%" stopColor="#A87E22" />
          </linearGradient>
          <radialGradient id="chHole" cx="0.5" cy="0.35" r="0.75">
            <stop offset="0%" stopColor="#B08E3B" /><stop offset="45%" stopColor="#D9C58A" /><stop offset="100%" stopColor={C.bg} />
          </radialGradient>
          <radialGradient id="chHoleSm" cx="0.5" cy="0.3" r="0.8">
            <stop offset="0%" stopColor="#C2A24A" /><stop offset="100%" stopColor="#EFE6C8" />
          </radialGradient>
          <filter id="chShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="4" dy="7" stdDeviation="5" floodColor="#5A4A12" floodOpacity="0.28" />
          </filter>
          <linearGradient id="board" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E9E4D8" /><stop offset="100%" stopColor="#DDD5C2" />
          </linearGradient>
        </defs>
        <ellipse cx={W / 2} cy={H - 18} rx={W / 2 - 14} ry="14" fill="url(#board)" />
        <ellipse cx={W / 2} cy={H - 20} rx={W / 2 - 14} ry="13" fill="#F0EBDF" />
        {model.layers.map((l, i) => {
          const x = 26 + i * 84;
          const rot = [-3, 2, -2, 3][i];
          const holes = Math.max(0, Math.round(l.pen * 5));
          const align = model.aligned;
          return (
            <g key={l.id} transform={`translate(${x},18) rotate(${rot} 32 78) skewX(-8)`} filter="url(#chShadow)">
              <path d={slicePath} transform="translate(6,4)" fill="url(#chRind)" />
              <path d={slicePath} fill="url(#chBody)" stroke="#C79A2E" strokeWidth="1" />
              <ellipse cx="30" cy="16" rx="18" ry="6" fill="#FFF6CE" opacity="0.65" />
              <circle cx="16" cy="30" r="3.2" fill="url(#chHoleSm)" />
              <circle cx="48" cy="136" r="3.8" fill="url(#chHoleSm)" />
              <circle cx="50" cy="24" r="2.4" fill="url(#chHoleSm)" />
              {Array.from({ length: holes }).map((_, h) => {
                const cy = align ? 78 + (h - (holes - 1) / 2) * 3 : 34 + ((h * 41 + i * 27) % 96);
                const cx = align ? 32 : 18 + ((h * 17 + i * 13) % 28);
                const r = 6.5 + l.pen * 9 + (h % 2) * 2;
                return (
                  <g key={h} style={{ transition: "all .6s cubic-bezier(.4,0,.2,1)" }}>
                    <circle cx={cx} cy={cy} r={r} fill="url(#chHole)" />
                    <path d={`M ${cx - r * 0.7} ${cy + r * 0.55} A ${r * 0.85} ${r * 0.85} 0 0 0 ${cx + r * 0.7} ${cy + r * 0.55}`} stroke="#FFF3C4" strokeWidth="1.6" fill="none" opacity="0.8" />
                  </g>
                );
              })}
              <g transform="skewX(8)">
                <rect x="4" y="160" width="56" height="16" rx="8" fill={l.color + "18"} />
                <text x="32" y="171" textAnchor="middle" fontSize="8.5" style={SF} fill={l.color} fontWeight="700">{l.name.toUpperCase()}</text>
              </g>
            </g>
          );
        })}
        {model.aligned && (
          <g>
            <line x1="8" y1="96" x2={W - 44} y2="96" stroke={C.red} strokeWidth="4.5" strokeDasharray="11 7" strokeLinecap="round">
              <animate attributeName="stroke-dashoffset" from="36" to="0" dur="0.8s" repeatCount="indefinite" />
            </line>
            <polygon points={`${W - 44},87 ${W - 20},96 ${W - 44},105`} fill={C.red} />
            <circle cx="8" cy="96" r="5" fill={C.red} />
          </g>
        )}
        {!model.aligned && model.riskPct > 25 && (
          <g opacity="0.9">
            <line x1="8" y1="96" x2={72 + model.riskPct * 2.3} y2="96" stroke={C.orange} strokeWidth="4" strokeDasharray="9 7" strokeLinecap="round" />
            <circle cx={72 + model.riskPct * 2.3} cy="96" r="5.5" fill={C.orange} />
          </g>
        )}
      </svg>
    );
  }

  const TABS = [["fly", "Flyg", "🛫"], ["log", "Logg", "✈"], ["more", "Mer", "⋯"]];
  const titles = { fly: "Dagens flygning", log: "Egen loggning", more: { menu: "Mer", links: "Väder & briefing", minima: "Minima", news: "Nyheter", blog: "Säkerhetsblogg", stats: "Haveribild", account: "Konto" }[moreView] };
  const S = STEPS[step];

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.ink, paddingBottom: 96, ...SF }}>
      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        @keyframes imsafeFall { to { transform: translateY(105vh) rotate(720deg); opacity: 0.9; } }
        @keyframes imsafePop { from { transform: translateX(-50%) scale(0.7); opacity: 0; } to { transform: translateX(-50%) scale(1); opacity: 1; } }
        @keyframes imsafeReveal { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes imsafeSlide { from { transform: translateX(18px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { * { animation:none!important; transition:none!important; } }
        @media print {
          body * { visibility: hidden; }
          #report, #report * { visibility: visible; }
          #report { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
        }
      `}</style>

      <Confetti show={confetti} />
      <Toast toast={toast} />

      {/* ===== Header ===== */}
      <header className="px-5 pt-5 pb-2 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] font-bold text-white" style={{ background: C.grad }}>im</span>
            <span className="text-[15px] font-bold tracking-tight">imsafe<span style={{ color: C.blue }}>.se</span></span>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[13px] font-bold"
                style={{ background: game.streak > 0 ? "#FFF3E0" : C.fill, color: game.streak > 0 ? "#E65100" : C.inkSoft }}>
                🔥 {game.streak}
              </span>
            )}
            <button className="w-8 h-8 rounded-full text-[14px]" style={{ background: night ? C.gold + "28" : C.fill }}
              title="Night Panel" onClick={() => { setNight(!night); if (game.soundOn) SND.tick(); }}>{night ? "☀️" : "🌙"}</button>
            <button className="w-8 h-8 rounded-full text-[14px]" style={{ background: C.fill }}
              onClick={() => setGame((g) => ({ ...g, soundOn: !g.soundOn }))}>{game.soundOn ? "🔊" : "🔇"}</button>
            <button onClick={() => { setTab("more"); setMoreView("account"); }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold"
              style={{ background: user ? C.green + "22" : C.fill, color: user ? C.green : C.inkSoft }}>
              {user ? user.name.slice(0, 1).toUpperCase() : "👤"}
            </button>
          </div>
        </div>
        {user && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[16px]">{lvl.icon}</span>
            <div className="flex-1">
              <div className="flex justify-between text-[11px] font-semibold">
                <span style={{ color: C.ink2 }}>{lvl.name}</span>
                <span style={{ color: C.inkSoft }}>{game.xp} XP{nextLvl ? ` · ${nextLvl.xp - game.xp} till ${nextLvl.name}` : " · MAX"}</span>
              </div>
              <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: C.fill }}>
                <div className="h-full rounded-full" style={{ width: `${lvlPct * 100}%`, background: C.grad, transition: "width .6s ease" }} />
              </div>
            </div>
          </div>
        )}
        <p className="text-[13px] font-medium mt-3" style={{ color: C.inkSoft }}>
          {tab === "fly" ? `${greeting}${user ? " " + user.name : ""} · ${new Date().toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}` : new Date().toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="text-[32px] font-bold tracking-tight leading-tight">{titles[tab]}</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4">

        {/* ================= FLYG: guidat flöde ================= */}
        {tab === "fly" && (
          <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {/* Stegvisare */}
            <div className="flex items-center mb-4 px-1">
              {STEPS.map((s, i) => (
                <React.Fragment key={s.id}>
                  <button onClick={() => goStep(i)} className="flex flex-col items-center gap-1 active:opacity-60" style={{ minWidth: 52 }}>
                    <span className="w-10 h-10 rounded-full flex items-center justify-center text-[17px]"
                      style={{
                        background: step === i ? s.color : stepDone[i] ? s.color + "22" : C.card,
                        border: step === i ? "none" : `1.5px solid ${stepDone[i] ? s.color : C.line}`,
                        boxShadow: step === i ? `0 4px 12px ${s.color}55` : "none",
                        transition: "all .25s",
                        filter: step === i ? "none" : stepDone[i] ? "none" : "grayscale(0.6)",
                      }}>
                      {stepDone[i] && step !== i ? <span style={{ color: s.color, fontWeight: 700 }}>✓</span> : s.icon}
                    </span>
                    <span className="text-[10px] font-semibold" style={{ color: step === i ? s.color : C.inkSoft }}>{s.name}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className="flex-1 h-[2px] mx-0.5 mb-4 rounded-full" style={{ background: stepDone[i] ? STEPS[i].color : C.line, transition: "background .3s" }} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {step === 0 && <p className="text-[11px] text-center -mt-2 mb-3" style={{ color: C.inkSoft }}>Svep åt sidorna för att byta steg</p>}

            {/* Onboarding – visas bara första gången */}
            {!seenIntro && (
              <Card style={{ background: `linear-gradient(135deg, ${C.blue}14, ${C.indigo}08)`, border: `1px solid ${C.blue}30` }}>
                <div className="p-4">
                  <p className="text-[17px] font-bold">Välkommen 👋</p>
                  <p className="text-[14px] mt-1.5" style={{ color: C.ink2 }}>
                    Fem steg. Fem minuter. Ett tydligt beslut.
                  </p>
                  <p className="mt-2.5 text-[13px]" style={{ color: C.ink2 }}>🧍 → 🌤 → 📋 → 🛩 → ⚖️</p>
                  <p className="mt-1.5 text-[12px]" style={{ color: C.inkSoft }}>Tips: ställ in dina minima under Mer → Minima.</p>
                  <button onClick={() => setSeenIntro(true)} className="w-full mt-3 py-2.5 rounded-xl font-semibold text-white active:opacity-70" style={{ background: C.blue }}>
                    Sätt igång
                  </button>
                </div>
              </Card>
            )}

            {/* Stegets fråga (animeras vid stegbyte) */}
            <div key={step} style={{ animation: "imsafeSlide .25s ease-out" }}>
            <Card style={{ background: `linear-gradient(135deg, ${S.color}12, ${S.color}04)`, border: `1px solid ${S.color}30` }}>
              <div className="p-4 flex items-center gap-3">
                <span className="text-[26px]">{S.icon}</span>
                <div className="flex-1">
                  <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: S.color }}>Steg {step + 1} av 5 · {S.name} · {S.time}</p>
                  <p className="text-[14px] mt-0.5" style={{ color: C.ink2 }}>{S.q}</p>
                </div>
              </div>
            </Card>

            {/* --- STEG 0: PILOTEN --- */}
            {step === 0 && (
              <Card>
                <CardHead title="IMSAFE" sub={imsafePct === 1 ? "Du är grön – vidare till läget ✓" : "Bocka av uppifrån och ner – som på pappersschecklistan"} right={<Ring pct={imsafePct} color={C.purple} />} />
                <Checklist items={IMSAFE_ITEMS} state={imsafe} set={setImsafe} color={C.purple} trail={(i) => i.target} />
              </Card>
            )}

            {/* --- STEG 1: LÄGET --- */}
            {step === 1 && (
              <Card>
                <CardHead title="Dagens riskfaktorer" sub="Öppna varje område och kryssa det som stämmer idag. Inga kryss = stark dag." />
                {BARRIERS.map((b) => {
                  const n = b.factors.filter((f) => effRisks[f.key]).length;
                  const open = expandedBarrier === b.id;
                  return (
                    <div key={b.id}>
                      <button className="w-full flex items-center gap-3 px-4 py-3 active:opacity-60"
                        style={{ borderTop: `0.5px solid ${C.line}`, background: open ? b.color + "08" : "transparent" }}
                        onClick={() => setExpandedBarrier(open ? null : b.id)}>
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-[15px]" style={{ background: b.color + "16" }}>
                          {b.id === "pilot" ? "🧍" : b.id === "wx" ? "🌤" : b.id === "acft" ? "🛩" : "🗂"}
                        </span>
                        <span className="flex-1 text-left">
                          <span className="block text-[15px] font-semibold" style={{ color: C.ink }}>{b.name}</span>
                          <span className="block text-[12px]" style={{ color: n > 0 ? b.color : C.inkSoft }}>
                            {n > 0 ? `${n} markerad${n > 1 ? "e" : ""}` : "Inget markerat"}
                          </span>
                        </span>
                        {n > 0 && <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold text-white" style={{ background: b.color }}>{n}</span>}
                        <span style={{ color: "rgba(60,60,67,0.3)", transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }}>›</span>
                      </button>
                      {open && b.factors.map((f) => AUTO_INFO[f.key] ? (
                        <button key={f.key} className="w-full flex items-center gap-3 px-4 py-3 active:opacity-60 text-left"
                          style={{ borderTop: `0.5px solid ${C.line}`, background: effRisks[f.key] ? b.color + "0C" : "transparent" }}
                          onClick={() => { setStep(AUTO_INFO[f.key].go); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                          <span style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            background: effRisks[f.key] ? b.color : C.fill, border: effRisks[f.key] ? "none" : "1.5px solid rgba(60,60,67,0.2)" }}>
                            <svg width="13" height="13" viewBox="0 0 12 12"><path d="M2 6.5L4.7 9 10 3.5" stroke={effRisks[f.key] ? "#fff" : "rgba(60,60,67,0.35)"} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </span>
                          <span className="flex-1">
                            <span className="block text-[15px]" style={{ color: C.ink }}>{f.label}</span>
                            <span className="block text-[12px]" style={{ color: effRisks[f.key] ? b.color : C.inkSoft }}>
                              {effRisks[f.key] ? AUTO_INFO[f.key].bad : AUTO_INFO[f.key].ok}
                            </span>
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0" style={{ background: C.fill, color: C.inkSoft }}>AUTO</span>
                        </button>
                      ) : (
                        <Row key={f.key} checked={!!risks[f.key]} color={b.color}
                          onChange={(e) => { setRisks({ ...risks, [f.key]: e.target.checked }); if (game.soundOn) (e.target.checked ? SND.tick() : SND.untick()); }}>
                          {f.label}
                        </Row>
                      ))}
                    </div>
                  );
                })}
                <p className="text-[11px] px-4 py-3" style={{ color: C.inkSoft }}>Resultatet visas inte här – du väger ihop allt i sista steget. Ärlighet nu = bättre beslut sen.</p>
              </Card>
            )}

            {/* --- STEG 2: BRIEFING --- */}
            {step === 2 && (
              <>
                <Card>
                  <CardHead title="Legalt & dokument" sub="Part-FCL · Part-MED · NCO.GEN.135" right={<Ring pct={legalPct} color={C.indigo} />} />
                  <Checklist items={LEGAL_ITEMS} state={legal} set={setLegal} color={C.indigo} trail={(i) => i.ref} />
                </Card>
                <Card>
                  <CardHead title="Briefing & planering" sub="Länkar till METAR/TAF, Aroweb och SMHI finns under Mer → Länkar" right={<Ring pct={prePct} color={C.blue} />} />
                  <Checklist items={PREFLIGHT_ITEMS} state={pre} set={setPre} color={C.blue} trail={(i) => i.hint} />
                </Card>
              </>
            )}

            {/* --- STEG 3: PLANET --- */}
            {step === 3 && (
              <Card>
                <CardHead title="Walkaround" sub={walkPct === 1 ? "Planet genomgånget – sista blicken: inget kvarglömt på vingen? ✓" : "Vätskor → Elektronik → Skick. I din takt."} right={<Ring pct={walkPct} color={C.green} />} />
                {WALKAROUND.map((g) => (
                  <div key={g.group}>
                    <div className="flex items-center gap-2 px-4 py-2" style={{ background: C.fill }}>
                      <span className="text-[14px]">{g.icon}</span>
                      <span className="text-[13px] font-semibold uppercase tracking-wide flex-1" style={{ color: g.color }}>{g.group}</span>
                      <span className="text-[11px]" style={{ ...mono, color: C.inkSoft }}>{g.items.filter((i) => walk[i.key]).length}/{g.items.length}</span>
                    </div>
                    <Checklist items={g.items} state={walk} set={setWalk} color={g.color} />
                  </div>
                ))}
                <p className="text-[11px] px-4 py-3" style={{ color: C.inkSoft }}>Generisk lista – typens POH-checklista har alltid företräde.</p>
              </Card>
            )}

            {/* --- STEG 4: BESLUT --- */}
            {step === 4 && (
              <>
                {/* Underlagsöversikt */}
                {lastAssessment && !assessed && (
                  <p className="text-[12px] text-center mb-3" style={{ color: C.inkSoft }}>
                    Senaste bedömning: <b>{lastAssessment.verdict}</b> ({lastAssessment.riskPct}/100) · {lastAssessment.date}
                    {lastAssessment.decision ? ` · beslut: ${lastAssessment.decision === "nogo" ? "avstod 🧠" : "flög ✈️"}` : ""}
                  </p>
                )}
                <Card>
                  <CardHead title="Ditt underlag" sub="Så komplett är genomgången" />
                  <div className="px-4 pb-4 grid grid-cols-4 gap-2 text-center">
                    {[["Piloten", imsafePct, C.purple], ["Risker", null, C.blue], ["Briefing", briefPct, C.indigo], ["Planet", walkPct, C.green]].map(([k, p, col]) => (
                      <div key={k} className="flex flex-col items-center">
                        {p === null
                          ? <div style={{
                              width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                              border: `5px solid ${model.active.length ? col : "rgba(120,120,128,0.15)"}`,
                              color: model.active.length ? col : C.inkSoft, fontSize: 14, fontWeight: 700, boxSizing: "border-box",
                            }}>{model.active.length}</div>
                          : <Ring pct={p} color={col} />}
                        <p className="text-[11px] mt-1 font-semibold" style={{ color: C.inkSoft }}>
                          {p === null ? `${k} · ${model.active.length} hot` : `${k}${p === 1 ? " ✓" : ""}`}
                        </p>
                      </div>
                    ))}
                  </div>
                  {(imsafePct < 1 || briefPct < 1 || walkPct < 1) && (
                    <p className="text-[12px] px-4 pb-3" style={{ color: C.orange }}>⚠ Genomgången är inte komplett – bedömningen blir bara så bra som underlaget.</p>
                  )}
                </Card>

                {/* Skapa bedömning – medveten handling */}
                {!assessed ? (
                  <button onClick={makeAssessment}
                    className="w-full py-4 rounded-2xl text-[17px] font-bold text-white active:opacity-70 mb-4"
                    style={{ background: C.grad, boxShadow: `0 6px 20px ${C.blue}44` }}>
                    ⚖️ Skapa min bedömning
                  </button>
                ) : (
                  <div style={{ animation: "imsafeReveal .4s ease-out" }}>
                    {/* Utlåtande – med uppräkning innan resultatet visas */}
                    <Card style={{
                      background: shownPct !== null ? C.card : `linear-gradient(135deg, ${model.color}16, ${model.color}06)`,
                      border: `1.5px solid ${shownPct !== null ? C.line : model.color}`, transition: "all .3s",
                    }}>
                      <div className="p-4">
                        <div className="flex items-center gap-4">
                          <Ring pct={(shownPct !== null ? shownPct : model.riskPct) / 100} color={shownPct !== null ? C.inkSoft : model.color} size={64} />
                          <div className="flex-1">
                            {shownPct !== null ? (
                              <p className="text-[16px] font-semibold" style={{ color: C.inkSoft }}>Väger ihop underlaget…</p>
                            ) : (
                              <>
                                <p className="text-[20px] font-bold" style={{ color: model.color }}>{model.verdict}</p>
                                <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: C.inkSoft }}>Risk {model.level} · {model.riskPct}/100</p>
                              </>
                            )}
                          </div>
                        </div>
                        {shownPct === null && <p className="text-[14px] mt-3" style={{ color: C.ink2 }}>{model.advice}</p>}
                      </div>
                    </Card>

                    {shownPct === null && (<>
                    <Card>
                      <CardHead title="Barriärerna just nu" />
                      <div className="px-3 pb-4"><CheeseBoard /></div>
                    </Card>

                    {/* ÅTGÄRDSRUTAN */}
                    <Card style={{ border: `1.5px solid ${C.blue}40`, background: `linear-gradient(180deg, ${C.blue}08, transparent)` }}>
                      <CardHead title="🛠 Sänk risken – gör så här" sub={model.active.length ? "Dina kryss, tyngst först. Varje åtgärd du genomför = bocka ur krysset och skapa ny bedömning." : "Inga riskfaktorer markerade"} />
                      {model.active.length === 0 ? (
                        <p className="px-4 pb-4 text-[14px]" style={{ color: C.ink2 }}>Stark dag! Håll ändå dina minima heliga och sätt en vändpunkt före start.</p>
                      ) : (
                        <>
                          {model.active.slice(0, 5).map((f, idx) => (
                            <div key={f.key} className="px-4 py-3 flex gap-3" style={{ borderTop: `0.5px solid ${C.line}` }}>
                              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0" style={{ background: f.color + "1A", color: f.color }}>{idx + 1}</span>
                              <div>
                                <p className="text-[14px] font-semibold">{f.label}</p>
                                <p className="text-[13px] mt-0.5" style={{ color: C.ink2 }}>{f.fix}</p>
                              </div>
                            </div>
                          ))}
                          {model.active.length > 5 && <p className="px-4 pb-3 text-[12px]" style={{ color: C.inkSoft }}>+ {model.active.length - 5} till – men börja med de fem tyngsta.</p>}
                        </>
                      )}
                    </Card>

                    {/* Beslutsknappar */}
                    {!decision ? (
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <button onClick={() => decide("go")} disabled={model.riskPct > 80}
                          className="py-3.5 rounded-2xl text-[16px] font-bold text-white active:opacity-70"
                          style={{ background: C.green, opacity: model.riskPct > 80 ? 0.35 : 1 }}>
                          ✈️ Jag flyger
                        </button>
                        <button onClick={() => decide("nogo")}
                          className="py-3.5 rounded-2xl text-[16px] font-bold text-white active:opacity-70" style={{ background: C.ink }}>
                          🧠 Jag avstår{user ? " (+50 XP)" : ""}
                        </button>
                      </div>
                    ) : (
                      <Card style={{ border: `1.5px solid ${decision === "nogo" ? C.purple : C.green}` }}>
                        <div className="p-4 text-center">
                          <p className="text-[17px] font-bold" style={{ color: decision === "nogo" ? C.purple : C.green }}>
                            {decision === "nogo" ? "🧠 Rätt beslut. Flygplanet står kvar imorgon." : "✈️ Beslut fattat – flyg din plan, inte dina förhoppningar."}
                          </p>
                          <p className="text-[13px] mt-1" style={{ color: C.inkSoft }}>
                            {decision === "nogo" ? "Notera gärna i loggen varför – framtida du tackar dig." : "Håll minima heliga och vändpunkten skarp. Kom tillbaka för debrief efteråt!"}
                          </p>
                        </div>
                      </Card>
                    )}

                    <button onClick={createReport} className="w-full py-3 rounded-2xl text-[15px] font-semibold active:opacity-60 mb-2" style={{ background: C.card, color: C.blue }}>
                      Spara som PDF-rapport{user ? " · +10 XP" : ""}
                    </button>
                    <button onClick={() => { setRisks({}); setImsafe({}); setLegal({}); setPre({}); setWalk({}); setAssessed(false); setDecision(null); setShownPct(null); setStep(0); celebrated.current = {}; }}
                      className="w-full py-3 rounded-2xl text-[15px] font-semibold active:opacity-60 mb-4" style={{ background: C.card, color: C.red }}>
                      Ny genomgång (nollställ)
                    </button>
                    </>)}
                  </div>
                )}
                {assessed === false && (
                  <p className="text-[12px] text-center mb-4" style={{ color: C.inkSoft }}>Bedömningen skapas när du trycker – inte i realtid. Ändrar du underlaget efteråt behöver du skapa en ny.</p>
                )}
              </>
            )}

            </div>

            {/* Nästa steg-knapp (inte på sista steget) */}
            {step < 4 && (
              <button onClick={() => goStep(step + 1)}
                className="w-full py-3.5 rounded-2xl text-[16px] font-bold text-white active:opacity-70 mb-2"
                style={{ background: stepDone[step] ? STEPS[step + 1].color : C.inkSoft }}>
                {stepDone[step] ? `Nästa: ${STEPS[step + 1].icon} ${STEPS[step + 1].name} →` : `Fortsätt ändå till ${STEPS[step + 1].name} →`}
              </button>
            )}
            {step < 4 && !stepDone[step] && (
              <p className="text-[12px] text-center mb-4" style={{ color: C.inkSoft }}>Du kan alltid gå vidare – men ett komplett steg ger en säkrare bedömning.</p>
            )}

            {/* Dagens tips längst ner */}
            <Card style={{ background: `linear-gradient(135deg, ${C.indigo}0C, ${C.blue}06)` }}>
              <div className="p-4 flex gap-3">
                <span className="text-[18px]">💡</span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.indigo }}>Dagens säkerhetstips</p>
                  <p className="text-[13px] mt-0.5" style={{ color: C.ink2 }}>{tipOfDay}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ================= LOGG ================= */}
        {tab === "log" && (
          <>
            <Card>
              <CardHead title="Nästa flygpass" sub="Förbered passet – sparas automatiskt" />
              <div className="px-4 pb-4 space-y-2.5">
                {PREP_FIELDS.map((f) => (
                  <div key={f.key}>
                    <p className="text-[12px] font-semibold mb-1" style={{ color: C.inkSoft }}>{f.label.toUpperCase()}</p>
                    <textarea style={{ ...inputF(), minHeight: 44 }} placeholder={f.ph} value={prep[f.key] || ""} onChange={(e) => setPrep({ ...prep, [f.key]: e.target.value })} />
                  </div>
                ))}
              </div>
            </Card>

            {!showNewFlight ? (
              <button onClick={() => setShowNewFlight(true)} className="w-full py-3.5 rounded-2xl text-[16px] font-semibold text-white active:opacity-70 mb-4" style={{ background: C.blue }}>
                + Spara flygning{user ? " · +30 XP" : ""}
              </button>
            ) : (
              <Card>
                <CardHead title="Ny flygning" sub="Tider för din egen loggning – för du sedan in i loggbok/MyWeblog" />
                <div className="px-4 pb-4 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" style={inputF()} value={nf.date} onChange={(e) => setNf({ ...nf, date: e.target.value })} />
                    <input style={inputF()} placeholder="Flygplan (SE-...)" value={nf.acft} onChange={(e) => setNf({ ...nf, acft: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input style={inputF()} placeholder="Från (ICAO)" value={nf.from} onChange={(e) => setNf({ ...nf, from: e.target.value.toUpperCase() })} />
                    <input style={inputF()} placeholder="Till (ICAO)" value={nf.to} onChange={(e) => setNf({ ...nf, to: e.target.value.toUpperCase() })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><p className="text-[11px] font-semibold mb-1" style={{ color: C.inkSoft }}>TACH / MOTORTID (h)</p>
                      <input style={inputF()} inputMode="decimal" placeholder="1.3" value={nf.tTach} onChange={(e) => setNf({ ...nf, tTach: e.target.value })} /></div>
                    <div><p className="text-[11px] font-semibold mb-1" style={{ color: C.inkSoft }}>BLOCKTID (h)</p>
                      <input style={inputF()} inputMode="decimal" placeholder="1.4" value={nf.tBlock} onChange={(e) => setNf({ ...nf, tBlock: e.target.value })} /></div>
                  </div>
                  <textarea style={{ ...inputF(), minHeight: 50 }} placeholder="Anteckning…" value={nf.note} onChange={(e) => setNf({ ...nf, note: e.target.value })} />
                  <div className="flex gap-2">
                    <button className="flex-1 py-2.5 rounded-xl font-semibold text-white" style={{ background: C.blue }}
                      onClick={() => {
                        const newList = [{ id: Date.now(), ...nf, debrief: null }, ...flights];
                        setFlights(newList);
                        addXP(30, "Flygning sparad"); touchStreak();
                        if (newList.length >= 10) award("flights10");
                        setNf({ date: new Date().toISOString().slice(0, 10), from: nf.from, to: nf.to, acft: nf.acft, tTach: "", tBlock: "", note: "" });
                        setShowNewFlight(false);
                      }}>Spara</button>
                    <button className="flex-1 py-2.5 rounded-xl font-semibold" style={{ background: C.fill, color: C.inkSoft }} onClick={() => setShowNewFlight(false)}>Avbryt</button>
                  </div>
                </div>
              </Card>
            )}

            {flights.length === 0 ? (
              <Card><p className="p-5 text-[14px] text-center" style={{ color: C.inkSoft }}>Inga flygningar sparade ännu.<br />Spara tach/block för din egen loggning – med debrief-checklista per pass.</p></Card>
            ) : flights.map((f) => (
              <Card key={f.id}>
                <button className="w-full text-left px-4 py-3 flex items-center gap-3 active:opacity-60" onClick={() => setOpenFlight(openFlight === f.id ? null : f.id)}>
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center text-[15px]" style={{ background: f.debrief ? C.green + "18" : C.fill, color: f.debrief ? C.green : C.inkSoft }}>✈</span>
                  <span className="flex-1">
                    <span className="block text-[15px] font-semibold">{f.from} → {f.to} {f.acft && <span style={{ color: C.inkSoft, fontWeight: 400 }}>· {f.acft}</span>}</span>
                    <span className="block text-[12px]" style={{ color: C.inkSoft }}>{f.date} · tach {f.tTach || "–"} h · block {f.tBlock || "–"} h {f.debrief ? "· ✓ debriefad" : ""}</span>
                  </span>
                  <span style={{ color: "rgba(60,60,67,0.3)", transform: openFlight === f.id ? "rotate(90deg)" : "none", transition: "transform .2s" }}>›</span>
                </button>
                {openFlight === f.id && (
                  <div className="px-4 pb-4" style={{ borderTop: `0.5px solid ${C.line}` }}>
                    {f.note && <p className="text-[13px] mt-3" style={{ color: C.ink2 }}>{f.note}</p>}
                    <p className="text-[13px] font-semibold mt-3 mb-2">Debrief-checklista {!f.debrief && user && <span style={{ color: C.inkSoft, fontWeight: 400 }}>· +40 XP</span>}</p>
                    {f.debrief ? (
                      <div className="space-y-1.5">
                        {DEBRIEF_CHECK.map((d) => (
                          <p key={d.key} className="text-[13px] flex items-center gap-2" style={{ color: f.debrief[d.key] ? C.ink2 : C.inkSoft }}>
                            <span>{f.debrief[d.key] ? "✅" : "⭕"}</span>{d.label}
                          </p>
                        ))}
                        {f.debrief.note && <p className="text-[13px] mt-1 p-2 rounded-lg" style={{ background: C.fill, color: C.ink2 }}>{f.debrief.note}</p>}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {DEBRIEF_CHECK.map((d) => (
                          <label key={d.key} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                            <span className="w-[20px] h-[20px] rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ background: dbDraft[d.key] ? C.green : "transparent", border: dbDraft[d.key] ? "none" : "1.5px solid rgba(60,60,67,0.3)" }}>
                              {dbDraft[d.key] && <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6.5L4.7 9 10 3.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                            </span>
                            <input type="checkbox" className="hidden" checked={!!dbDraft[d.key]}
                              onChange={(e) => { setDbDraft({ ...dbDraft, [d.key]: e.target.checked }); if (game.soundOn) (e.target.checked ? SND.tick() : SND.untick()); }} />
                            <span className="text-[14px]">{d.label}</span>
                          </label>
                        ))}
                        <textarea style={{ ...inputF(), minHeight: 44 }} placeholder="Lärdom / anteckning (frivilligt)…"
                          value={dbDraft.note || ""} onChange={(e) => setDbDraft({ ...dbDraft, note: e.target.value })} />
                        <button className="w-full py-2.5 rounded-xl font-semibold text-white" style={{ background: C.green }}
                          onClick={() => {
                            const upd = flights.map((x) => x.id === f.id ? { ...x, debrief: dbDraft } : x);
                            setFlights(upd); setDbDraft({});
                            addXP(40, "Debrief sparad"); touchStreak();
                            if (upd.filter((x) => x.debrief).length >= 5) award("debrief5");
                          }}>Spara debrief</button>
                      </div>
                    )}
                    <button className="mt-3 text-[13px] font-semibold" style={{ color: C.red }} onClick={() => setFlights(flights.filter((x) => x.id !== f.id))}>Ta bort flygning</button>
                  </div>
                )}
              </Card>
            ))}
          </>
        )}

        {/* ================= MER ================= */}
        {tab === "more" && (
          <>
            {moreView === "menu" ? (
              <Card>
                {[
                  ["links", "☁️", "Väder & briefing", "METAR/TAF, Aroweb, NOTAM, SMHI", C.blue],
                  ["minima", "📏", "Personliga minima", "Dina gränser + lagens VMC-minima", C.indigo],
                  ["news", "📰", "Nyheter", "Regler & säkerhet, hämtas live", C.teal],
                  ["blog", "✍️", "Säkerhetsblogg", "Tips och haverilärdomar", C.orange],
                  ["stats", "📊", "Haveribild", "Vad dödar VFR-piloter?", C.red],
                  ["account", "👤", "Konto & utmärkelser", user ? user.name : "Logga in för XP och streaks", C.green],
                ].map(([id, icon, title, sub, col]) => (
                  <button key={id} onClick={() => setMoreView(id)} className="w-full flex items-center gap-3 px-4 py-3.5 active:opacity-60 text-left"
                    style={{ borderTop: `0.5px solid ${C.line}` }}>
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center text-[17px]" style={{ background: col + "16" }}>{icon}</span>
                    <span className="flex-1">
                      <span className="block text-[15px] font-semibold" style={{ color: C.ink }}>{title}</span>
                      <span className="block text-[12px]" style={{ color: C.inkSoft }}>{sub}</span>
                    </span>
                    <span style={{ color: "rgba(60,60,67,0.3)" }}>›</span>
                  </button>
                ))}
              </Card>
            ) : (
              <button onClick={() => setMoreView("menu")} className="flex items-center gap-1 mb-3 text-[15px] font-semibold active:opacity-60" style={{ color: C.blue }}>
                ‹ Mer
              </button>
            )}

            {moreView === "minima" && (
              <>
                <Card>
                  <CardHead title="Personliga minima" sub="Ställ in en gång – sparas automatiskt. Används som referens i steget Risker." />
                  {MIN_DEFS.map((m) => (
                    <div key={m.key} style={{ borderTop: `0.5px solid ${C.line}` }} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[15px] font-medium">{m.label} <span style={{ color: C.inkSoft, fontWeight: 400 }}>({m.dir === "max" ? "max" : "minst"})</span></span>
                        <Stepper value={minVals[m.key]} min={m.min} max={m.max} step={m.step} unit={m.unit} onChange={(v) => setMinVals({ ...minVals, [m.key]: v })} />
                      </div>
                      {m.legal && <p className="text-[12px] mt-1" style={{ color: C.inkSoft }}>{m.legal}</p>}
                    </div>
                  ))}
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: `0.5px solid ${C.line}` }}>
                    <span className="text-[15px] font-medium">Bantyp</span>
                    <div className="flex gap-1 p-1 rounded-xl" style={{ background: C.fill }}>
                      {[["asfalt", "Asfalt"], ["gras", "Gräs OK"]].map(([v, l]) => (
                        <button key={v} onClick={() => setSurfaceOk(v)} className="px-3 py-1.5 rounded-lg text-[13px] font-semibold"
                          style={{ background: surfaceOk === v ? C.card : "transparent", color: surfaceOk === v ? C.ink : C.inkSoft, boxShadow: surfaceOk === v ? "0 1px 3px rgba(0,0,0,0.12)" : "none" }}>{l}</button>
                      ))}
                    </div>
                  </div>
                </Card>
                <Card>
                  <CardHead title="Lagens VMC-minima" sub="SERA.5001 – flygplan under FL100" />
                  {VMC_ROWS.map((r) => (
                    <div key={r.space} className="px-4 py-3 flex items-baseline justify-between gap-3" style={{ borderTop: `0.5px solid ${C.line}` }}>
                      <span className="text-[14px] font-medium flex-1">{r.space}</span>
                      <span className="text-[14px]" style={mono}>{r.vis}</span>
                      <span className="text-[11px] text-right" style={{ color: C.inkSoft, maxWidth: 130 }}>{r.cloud}</span>
                    </div>
                  ))}
                  <p className="text-[11px] px-4 py-3" style={{ color: C.inkSoft }}>* Under 900 m AMSL kan sikten under vissa villkor reduceras till 3 km vid IAS ≤ 140 kt. Verifiera mot svensk AIP.</p>
                </Card>
              </>
            )}

            {moreView === "links" && (
              <>
                <Card>
                  <CardHead title="Välj flygplatser" sub="Länkarna anpassas efter ditt val" />
                  <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                    <div><p className="text-[12px] font-semibold mb-1" style={{ color: C.inkSoft }}>FRÅN</p>
                      <select style={inputF()} value={dep} onChange={(e) => setDep(e.target.value)}>{AIRPORTS.map((a) => <option key={a}>{a}</option>)}</select></div>
                    <div><p className="text-[12px] font-semibold mb-1" style={{ color: C.inkSoft }}>TILL</p>
                      <select style={inputF()} value={dst} onChange={(e) => setDst(e.target.value)}>{AIRPORTS.map((a) => <option key={a}>{a}</option>)}</select></div>
                  </div>
                </Card>
                <Card>
                  <CardHead title="METAR & TAF" sub={`${depIcao} och ${dstIcao}`} />
                  <LinkRow href={`https://metar-taf.com/${depIcao}`} title={`METAR/TAF ${depIcao}`} sub="metar-taf.com" color={C.blue} />
                  <LinkRow href={`https://metar-taf.com/${dstIcao}`} title={`METAR/TAF ${dstIcao}`} sub="metar-taf.com" color={C.blue} />
                  <LinkRow href={`https://aviationweather.gov/data/metar/?ids=${depIcao},${dstIcao}`} title="Rådata båda fälten" sub="aviationweather.gov" color={C.teal} />
                </Card>
                <Card>
                  <CardHead title="Briefing & NOTAM" />
                  <LinkRow href="https://aro.lfv.se" title="Aroweb – NOTAM, LHP, AIP" sub="LFV:s briefingtjänst" color={C.indigo} />
                  <LinkRow href="https://www.smhi.se/vader" title="SMHI" sub="Prognoser, radar, blixt" color={C.blue} />
                  <LinkRow href="https://www.windy.com" title="Windy" sub="Vind, moln – visuellt" color={C.teal} />
                </Card>
                <Card>
                  <CardHead title="Övrigt" />
                  <LinkRow href="https://www.transportstyrelsen.se/sv/luftfart/" title="Transportstyrelsen" sub="Föreskrifter och regler" color={C.orange} />
                  <LinkRow href="https://www.easa.europa.eu/en/domains/general-aviation" title="EASA General Aviation" sub="Part-NCO, säkerhetsmaterial" color={C.orange} />
                  <LinkRow href="https://havkom.se" title="SHK – Haverikommissionen" sub="Svenska haverirapporter" color={C.red} />
                </Card>
              </>
            )}

            {moreView === "news" && (
              <Card>
                <CardHead title="Flygvärlden just nu" sub="Hämtas live med AI-webbsökning" />
                <div className="px-4 pb-4">
                  <button onClick={fetchNews} disabled={news.status === "loading"} className="w-full py-3 rounded-xl text-[15px] font-semibold text-white active:opacity-70"
                    style={{ background: C.blue, opacity: news.status === "loading" ? 0.6 : 1 }}>
                    {news.status === "loading" ? "Söker nyheter…" : "Hämta senaste nytt"}
                  </button>
                  {news.text && <div className="mt-3 rounded-xl p-3 text-[13px] whitespace-pre-wrap" style={{ background: C.fill, color: C.ink2 }}>{news.text}</div>}
                </div>
              </Card>
            )}

            {moreView === "blog" && (
              <>
                <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
                  {BLOG_CATS.map((c) => (
                    <button key={c} onClick={() => setBlogCat(c)} className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap"
                      style={{ background: blogCat === c ? C.ink : C.card, color: blogCat === c ? C.bg : C.inkSoft }}>{c}</button>
                  ))}
                </div>
                {posts.filter((p) => blogCat === "Alla" || p.cat === blogCat).map((p) => (
                  <Card key={p.id}>
                    <div className="p-4">
                      <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: C.blue }}>
                        <span className="px-2 py-0.5 rounded-full" style={{ background: C.blue + "14" }}>{p.cat}</span>
                        <span style={{ color: C.inkSoft, fontWeight: 400 }}>{p.date} · {p.read}</span>
                      </div>
                      <h3 className="text-[17px] font-bold mt-1.5 leading-snug">{p.title}</h3>
                      <p className="text-[13px] mt-1" style={{ color: C.inkSoft }}>{p.excerpt}</p>
                    </div>
                  </Card>
                ))}
                {!showDraft ? (
                  <button onClick={() => setShowDraft(true)} className="w-full py-3 rounded-2xl text-[15px] font-semibold active:opacity-60 mb-4" style={{ background: C.card, color: C.blue }}>+ Nytt inlägg</button>
                ) : (
                  <Card>
                    <CardHead title="Nytt inlägg" />
                    <div className="px-4 pb-4 space-y-2">
                      <input style={inputF()} placeholder="Rubrik" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                      <select style={inputF()} value={draft.cat} onChange={(e) => setDraft({ ...draft, cat: e.target.value })}>{BLOG_CATS.slice(1).map((c) => <option key={c}>{c}</option>)}</select>
                      <textarea style={{ ...inputF(), minHeight: 80 }} placeholder="Ingress…" value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} />
                      <div className="flex gap-2">
                        <button className="flex-1 py-2.5 rounded-xl font-semibold text-white" style={{ background: C.blue }}
                          onClick={() => { if (!draft.title) return; setPosts([{ id: Date.now(), ...draft, date: new Date().toISOString().slice(0, 10), read: "— min" }, ...posts]); setDraft({ title: "", cat: "Väder", excerpt: "" }); setShowDraft(false); }}>Publicera</button>
                        <button className="flex-1 py-2.5 rounded-xl font-semibold" style={{ background: C.fill, color: C.inkSoft }} onClick={() => setShowDraft(false)}>Avbryt</button>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            )}

            {moreView === "stats" && (
              <Card>
                <CardHead title="Vad dödar VFR-piloter?" sub="EASA · AOPA Nall Report · SHK" />
                {ACCIDENT_DATA.map((d) => (
                  <div key={d.cat} className="px-4 py-3" style={{ borderTop: `0.5px solid ${C.line}` }}>
                    <span className="text-[14px] font-semibold">{d.cat}</span>
                    <div className="mt-1.5 space-y-1">
                      <div className="flex items-center gap-2"><div className="h-2.5 rounded-full" style={{ width: `${d.shareFatal * 2.4}%`, minWidth: 8, background: C.blue }} /><span className="text-[11px]" style={{ ...mono, color: C.inkSoft }}>{d.shareFatal} % av dödsolyckor</span></div>
                      <div className="flex items-center gap-2"><div className="h-2.5 rounded-full" style={{ width: `${d.lethality * 0.9}%`, minWidth: 8, background: C.red, opacity: 0.85 }} /><span className="text-[11px]" style={{ ...mono, color: C.inkSoft }}>{d.lethality} % dödlighet</span></div>
                    </div>
                    <p className="text-[12px] mt-1" style={{ color: C.inkSoft }}>{d.note}</p>
                  </div>
                ))}
              </Card>
            )}

            {moreView === "account" && (
              <>
                <Card>
                  <CardHead title="Utmärkelser" sub={`${game.badges.length} av ${BADGES.length} upplåsta · nej-beslut: ${game.nogoCount}`} />
                  <div className="px-4 pb-4 grid grid-cols-3 gap-2">
                    {BADGES.map((b) => {
                      const has = game.badges.includes(b.id);
                      return (
                        <div key={b.id} className="rounded-xl p-2.5 text-center" style={{ background: has ? C.gold + "18" : C.fill, opacity: has ? 1 : 0.55, border: has ? `1px solid ${C.gold}55` : "1px solid transparent" }}>
                          <span className="text-[22px]" style={{ filter: has ? "none" : "grayscale(1)" }}>{b.icon}</span>
                          <p className="text-[11px] font-bold mt-0.5">{b.name}</p>
                          <p className="text-[9.5px] leading-tight" style={{ color: C.inkSoft }}>{b.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
                {user ? (
                  <Card>
                    <div className="p-5 text-center">
                      <span className="inline-flex w-16 h-16 rounded-full items-center justify-center text-[24px] font-bold text-white mb-2" style={{ background: C.grad }}>{user.name.slice(0, 1).toUpperCase()}</span>
                      <h3 className="text-[18px] font-bold">{user.name}</h3>
                      <p className="text-[13px]" style={{ color: C.inkSoft }}>{lvl.icon} {lvl.name} · {game.xp} XP · 🔥 {game.streak} dagar</p>
                      <button className="mt-4 px-5 py-2.5 rounded-xl font-semibold" style={{ background: C.fill, color: C.red }} onClick={() => setUser(null)}>Logga ut</button>
                    </div>
                  </Card>
                ) : (
                  <Card>
                    <div className="p-5">
                      <h3 className="text-[18px] font-bold text-center">Logga in på imsafe.se</h3>
                      <p className="text-[13px] text-center mt-1 mb-4" style={{ color: C.inkSoft }}>Lås upp XP, streaks och utmärkelser – och spara allt mellan enheter.</p>
                      <input style={inputF()} placeholder="Ditt namn" value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
                      <button className="w-full mt-2 py-3 rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2 active:opacity-70" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.ink }}
                        onClick={() => nameInput && setUser({ name: nameInput, via: "google" })}>
                        <span style={{ fontWeight: 700, color: "#4285F4" }}>G</span> Fortsätt med Google
                      </button>
                      <button className="w-full mt-2 py-3 rounded-xl font-semibold text-white text-[15px] active:opacity-70" style={{ background: C.blue }} onClick={() => nameInput && setUser({ name: nameInput, via: "email" })}>
                        Skapa konto med e-post
                      </button>
                      <p className="text-[11px] mt-3 text-center" style={{ color: C.inkSoft }}>Demo-läge: riktig Google-inloggning kräver driftsättning på imsafe.se med OAuth. Data sparas redan lokalt.</p>
                    </div>
                  </Card>
                )}
              </>
            )}
          </>
        )}

        <footer className="text-[11px] pb-4 px-2" style={{ color: C.inkSoft }}>
          imsafe.se · Beslutsstöd – inte ett operativt godkännande. Befälhavaren ansvarar för go/no-go.
        </footer>
      </main>

      {/* ===== Bottenflikar ===== */}
      <nav className="fixed bottom-0 left-0 right-0 z-20" style={{ background: C.navGlass, backdropFilter: "blur(20px)", borderTop: `0.5px solid ${C.line}`, paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-2xl mx-auto flex">
          {TABS.map(([id, label, icon]) => (
            <button key={id} onClick={() => setTab(id)} className="flex-1 pt-2 pb-2.5 flex flex-col items-center gap-0.5 active:opacity-50">
              <span className="leading-none flex items-center justify-center"
                style={{ fontSize: 19, width: 46, height: 28, borderRadius: 14, background: tab === id ? C.blue + "16" : "transparent", color: tab === id ? C.blue : C.inkSoft, transition: "background .2s" }}>{icon}</span>
              <span className="text-[10px] font-semibold" style={{ color: tab === id ? C.blue : C.inkSoft }}>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ===== PDF-RAPPORT ===== */}
      <div id="report" style={{ display: "none", ...SF, color: "#111", padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>imsafe.se · Riskbedömning VFR</h1>
        <p style={{ fontSize: 12, color: "#555" }}>Genererad {new Date().toLocaleString("sv-SE")}{user ? ` · Pilot: ${user.name}` : ""}</p>
        <hr style={{ margin: "12px 0" }} />
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Utlåtande: {model.verdict} — Risk {model.level} ({model.riskPct}/100, skydd {Math.round(model.protection * 100)} %)</h2>
        <p style={{ fontSize: 13 }}>{model.advice}</p>
        {decision && <p style={{ fontSize: 13, fontWeight: 700 }}>Befälhavarens beslut: {decision === "nogo" ? "AVSTÅR / FLYTTAR FLYGNINGEN" : "GENOMFÖR FLYGNINGEN"}</p>}
        <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 14 }}>Barriärstatus</h3>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}><tbody>
          {model.layers.map((l) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "4px 0", fontWeight: 600 }}>{l.name}</td><td>{l.score}/{l.max} p</td><td>penetration {Math.round(l.pen * 100)} %</td>
            </tr>
          ))}
        </tbody></table>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 14 }}>Riskfaktorer & åtgärder</h3>
        {model.active.length === 0 ? <p style={{ fontSize: 12 }}>Inga riskfaktorer markerade.</p> : (
          <ul style={{ fontSize: 12, paddingLeft: 18 }}>{model.active.map((f) => <li key={f.key} style={{ marginBottom: 6 }}><b>{f.label}</b> ({f.barrier}, +{f.w})<br />Åtgärd: {f.fix}</li>)}</ul>
        )}
        <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 14 }}>Genomgångens status</h3>
        <p style={{ fontSize: 12 }}>Piloten (IMSAFE) {Math.round(imsafePct * 100)} % · Briefing & legalt {Math.round(briefPct * 100)} % · Walkaround {Math.round(walkPct * 100)} %</p>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 14 }}>Personliga minima</h3>
        <p style={{ fontSize: 12 }}>{MIN_DEFS.map((m) => `${m.label}: ${m.dir === "max" ? "max" : "minst"} ${minVals[m.key]} ${m.unit}`).join(" · ")} · Bantyp: {surfaceOk === "asfalt" ? "endast asfalt" : "gräs OK"}</p>
        <hr style={{ margin: "16px 0" }} />
        <p style={{ fontSize: 11, color: "#555" }}>Formel: Skydd = ∏(1 − penetration per barriär). Beslutsstöd – befälhavaren ansvarar för go/no-go.</p>
        <p style={{ fontSize: 12, marginTop: 24 }}>Befälhavarens underskrift: ______________________________ Datum: ______________</p>
      </div>
    </div>
  );
}
