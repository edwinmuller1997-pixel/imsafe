import React, { useState, useMemo, useEffect, useRef } from "react";

/* ============================================================
   IMSAFE.SE — v11 "International"
   · Tre språk: svenska / English / Deutsch (autodetekteras)
   · Väderlänkar per språkregion (svenska tjänster bara på SV)
   · Swish-stöd (endast SV)
   · Logg-fliken borttagen · Swipe borttagen
   · Konsultpass: språkputs, typofixar, konsekvent ton
   ============================================================ */

/* ---------- Paletter ---------- */
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

/* ============================================================
   STRUKTURDATA (språkoberoende: nycklar, vikter, färger, mått)
   ============================================================ */
const STEP_DEF = [
  { id: 0, icon: "🧍", colorKey: "purple" },
  { id: 1, icon: "🌤", colorKey: "blue" },
  { id: 2, icon: "📋", colorKey: "indigo" },
  { id: 3, icon: "🛩", colorKey: "green" },
  { id: 4, icon: "⚖️", colorKey: "gold" },
];
const IMSAFE_KEYS = ["illness", "medication", "stress", "alcohol", "fatigue", "eating"];
const LEGAL_DEF = [
  { key: "license", ref: "Part-FCL" },
  { key: "medical", ref: "Part-MED" },
  { key: "recency", ref: "FCL.060" },
  { key: "docsAboard", ref: "NCO.GEN.135" },
  { key: "techlog", ref: "" },
];
const PREFLIGHT_KEYS = ["notam", "airspace", "wx", "massbalance", "fuelplan", "fuelcard", "freq", "ppr", "dryfly", "efb", "paxbrief"];
const PREFLIGHT_REF = { massbalance: "NCO.POL", fuelplan: "NCO.OP.125", paxbrief: "NCO.OP.130" };
const WALK_DEF = [
  { id: "fluids", icon: "💧", colorKey: "blue", keys: ["oil", "fuelQty", "drain", "fuelCaps", "leaks"] },
  { id: "electric", icon: "⚡", colorKey: "purple", keys: ["master", "lights", "pitot", "stall", "flaps"] },
  { id: "condition", icon: "🔍", colorKey: "green", keys: ["prop", "cowl", "wings", "tires", "struts", "static", "tiedown"] },
];
const BARRIER_DEF = [
  { id: "pilot", colorKey: "purple", icon: "🧍", factors: [{ key: "imsafe", w: 4 }, { key: "lowRecent", w: 3 }, { key: "recency90", w: 2 }, { key: "newType", w: 3 }, { key: "noDryFly", w: 1 }] },
  { id: "wx", colorKey: "blue", icon: "🌤", factors: [{ key: "marginal", w: 5 }, { key: "deterio", w: 4 }, { key: "xwind", w: 3 }, { key: "dusk", w: 4 }, { key: "gps", w: 2 }, { key: "terrain", w: 2 }, { key: "icing", w: 3 }] },
  { id: "acft", colorKey: "green", icon: "🛩", factors: [{ key: "fuelTight", w: 4 }, { key: "nearMtow", w: 2 }, { key: "defect", w: 3 }, { key: "unfamiliarEquip", w: 2 }] },
  { id: "plan", colorKey: "orange", icon: "🗂", factors: [{ key: "pressure", w: 4 }, { key: "newAd", w: 2 }, { key: "grassShort", w: 2 }, { key: "noAltn", w: 3 }, { key: "noBrief", w: 2 }] },
];
const MIN_DEF = [
  { key: "xwind", unit: "kt", def: 12, min: 0, max: 25, step: 1, dir: "max" },
  { key: "gust", unit: "kt", def: 20, min: 5, max: 40, step: 1, dir: "max" },
  { key: "vis", unit: "km", def: 8, min: 5, max: 30, step: 1, dir: "min" },
  { key: "cloud", unit: "ft", def: 2000, min: 600, max: 5000, step: 100, dir: "min" },
  { key: "fuel", unit: "min", def: 60, min: 30, max: 120, step: 5, dir: "min" },
  { key: "rwy", unit: "m", def: 800, min: 400, max: 2000, step: 50, dir: "min" },
];
const ACC_DEF = [
  { key: "loc", shareFatal: 32, lethality: 65 },
  { key: "imc", shareFatal: 20, lethality: 86 },
  { key: "cfit", shareFatal: 12, lethality: 75 },
  { key: "toldg", shareFatal: 10, lethality: 8 },
  { key: "fuel", shareFatal: 7, lethality: 15 },
  { key: "engine", shareFatal: 9, lethality: 20 },
  { key: "midair", shareFatal: 4, lethality: 60 },
  { key: "other", shareFatal: 6, lethality: 25 },
];
const LEVEL_DEF = [{ xp: 0, icon: "🐣" }, { xp: 150, icon: "🛫" }, { xp: 400, icon: "👨‍✈️" }, { xp: 900, icon: "⭐" }, { xp: 1800, icon: "🛡️" }, { xp: 3500, icon: "🏆" }];
const BADGE_DEF = [{ id: "first", icon: "✅" }, { id: "allday", icon: "💯" }, { id: "nogo", icon: "🧠" }, { id: "walk", icon: "🔍" }];
const AIRPORTS = ["ESSB Bromma", "ESKN Skavsta", "ESOW Västerås", "ESSA Arlanda", "ESGG Landvetter", "ESGP Säve", "ESMS Malmö", "ESSL Linköping", "ESSP Norrköping", "ESOE Örebro", "ESKC Uppsala/Sundbro", "ESMK Kristianstad", "ESMQ Kalmar", "ESSV Visby", "ESNZ Östersund", "ESNU Umeå", "ESPA Luleå", "ESOK Karlstad", "ESGJ Jönköping", "ESSU Eskilstuna", "ESMX Växjö"];

/* ============================================================
   SPRÅKPAKET
   ============================================================ */
const EDWIN_IMG = "data:image/jpeg;base64,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";
function logEvent(e) {
  try {
    const raw = localStorage.getItem("imsafe:events");
    const arr = raw ? JSON.parse(raw) : [];
    arr.push({ d: new Date().toISOString().slice(0, 10), e });
    if (arr.length > 5000) arr.splice(0, arr.length - 5000);
    localStorage.setItem("imsafe:events", JSON.stringify(arr));
  } catch {}
}
function readEvents() {
  try { const raw = localStorage.getItem("imsafe:events"); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function ageNow() {
  const b = new Date(1997, 3, 7); // 7 april 1997
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < 3 || (n.getMonth() === 3 && n.getDate() < 7)) a--;
  return a;
}
const I18N = {
  /* ================= SVENSKA ================= */
  sv: {
    locale: "sv-SE",
    greet: { m: "God morgon", d: "Hej", e: "God kväll" },
    tabs: { fly: "Flyg", more: "Mer" },
    titles: { fly: "Dagens flygning", menu: "Mer", links: "Väder & briefing", minima: "Minima", news: "Nyheter", blog: "Säkerhetsblogg", stats: "Haveribild", account: "Konto", support: "Stöd imsafe" },
    steps: [
      { name: "Piloten", q: "Är jag i skick att flyga idag?", time: "~30 sek" },
      { name: "Risker", q: "Vilka hot finns idag?", time: "~1 min" },
      { name: "Briefing", q: "Papper, briefing och planering på plats?", time: "~2 min" },
      { name: "Planet", q: "Runt planet – i lugn takt. Låt ingen stressa dig.", time: "vid planet" },
      { name: "Beslut", q: "Dags att väga ihop allt.", time: "~30 sek" },
    ],
    stepOf: (n) => `Steg ${n} av 5`,
    onboard: { hi: "Välkommen 👋", tag: "Fem steg. Fem minuter. Ett tydligt beslut.", tip: "Tips: ställ in dina minima under Mer → Minima.", start: "Sätt igång", langLabel: "Språk / Language / Sprache" },
    imsafe: {
      title: "IMSAFE", subDone: "Du är grön – vidare till riskerna ✓", subTodo: "Bocka av uppifrån och ner – som på papperschecklistan",
      items: { illness: ["Illness", "Nej", "Fri från sjukdom som påverkar flygningen"], medication: ["Medication", "Nej", "Inga mediciner som påverkar omdöme eller vakenhet"], stress: ["Stress", "Nej", "Privat eller jobbrelaterad stress under kontroll"], alcohol: ["Alcohol", "Nej", "Minst 8 h flaska→spak och under laggräns (0,2 ‰)"], fatigue: ["Fatigue", "Ja", "Utvilad – tillräcklig sömn senaste natten"], eating: ["Eating", "Ja", "Ätit och druckit – energi för hela flygningen"] },
    },
    riskStep: {
      title: "Dagens riskfaktorer", sub: "Öppna varje område och kryssa det som stämmer idag. Inga kryss = stark dag.",
      none: "Inget markerat", marked: (n) => `${n} markerad${n > 1 ? "e" : ""}`,
      foot: "Resultatet visas inte här – du väger ihop allt i sista steget. Ärlighet nu ger ett bättre beslut sen.",
      autoOk: "IMSAFE grön – hämtas från steg 1", autoBad: "IMSAFE är inte komplett – tryck för att gå till steg 1",
    },
    barriers: { pilot: "Pilot", wx: "Väder & miljö", acft: "Flygplan", plan: "Planering & press" },
    factors: {
      imsafe: ["IMSAFE ej helt grön", "Flyg inte idag."],
      lowRecent: ["Mindre än 10 h senaste 90 dagarna", "Boka en timme med instruktör, eller börja med några trafikvarv i lugnt väder."],
      recency90: ["90-dagarsregeln ej uppfylld (FCL.060)", "Flyg 3 starter och landningar solo för att få ta med passagerare."],
      newType: ["Under 10 h på typen", "Läs manualen och höj dina minima tills du har 10 h på typen."],
      noDryFly: ["Ingen torrflygning gjord", "Ta 5 minuter nu: blunda och ”flyg” trafikvarvet och en go-around."],
      marginal: ["Sikt eller molnbas nära dina minima", "Sätt en vändpunkt: under X ft molnbas vänder jag. Låt inte dina minima förändras under flygningen."],
      deterio: ["Prognosen försämras under dagen", "Ta höjd för försämringen – flyg hem några timmar tidigare."],
      xwind: ["Sidvind eller byar över din gräns", "Vänta tills vinden lugnat ner sig. Det är bättre att vara på marken och längta upp än att vara i luften och längta ner…"],
      dusk: ["Skymning eller mörker", "Planera landning senast 30 minuter före solnedgång (VFR dag) – och håll den marginalen."],
      nightOk: ["Jag har mörkerbevis (NQ) och planet är nattutrustat", "Mörker-VFR: håll högre väderminima och välj belysta fält – utmaningen är att hitta lämpligt nödfält i mörker."],
      gps: ["Risk för GPS-störning (jamming) längs rutten", "Kolla läget på gpsjam.org (länk under Mer), skriv ut backupkartor och briefa: vad gör vi om GPS:en försvinner?"],
      terrain: ["Terräng eller vatten utan nödlandningsalternativ", "Lägg rutten längs fält och vägar i den mån det går, flyg högre. Över vatten: flytvästar på – överväg flotte och överlevnadsdräkt."],
      icing: ["Risk för förgasaris eller isbildning", "Kom ihåg förgasarvärme med jämna intervall samt vid plané."],
      fuelTight: ["Bränslereserv under ditt personliga minima", "Tanka fullt eller planera en mellanlandning. Bränsle är den billigaste försäkringen."],
      nearMtow: ["Nära max startvikt eller tyngdpunkt långt fram/bak", "Justera var passagerare och bagage placeras, eller lämna en väska hemma."],
      defect: ["Kvarstående anmärkning på flygplanet", "Läs i loggboken. Ring teknikern vid osäkerhet. Utan tydligt besked – inget flyg."],
      unfamiliarEquip: ["Ovan vid avioniken eller utrustningen", "Sitt kvar på marken i 15 minuter, programmera hela rutten och öva de mest grundläggande funktionerna."],
      pressure: ["Tidspress (get-there-itis) eller förväntanstryck", "Säg det högt till passagerarna redan nu: vi kan behöva vända, ställa in eller ta bilen."],
      newAd: ["Obekant flygplats", "Studera kartan och satellitbilden, rita trafikvarvet, ring fältet om något är oklart."],
      grassShort: ["Gräsbana eller kort bana", "Gör prestandaberäkningen med tillägg: gräs +20 %, vått +30 %."],
      noAltn: ["Ingen tydlig plan B", "Välj ett alternativ med bättre väder eller längre bana – skriv upp frekvens och kurs dit."],
      noBrief: ["Ofullständig briefing", "Ta 10 minuter: NOTAM, TAF och PPR. Länkarna finns under Mer."],
    },
    brief: {
      legalTitle: "Legalt & dokument", legalSub: "Part-FCL · Part-MED · NCO.GEN.135",
      legal: { license: "Certifikat och behörigheter giltiga", medical: "Medical giltigt", recency: "90-dagarsregeln för passagerare uppfylld", docsAboard: "Dokument ombord: registreringsbevis, ARC, radiotillstånd, försäkring, flyghandbok", techlog: "Techlog: gångtid OK, inga öppna anmärkningar" },
      preTitle: "Briefing & planering", preSub: "Länkar till väder och NOTAM finns under Mer → Väder & briefing",
      pre: { notam: ["NOTAM", "Hela rutten och alternativen"], airspace: ["Luftrum", "Restriktionsområden, TMA, drönarzoner"], wx: ["Väder", "METAR/TAF · LHP · SWC · SMHI"], booking: ["Bokning", null], massbalance: ["Vikt & balans samt prestandaberäkningar", null], fuelplan: ["Bränsle", "Trip + 30 min dag / 45 min natt"], fuelcard: ["Bränslekort med", "Tankning möjlig på destinationen"], freq: ["Frekvenser och transponderkoder", null], ppr: ["PPR och öppettider", null], dryfly: ["Torrflygning", "Visualisera trafikvarvet"], efb: ["Offlinebackup av kartor · laddade enheter", "Skriv ut kartor eller ta med fysiska kartor"], paxbrief: ["Passagerarbriefing", null] },
    },
    walk: {
      title: "Walkaround", subDone: "Planet genomgånget – sista blicken: inget kvarglömt på vingen? ✓", subTodo: "Vätskor → Elektronik → Skick. I din takt.",
      groups: { fluids: "Vätskor", electric: "Elektronik", condition: "Skick" },
      items: { oil: ["Olja", "Nivå inom gränser, lock åtdraget"], fuelQty: ["Bränslemängd", "Visuellt verifierad i alla tankar"], drain: ["Dränering", "Alla punkter, fritt från vatten och partiklar"], fuelCaps: ["Tanklock", "Stängda och låsta"], leaks: ["Läckage", "Inga droppar eller fläckar under motor och vingar"], master: ["Huvudström", "På – batterispänning OK"], lights: ["Belysning", "Beacon, strobe, nav- och landningsljus"], pitot: ["Pitotvärme", "Känn att den blir varm (kort test)"], stall: ["Stallvarnare", "Testad"], flaps: ["Klaffar", "Ut och in, symmetriskt"], prop: ["Propeller", "Inga hack, sprickor eller glapp"], cowl: ["Motorkåpa", "Fäst, inga lösa föremål"], wings: ["Vingar och roder", "Hela ytor, fria rörelser"], tires: ["Däck", "Tryck och mönster OK"], struts: ["Dämpare", "Inget läckage"], static: ["Statiska portar", "Portar och pitotrör fria"], tiedown: ["Pitotskydd och bogserstång", "Borttagna – även förtöjning och klossar"] },
      poh: "Generisk lista – flygplanstypens egen checklista har alltid företräde.",
    },
    decide: { imsafeBlock: "IMSAFE ist nicht grün – heute nicht fliegen.", imsafeBlock: "IMSAFE is not green – don't fly today.", imsafeBlock: "IMSAFE är inte grön – flyg inte idag.",
      basisTitle: "Ditt underlag", basisSub: "Så komplett är genomgången",
      cols: ["Piloten", "Risker", "Briefing", "Planet"], threats: "hot",
      incomplete: "⚠ Genomgången är inte komplett – bedömningen blir bara så bra som underlaget.",
      last: (a, dTxt) => `Senaste bedömning: ${a.verdict} (${a.riskPct}/100) · ${a.date}${dTxt}`,
      lastGo: " · beslut: flög ✈️", lastNogo: " · beslut: avstod 🧠",
      create: "⚖️ Skapa min bedömning", weighing: "Väger ihop underlaget…",
      notRealtime: "Bedömningen skapas när du trycker – inte i realtid. Ändrar du underlaget efteråt skapar du en ny.",
      riskLabel: "Risk", barriersNow: "Barriärerna just nu",
      actionsTitle: "🛠 Sänk risken – gör så här", actionsSub: "Dina kryss, tyngst först. Åtgärdat något? Bocka ur krysset och skapa en ny bedömning.",
      actionsEmpty: "Inga riskfaktorer markerade", strongDay: "Stark dag! Håll ändå dina minima heliga och sätt en vändpunkt före start.",
      moreN: (n) => `+ ${n} till – men börja med de fem tyngsta.`,
      fly: "✈️ Jag flyger", abstain: "🧠 Jag avstår",
      decidedNogo: ["🧠 Det är bättre att vara på marken och längta upp än att vara i luften och längta ner.", "Skriv gärna ner varför – framtida du tackar dig."],
      decidedGo: ["✈️ Trevlig flygtur!", "Flyg din plan – och välkommen ner."],
      pdf: "Spara som PDF-rapport", restart: "Börja om – ny genomgång",
      verdicts: { GO: "GO", COND: "GO MED VILLKOR", DOUBT: "TVEKSAMT", NOGO: "NO-GO" },
      levels: { LOW: "LÅG", ELEV: "FÖRHÖJD", HIGH: "HÖG", CRIT: "KRITISK" },
      advice: {
        LOW: "Barriärerna är intakta. Flyg som planerat och håll dina minima.",
        ELEV: "Flygbart – om du först neutraliserar minst en faktor i åtgärdslistan och sätter tydliga beslutspunkter.",
        HIGH: "Flera barriärer är kraftigt försvagade. Ändra förutsättningarna på riktigt innan du överväger start.",
        CRIT: "Det här är profilen i haverirapporterna. Ställ in. Ingen flygning måste göras idag.",
      },
    },
    nextStep: (icon, name) => `Nästa: ${icon} ${name} →`, contAnyway: (name) => `Fortsätt ändå till ${name} →`,
    contHint: "Du kan alltid gå vidare – men ett komplett steg ger en säkrare bedömning.",
    tipTitle: "Dagens säkerhetstips",
    tips: [
      "Sätt en hård vändpunkt före start: under X ft molnbas vänder jag. Beslut fattade på marken håller i luften.",
      "Läs TAF:en baklänges – börja med hur dagen slutar. De flesta väderhaverier sker på hemvägen.",
      "Säg dina minima högt till passagerarna före start. Då är de lättare att hålla.",
      "En avbruten landning är alltid ett godkänt facit. Öva en frivillig då och då.",
      "Bränsle i tanken är tid att tänka. Tanka för hjärnan, inte bara för sträckan.",
      "Titta ut 80 % av tiden i trafikvarvet. Skärmen visar var trafiken var – fönstret var den är.",
    ],
    menu: {
      links: ["Väder & briefing", "METAR/TAF, Aroweb, NOTAM, SMHI"],
      minima: ["Personliga minima", "Dina gränser + lagens VMC-minima"],
      news: ["Nyheter", "Regler och säkerhet – hämtas live"],
      blog: ["Säkerhetsblogg", "Tips och haverilärdomar"],
      stats: ["Haveribild", "Vad dödar VFR-piloter?"],
      support: ["Stöd imsafe 💙", "Bjud utvecklaren på en fika via Swish"],
      account: ["Konto & utmärkelser", "Logga in för XP och streaks"],
      lang: ["Språk", "Svenska · English · Deutsch"],
      back: "‹ Mer",
    },
    links: {
      airportsTitle: "Välj flygplatser", airportsSub: "Länkarna anpassas efter ditt val", from: "FRÅN", to: "TILL",
      metarTitle: "METAR & TAF", raw: "Rådata båda fälten",
      briefTitle: "Briefing & NOTAM",
      briefRows: [
        ["https://aro.lfv.se", "Aroweb – NOTAM, LHP, AIP", "LFV:s briefingtjänst", "indigo"],
        ["https://gpsjam.org", "GPS-jamming – gpsjam.org", "Störningsläget längs rutten", "red"],
        ["https://www.smhi.se/vader", "SMHI", "Prognoser, radar, blixt", "blue"],
        ["https://www.windy.com", "Windy", "Vind och moln – visuellt", "teal"],
      ],
      otherTitle: "Övrigt",
      otherRows: [
        ["https://www.transportstyrelsen.se/sv/luftfart/", "Transportstyrelsen", "Föreskrifter och regler", "orange"],
        ["https://www.easa.europa.eu/en/domains/general-aviation", "EASA General Aviation", "Part-NCO och säkerhetsmaterial", "orange"],
        ["https://havkom.se", "SHK – Haverikommissionen", "Svenska haverirapporter", "red"],
      ],
    },
    minima: {
      title: "Personliga minima", sub: "Ställ in en gång – sparas automatiskt och används i risksteget.",
      max: "max", min: "minst",
      labels: { xwind: ["Sidvind", "Tillverkarens demovärde är inte din gräns"], gust: ["Byvind totalt", ""], vis: ["Sikt", "Lagkrav SERA: minst 5 km"], cloud: ["Molnbas", "G: fri från moln · kontrollzon: bas minst 1 500 ft"], fuel: ["Bränslereserv vid landning", "Lagkrav: 30 min dag / 45 min natt"], rwy: ["Banlängd", "Kräver prestandaberäkning"] },
      surface: "Bantyp", surfAsphalt: "Asfalt", surfGrass: "Gräs OK",
      vmcTitle: "Lagens VMC-minima", vmcSub: "SERA.5001 – flygplan under FL100",
      vmcRows: [
        ["C, D, E (under FL100)", "5 km", "1 500 m horisontellt · 1 000 ft vertikalt"],
        ["G över 900 m AMSL", "5 km", "1 500 m horisontellt · 1 000 ft vertikalt"],
        ["G under 900 m AMSL", "5 km*", "Fri från moln, marken i sikte"],
        ["Över FL100", "8 km", "1 500 m horisontellt · 1 000 ft vertikalt"],
      ],
      vmcFoot: "* Under 900 m AMSL kan sikten under vissa villkor reduceras till 3 km vid högst 140 kt IAS. Verifiera alltid mot svensk AIP.",
    },
    news: { title: "Flygvärlden just nu", sub: "Hämtas live med AI-webbsökning", btn: "Hämta senaste nytt", loading: "Söker nyheter…", fail: "Kunde inte hämta nyheter. Besök easa.europa.eu och transportstyrelsen.se direkt.", empty: "Inga nyheter kunde hämtas just nu.", prompt: "Sök på webben efter de senaste nyheterna (1-2 månader) inom allmänflyg och flygsäkerhet relevanta för en svensk VFR-privatpilot: EASA-regler, Transportstyrelsen, luftrumsändringar, SHK-rapporter. Svara på svenska, punktlista max 6: **rubrik** – 1-2 meningar + relevans. Om inget hittas: hänvisa till EASA:s och Transportstyrelsens nyhetssidor." },
    blog: {
      cats: ["Alla", "Väder", "Airmanship", "Teknik", "Regler", "Haverilärdomar"],
      seed: [
        { id: 1, cat: "Väder", title: "Så läser du LHP som ett proffs", excerpt: "Platshållare – tolka områdesprognosen mot dina minima.", date: "2026-07-01", read: "5 min" },
        { id: 2, cat: "Airmanship", title: "Vändpunkten: konsten att säga nej i luften", excerpt: "Platshållare – beslutspunkter och sunk cost.", date: "2026-06-20", read: "4 min" },
        { id: 3, cat: "Haverilärdomar", title: "Tre haverirapporter varje VFR-pilot borde läsa", excerpt: "Platshållare – lärdomar från svenska haverier.", date: "2026-06-10", read: "7 min" },
      ],
      newBtn: "+ Nytt inlägg", newTitle: "Nytt inlägg", phTitle: "Rubrik", phExcerpt: "Ingress…", publish: "Publicera", cancel: "Avbryt",
    },
    stats: {
      title: "Vad dödar VFR-piloter?", sub: "EASA · AOPA Nall Report · SHK",
      share: "% av dödsolyckor", lethality: "% dödlighet",
      cats: {
        loc: ["Loss of control i luften (LOC-I)", "Stall och spinn – ofta lågt i trafikvarvet. Största dödsorsaken."],
        imc: ["VFR in i moln och dåligt väder", "Få händelser – nästan alltid dödliga."],
        cfit: ["Flygning in i terräng (CFIT)", "Låg höjd, mörker, dålig sikt."],
        toldg: ["Start och landning", "Vanligast totalt – men sällan dödlig."],
        fuel: ["Bränslehantering", "Nästan alltid förebyggbart."],
        engine: ["Motorbortfall (tekniskt)", "Höjd och terrängval avgör utfallet."],
        midair: ["Kollision i luften", "Trafikvarv och nära fält."],
        other: ["Övrigt", "Markkollision, förgasaris med mera."],
      },
    },
    account: {
      badgesTitle: "Utmärkelser", badgesSub: (n, t, g) => `${n} av ${t} upplåsta · nej-beslut: ${g}`,
      badges: { first: ["Första kollen", "Slutför din första genomgång"], allday: ["Full koll", "Alla steg klara samma dag"], streak3: ["3 i rad", "3 dagars säkerhetsstreak"], streak7: ["Veckan", "7 dagars streak"], streak30: ["Månaden", "30 dagars streak"], nogo: ["Rätt beslut", "Ställde in en flygning – starkaste airmanship som finns"], walk: ["Runt planet", "Första kompletta walkaround"] },
      levels: ["Elev", "Solopilot", "Befälhavare", "Kapten", "Safety Pro", "Legendar"],
      loginTitle: "Logga in på imsafe.se", loginSub: "Lås upp XP, streaks och utmärkelser.",
      phName: "Ditt namn", google: "Fortsätt med Google", email: "Skapa konto med e-post",
      demo: "Demo-läge: riktig inloggning kräver driftsättning med OAuth. Data sparas redan lokalt på enheten.",
      logout: "Logga ut", loggedVia: "dagar", xpTo: (n, name) => `${n} till ${name}`, max: "MAX", days: "dagar",
    },
    support: {
      title: "Stöd imsafe 💙", sub: "Appen är gratis och byggd på fritid. Vill du bjuda på en fika?",
      note: "Öppnar Swish på din mobil med beloppet ifyllt.", thanks: "Tack! Varje krona går till drift och utveckling. ✈️",
      amounts: [29, 59, 99], msg: "Tack for imsafe.se",
    },
    xpEvents: { step: "Steg klart", assess: "Bedömning skapad", report: "Rapport skapad", nogoToast: "Starkaste beslutet i flygningen", badge: "Utmärkelse" },
    footer: "imsafe.se · Beslutsstöd – inte ett operativt godkännande. Befälhavaren ansvarar alltid för go/no-go.",
    report: { title: "imsafe.se · Riskbedömning VFR", generated: "Genererad", pilot: "Pilot", verdict: "Utlåtande", risk: "Risk", protection: "skydd", decision: "Befälhavarens beslut", decGo: "GENOMFÖR FLYGNINGEN", decNogo: "AVSTÅR / FLYTTAR FLYGNINGEN", barriers: "Barriärstatus", pen: "penetration", factors: "Riskfaktorer & åtgärder", noneF: "Inga riskfaktorer markerade.", action: "Åtgärd", status: "Genomgångens status", minima: "Personliga minima", formula: "Formel: Skydd = ∏(1 − penetration per barriär). Beslutsstöd – befälhavaren ansvarar för go/no-go.", sign: "Befälhavarens underskrift", date: "Datum", surfA: "endast asfalt", surfG: "gräs OK" },
    night: "Night Panel",
  },

  /* ================= ENGLISH ================= */
  en: {
    locale: "en-GB",
    greet: { m: "Good morning", d: "Hello", e: "Good evening" },
    tabs: { fly: "Fly", more: "More" },
    titles: { fly: "Today's flight", menu: "More", links: "Weather & briefing", minima: "Minimums", news: "News", blog: "Safety blog", stats: "Accident picture", account: "Account", support: "Support" },
    steps: [
      { name: "Pilot", q: "Am I fit to fly today?", time: "~30 sec" },
      { name: "Risks", q: "What threats exist today?", time: "~1 min" },
      { name: "Briefing", q: "Paperwork, briefing and planning in place?", time: "~2 min" },
      { name: "Aircraft", q: "Around the aircraft – at your pace. Let no one rush you.", time: "at the acft" },
      { name: "Decision", q: "Time to weigh it all up.", time: "~30 sec" },
    ],
    stepOf: (n) => `Step ${n} of 5`,
    onboard: { hi: "Welcome 👋", tag: "Five steps. Five minutes. One clear decision.", tip: "Tip: set your personal minimums under More → Minimums.", start: "Let's go", langLabel: "Språk / Language / Sprache" },
    imsafe: {
      title: "IMSAFE", subDone: "You're in the green – on to the risks ✓", subTodo: "Tick top to bottom – like the paper checklist",
      items: { illness: ["Illness", "No", "Free of illness that affects the flight"], medication: ["Medication", "No", "No medication impairing judgement or alertness"], stress: ["Stress", "No", "Personal or work stress under control"], alcohol: ["Alcohol", "No", "At least 8 h bottle-to-throttle and within legal limits"], fatigue: ["Fatigue", "Yes", "Well rested – enough sleep last night"], eating: ["Eating", "Yes", "Fed and hydrated – energy for the whole flight"] },
    },
    riskStep: {
      title: "Today's risk factors", sub: "Open each area and tick what applies today. No ticks = a strong day.",
      none: "Nothing ticked", marked: (n) => `${n} ticked`,
      foot: "No result shown here – you weigh everything up in the final step. Honesty now means a better decision later.",
      autoOk: "IMSAFE green – imported from step 1", autoBad: "IMSAFE incomplete – tap to go to step 1",
    },
    barriers: { pilot: "Pilot", wx: "Weather & environment", acft: "Aircraft", plan: "Planning & pressure" },
    factors: {
      imsafe: ["IMSAFE not fully green", "Don't fly today."],
      lowRecent: ["Less than 10 h in the last 90 days", "Book an hour with an instructor, or start with a few circuits in calm weather."],
      recency90: ["90-day rule not met (FCL.060)", "Fly 3 take-offs and landings solo before carrying passengers."],
      newType: ["Under 10 h on type", "Read the manual and raise your minimums until you have 10 h on type."],
      noDryFly: ["No chair-flying done", "Take 5 minutes now: close your eyes and ”fly” the circuit and a go-around."],
      marginal: ["Visibility or ceiling near your minimums", "Set a turn-back point: below X ft ceiling I turn back. Don't let your minimums shift in flight."],
      deterio: ["Forecast deteriorating during the day", "Build in margin for the deterioration – head home a few hours earlier."],
      xwind: ["Crosswind or gusts above your limit", "Wait for the wind to settle. Better to be on the ground wishing you were in the air than the other way around…"],
      dusk: ["Dusk or darkness", "Plan to land no later than 30 minutes before sunset (day VFR) – and keep that margin."],
      nightOk: ["I hold a night rating (NQ) and the aircraft is night-equipped", "Night VFR: keep higher weather minimums and choose lit fields – the challenge is finding a forced-landing site in the dark."],
      gps: ["Risk of GPS jamming along the route", "Check gpsjam.org (link under More), print backup charts and brief: what do we do if GPS drops out?"],
      terrain: ["Terrain or water without forced-landing options", "Route along fields and roads where possible, fly higher. Over water: life jackets on – consider a raft and immersion suits."],
      icing: ["Risk of carburettor or airframe icing", "Remember carb heat at regular intervals and before descent."],
      fuelTight: ["Fuel reserve below your personal minimum", "Fill up or plan a fuel stop. Fuel is the cheapest insurance there is."],
      nearMtow: ["Near MTOW or CG far forward/aft", "Adjust where passengers and baggage go, or leave a bag behind."],
      defect: ["Open defect on the aircraft", "Check the tech log. Call the engineer if unsure. No clear release – no flight."],
      unfamiliarEquip: ["Unfamiliar avionics or equipment", "Sit on the ground for 15 minutes, programme the whole route and practise the basic functions."],
      pressure: ["Time pressure (get-there-itis) or expectations", "Say it out loud to your passengers now: we may turn back, cancel or take the car."],
      newAd: ["Unfamiliar aerodrome", "Study the chart and satellite view, draw the circuit, call the field if unsure."],
      grassShort: ["Grass or short runway", "Do the performance calculation with factors: grass +20 %, wet +30 %."],
      noAltn: ["No clear plan B", "Pick an alternate with better weather or a longer runway – note frequency and heading."],
      noBrief: ["Incomplete briefing", "Take 10 minutes: NOTAM, TAF and PPR. Links are under More."],
    },
    brief: {
      legalTitle: "Legal & documents", legalSub: "Part-FCL · Part-MED · NCO.GEN.135",
      legal: { license: "Licence and ratings valid", medical: "Medical valid", recency: "90-day rule for passengers met", docsAboard: "On board: registration, ARC, radio licence, insurance, flight manual", techlog: "Tech log: hours OK, no open defects" },
      preTitle: "Briefing & planning", preSub: "Weather and NOTAM links are under More → Weather & briefing",
      pre: { notam: ["NOTAM", "Whole route and alternates"], airspace: ["Airspace", "Restricted areas, TMA, drone zones"], wx: ["Weather", "METAR/TAF · area forecast · charts"], booking: ["Booking", null], massbalance: ["Weight & balance and performance", null], fuelplan: ["Fuel", "Trip + 30 min day / 45 min night"], fuelcard: ["Fuel card packed", "Refuelling possible at destination"], freq: ["Frequencies and transponder codes", null], ppr: ["PPR and opening hours", null], dryfly: ["Chair-flying", "Visualise the circuit"], efb: ["Offline chart backup · devices charged", "Print charts or bring paper charts"], paxbrief: ["Passenger briefing", null] },
    },
    walk: {
      title: "Walkaround", subDone: "Aircraft checked – one last look: nothing left on the wing? ✓", subTodo: "Fluids → Electrics → Condition. At your pace.",
      groups: { fluids: "Fluids", electric: "Electrics", condition: "Condition" },
      items: { oil: ["Oil", "Level within limits, cap secure"], fuelQty: ["Fuel quantity", "Visually verified in all tanks"], drain: ["Fuel drains", "All points, free of water and debris"], fuelCaps: ["Fuel caps", "Closed and locked"], leaks: ["Leaks", "No drips or stains under engine or wings"], master: ["Master", "On – battery voltage OK"], lights: ["Lights", "Beacon, strobe, nav and landing"], pitot: ["Pitot heat", "Feel it getting warm (brief test)"], stall: ["Stall warner", "Tested"], flaps: ["Flaps", "Out and in, symmetrical"], prop: ["Propeller", "No nicks, cracks or play"], cowl: ["Cowling", "Secure, no loose objects"], wings: ["Wings and controls", "Surfaces intact, free movement"], tires: ["Tyres", "Pressure and tread OK"], struts: ["Struts", "Correct extension, no leaks"], static: ["Static ports", "Ports and pitot clear"], tiedown: ["Tie-downs", "Tie-downs, chocks and pitot cover REMOVED"] },
      poh: "Generic list – your aircraft type's own checklist always takes precedence.",
    },
    decide: {
      basisTitle: "Your basis", basisSub: "How complete the review is",
      cols: ["Pilot", "Risks", "Briefing", "Aircraft"], threats: "threats",
      incomplete: "⚠ The review is incomplete – the assessment is only as good as its basis.",
      last: (a, dTxt) => `Last assessment: ${a.verdict} (${a.riskPct}/100) · ${a.date}${dTxt}`,
      lastGo: " · decision: flew ✈️", lastNogo: " · decision: stood down 🧠",
      create: "⚖️ Create my assessment", weighing: "Weighing it up…",
      notRealtime: "The assessment is created when you press – not in real time. Change the basis and you'll create a new one.",
      riskLabel: "Risk", barriersNow: "The barriers right now",
      actionsTitle: "🛠 Reduce the risk – do this", actionsSub: "Your ticks, heaviest first. Fixed one? Untick it and create a new assessment.",
      actionsEmpty: "No risk factors ticked", strongDay: "Strong day! Still keep your minimums sacred and set a turn-back point before departure.",
      moreN: (n) => `+ ${n} more – but start with the heaviest five.`,
      fly: "✈️ I'm flying", abstain: "🧠 I stand down",
      decidedNogo: ["🧠 Better to be on the ground wishing you were in the air than in the air wishing you were on the ground.", "Note down why – future you will be grateful."],
      decidedGo: ["✈️ Have a great flight!", "Fly your plan – and welcome back down."],
      pdf: "Save as PDF report", restart: "Start over – new review",
      verdicts: { GO: "GO", COND: "GO WITH CONDITIONS", DOUBT: "DOUBTFUL", NOGO: "NO-GO" },
      levels: { LOW: "LOW", ELEV: "ELEVATED", HIGH: "HIGH", CRIT: "CRITICAL" },
      advice: {
        LOW: "The barriers are intact. Fly as planned and keep your minimums.",
        ELEV: "Flyable – if you first neutralise at least one factor in the action list and set clear decision points.",
        HIGH: "Several barriers are badly weakened. Genuinely change the conditions before even considering departure.",
        CRIT: "This is the profile in the accident reports. Cancel. No flight has to happen today.",
      },
    },
    nextStep: (icon, name) => `Next: ${icon} ${name} →`, contAnyway: (name) => `Continue to ${name} anyway →`,
    contHint: "You can always move on – but a complete step gives a safer assessment.",
    tipTitle: "Safety tip of the day",
    tips: [
      "Set a hard turn-back point before departure: below X ft ceiling I turn back. Decisions made on the ground hold in the air.",
      "Read the TAF backwards – start with how the day ends. Most weather accidents happen on the way home.",
      "Say your minimums out loud to your passengers before departure. It makes them easier to keep.",
      "A go-around is always a passing grade. Practise a voluntary one now and then.",
      "Fuel in the tank is time to think. Fuel for your brain, not just the distance.",
      "Eyes outside 80 % of the time in the circuit. The screen shows where traffic was – the window shows where it is.",
    ],
    menu: {
      links: ["Weather & briefing", "METAR/TAF, NOTAM, charts"],
      minima: ["Personal minimums", "Your limits + legal VMC minima"],
      news: ["News", "Rules and safety – fetched live"],
      blog: ["Safety blog", "Tips and accident lessons"],
      stats: ["Accident picture", "What kills VFR pilots?"],
      support: null,
      account: ["Account & badges", "Sign in for XP and streaks"],
      lang: ["Language", "Svenska · English · Deutsch"],
      back: "‹ More",
    },
    links: {
      airportsTitle: "Choose aerodromes", airportsSub: "The links adapt to your choice", from: "FROM", to: "TO",
      metarTitle: "METAR & TAF", raw: "Raw data, both fields",
      briefTitle: "Briefing & NOTAM",
      briefRows: [
        ["https://www.windy.com", "Windy", "Wind and cloud – visual", "teal"],
        ["https://gpsjam.org", "GPS jamming – gpsjam.org", "Interference along your route", "red"],
        ["https://skybrary.aero", "SKYbrary", "Safety knowledge base", "indigo"],
      ],
      otherTitle: "More",
      otherRows: [
        ["https://www.easa.europa.eu/en/domains/general-aviation", "EASA General Aviation", "Part-NCO and safety material", "orange"],
        ["https://aviationweather.gov", "Aviation Weather Center", "Charts and raw data", "blue"],
      ],
      note: "Use your national AIS/briefing service for NOTAM and legal pre-flight information.",
    },
    minima: {
      title: "Personal minimums", sub: "Set once – saved automatically and referenced in the risk step.",
      max: "max", min: "at least",
      labels: { xwind: ["Crosswind", "The manufacturer's demo value is not your limit"], gust: ["Total gust", ""], vis: ["Visibility", "SERA legal minimum: 5 km"], cloud: ["Ceiling", "Class G: clear of cloud · CTR: ceiling at least 1 500 ft"], fuel: ["Fuel reserve at landing", "Legal: 30 min day / 45 min night"], rwy: ["Runway length", "Requires a performance calculation"] },
      surface: "Surface", surfAsphalt: "Paved only", surfGrass: "Grass OK",
      vmcTitle: "Legal VMC minima", vmcSub: "SERA.5001 – aeroplanes below FL100",
      vmcRows: [
        ["C, D, E (below FL100)", "5 km", "1 500 m horizontally · 1 000 ft vertically"],
        ["G above 900 m AMSL", "5 km", "1 500 m horizontally · 1 000 ft vertically"],
        ["G below 900 m AMSL", "5 km*", "Clear of cloud, surface in sight"],
        ["Above FL100", "8 km", "1 500 m horizontally · 1 000 ft vertically"],
      ],
      vmcFoot: "* Below 900 m AMSL national rules may allow 3 km at max 140 kt IAS. Always verify against your national AIP.",
    },
    news: { title: "Aviation right now", sub: "Fetched live with AI web search", btn: "Fetch latest news", loading: "Searching…", fail: "Couldn't fetch news. Visit easa.europa.eu directly.", empty: "No news could be fetched right now.", prompt: "Search the web for the latest news (1-2 months) in general aviation and flight safety relevant to a European VFR private pilot: EASA rules, airspace changes, safety bulletins, notable accident reports. Answer in English, bullet list max 6: **headline** – 1-2 sentences + relevance. If nothing found: point to EASA's news pages." },
    blog: {
      cats: ["All", "Weather", "Airmanship", "Technical", "Rules", "Accident lessons"],
      seed: [
        { id: 1, cat: "Weather", title: "Reading area forecasts like a pro", excerpt: "Placeholder – interpreting the forecast against your minimums.", date: "2026-07-01", read: "5 min" },
        { id: 2, cat: "Airmanship", title: "The turn-back point: the art of saying no", excerpt: "Placeholder – decision points and sunk cost.", date: "2026-06-20", read: "4 min" },
        { id: 3, cat: "Accident lessons", title: "Three accident reports every VFR pilot should read", excerpt: "Placeholder – lessons from real accidents.", date: "2026-06-10", read: "7 min" },
      ],
      newBtn: "+ New post", newTitle: "New post", phTitle: "Title", phExcerpt: "Lead…", publish: "Publish", cancel: "Cancel",
    },
    stats: {
      title: "What kills VFR pilots?", sub: "EASA · AOPA Nall Report",
      share: "% of fatal accidents", lethality: "% lethality",
      cats: {
        loc: ["Loss of control in flight (LOC-I)", "Stall and spin – often low in the circuit. The biggest killer."],
        imc: ["VFR into IMC / weather", "Few events – almost always fatal."],
        cfit: ["Controlled flight into terrain", "Low altitude, darkness, poor visibility."],
        toldg: ["Take-off and landing", "Most common overall – rarely fatal."],
        fuel: ["Fuel management", "Almost always preventable."],
        engine: ["Engine failure (technical)", "Altitude and terrain choice decide the outcome."],
        midair: ["Mid-air collision", "Circuits and near aerodromes."],
        other: ["Other", "Ground collision, carb icing and more."],
      },
    },
    account: {
      badgesTitle: "Badges", badgesSub: (n, t, g) => `${n} of ${t} unlocked · no-go calls: ${g}`,
      badges: { first: ["First check", "Complete your first review"], allday: ["Full check", "All steps complete in one day"], streak3: ["3 in a row", "3-day safety streak"], streak7: ["The week", "7-day streak"], streak30: ["The month", "30-day streak"], nogo: ["The right call", "Cancelled a flight – the strongest airmanship there is"], walk: ["Around the aircraft", "First complete walkaround"] },
      levels: ["Student", "Solo pilot", "PIC", "Captain", "Safety Pro", "Legend"],
      loginTitle: "Sign in to imsafe.se", loginSub: "Unlock XP, streaks and badges.",
      phName: "Your name", google: "Continue with Google", email: "Create account with email",
      demo: "Demo mode: real sign-in requires OAuth deployment. Data is already saved locally on this device.",
      logout: "Sign out", xpTo: (n, name) => `${n} to ${name}`, max: "MAX", days: "days",
    },
    support: null,
    xpEvents: { step: "Step complete", assess: "Assessment created", report: "Report created", nogoToast: "The strongest call in aviation", badge: "Badge" },
    footer: "imsafe.se · Decision support – not an operational approval. The pilot in command is always responsible for go/no-go.",
    report: { title: "imsafe.se · VFR Risk Assessment", generated: "Generated", pilot: "Pilot", verdict: "Verdict", risk: "Risk", protection: "protection", decision: "PIC decision", decGo: "CONDUCTING THE FLIGHT", decNogo: "STANDING DOWN / POSTPONING", barriers: "Barrier status", pen: "penetration", factors: "Risk factors & actions", noneF: "No risk factors ticked.", action: "Action", status: "Review status", minima: "Personal minimums", formula: "Formula: Protection = ∏(1 − penetration per barrier). Decision support – the PIC is responsible for go/no-go.", sign: "PIC signature", date: "Date", surfA: "paved only", surfG: "grass OK" },
    night: "Night Panel",
  },

  /* ================= DEUTSCH ================= */
  de: {
    locale: "de-DE",
    greet: { m: "Guten Morgen", d: "Hallo", e: "Guten Abend" },
    tabs: { fly: "Flug", more: "Mehr" },
    titles: { fly: "Heutiger Flug", menu: "Mehr", links: "Wetter & Briefing", minima: "Minima", news: "News", blog: "Safety-Blog", stats: "Unfallbild", account: "Konto", support: "Support" },
    steps: [
      { name: "Pilot", q: "Bin ich heute flugtauglich?", time: "~30 Sek" },
      { name: "Risiken", q: "Welche Gefahren gibt es heute?", time: "~1 Min" },
      { name: "Briefing", q: "Papiere, Briefing und Planung erledigt?", time: "~2 Min" },
      { name: "Flugzeug", q: "Rund ums Flugzeug – in Ruhe. Lass dich von niemandem hetzen.", time: "am Flugzeug" },
      { name: "Entscheidung", q: "Zeit, alles abzuwägen.", time: "~30 Sek" },
    ],
    stepOf: (n) => `Schritt ${n} von 5`,
    onboard: { hi: "Willkommen 👋", tag: "Fünf Schritte. Fünf Minuten. Eine klare Entscheidung.", tip: "Tipp: Stelle deine Minima unter Mehr → Minima ein.", start: "Los geht's", langLabel: "Språk / Language / Sprache" },
    imsafe: {
      title: "IMSAFE", subDone: "Du bist im grünen Bereich – weiter zu den Risiken ✓", subTodo: "Von oben nach unten abhaken – wie auf der Papier-Checkliste",
      items: { illness: ["Illness", "Nein", "Frei von Krankheit, die den Flug beeinträchtigt"], medication: ["Medication", "Nein", "Keine Medikamente, die Urteilsvermögen oder Wachheit beeinträchtigen"], stress: ["Stress", "Nein", "Privater oder beruflicher Stress unter Kontrolle"], alcohol: ["Alcohol", "Nein", "Mindestens 8 h bottle to throttle – 0,0 als Richtwert"], fatigue: ["Fatigue", "Ja", "Ausgeruht – genug Schlaf letzte Nacht"], eating: ["Eating", "Ja", "Gegessen und getrunken – Energie für den ganzen Flug"] },
    },
    riskStep: {
      title: "Heutige Risikofaktoren", sub: "Öffne jeden Bereich und hake an, was heute zutrifft. Keine Häkchen = starker Tag.",
      none: "Nichts markiert", marked: (n) => `${n} markiert`,
      foot: "Hier wird kein Ergebnis angezeigt – du wägst alles im letzten Schritt ab. Ehrlichkeit jetzt bedeutet eine bessere Entscheidung später.",
      autoOk: "IMSAFE grün – aus Schritt 1 übernommen", autoBad: "IMSAFE unvollständig – tippe, um zu Schritt 1 zu gehen",
    },
    barriers: { pilot: "Pilot", wx: "Wetter & Umgebung", acft: "Flugzeug", plan: "Planung & Druck" },
    factors: {
      imsafe: ["IMSAFE nicht ganz grün", "Heute nicht fliegen."],
      lowRecent: ["Weniger als 10 h in den letzten 90 Tagen", "Buche eine Stunde mit Fluglehrer, oder starte mit ein paar Platzrunden bei ruhigem Wetter."],
      recency90: ["90-Tage-Regel nicht erfüllt (FCL.060)", "Fliege 3 Starts und Landungen solo, bevor du Passagiere mitnimmst."],
      newType: ["Unter 10 h auf dem Muster", "Lies das Handbuch und erhöhe deine Minima, bis du 10 h auf dem Muster hast."],
      noDryFly: ["Kein Chair Flying gemacht", "Nimm dir 5 Minuten: Augen zu, Platzrunde und Durchstarten mental durchfliegen."],
      marginal: ["Sicht oder Wolkenuntergrenze nahe deiner Minima", "Setze einen Umkehrpunkt: unter X ft Untergrenze kehre ich um. Lass deine Minima im Flug nicht wandern."],
      deterio: ["Vorhersage verschlechtert sich im Tagesverlauf", "Plane Reserve für die Verschlechterung ein – flieg ein paar Stunden früher heim."],
      xwind: ["Seitenwind oder Böen über deiner Grenze", "Warte, bis der Wind nachlässt. Lieber am Boden sein und nach oben wollen, als in der Luft sein und nach unten wollen…"],
      dusk: ["Dämmerung oder Dunkelheit", "Landung spätestens 30 Minuten vor Sonnenuntergang planen (VFR am Tag) – und diese Reserve halten."],
      nightOk: ["Ich habe eine Nachtflugberechtigung (NQ) und das Flugzeug ist nachtflugtauglich", "Nacht-VFR: höhere Wetterminima halten und beleuchtete Plätze wählen – die Herausforderung ist ein Notlandefeld im Dunkeln."],
      gps: ["Gefahr von GPS-Störung (Jamming) entlang der Route", "Lage auf gpsjam.org prüfen (Link unter Mehr), Backup-Karten drucken und briefen: Was tun wir, wenn das GPS ausfällt?"],
      terrain: ["Gelände oder Wasser ohne Notlandemöglichkeit", "Route entlang Feldern und Straßen wo möglich, höher fliegen. Über Wasser: Schwimmwesten an – Rettungsinsel und Überlebensanzug erwägen."],
      icing: ["Gefahr von Vergaser- oder Flugzeugvereisung", "Vergaservorwärmung in regelmäßigen Abständen und vor dem Sinkflug."],
      fuelTight: ["Kraftstoffreserve unter deinem persönlichen Minimum", "Volltanken oder Tankstopp planen. Sprit ist die günstigste Versicherung."],
      nearMtow: ["Nahe MTOW oder Schwerpunkt weit vorn/hinten", "Passagiere und Gepäck umverteilen oder eine Tasche zu Hause lassen."],
      defect: ["Defekt am Flugzeug", "Bordbuch lesen. Bei Unsicherheit den Techniker anrufen. Ohne klare Freigabe – kein Flug."],
      unfamiliarEquip: ["Ungewohnte Avionik oder Ausrüstung", "15 Minuten am Boden sitzen bleiben, die ganze Route programmieren und die grundlegenden Funktionen üben."],
      pressure: ["Zeitdruck (Get-there-itis) oder Erwartungsdruck", "Sag es den Passagieren jetzt laut: Wir müssen vielleicht umkehren, absagen oder das Auto nehmen."],
      newAd: ["Unbekannter Flugplatz", "Karte und Satellitenbild studieren, Platzrunde zeichnen, bei Unklarheit anrufen."],
      grassShort: ["Gras- oder kurze Bahn", "Leistungsberechnung mit Zuschlägen: Gras +20 %, nass +30 %."],
      noAltn: ["Kein klarer Plan B", "Wähle einen Ausweichplatz mit besserem Wetter oder längerer Bahn – Frequenz und Kurs notieren."],
      noBrief: ["Unvollständiges Briefing", "Nimm dir 10 Minuten: NOTAM, TAF und PPR. Links unter Mehr."],
    },
    brief: {
      legalTitle: "Recht & Dokumente", legalSub: "Part-FCL · Part-MED · NCO.GEN.135",
      legal: { license: "Lizenz und Berechtigungen gültig", medical: "Medical gültig", recency: "90-Tage-Regel für Passagiere erfüllt", docsAboard: "An Bord: Eintragungsschein, ARC, Funkzulassung, Versicherung, Flughandbuch", techlog: "Bordbuch: Stunden OK, keine offenen Beanstandungen" },
      preTitle: "Briefing & Planung", preSub: "Wetter- und NOTAM-Links unter Mehr → Wetter & Briefing",
      pre: { notam: ["NOTAM", "Gesamte Route und Ausweichplätze"], airspace: ["Luftraum", "Sperrgebiete, TMA, Drohnenzonen"], wx: ["Wetter", "METAR/TAF · GAFOR · Karten"], booking: ["Buchung", null], massbalance: ["Masse & Schwerpunkt sowie Leistungsberechnung", null], fuelplan: ["Kraftstoff", "Trip + 30 Min Tag / 45 Min Nacht"], fuelcard: ["Tankkarte dabei", "Tanken am Zielplatz möglich"], freq: ["Frequenzen und Transpondercodes", null], ppr: ["PPR und Öffnungszeiten", null], dryfly: ["Chair Flying", "Platzrunde visualisieren"], efb: ["Offline-Backup der Karten · Geräte geladen", "Karten drucken oder Papierkarten mitnehmen"], paxbrief: ["Passagier-Briefing", null] },
    },
    walk: {
      title: "Außencheck", subDone: "Flugzeug geprüft – letzter Blick: nichts auf der Fläche vergessen? ✓", subTodo: "Flüssigkeiten → Elektrik → Zustand. In deinem Tempo.",
      groups: { fluids: "Flüssigkeiten", electric: "Elektrik", condition: "Zustand" },
      items: { oil: ["Öl", "Stand innerhalb der Grenzen, Deckel fest"], fuelQty: ["Kraftstoffmenge", "In allen Tanks geprüft"], drain: ["Fuel Drain", "Alle Punkte, frei von Wasser und Partikeln"], fuelCaps: ["Tankdeckel", "Geschlossen und verriegelt"], leaks: ["Lecks", "Keine Tropfen oder Flecken unter Motor und Flächen"], master: ["Hauptschalter", "Ein – Batteriespannung OK"], lights: ["Beleuchtung", "Beacon, Strobe, Nav- und Landelicht"], pitot: ["Pitot Heat", "Kurz testen, wird warm"], stall: ["Überziehwarnung", "Getestet"], flaps: ["Klappen", "Fahren symmetrisch ein und aus"], prop: ["Propeller", "Keine Kerben, Risse oder Spiel"], cowl: ["Motorhaube", "Fest, keine losen Gegenstände"], wings: ["Flächen und Rumpf", "Oberflächen intakt, freigängig"], tires: ["Reifen", "Druck und Profil OK"], struts: ["Struts", "Korrekter Ausschub, keine Lecks"], static: ["Statikports", "Ports und Pitotrohr frei"], tiedown: ["Verzurrung", "Verzurrung, Bremsklötze und Pitotabdeckung ENTFERNT"] },
      poh: "Generische Liste – die Checkliste deines Flugzeugmusters hat immer Vorrang.",
    },
    decide: {
      basisTitle: "Deine Grundlage", basisSub: "So vollständig ist der Durchgang",
      cols: ["Pilot", "Risiken", "Briefing", "Flugzeug"], threats: "Gefahren",
      incomplete: "⚠ Der Durchgang ist unvollständig – die Bewertung ist nur so gut wie ihre Grundlage.",
      last: (a, dTxt) => `Letzte Bewertung: ${a.verdict} (${a.riskPct}/100) · ${a.date}${dTxt}`,
      lastGo: " · Entscheidung: geflogen ✈️", lastNogo: " · Entscheidung: abgesagt 🧠",
      create: "⚖️ Meine Bewertung erstellen", weighing: "Wäge ab…",
      notRealtime: "Die Bewertung entsteht auf Knopfdruck – nicht in Echtzeit. Änderst du die Grundlage, erstellst du eine neue.",
      riskLabel: "Risiko", barriersNow: "Die Barrieren jetzt",
      actionsTitle: "🛠 Risiko senken – so geht's", actionsSub: "Deine Häkchen, schwerste zuerst. Etwas erledigt? Häkchen entfernen und neu bewerten.",
      actionsEmpty: "Keine Risikofaktoren markiert", strongDay: "Starker Tag! Halte trotzdem deine Minima heilig und setze einen Umkehrpunkt vor dem Start.",
      moreN: (n) => `+ ${n} weitere – aber beginne mit den fünf schwersten.`,
      fly: "✈️ Ich fliege", abstain: "🧠 Ich sage ab",
      decidedNogo: ["🧠 Lieber am Boden sein und nach oben wollen, als in der Luft sein und nach unten wollen.", "Notiere, warum – dein zukünftiges Ich dankt dir."],
      decidedGo: ["✈️ Entschieden – fliege deinen Plan, nicht deine Hoffnungen.", "Halte die Minima heilig und den Umkehrpunkt scharf."],
      pdf: "Als PDF-Bericht speichern", restart: "Neu beginnen – neuer Durchgang",
      verdicts: { GO: "GO", COND: "GO MIT AUFLAGEN", DOUBT: "FRAGLICH", NOGO: "NO-GO" },
      levels: { LOW: "NIEDRIG", ELEV: "ERHÖHT", HIGH: "HOCH", CRIT: "KRITISCH" },
      advice: {
        LOW: "Die Barrieren sind intakt. Fliege wie geplant und halte deine Minima.",
        ELEV: "Fliegbar – wenn du zuerst mindestens einen Faktor der Maßnahmenliste neutralisierst und klare Entscheidungspunkte setzt.",
        HIGH: "Mehrere Barrieren sind stark geschwächt. Ändere die Bedingungen wirklich, bevor du einen Start überhaupt erwägst.",
        CRIT: "Das ist das Profil aus den Unfallberichten. Absagen. Kein Flug muss heute stattfinden.",
      },
    },
    nextStep: (icon, name) => `Weiter: ${icon} ${name} →`, contAnyway: (name) => `Trotzdem weiter zu ${name} →`,
    contHint: "Du kannst immer weitergehen – aber ein vollständiger Schritt ergibt eine sicherere Bewertung.",
    tipTitle: "Sicherheitstipp des Tages",
    tips: [
      "Setze vor dem Start einen harten Umkehrpunkt: unter X ft Untergrenze kehre ich um. Bodenentscheidungen halten in der Luft.",
      "Lies die TAF rückwärts – beginne damit, wie der Tag endet. Die meisten Wetterunfälle passieren auf dem Heimweg.",
      "Sag deine Minima vor dem Start laut zu den Passagieren. Dann sind sie leichter zu halten.",
      "Ein Durchstarten ist immer ein bestandenes Ergebnis. Übe ab und zu ein freiwilliges.",
      "Sprit im Tank ist Zeit zum Denken. Tanke für den Kopf, nicht nur für die Strecke.",
      "In der Platzrunde 80 % der Zeit rausschauen. Der Bildschirm zeigt, wo der Verkehr war – das Fenster, wo er ist.",
    ],
    menu: {
      links: ["Wetter & Briefing", "METAR/TAF, NOTAM, Karten"],
      minima: ["Persönliche Minima", "Deine Grenzen + gesetzliche VMC-Minima"],
      news: ["News", "Regeln und Sicherheit – live geladen"],
      blog: ["Safety-Blog", "Tipps und Unfalllehren"],
      stats: ["Unfallbild", "Was tötet VFR-Piloten?"],
      support: null,
      account: ["Konto & Auszeichnungen", "Anmelden für XP und Serien"],
      lang: ["Sprache", "Svenska · English · Deutsch"],
      back: "‹ Mehr",
    },
    links: {
      airportsTitle: "Flugplätze wählen", airportsSub: "Die Links passen sich deiner Wahl an", from: "VON", to: "NACH",
      metarTitle: "METAR & TAF", raw: "Rohdaten, beide Plätze",
      briefTitle: "Briefing & NOTAM",
      briefRows: [
        ["https://www.flugwetter.de", "flugwetter.de (DWD)", "Amtliches Flugwetter · Anmeldung nötig", "indigo"],
        ["https://gpsjam.org", "GPS-Jamming – gpsjam.org", "Störungslage entlang der Route", "red"],
        ["https://www.windy.com", "Windy", "Wind und Wolken – visuell", "teal"],
        ["https://skybrary.aero", "SKYbrary", "Sicherheits-Wissensdatenbank", "blue"],
      ],
      otherTitle: "Weiteres",
      otherRows: [
        ["https://www.easa.europa.eu/en/domains/general-aviation", "EASA General Aviation", "Part-NCO und Sicherheitsmaterial", "orange"],
        ["https://www.bfu-web.de", "BFU", "Deutsche Unfallberichte", "red"],
      ],
      note: "Nutze deinen nationalen AIS-/Briefingdienst für NOTAM und rechtsverbindliche Flugvorbereitung.",
    },
    minima: {
      title: "Persönliche Minima", sub: "Einmal einstellen – wird automatisch gespeichert und im Risiko-Schritt genutzt.",
      max: "max", min: "mind.",
      labels: { xwind: ["Seitenwind", "Der Demowert des Herstellers ist nicht deine Grenze"], gust: ["Böen gesamt", ""], vis: ["Sicht", "SERA-Minimum: 5 km"], cloud: ["Wolkenuntergrenze", "G: frei von Wolken · CTR: Untergrenze mind. 1 500 ft"], fuel: ["Kraftstoffreserve bei Landung", "Gesetzlich: 30 Min Tag / 45 Min Nacht"], rwy: ["Bahnlänge", "Erfordert eine Leistungsberechnung"] },
      surface: "Bahnbelag", surfAsphalt: "Nur Asphalt", surfGrass: "Gras OK",
      vmcTitle: "Gesetzliche VMC-Minima", vmcSub: "SERA.5001 – Flugzeuge unter FL100",
      vmcRows: [
        ["C, D, E (unter FL100)", "5 km", "1 500 m horizontal · 1 000 ft vertikal"],
        ["G über 900 m AMSL", "5 km", "1 500 m horizontal · 1 000 ft vertikal"],
        ["G unter 900 m AMSL", "5 km*", "Frei von Wolken, Erdsicht"],
        ["Über FL100", "8 km", "1 500 m horizontal · 1 000 ft vertikal"],
      ],
      vmcFoot: "* Unter 900 m AMSL können nationale Regeln 3 km bei max. 140 kt IAS erlauben. Immer gegen das nationale AIP prüfen.",
    },
    news: { title: "Luftfahrt aktuell", sub: "Live per KI-Websuche geladen", btn: "Neueste News laden", loading: "Suche…", fail: "News konnten nicht geladen werden. Besuche easa.europa.eu direkt.", empty: "Momentan keine News gefunden.", prompt: "Suche im Web nach den neuesten Nachrichten (1-2 Monate) aus der Allgemeinen Luftfahrt und Flugsicherheit, relevant für einen europäischen VFR-Privatpiloten: EASA-Regeln, Luftraumänderungen, Sicherheitsbulletins, BFU-Berichte. Antworte auf Deutsch, Stichpunktliste max 6: **Überschrift** – 1-2 Sätze + Relevanz. Falls nichts gefunden: auf die News-Seiten der EASA verweisen." },
    blog: {
      cats: ["Alle", "Wetter", "Airmanship", "Technik", "Regeln", "Unfalllehren"],
      seed: [
        { id: 1, cat: "Wetter", title: "GAFOR lesen wie ein Profi", excerpt: "Platzhalter – die Gebietsvorhersage gegen deine Minima lesen.", date: "2026-07-01", read: "5 Min" },
        { id: 2, cat: "Airmanship", title: "Der Umkehrpunkt: die Kunst, Nein zu sagen", excerpt: "Platzhalter – Entscheidungspunkte und Sunk Cost.", date: "2026-06-20", read: "4 Min" },
        { id: 3, cat: "Unfalllehren", title: "Drei Unfallberichte, die jeder VFR-Pilot lesen sollte", excerpt: "Platzhalter – Lehren aus echten Unfällen.", date: "2026-06-10", read: "7 Min" },
      ],
      newBtn: "+ Neuer Beitrag", newTitle: "Neuer Beitrag", phTitle: "Titel", phExcerpt: "Anriss…", publish: "Veröffentlichen", cancel: "Abbrechen",
    },
    stats: {
      title: "Was tötet VFR-Piloten?", sub: "EASA · AOPA Nall Report · BFU",
      share: "% der tödlichen Unfälle", lethality: "% Letalität",
      cats: {
        loc: ["Kontrollverlust im Flug (LOC-I)", "Überziehen und Trudeln – oft tief in der Platzrunde. Der größte Killer."],
        imc: ["VFR in IMC / Wetter", "Wenige Ereignisse – fast immer tödlich."],
        cfit: ["Kontrollierter Flug ins Gelände (CFIT)", "Geringe Höhe, Dunkelheit, schlechte Sicht."],
        toldg: ["Start und Landung", "Insgesamt am häufigsten – selten tödlich."],
        fuel: ["Kraftstoffmanagement", "Fast immer vermeidbar."],
        engine: ["Triebwerksausfall (technisch)", "Höhe und Geländewahl entscheiden."],
        midair: ["Zusammenstoß in der Luft", "Platzrunden und Platznähe."],
        other: ["Sonstiges", "Bodenkollision, Vergaservereisung u. a."],
      },
    },
    account: {
      badgesTitle: "Auszeichnungen", badgesSub: (n, t, g) => `${n} von ${t} freigeschaltet · No-Go-Entscheidungen: ${g}`,
      badges: { first: ["Erster Check", "Schließe deinen ersten Durchgang ab"], allday: ["Voller Check", "Alle Schritte an einem Tag"], streak3: ["3 in Folge", "3-Tage-Serie"], streak7: ["Die Woche", "7-Tage-Serie"], streak30: ["Der Monat", "30-Tage-Serie"], nogo: ["Die richtige Entscheidung", "Einen Flug abgesagt – stärkste Airmanship überhaupt"], walk: ["Rund ums Flugzeug", "Erster kompletter Außencheck"] },
      levels: ["Schüler", "Solopilot", "PIC", "Kapitän", "Safety Pro", "Legende"],
      loginTitle: "Bei imsafe.se anmelden", loginSub: "Schalte XP, Serien und Auszeichnungen frei.",
      phName: "Dein Name", google: "Mit Google fortfahren", email: "Konto mit E-Mail erstellen",
      demo: "Demo-Modus: Echte Anmeldung erfordert OAuth-Deployment. Daten werden bereits lokal gespeichert.",
      logout: "Abmelden", xpTo: (n, name) => `${n} bis ${name}`, max: "MAX", days: "Tage",
    },
    support: null,
    xpEvents: { step: "Schritt fertig", assess: "Bewertung erstellt", report: "Bericht erstellt", nogoToast: "Die stärkste Entscheidung der Fliegerei", badge: "Auszeichnung" },
    footer: "imsafe.se · Entscheidungshilfe – keine betriebliche Freigabe. Der verantwortliche Pilot entscheidet über go/no-go.",
    report: { title: "imsafe.se · VFR-Risikobewertung", generated: "Erstellt", pilot: "Pilot", verdict: "Ergebnis", risk: "Risiko", protection: "Schutz", decision: "Entscheidung des PIC", decGo: "FLUG WIRD DURCHGEFÜHRT", decNogo: "ABGESAGT / VERSCHOBEN", barriers: "Barrierenstatus", pen: "Penetration", factors: "Risikofaktoren & Maßnahmen", noneF: "Keine Risikofaktoren markiert.", action: "Maßnahme", status: "Status des Durchgangs", minima: "Persönliche Minima", formula: "Formel: Schutz = ∏(1 − Penetration pro Barriere). Entscheidungshilfe – der PIC entscheidet über go/no-go.", sign: "Unterschrift PIC", date: "Datum", surfA: "nur Asphalt", surfG: "Gras OK" },
    night: "Night Panel",
  },
};

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
function Stepper({ value, onChange, min, max, step, unit, color }) {
  const b = { width: 32, height: 32, borderRadius: 10, background: C.fill, color: C.blue, fontSize: 19, fontWeight: 500, lineHeight: 1 };
  return (
    <div className="flex items-center gap-1.5">
      <button style={b} className="active:opacity-50" onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <div className="text-center" style={{ minWidth: 70 }}>
        <span style={{ ...SF, fontSize: 17, fontWeight: 600, color: color || C.ink }}>{value}</span>
        <span style={{ ...SF, fontSize: 12, color: C.inkSoft }}> {unit}</span>
      </div>
      <button style={b} className="active:opacity-50" onClick={() => onChange(Math.min(max, value + step))}>+</button>
    </div>
  );
}
function LinkRow({ href, title, sub, color }) {
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
        <span className="text-[17px]">{toast.icon}</span>
        <span className="text-[15px] font-semibold">{toast.text}</span>
      </div>
    </div>
  );
}

/* Swish egen QR-payload (A+46708869697) som inbäddad bild */


/* ============================================================ */

export default function ImsafeApp() {
  const [lang, setLang] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("lang");
      if (p && ["sv", "en", "de"].includes(p)) return p;           // imsafe.se?lang=de
      if (window.location.hostname.endsWith(".de")) return "de";  // framtida imsafe.de
      if (window.location.hostname.endsWith(".eu")) return "en";  // imsafe.eu → engelska
    } catch {}
    const nav = (typeof navigator !== "undefined" && navigator.language) || "en";
    return nav.startsWith("sv") ? "sv" : nav.startsWith("de") ? "de" : "en";
  });
  const urlHasLang = useRef(false);
  useEffect(() => { try { urlHasLang.current = !!new URLSearchParams(window.location.search).get("lang"); } catch {} }, []);
  const T = I18N[lang];

  const [tab, setTab] = useState("fly");
  const [step, setStep] = useState(0);
  const [assessed, setAssessed] = useState(false);
  const [decision, setDecision] = useState(null);
  const [moreView, setMoreView] = useState("menu");
  const [expandedBarrier, setExpandedBarrier] = useState("pilot");
  const [seenIntro, setSeenIntro] = useState(false); /* intro visas vid varje kallstart */
  const [lastAssessment, setLastAssessment] = useState(null);
  const [risks, setRisks] = useState({});
  const [imsafe, setImsafe] = useState({});
  const [legal, setLegal] = useState({});
  const [pre, setPre] = useState({});
  const [walk, setWalk] = useState({});
  const [minVals, setMinVals] = useState(Object.fromEntries(MIN_DEF.map((m) => [m.key, m.def])));
  const [surfaceOk, setSurfaceOk] = useState("asfalt");
  const [dep, setDep] = useState("ESSB Bromma");
  const [dst, setDst] = useState("ESGP Säve");
  const [news, setNews] = useState({ status: "idle", text: "" });
  const [blogCat, setBlogCat] = useState(0);
  const [posts, setPosts] = useState(null); // null = använd seed för aktuellt språk
  const [draft, setDraft] = useState({ title: "", cat: 1, excerpt: "" });
  const [showDraft, setShowDraft] = useState(false);
  const [user, setUser] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [game, setGame] = useState({ xp: 0, streak: 0, lastDay: null, badges: [], soundOn: true, nogoCount: 0 });
  const [night, setNight] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [installEvt, setInstallEvt] = useState(null);
  const isAdmin = typeof window !== "undefined" && window.location.pathname.replace(/\/+$/, "") === "/admin";
  const [adminPw, setAdminPw] = useState("");
  const [adminOk, setAdminOk] = useState(false);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  const [temNotes, setTemNotes] = useState("");
  const [uses, setUses] = useState(0);
  const [nudgeGone, setNudgeGone] = useState(false);
  const [kbdGone, setKbdGone] = useState(false);
  const [printMode, setPrintMode] = useState("report");
  const [infoOpen, setInfoOpen] = useState(null);
  const [introSplash, setIntroSplash] = useState(false);
  const [seenIntroEver, setSeenIntroEver] = useState(false);
  const [helloIdx, setHelloIdx] = useState(0);
  const [confetti, setConfetti] = useState(false);
  const [toast, setToast] = useState(null);
  const [shownPct, setShownPct] = useState(null);
  const toastTimer = useRef(null);
  const celebrated = useRef({});

  /* Tema före render */
  Object.assign(C, night ? DARK : LIGHT);
  useEffect(() => { document.body.style.background = C.bg; }, [night]);
  useEffect(() => { logEvent("visit"); }, []);
  useEffect(() => {
    if (seenIntro) return;
    const t = setInterval(() => setHelloIdx((i) => (i + 1) % 3), 2400);
    return () => clearInterval(t);
  }, [seenIntro]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  function showToast(icon, text) {
    setToast({ icon, text });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }
  function addXP() { /* XP borttaget – återinförs senare */ }
  function _addXP_disabled(n, label) {
    setGame((g) => ({ ...g, xp: g.xp + n }));
    if (game.soundOn) SND.xp();
    if (label) showToast("✨", `+${n} XP · ${label}`);
  }
  function award() { /* utmärkelser borttagna – återinförs senare */ }
  function touchStreak() {} /* streak-funktionen borttagen på användarens begäran */

  /* Lagring */
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("imsafe-profile-v7");
        if (r?.value) {
          const d = JSON.parse(r.value);
          if (d.user) setUser(d.user);
          if (d.minVals) setMinVals((v) => ({ ...v, ...d.minVals }));
          if (d.game) setGame((g) => ({ ...g, ...d.game }));
          const fresh = !d.ts || Date.now() - d.ts < 12 * 3600 * 1000; /* 12 h: ny dag = ny genomgång */
          if (d.seenIntroEver) {
            setSeenIntroEver(true);
            if (fresh) { setIntroSplash(true); setTimeout(() => setSeenIntro(true), 1100); } /* 1 s splash, fullt intro efter nollning */
          }
          if (typeof d.step === "number" && fresh) setStep(Math.min(4, d.step));
          if (d.lastAssessment) setLastAssessment(d.lastAssessment);
          if (d.night) setNight(true);
          if (d.temNotes && fresh) setTemNotes(d.temNotes);
          if (d.uses) setUses(d.uses);
          if (d.nudgeGone) setNudgeGone(true);
          if (d.kbdGone) setKbdGone(true);
          if (d.lang && I18N[d.lang] && !urlHasLang.current) setLang(d.lang);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);
  useEffect(() => {
    if (!loaded) return;
    (async () => { try { await window.storage.set("imsafe-profile-v7", JSON.stringify({ user, minVals, game, step, seenIntro, seenIntroEver, lastAssessment, night, lang, temNotes, uses, nudgeGone, kbdGone, ts: Date.now() })); } catch {} })();
  }, [user, minVals, game, step, seenIntro, seenIntroEver, lastAssessment, night, lang, temNotes, uses, nudgeGone, kbdGone, loaded]);

  /* IMSAFE auto-import + riskmodell */
  const imsafePct = IMSAFE_KEYS.filter((k) => imsafe[k]).length / IMSAFE_KEYS.length;
  const effRisks = useMemo(() => ({ ...risks, imsafe: imsafePct < 1 }), [risks, imsafePct]);
  const AUTO_INFO = { imsafe: { go: 0 } };

  const model = useMemo(() => {
    /* NQ + nattutrustat plan sänker skymningsfaktorns vikt från 4 till 1 */
    const wOf = (f) => (f.key === "dusk" && risks.nightOk ? 1 : f.w);
    const layers = BARRIER_DEF.map((b) => {
      const max = b.factors.reduce((s, f) => s + f.w, 0);
      const score = b.factors.reduce((s, f) => s + (effRisks[f.key] ? wOf(f) : 0), 0);
      return { ...b, color: C[b.colorKey], name: T.barriers[b.id], score, max, pen: score / max };
    });
    const protection = layers.reduce((p, l) => p * (1 - l.pen), 1);
    const riskPct = Math.round((1 - protection) * 100);
    let lv;
    if (riskPct <= 25) lv = ["LOW", C.green, "GO"];
    else if (riskPct <= 55) lv = ["ELEV", C.orange, "COND"];
    else if (riskPct <= 80) lv = ["HIGH", "#E8642C", "DOUBT"];
    else lv = ["CRIT", C.red, "NOGO"];
    const [lvKey, color, vKey] = lv;
    const aligned = layers.every((l) => l.pen > 0.4);
    const active = BARRIER_DEF.flatMap((b) => b.factors.filter((f) => effRisks[f.key]).map((f) => ({ ...f, w: wOf(f), color: C[b.colorKey], barrier: T.barriers[b.id] }))).sort((a, b2) => b2.w - a.w);
    /* IMSAFE är absolut: ett fel = NO-GO, oavsett beräknad procent */
    const imsafeBlock = !!effRisks.imsafe;
    return { layers, protection, riskPct, level: T.decide.levels[lvKey],
      color: imsafeBlock ? C.red : color,
      advice: imsafeBlock ? T.decide.imsafeBlock : T.decide.advice[lvKey],
      verdict: imsafeBlock ? T.decide.verdicts[3] : T.decide.verdicts[vKey],
      aligned, active, imsafeBlock };
    // eslint-disable-next-line
  }, [effRisks, risks.nightOk, lang, night]);

  useEffect(() => { if (assessed) { setAssessed(false); setDecision(null); setShownPct(null); } /* eslint-disable-next-line */ }, [risks, imsafe, walk, legal, pre]);

  const legalPct = LEGAL_DEF.filter((i) => legal[i.key]).length / LEGAL_DEF.length;
  const prePct = PREFLIGHT_KEYS.filter((k) => pre[k]).length / PREFLIGHT_KEYS.length;
  const briefPct = (LEGAL_DEF.filter((i) => legal[i.key]).length + PREFLIGHT_KEYS.filter((k) => pre[k]).length) / (LEGAL_DEF.length + PREFLIGHT_KEYS.length);
  const walkAllKeys = WALK_DEF.flatMap((g) => g.keys);
  const walkPct = walkAllKeys.filter((k) => walk[k]).length / walkAllKeys.length;
  const stepDone = [imsafePct === 1, true, briefPct === 1, walkPct === 1, assessed];
  const depIcao = dep.slice(0, 4), dstIcao = dst.slice(0, 4);

  const tipOfDay = T.tips[Math.floor(Date.now() / 864e5) % T.tips.length];
  const hour = new Date().getHours();
  const greeting = hour < 10 ? T.greet.m : hour < 18 ? T.greet.d : T.greet.e;
  const blogPosts = posts || T.blog.seed;

  useEffect(() => {
    [["imsafe", imsafePct], ["brief", briefPct], ["walk", walkPct]].forEach(([id, pct]) => {
      if (pct === 1 && !celebrated.current[id]) {
        celebrated.current[id] = true;
        if (game.soundOn) SND.step();
        addXP(25, T.xpEvents.step); touchStreak(); award("first");
        if (id === "walk") award("walk");
      }
      if (pct < 1) celebrated.current[id] = false;
    });
    // eslint-disable-next-line
  }, [imsafePct, briefPct, walkPct]);

  /* Tangentbord på dator: ←/→ byter steg, Enter/Space bockar nästa punkt */
  const kbdRef = useRef({});
  kbdRef.current = { step, imsafe, legal, pre, walk, assessed, tab };
  useEffect(() => {
    const onKey = (e) => {
      const K = kbdRef.current;
      if (K.tab !== "fly") return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "ArrowRight") { e.preventDefault(); goStep(K.step + 1); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); goStep(K.step - 1); return; }
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (K.step === 0) {
        const k = IMSAFE_KEYS.find((x) => !K.imsafe[x]);
        if (k) { setImsafe({ ...K.imsafe, [k]: true }); if (game.soundOn) SND.tick(); }
      } else if (K.step === 2) {
        const lk = LEGAL_DEF.map((d) => d.key).find((x) => !K.legal[x]);
        if (lk) { setLegal({ ...K.legal, [lk]: true }); if (game.soundOn) SND.tick(); return; }
        const pk = PREFLIGHT_KEYS.find((x) => !K.pre[x]);
        if (pk) { setPre({ ...K.pre, [pk]: true }); if (game.soundOn) SND.tick(); }
      } else if (K.step === 3) {
        const wk = WALK_DEF.flatMap((g) => g.keys).find((x) => !K.walk[x]);
        if (wk) { setWalk({ ...K.walk, [wk]: true }); if (game.soundOn) SND.tick(); }
      } else if (K.step === 4 && !K.assessed) {
        makeAssessment();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line
  }, []);

  function goStep(n) {
    if (n < 0 || n > 4 || n === step) return;
    setStep(n);
    if (game.soundOn) SND.step();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function makeAssessment() {
    setAssessed(true);
    setLastAssessment({ date: new Date().toISOString().slice(0, 10), verdict: model.verdict, riskPct: model.riskPct, decision: null });
    addXP(20, T.xpEvents.assess); touchStreak();
    setUses((u) => u + 1);
    logEvent("assess");
    const target = model.riskPct;
    const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { /* tillgänglighet: ingen svepande nål */
      setShownPct(null);
      if (game.soundOn) SND.verdict();
      return;
    }
    setShownPct(0);
    if (game.soundOn) tone(520, 0.06, 0, "sine", 0.05);
    const t0 = performance.now(), dur = 1400;
    const tick = (t) => {
      const f = Math.min(1, (t - t0) / dur);
      setShownPct(Math.round((1 - Math.pow(1 - f, 3)) * target)); /* mjuk inbromsning */
      if (f < 1) requestAnimationFrame(tick);
      else {
        try { navigator.vibrate && navigator.vibrate(12); } catch {} /* kännbart stopp */
        setTimeout(() => { /* ett andetag innan domen faller */
          setShownPct(null);
          if (game.soundOn) SND.verdict();
        }, 450);
      }
    };
    requestAnimationFrame(tick);
  }
  function decide(d) {
    logEvent(d === "nogo" ? "nogo" : "go");
    setDecision(d);
    setLastAssessment((a) => a ? { ...a, decision: d } : a);
    if (d === "nogo") {
      if (game.soundOn) SND.nogo();
      setGame((g) => ({ ...g, nogoCount: g.nogoCount + 1 }));
      showToast("🧠", T.xpEvents.nogoToast);
      award("nogo"); touchStreak();
    } else {
      if (game.soundOn) SND.done();
      addXP(15, "");
    }
  }
  function createReport() { addXP(10, T.xpEvents.report); setTimeout(() => window.print(), 200); }

  async function fetchNews() {
    setNews({ status: "loading", text: "" });
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1200, messages: [{ role: "user", content: {
          sv: "Sök på webben efter senaste nytt (1-2 månader) inom allmänflyg och flygsäkerhet för en svensk VFR-privatpilot. Källor att prioritera: Mentour Pilot (YouTube – senaste avsnitt/ämnen), Statens haverikommission havkom.se (nya rapporter), EASA, Transportstyrelsen, AOPA, Flygtorget. Svara på svenska som punktlista, max 6 punkter: **källa – rubrik** och 1-2 meningar med varför det är relevant. Om inget hittas: hänvisa till källornas egna sidor.",
          en: "Search the web for the latest general aviation and flight safety news (past 1-2 months) relevant to a European VFR private pilot. Prioritise: Mentour Pilot (YouTube – latest topics), EASA, NTSB/AOPA, national AIBs. Reply in English as a bullet list, max 6 items: **source – headline** plus 1-2 sentences on relevance.",
          de: "Suche im Web nach den neuesten Nachrichten (1-2 Monate) zu Allgemeiner Luftfahrt und Flugsicherheit für einen VFR-Privatpiloten. Priorisiere: Mentour Pilot (YouTube), EASA, BFU, AOPA, DWD/flugwetter. Antworte auf Deutsch als Liste, max. 6 Punkte: **Quelle – Schlagzeile** plus 1-2 Sätze zur Relevanz.",
        }[lang] }], tools: [{ type: "web_search_20250305", name: "web_search" }] }),
      });
      const data = await res.json();
      const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      setNews({ status: "done", text: text || T.news.empty });
    } catch { setNews({ status: "error", text: T.news.fail }); }
  }

  function Row({ checked, onChange, children, trailing, color, highlight = false, danger = false, info = null, infoKey = null }) {
    /* danger = negativt kryss (riskfaktor): rött med utropstecken. info = förklaring bakom ⓘ */
    const mark = danger ? C.red : color;
    const open = info && infoKey && infoOpen === infoKey;
    return (
      <label className="flex items-center gap-3 px-4 cursor-pointer active:opacity-60"
        style={{ paddingTop: 16, paddingBottom: 16, borderTop: `0.5px solid ${C.line}`, background: danger && checked ? C.red + "0C" : highlight ? color + "0C" : "transparent", boxShadow: highlight ? `inset 3px 0 0 ${color}` : "none", transition: "all .25s" }}>
        <span style={{ width: 29, height: 29, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: checked ? mark : "transparent", border: checked ? "none" : `2px solid ${highlight ? color : "rgba(120,128,140,0.4)"}`, transition: "all .15s", transform: checked ? "scale(1.05)" : "scale(1)", alignSelf: "flex-start" }}>
          {checked && (danger
            ? <span style={{ color: "#fff", fontWeight: 800, fontSize: 15, lineHeight: 1 }}>!</span>
            : <svg width="16" height="16" viewBox="0 0 12 12"><path d="M2 6.5L4.7 9 10 3.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>)}
        </span>
        <input type="checkbox" className="hidden" checked={checked} onChange={onChange} />
        <span className="flex-1">
          <span className="block text-[15px]" style={{ ...SF, color: C.ink, fontWeight: highlight ? 600 : 400 }}>{children}</span>
          {open && <span className="block text-[13px] mt-1 pr-2" style={{ color: C.ink2, animation: "imsafePopIn .18s ease-out" }}>{info}</span>}
        </span>
        {trailing}
        {info && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setInfoOpen(open ? null : infoKey); }}
            style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, fontSize: 12, fontWeight: 700, lineHeight: 1, color: open ? "#fff" : C.inkSoft, background: open ? C.blue : C.fill, border: `1px solid ${open ? C.blue : C.line}`, alignSelf: "flex-start", marginTop: 5 }}>i</button>
        )}
      </label>
    );
  }
  function toggle(state, set, key, e) {
    const on = e.target.checked;
    set({ ...state, [key]: on });
    if (game.soundOn) (on ? SND.tick() : SND.untick());
    if (on) addXP(2);
  }
  function Checklist({ items, state, set, color, trail }) {
    const firstOpen = items.find((i) => !state[i.key])?.key;
    return items.map((i) => (
      <Row key={i.key} checked={!!state[i.key]} color={color} highlight={i.key === firstOpen} info={i.info || null} infoKey={i.key}
        onChange={(e) => toggle(state, set, i.key, e)}
        trailing={trail && trail(i) ? <span className="text-[12px] flex-shrink-0" style={{ ...mono, color: C.inkSoft }}>{trail(i)}</span> : null}>
        {i.label}
      </Row>
    ));
  }

  function Gauge({ value, size = 300 }) {
    /* Halvmätare i flyginstrumentstil: grön/gul/orange/röd zon + nål */
    const W = 300, H = 172, cx = 150, cy = 150, R = 118;
    const a = (p) => (-180 + p * 1.8) * Math.PI / 180; // 0..100 → -180..0 grader
    const pt = (p, r) => [cx + r * Math.cos(a(p)), cy + r * Math.sin(a(p))];
    const arc = (p1, p2, r) => {
      const [x1, y1] = pt(p1, r), [x2, y2] = pt(p2, r);
      return `M ${x1} ${y1} A ${r} ${r} 0 ${p2 - p1 > 55 ? 1 : 0} 1 ${x2} ${y2}`;
    };
    const zones = [[0, 25, C.green], [25, 55, "#D9A400"], [55, 80, C.orange], [80, 100, C.red]];
    const [nx, ny] = pt(value, R - 26);
    const vcol = value <= 25 ? C.green : value <= 55 ? "#D9A400" : value <= 80 ? C.orange : C.red;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: size }}>
        {zones.map(([p1, p2, col]) => (
          <path key={p1} d={arc(p1, p2 - 1.2, R)} stroke={col} strokeWidth="15" fill="none" strokeLinecap="butt" opacity="0.92" />
        ))}
        {[0, 25, 55, 80, 100].map((p) => {
          const [tx, ty] = pt(p, R + 15);
          return <text key={p} x={tx} y={ty + 4} textAnchor="middle" fontSize="9.5" style={mono} fill={C.inkSoft}>{p}</text>;
        })}
        {/* Nål */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={C.ink} strokeWidth="3.5" strokeLinecap="round"
          style={{ transition: "all .1s linear" }} />
        <circle cx={cx} cy={cy} r="9" fill={C.ink} />
        <circle cx={cx} cy={cy} r="4" fill={C.card} />
        {/* Värdet */}
        <text x={cx} y={cy - 38} textAnchor="middle" fontSize="44" fontWeight="800" style={SF} fill={vcol}>{value}</text>
        <text x={cx} y={cy - 22} textAnchor="middle" fontSize="11" style={SF} fill={C.inkSoft}>/ 100</text>
      </svg>
    );
  }

  function CheeseBoard() {
    /* Barriärdiagram: fyra sköldar, hål = dina kryss, pil = dagens hot.
       Pilen stoppas av första intakta barriären – eller tar sig igenom om alla läcker. */
    const W = 380, H = 168, AY = 74;
    const BX = (i) => 34 + i * 88, BW = 48, BH = 118, BY = 12;
    const holdIdx = model.layers.findIndex((l) => l.pen <= 0.4);
    const breached = model.aligned;
    const arrowEndX = breached ? W - 16 : holdIdx === -1 ? W - 16 : BX(holdIdx) + 4;
    const caption = {
      sv: "Varje sköld är en barriär mellan dig och ett haveri. Dina kryss öppnar hål. Pilen är dagens hot – den stoppas av första intakta barriären, men radar hålen upp sig går den hela vägen igenom.",
      en: "Each shield is a barrier between you and an accident. Your checks open holes. The arrow is today's threat – it is stopped by the first intact barrier, but if the holes line up it goes all the way through.",
      de: "Jeder Schild ist eine Barriere zwischen dir und einem Unfall. Deine Kreuze öffnen Löcher. Der Pfeil ist die heutige Gefahr – die erste intakte Barriere stoppt ihn, doch wenn sich die Löcher überlappen, geht er ganz durch.",
    }[lang];
    return (
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: 560 }}>
          {model.layers.map((l, i) => {
            const x = BX(i);
            const holes = Math.max(0, Math.round(l.pen * 4));
            const holding = !breached && holdIdx === i;
            return (
              <g key={l.id}>
                <rect x={x} y={BY} width={BW} height={BH} rx="13"
                  fill={l.color + "26"} stroke={l.color} strokeWidth={holding ? 2.5 : 1.5} />
                {Array.from({ length: holes }).map((_, h) => {
                  const cy = breached ? AY + (h - (holes - 1) / 2) * 5
                    : BY + 22 + ((h * 37 + i * 19) % (BH - 44));
                  const cx = breached ? x + BW / 2 : x + 14 + ((h * 13 + i * 7) % (BW - 28));
                  const r = 5 + l.pen * 7;
                  return <circle key={h} cx={cx} cy={cy} r={r} fill={C.card} stroke={l.color + "55"} strokeWidth="1" />;
                })}
                {holding && (
                  <g>
                    <circle cx={x + 4} cy={AY} r="7" fill={l.color} />
                    <text x={x + 4} y={AY + 3.5} textAnchor="middle" fontSize="9" fill="#fff" fontWeight="700">✕</text>
                  </g>
                )}
                <text x={x + BW / 2} y={BY + BH + 16} textAnchor="middle" fontSize="9.5" style={SF} fill={l.color} fontWeight="700">
                  {l.name.split(" ")[0].toUpperCase()}
                </text>
                <text x={x + BW / 2} y={BY + BH + 28} textAnchor="middle" fontSize="9" style={{ ...mono }} fill={C.inkSoft}>
                  {Math.round(l.pen * 100)} %
                </text>
              </g>
            );
          })}
          <line x1="6" y1={AY} x2={arrowEndX - 8} y2={AY}
            stroke={breached ? C.red : C.orange} strokeWidth="4" strokeDasharray="10 7" strokeLinecap="round">
            {breached && <animate attributeName="stroke-dashoffset" from="34" to="0" dur="0.8s" repeatCount="indefinite" />}
          </line>
          <polygon points={`${arrowEndX - 9},${AY - 7} ${arrowEndX + 3},${AY} ${arrowEndX - 9},${AY + 7}`} fill={breached ? C.red : C.orange} />
          <circle cx="6" cy={AY} r="5" fill={breached ? C.red : C.orange} />
          {breached && (
            <text x={W - 8} y={AY + 5} textAnchor="end" fontSize="14">💥</text>
          )}
        </svg>
        <p className="text-[12px] mt-1 px-1" style={{ color: C.inkSoft }}>{caption}</p>
      </div>
    );
  }

  const TABS = [["fly", T.tabs.fly, "🛫"], ["more", T.tabs.more, "⋯"]];
  const title = tab === "fly" ? T.titles.fly : T.titles[moreView];
  const S = STEP_DEF[step];
  const ST = T.steps[step];
  const imsafeItems = IMSAFE_KEYS.map((k) => ({ key: k, label: T.imsafe.items[k][0], target: T.imsafe.items[k][1], info: T.imsafe.items[k][2] }));
  const legalItems = LEGAL_DEF.map((d) => ({ ...d, label: T.brief.legal[d.key] }));
  const preItems = PREFLIGHT_KEYS.map((k) => ({ key: k, label: T.brief.pre[k][0], info: T.brief.pre[k][1], ref: PREFLIGHT_REF[k] || "" }));
  const langNames = { sv: "Svenska", en: "English", de: "Deutsch" };
  const langMeta = { sv: ["🇸🇪", "Svenska"], en: ["🇬🇧", "English"], de: ["🇩🇪", "Deutsch"] };

  /* ===== ADMIN (imsafe.se/admin) ===== */
  if (isAdmin) {
    const ev = readEvents();
    const days = {};
    ev.forEach((x) => { days[x.d] = days[x.d] || { visit: 0, assess: 0, go: 0, nogo: 0 }; days[x.d][x.e] = (days[x.d][x.e] || 0) + 1; });
    const dates = Object.keys(days).sort().reverse().slice(0, 30);
    const tot = (e) => ev.filter((x) => x.e === e).length;
    const maxDay = Math.max(1, ...dates.map((d) => days[d].visit + days[d].assess));
    return (
      <div className="min-h-screen" style={{ background: C.bg, color: C.ink, padding: 20, ...SF }}>
        <div className="max-w-2xl mx-auto pt-6">
          <div className="flex items-center gap-2 mb-6">
            <svg width="30" height="30" viewBox="0 0 30 30"><rect width="30" height="30" rx="9" fill="#0B5CD6" /><path d="M7.5 16 L12.5 21 L22.5 9" stroke="#fff" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <h1 className="text-[24px] font-bold">imsafe · admin</h1>
          </div>
          {!adminOk ? (
            <Card>
              <div className="p-5">
                <p className="text-[15px] font-semibold mb-2">Lösenord</p>
                <input type="password" style={inputF()} value={adminPw} onChange={(e) => setAdminPw(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && adminPw === "455bd6dd52" && setAdminOk(true)} />
                <button className="w-full mt-2 py-3 rounded-xl font-semibold text-white" style={{ background: C.grad }}
                  onClick={() => adminPw === "455bd6dd52" && setAdminOk(true)}>Logga in</button>
                <p className="text-[12px] mt-3" style={{ color: C.inkSoft }}>Obs: enkelt skydd mot nyfikna – känslig data ska aldrig ligga här.</p>
              </div>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[["Besök", tot("visit"), C.blue], ["Bedömn.", tot("assess"), C.indigo], ["GO", tot("go"), C.green], ["NO-GO", tot("nogo"), C.purple]].map(([l, v, col]) => (
                  <Card key={l} style={{ marginBottom: 0 }}>
                    <div className="p-3 text-center">
                      <p className="text-[22px] font-bold" style={{ color: col }}>{v}</p>
                      <p className="text-[12px] font-semibold" style={{ color: C.inkSoft }}>{l}</p>
                    </div>
                  </Card>
                ))}
              </div>
              <Card>
                <CardHead title="Per dag (30 senaste)" sub="Besök + bedömningar" />
                <div className="px-4 pb-4 space-y-1.5">
                  {dates.length === 0 && <p className="text-[13px]" style={{ color: C.inkSoft }}>Inga händelser ännu.</p>}
                  {dates.map((d) => (
                    <div key={d} className="flex items-center gap-2">
                      <span className="text-[12px]" style={{ ...mono, color: C.inkSoft, width: 78 }}>{d}</span>
                      <div className="flex-1 h-4 rounded-md overflow-hidden flex" style={{ background: C.fill }}>
                        <div style={{ width: `${(days[d].visit / maxDay) * 100}%`, background: C.blue }} />
                        <div style={{ width: `${(days[d].assess / maxDay) * 100}%`, background: C.indigo }} />
                      </div>
                      <span className="text-[12px]" style={{ ...mono, color: C.inkSoft, width: 110, textAlign: "right" }}>
                        {days[d].visit}b · {days[d].assess}bed · {days[d].go || 0}go · {days[d].nogo || 0}no
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <p className="text-[13px] font-semibold mb-1">ℹ️ Vad visas här?</p>
                  <p className="text-[12px]" style={{ color: C.ink2 }}>
                    Statistiken ovan är från DEN HÄR enhetens webbläsare (ingen central databas ännu – appen sparar allt lokalt hos varje användare, per designval).
                    Global trafik (alla besökare, länder, enheter, per datum) finns i Vercel → ditt projekt → fliken Analytics.
                    Vill du ha global knapp-statistik här på /admin krävs en liten gratis databas (Supabase) – säg till så bygger vi det som nästa steg.
                  </p>
                </div>
              </Card>
              <button className="w-full py-3 rounded-xl font-semibold mb-8" style={{ background: C.card, color: C.blue }}
                onClick={() => (window.location.href = "/")}>← Till appen</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.ink, paddingBottom: 96, ...SF }}>
      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        @keyframes imsafeFall { to { transform: translateY(105vh) rotate(720deg); opacity: 0.9; } }
        @keyframes imsafePop { from { transform: translateX(-50%) scale(0.7); opacity: 0; } to { transform: translateX(-50%) scale(1); opacity: 1; } }
        @keyframes imsafeReveal { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes imsafeSlide { from { transform: translateX(18px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes imsafePopIn { from { transform: translateY(-6px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
        @keyframes imsafeHello { 0% { opacity: 0; transform: translateY(16px) scale(0.97); } 14% { opacity: 1; transform: translateY(0) scale(1); } 86% { opacity: 1; } 100% { opacity: 1; } }
        @keyframes imsafeFloat { from { transform: translateY(0) translateX(0); } to { transform: translateY(26px) translateX(-14px); } }
        @media (prefers-reduced-motion: reduce) { * { animation:none!important; transition:none!important; } }
        @media print {
          body * { visibility: hidden; }
          #${printMode === "minima" ? "lathund" : "report"}, #${printMode === "minima" ? "lathund" : "report"} * { visibility: visible; }
          #${printMode === "minima" ? "lathund" : "report"} { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
        }
      `}</style>

      <Confetti show={confetti} />
      <Toast toast={toast} />

      {/* ===== Intro-overlay (första besöket) ===== */}
      {!seenIntro && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "linear-gradient(160deg,#0B5CD6 0%,#4F46E5 60%,#3B2FA8 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, overflow: "hidden" }}>
          <div style={{ position: "absolute", width: 340, height: 340, borderRadius: "50%", background: "rgba(255,255,255,0.07)", top: -90, right: -110, filter: "blur(2px)", animation: "imsafeFloat 9s ease-in-out infinite alternate" }} />
          <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", background: "rgba(255,255,255,0.05)", bottom: -70, left: -90, animation: "imsafeFloat 11s ease-in-out infinite alternate-reverse" }} />
          <svg width="76" height="76" viewBox="0 0 30 30" style={{ marginBottom: 28, filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.25))", animation: "imsafeHello 0.9s ease-out" }}>
            <rect width="30" height="30" rx="9" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.35)" strokeWidth="0.75" />
            <path d="M7.5 16 L12.5 21 L22.5 9" stroke="#fff" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {!introSplash && (
          <h1 key={helloIdx} className="font-bold" style={{ color: "#fff", fontSize: 40, letterSpacing: "-0.02em", animation: "imsafeHello 2.4s ease-in-out", minHeight: 52, textAlign: "center" }}>
            {["Välkommen", "Welcome", "Willkommen"][helloIdx]}
          </h1>
          )}
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 15, marginTop: 6, textAlign: "center" }}>imsafe.se{introSplash ? "" : " · " + T.onboard.tag}</p>
          {!introSplash && (<>
          <div className="grid grid-cols-3 gap-2" style={{ marginTop: 34, width: "100%", maxWidth: 340 }}>
            {["sv", "en", "de"].map((l) => (
              <button key={l} onClick={() => setLang(l)} className="py-2.5 rounded-xl active:opacity-70"
                style={{ background: lang === l ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.09)", border: lang === l ? "1.5px solid rgba(255,255,255,0.9)" : "1.5px solid rgba(255,255,255,0.2)" }}>
                <span className="block text-[20px] leading-none">{langMeta[l][0]}</span>
                <span className="block text-[12px] font-semibold mt-1" style={{ color: "#fff" }}>{langMeta[l][1]}</span>
              </button>
            ))}
          </div>
          <button onClick={() => { setSeenIntro(true); setSeenIntroEver(true); if (game.soundOn) SND.step(); }}
            className="active:opacity-70" style={{ marginTop: 14, width: "100%", maxWidth: 340, padding: "14px 0", borderRadius: 16, background: "#fff", color: "#0B5CD6", fontSize: 16, fontWeight: 700, boxShadow: "0 10px 26px rgba(0,0,0,0.25)" }}>
            {T.onboard.start}
          </button>
          </>)}
        </div>
      )}

      {/* ===== Header ===== */}
      <header className="px-5 pt-5 pb-2 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-2 active:opacity-60" onClick={() => { setTab("fly"); goStep(0); }} title="Till start">
            <svg width="30" height="30" viewBox="0 0 30 30" style={{ flexShrink: 0 }}>
              <defs>
                <linearGradient id="imLogoGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={night ? "#4D8DF0" : "#0B5CD6"} />
                  <stop offset="100%" stopColor={night ? "#7B74F0" : "#4F46E5"} />
                </linearGradient>
              </defs>
              <rect width="30" height="30" rx="9" fill="url(#imLogoGrad)" />
              {/* Bocken som lyfter: check vars övre streck blir en stigande flygbana */}
              <path d="M7.5 16 L12.5 21 L22.5 9" stroke="#fff" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="9.5" cy="10" r="1.1" fill="rgba(255,255,255,0.5)" />
              <circle cx="13" cy="8" r="0.8" fill="rgba(255,255,255,0.35)" />
            </svg>
            <span className="text-[17px] font-bold" style={{ letterSpacing: "-0.02em", color: C.ink }}>imsafe<span style={{ color: C.blue }}>.se</span></span>
          </button>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-full text-[15px]" style={{ background: night ? C.gold + "28" : C.fill }}
              title={T.night} onClick={() => { setNight(!night); if (game.soundOn) SND.tick(); }}>{night ? "☀️" : "🌙"}</button>
            <div style={{ position: "relative" }}>
              <button className="w-8 h-8 rounded-full text-[15px]" style={{ background: langMenuOpen ? C.blue + "22" : C.fill }}
                title="Language" onClick={() => { setLangMenuOpen(!langMenuOpen); if (game.soundOn) SND.tick(); }}>🌐</button>
              {langMenuOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setLangMenuOpen(false)} />
                  <div className="rounded-2xl overflow-hidden" style={{ position: "absolute", top: 38, right: -8, zIndex: 50, minWidth: 168,
                    background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, animation: "imsafePopIn .15s ease-out" }}>
                    {["sv", "en", "de"].map((l) => (
                      <button key={l} className="w-full flex items-center gap-2.5 px-3.5 py-3 active:opacity-60 text-left"
                        style={{ background: lang === l ? C.blue + "10" : "transparent", borderTop: l !== "sv" ? `0.5px solid ${C.line}` : "none" }}
                        onClick={() => { setLang(l); setLangMenuOpen(false); if (game.soundOn) SND.tick(); }}>
                        <span className="text-[18px]">{langMeta[l][0]}</span>
                        <span className="flex-1 text-[15px] font-semibold" style={{ color: lang === l ? C.blue : C.ink }}>{langMeta[l][1]}</span>
                        {lang === l && <span style={{ color: C.blue, fontWeight: 700 }}>✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button className="w-8 h-8 rounded-full text-[15px]" style={{ background: C.fill }}
              title="Reset" onClick={() => {
                const msg = { sv: "Nollställa hela genomgången?", en: "Reset the entire walkthrough?", de: "Gesamten Durchgang zurücksetzen?" }[lang];
                if (!window.confirm(msg)) return;
                setRisks({}); setImsafe({}); setLegal({}); setPre({}); setWalk({});
                setAssessed(false); setDecision(null); setShownPct(null); setStep(0);
                celebrated.current = {};
                showToast("↺", { sv: "Nollställd – ny genomgång", en: "Reset – fresh walkthrough", de: "Zurückgesetzt – neuer Durchgang" }[lang]);
                if (game.soundOn) SND.tick();
              }}>↺</button>
            <button className="w-8 h-8 rounded-full text-[15px]" style={{ background: C.fill }}
              onClick={() => setGame((g) => ({ ...g, soundOn: !g.soundOn }))}>{game.soundOn ? "🔊" : "🔇"}</button>
          </div>
        </div>
        <p className="text-[13px] font-medium mt-3" style={{ color: C.inkSoft }}>
          {tab === "fly" ? `${greeting} · ` : ""}{new Date().toLocaleDateString(T.locale, { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="text-[32px] font-bold tracking-tight leading-tight">{title}</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4">

        {/* ================= FLYG ================= */}
        {tab === "fly" && (
          <div>
            {/* Stöd-nudge efter flitig användning */}
            {lang === "sv" && uses >= 5 && !nudgeGone && seenIntro && (
              <Card style={{ background: `linear-gradient(135deg, ${C.blue}0E, ${C.indigo}06)` }}>
                <div className="p-3.5 flex items-center gap-3">
                  <img src={EDWIN_IMG} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  <p className="flex-1 text-[13px]" style={{ color: C.ink2 }}>
                    {uses} genomgångar gjorda. imsafe byggs och drivs av en pilot – vill du hålla appen gratis och reklamfri? <button className="font-bold underline" style={{ color: C.blue }} onClick={() => { setTab("more"); setMoreView("support"); }}>Stöd utvecklingen</button>
                  </p>
                  <button className="text-[13px] font-bold px-2" style={{ color: C.inkSoft }} onClick={() => setNudgeGone(true)}>✕</button>
                </div>
              </Card>
            )}

            {/* Stegvisare */}
            <div className="flex items-center mb-4 px-1">
              {STEP_DEF.map((s, i) => (
                <React.Fragment key={s.id}>
                  <button onClick={() => goStep(i)} className="flex flex-col items-center gap-1 active:opacity-60" style={{ minWidth: 52 }}>
                    <span className="w-10 h-10 rounded-full flex items-center justify-center text-[17px]"
                      style={{
                        background: step === i ? C[s.colorKey] : stepDone[i] ? C[s.colorKey] + "22" : C.card,
                        border: step === i ? "none" : `1.5px solid ${stepDone[i] ? C[s.colorKey] : C.line}`,
                        boxShadow: step === i ? `0 4px 12px ${C[s.colorKey]}55` : "none",
                        transition: "all .25s", filter: step === i ? "none" : stepDone[i] ? "none" : "grayscale(0.6)",
                      }}>
                      {stepDone[i] && step !== i ? <span style={{ color: C[s.colorKey], fontWeight: 700 }}>✓</span> : s.icon}
                    </span>
                    <span className="text-[10px] font-semibold" style={{ color: step === i ? C[s.colorKey] : C.inkSoft }}>{T.steps[i].name}</span>
                  </button>
                  {i < STEP_DEF.length - 1 && (
                    <div className="flex-1 h-[2px] mx-0.5 mb-4 rounded-full" style={{ background: stepDone[i] ? C[STEP_DEF[i].colorKey] : C.line, transition: "background .3s" }} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Stegets fråga (animeras vid stegbyte) */}
            <div key={step + lang} style={{ animation: "imsafeSlide .25s ease-out" }}>
              <Card style={{ background: `linear-gradient(135deg, ${C[S.colorKey]}10, transparent)`, borderLeft: `3px solid ${C[S.colorKey]}` }}>
                <div className="px-4 py-3.5">
                  <p className="text-[15px] font-semibold">{ST.q}</p>
                </div>
              </Card>

              {/* --- STEG 0 --- */}
              {step === 0 && (
                <Card>
                  <CardHead title={T.imsafe.title} sub={imsafePct === 1 ? T.imsafe.subDone : T.imsafe.subTodo} right={<Ring pct={imsafePct} color={C.purple} />} />
                  {/* Bokstäverna tänds i takt med att man bockar */}
                  <div className="flex justify-center gap-1.5 px-4 pb-3">
                    {IMSAFE_KEYS.map((k, i) => (
                      <span key={k + (imsafe[k] ? "1" : "0")}
                        className="flex items-center justify-center font-bold"
                        style={{ width: 40, height: 44, borderRadius: 12, fontSize: 21,
                          background: imsafe[k] ? C.purple : C.fill,
                          color: imsafe[k] ? "#fff" : C.inkSoft,
                          border: imsafe[k] ? "none" : `1.5px solid ${C.line}`,
                          animation: imsafe[k] ? "imsafePopIn .25s ease-out" : "none",
                          transition: "all .2s" }}>
                        {"IMSAFE"[i]}
                      </span>
                    ))}
                  </div>
                  <Checklist items={imsafeItems} state={imsafe} set={setImsafe} color={C.purple} trail={(i) => i.target} />
                </Card>
              )}

              {/* --- STEG 1 --- */}
              {step === 1 && (
                <Card>
                  <CardHead title={T.riskStep.title} sub={T.riskStep.sub} />
                  {BARRIER_DEF.map((b) => {
                    const n = b.factors.filter((f) => effRisks[f.key]).length;
                    const open = expandedBarrier === b.id;
                    const col = C[b.colorKey];
                    return (
                      <div key={b.id}>
                        <button className="w-full flex items-center gap-3 px-4 py-3 active:opacity-60"
                          style={{ borderTop: `0.5px solid ${C.line}`, background: open ? col + "08" : "transparent" }}
                          onClick={() => setExpandedBarrier(open ? null : b.id)}>
                          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-[15px]" style={{ background: col + "16" }}>{b.icon}</span>
                          <span className="flex-1 text-left">
                            <span className="block text-[15px] font-semibold" style={{ color: C.ink }}>{T.barriers[b.id]}</span>
                            <span className="block text-[12px]" style={{ color: n > 0 ? C.red : C.inkSoft }}>{n > 0 ? T.riskStep.marked(n) : T.riskStep.none}</span>
                          </span>
                          {n > 0 && <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold text-white" style={{ background: C.red }}>{n}</span>}
                          <span style={{ color: "rgba(120,128,140,0.4)", transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }}>›</span>
                        </button>
                        {open && b.factors.map((f) => AUTO_INFO[f.key] ? (
                          /* Statusrad (ej kryssbar): grön bock när IMSAFE är klar, varning annars */
                          <button key={f.key} className="w-full flex items-center gap-3 px-4 active:opacity-60 text-left"
                            style={{ paddingTop: 16, paddingBottom: 16, borderTop: `0.5px solid ${C.line}`,
                              background: effRisks[f.key] ? C.orange + "10" : C.green + "0C" }}
                            onClick={() => goStep(AUTO_INFO[f.key].go)}>
                            <span style={{ width: 29, height: 29, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                              background: effRisks[f.key] ? C.orange : C.green }}>
                              {effRisks[f.key]
                                ? <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>!</span>
                                : <svg width="16" height="16" viewBox="0 0 12 12"><path d="M2 6.5L4.7 9 10 3.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                            </span>
                            <span className="flex-1">
                              <span className="block text-[15px] font-semibold" style={{ color: effRisks[f.key] ? C.orange : C.green }}>
                                {effRisks[f.key] ? T.factors[f.key][0] : { sv: "IMSAFE – helt grön ✓", en: "IMSAFE – all green ✓", de: "IMSAFE – alles grün ✓" }[lang]}
                              </span>
                              <span className="block text-[12px]" style={{ color: C.inkSoft }}>{effRisks[f.key] ? T.riskStep.autoBad : T.riskStep.autoOk}</span>
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0" style={{ background: C.fill, color: C.inkSoft }}>AUTO</span>
                          </button>
                        ) : (
                          <React.Fragment key={f.key}>
                            <Row checked={!!risks[f.key]} color={col} danger info={T.factors[f.key][1]} infoKey={"risk-" + f.key}
                              onChange={(e) => { setRisks({ ...risks, [f.key]: e.target.checked }); if (game.soundOn) (e.target.checked ? SND.tick() : SND.untick()); }}>
                              {T.factors[f.key][0]}
                            </Row>
                            {f.key === "dusk" && risks.dusk && (
                              <div style={{ paddingLeft: 28, background: C.green + "08" }}>
                                <Row checked={!!risks.nightOk} color={C.green} info={T.factors.nightOk[1]} infoKey="risk-nightOk"
                                  onChange={(e) => { setRisks({ ...risks, nightOk: e.target.checked }); if (game.soundOn) (e.target.checked ? SND.tick() : SND.untick()); }}>
                                  {T.factors.nightOk[0]}
                                </Row>
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    );
                  })}
                  <div className="px-4 pt-3 pb-1" style={{ borderTop: `0.5px solid ${C.line}` }}>
                    <p className="text-[12px] font-semibold mb-1" style={{ color: C.inkSoft }}>
                      {{ sv: "TEM – ÖVRIGA HOT (FRIVILLIGT)", en: "TEM – OTHER THREATS (OPTIONAL)", de: "TEM – WEITERE GEFAHREN (OPTIONAL)" }[lang]}
                    </p>
                    <textarea style={{ ...inputF(), minHeight: 52 }} value={temNotes} onChange={(e) => setTemNotes(e.target.value)}
                      placeholder={{ sv: "T.ex. mycket skoltrafik, ovan passagerare, tidig start…", en: "E.g. busy circuit, unfamiliar passenger, early start…", de: "Z.B. viel Platzverkehr, unerfahrener Passagier, früher Start…" }[lang]} />
                  </div>
                  <p className="text-[12px] px-4 py-3" style={{ color: C.inkSoft }}>{T.riskStep.foot}</p>
                </Card>
              )}

              {/* --- STEG 2 --- */}
              {step === 2 && (
                <>
                  <Card>
                    <CardHead title={T.brief.legalTitle} sub={T.brief.legalSub} right={<Ring pct={legalPct} color={C.indigo} />} />
                    <Checklist items={legalItems} state={legal} set={setLegal} color={C.indigo} trail={(i) => i.ref} />
                  </Card>
                  <Card>
                    <CardHead title={T.brief.preTitle} sub={T.brief.preSub} right={<Ring pct={prePct} color={C.blue} />} />
                    <Checklist items={preItems} state={pre} set={setPre} color={C.blue} trail={(i) => i.ref} />
                  </Card>
                </>
              )}

              {/* --- STEG 3 --- */}
              {step === 3 && (
                <Card>
                  <CardHead title={T.walk.title} sub={walkPct === 1 ? T.walk.subDone : T.walk.subTodo} right={<Ring pct={walkPct} color={C.green} />} />
                  {walkPct < 1 && (
                    <div className="px-4 pb-1">
                      <button className="w-full py-2.5 rounded-xl text-[15px] font-semibold active:opacity-60"
                        style={{ background: C.green + "12", color: C.green, border: `1.5px solid ${C.green}40` }}
                        onClick={() => {
                          const all = {};
                          WALK_DEF.forEach((g) => g.keys.forEach((k) => { all[k] = true; }));
                          setWalk(all);
                          if (game.soundOn) SND.step();
                          showToast("✓", { sv: "Walkaround markerad som gjord", en: "Walkaround marked as done", de: "Walkaround als erledigt markiert" }[lang]);
                        }}>
                        {{ sv: "✓ Redan gjord enligt POH – bocka allt", en: "✓ Already done per POH – check all", de: "✓ Bereits nach POH erledigt – alles abhaken" }[lang]}
                      </button>
                    </div>
                  )}
                  {WALK_DEF.map((g) => (
                    <div key={g.id}>
                      <div className="flex items-center gap-2 px-4 py-2" style={{ background: C.fill }}>
                        <span className="text-[15px]">{g.icon}</span>
                        <span className="text-[13px] font-semibold uppercase tracking-wide flex-1" style={{ color: C[g.colorKey] }}>{T.walk.groups[g.id]}</span>
                        <span className="text-[12px]" style={{ ...mono, color: C.inkSoft }}>{g.keys.filter((k) => walk[k]).length}/{g.keys.length}</span>
                      </div>
                      <Checklist items={g.keys.map((k) => ({ key: k, label: T.walk.items[k][0], info: T.walk.items[k][1] }))} state={walk} set={setWalk} color={C[g.colorKey]} />
                    </div>
                  ))}
                  <p className="text-[12px] px-4 py-3" style={{ color: C.inkSoft }}>{T.walk.poh}</p>
                </Card>
              )}

              {/* --- STEG 4 --- */}
              {step === 4 && (
                <>
                  {lastAssessment && !assessed && (
                    <p className="text-[12px] text-center mb-3" style={{ color: C.inkSoft }}>
                      {T.decide.last(lastAssessment, lastAssessment.decision ? (lastAssessment.decision === "nogo" ? T.decide.lastNogo : T.decide.lastGo) : "")}
                    </p>
                  )}
                  {!assessed && (
                  <Card>
                    <CardHead title={T.decide.basisTitle} sub={T.decide.basisSub} />
                    <div className="px-4 pb-4 grid grid-cols-4 gap-2 text-center">
                      {[[T.decide.cols[0], imsafePct, C.purple], [T.decide.cols[1], null, C.blue], [T.decide.cols[2], briefPct, C.indigo], [T.decide.cols[3], walkPct, C.green]].map(([k, p, col]) => (
                        <div key={k} className="flex flex-col items-center">
                          {p === null
                            ? <div style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: `5px solid ${model.active.length ? col : "rgba(120,128,140,0.15)"}`, color: model.active.length ? col : C.inkSoft, fontSize: 15, fontWeight: 700, boxSizing: "border-box" }}>{model.active.length}</div>
                            : <Ring pct={p} color={col} />}
                          <p className="text-[12px] mt-1 font-semibold" style={{ color: C.inkSoft }}>
                            {p === null ? `${k} · ${model.active.length} ${T.decide.threats}` : `${k}${p === 1 ? " ✓" : ""}`}
                          </p>
                        </div>
                      ))}
                    </div>
                    {(imsafePct < 1 || briefPct < 1 || walkPct < 1) && (
                      <p className="text-[12px] px-4 pb-3" style={{ color: C.orange }}>{T.decide.incomplete}</p>
                    )}
                  </Card>
                  )}

                  {!assessed ? (
                    <>
                      <button onClick={makeAssessment} className="w-full py-4 rounded-2xl text-[17px] font-bold text-white active:opacity-70 mb-2"
                        style={{ background: C.grad, boxShadow: `0 6px 20px ${C.blue}44` }}>
                        {T.decide.create}
                      </button>
                      <p className="text-[12px] text-center mb-4" style={{ color: C.inkSoft }}>{T.decide.notRealtime}</p>
                    </>
                  ) : (
                    <div style={{ animation: "imsafeReveal .4s ease-out" }}>
                      <Card style={{ background: shownPct !== null ? C.card : `linear-gradient(180deg, ${model.color}14, ${model.color}04)`, border: `1.5px solid ${shownPct !== null ? C.line : model.color}`, transition: "all .3s" }}>
                        <div className="p-4 pt-5">
                          <Gauge value={shownPct !== null ? shownPct : model.riskPct} />
                          <div className="text-center" style={{ marginTop: -6 }}>
                            {shownPct !== null ? (
                              <p className="text-[15px] font-semibold" style={{ color: C.inkSoft }}>{T.decide.weighing}</p>
                            ) : (
                              <>
                                <p className="text-[26px] font-bold tracking-tight" style={{ color: model.color, animation: "imsafeReveal .45s ease-out backwards" }}>{model.verdict}</p>
                                <p className="text-[12px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: C.inkSoft }}>{T.decide.riskLabel} {model.level}</p>
                                <p className="text-[15px] mt-2.5 text-left" style={{ color: C.ink2, animation: "imsafeReveal .45s ease-out .2s backwards" }}>{model.advice}</p>
                              </>
                            )}
                          </div>
                        </div>
                      </Card>

                      {shownPct === null && (<>
                        <Card style={{ border: `1.5px solid ${C.blue}40`, background: `linear-gradient(180deg, ${C.blue}08, transparent)` }}>
                          <CardHead title={T.decide.actionsTitle} sub={model.active.length ? T.decide.actionsSub : T.decide.actionsEmpty} />
                          {model.active.length === 0 ? (
                            <p className="px-4 pb-4 text-[15px]" style={{ color: C.ink2 }}>{T.decide.strongDay}</p>
                          ) : (
                            <>
                              {model.active.slice(0, 5).map((f, idx) => (
                                <div key={f.key} className="px-4 py-3 flex gap-3" style={{ borderTop: `0.5px solid ${C.line}` }}>
                                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0" style={{ background: f.color + "1A", color: f.color }}>{idx + 1}</span>
                                  <div>
                                    <p className="text-[15px] font-semibold">{T.factors[f.key][0]}</p>
                                    <p className="text-[13px] mt-0.5" style={{ color: C.ink2 }}>{f.key === "dusk" && risks.nightOk ? T.factors.nightOk[1] : T.factors[f.key][1]}</p>
                                  </div>
                                </div>
                              ))}
                              {model.active.length > 5 && <p className="px-4 pb-3 text-[12px]" style={{ color: C.inkSoft }}>{T.decide.moreN(model.active.length - 5)}</p>}
                            </>
                          )}
                        </Card>

                        {!decision ? (
                          <>
                          <p className="text-[13px] text-center mb-2 font-medium" style={{ color: C.ink2 }}>
                            {{ sv: "Siffran är ett underlag – du är befälhavare och beslutet är alltid ditt.",
                               en: "The number is guidance – you are pilot in command and the decision is always yours.",
                               de: "Die Zahl ist eine Hilfe – du bist verantwortlicher Pilot und die Entscheidung liegt immer bei dir." }[lang]}
                          </p>
                          <div className="grid grid-cols-2 gap-2 mb-4">
                            <button onClick={() => decide("go")} disabled={model.riskPct > 80 || model.imsafeBlock}
                              className="py-3.5 rounded-2xl text-[17px] font-bold text-white active:opacity-70"
                              style={{ background: C.green, opacity: model.riskPct > 80 || model.imsafeBlock ? 0.35 : 1 }}>
                              {T.decide.fly}
                            </button>
                            <button onClick={() => decide("nogo")} className="py-3.5 rounded-2xl text-[17px] font-bold active:opacity-70" style={{ background: night ? "#39424E" : C.ink, color: night ? "#E9EDF3" : "#fff" }}>
                              {T.decide.abstain}
                            </button>
                          </div>
                          </>
                        ) : (
                          <Card style={{ border: `1.5px solid ${decision === "nogo" ? C.purple : C.green}` }}>
                            <div className="p-4 text-center">
                              <p className="text-[17px] font-bold" style={{ color: decision === "nogo" ? C.purple : C.green }}>
                                {(decision === "nogo" ? T.decide.decidedNogo : T.decide.decidedGo)[0]}
                              </p>
                              <p className="text-[13px] mt-1" style={{ color: C.inkSoft }}>
                                {(decision === "nogo" ? T.decide.decidedNogo : T.decide.decidedGo)[1]}
                              </p>
                            </div>
                          </Card>
                        )}

                        <Card>
                        <div className="px-4 py-3 flex items-center justify-around">
                          {[[T.decide.cols[0], imsafePct, C.purple], [T.decide.cols[2], briefPct, C.indigo], [T.decide.cols[3], walkPct, C.green]].map(([k, p, col]) => (
                            <div key={k} className="flex items-center gap-1.5">
                              <Ring pct={p} color={col} size={32} />
                              <span className="text-[12px] font-semibold" style={{ color: C.inkSoft }}>{k}</span>
                            </div>
                          ))}
                        </div>
                      </Card>

                      <button onClick={createReport} className="w-full py-3 rounded-2xl text-[15px] font-semibold active:opacity-60 mb-2" style={{ background: C.card, color: C.blue }}>
                          {T.decide.pdf}
                        </button>
                        <button onClick={() => { setRisks({}); setImsafe({}); setLegal({}); setPre({}); setWalk({}); setAssessed(false); setDecision(null); setShownPct(null); setStep(0); celebrated.current = {}; }}
                          className="w-full py-3 rounded-2xl text-[15px] font-semibold active:opacity-60 mb-4" style={{ background: C.card, color: C.red }}>
                          {T.decide.restart}
                        </button>
                      </>)}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Nästa steg */}
            {step < 4 && (
              <button onClick={() => goStep(step + 1)}
                className="w-full py-3.5 rounded-2xl text-[17px] font-bold text-white active:opacity-70 mb-2"
                style={{ background: stepDone[step] ? C[STEP_DEF[step + 1].colorKey] : C.inkSoft }}>
                {stepDone[step] ? T.nextStep(STEP_DEF[step + 1].icon, T.steps[step + 1].name) : T.contAnyway(T.steps[step + 1].name)}
              </button>
            )}
            {step < 4 && !stepDone[step] && (
              <p className="text-[12px] text-center mb-4" style={{ color: C.inkSoft }}>{T.contHint}</p>
            )}

            {/* Dagens tips */}
            <Card style={{ background: `linear-gradient(135deg, ${C.indigo}0C, ${C.blue}06)` }}>
              <div className="p-4 flex gap-3">
                <span className="text-[18px]">💡</span>
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: C.indigo }}>{T.tipTitle}</p>
                  <p className="text-[13px] mt-0.5" style={{ color: C.ink2 }}>{tipOfDay}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ================= MER ================= */}
        {tab === "more" && (
          <>
            {moreView === "menu" ? (
              <Card>
                {[
                  ["links", "☁️", ...T.menu.links, C.blue],
                  ["minima", "📏", { sv: "Skapa mina personliga minima", en: "Create my personal minimums", de: "Meine persönlichen Minima" }[lang], T.menu.minima[1], C.blue],
                  ["guide", "📖", { sv: "Så funkar imsafe", en: "How imsafe works", de: "So funktioniert imsafe" }[lang], { sv: "Metoden bakom de fem stegen", en: "The method behind the five steps", de: "Die Methode hinter den fünf Schritten" }[lang], C.blue],
                  ["stats", "📊", { sv: "Haveristatistik", en: "Accident insights", de: "Unfallstatistik" }[lang], { sv: "Vad statistiken lär oss", en: "What the data teaches us", de: "Was die Daten uns lehren" }[lang], C.blue],
                  ...(lang === "sv" && T.support ? [["support", "💙", ...T.menu.support, C.blue]] : []),
                  ["install", "📲", { sv: "Spara som app", en: "Save as app", de: "Als App speichern" }[lang], { sv: "Lägg imsafe på hemskärmen", en: "Add imsafe to your home screen", de: "imsafe zum Startbildschirm hinzufügen" }[lang], C.blue],
                  ["lang", "🌐", ...T.menu.lang, C.blue],
                ].map(([id, icon, mTitle, mSub, col]) => (
                  <button key={id} onClick={() => id === "lang" ? null : setMoreView(id)} className="w-full flex items-center gap-3 px-4 py-3.5 active:opacity-60 text-left"
                    style={{ borderTop: `0.5px solid ${C.line}` }}>
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center text-[17px]" style={{ background: col + "16" }}>{icon}</span>
                    <span className="flex-1">
                      <span className="block text-[15px] font-semibold" style={{ color: C.ink }}>{mTitle}</span>
                      <span className="block text-[12px]" style={{ color: C.inkSoft }}>{mSub}</span>
                    </span>
                    {id === "lang" ? (
                      <span className="flex gap-1">
                        {["sv", "en", "de"].map((l) => (
                          <span key={l} onClick={(e) => { e.stopPropagation(); setLang(l); }}
                            className="flex items-center justify-center rounded-lg cursor-pointer"
                            style={{ width: 36, height: 30, fontSize: 17, background: lang === l ? C.blue + "18" : C.fill,
                              border: lang === l ? `1.5px solid ${C.blue}` : "1.5px solid transparent", opacity: lang === l ? 1 : 0.55 }}>{langMeta[l][0]}</span>
                        ))}
                      </span>
                    ) : <span style={{ color: "rgba(120,128,140,0.4)" }}>›</span>}
                  </button>
                ))}
              </Card>
            ) : (
              <button onClick={() => setMoreView("menu")} className="flex items-center gap-1 mb-3 text-[15px] font-semibold active:opacity-60" style={{ color: C.blue }}>
                {T.menu.back}
              </button>
            )}

            {moreView === "links" && (
              <>
                <Card>
                  <CardHead title={T.links.airportsTitle} sub={T.links.airportsSub} />
                  <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                    <div><p className="text-[12px] font-semibold mb-1" style={{ color: C.inkSoft }}>{T.links.from}</p>
                      <select style={inputF()} value={dep} onChange={(e) => setDep(e.target.value)}>{AIRPORTS.map((a) => <option key={a}>{a}</option>)}</select></div>
                    <div><p className="text-[12px] font-semibold mb-1" style={{ color: C.inkSoft }}>{T.links.to}</p>
                      <select style={inputF()} value={dst} onChange={(e) => setDst(e.target.value)}>{AIRPORTS.map((a) => <option key={a}>{a}</option>)}</select></div>
                  </div>
                </Card>
                <Card>
                  <CardHead title={T.links.metarTitle} sub={`${depIcao} · ${dstIcao}`} />
                  <LinkRow href={`https://metar-taf.com/${depIcao}`} title={`METAR/TAF ${depIcao}`} sub="metar-taf.com" color={C.blue} />
                  <LinkRow href={`https://metar-taf.com/${dstIcao}`} title={`METAR/TAF ${dstIcao}`} sub="metar-taf.com" color={C.blue} />
                  <LinkRow href={`https://aviationweather.gov/data/metar/?ids=${depIcao},${dstIcao}`} title={T.links.raw} sub="aviationweather.gov" color={C.teal} />
                </Card>
                <Card>
                  <CardHead title={T.links.briefTitle} />
                  {T.links.briefRows.map(([href, t2, s2, colKey]) => <LinkRow key={href} href={href} title={t2} sub={s2} color={C[colKey]} />)}
                </Card>
                <Card>
                  <CardHead title={T.links.otherTitle} />
                  {T.links.otherRows.map(([href, t2, s2, colKey]) => <LinkRow key={href} href={href} title={t2} sub={s2} color={C[colKey]} />)}
                </Card>
                {T.links.note && <p className="text-[12px] px-2 mb-4" style={{ color: C.inkSoft }}>{T.links.note}</p>}
              </>
            )}

            {moreView === "minima" && (
              <>
                <Card>
                  <CardHead title={T.minima.title} sub={T.minima.sub} />
                  {MIN_DEF.map((m) => (
                    <div key={m.key} style={{ borderTop: `0.5px solid ${C.line}` }} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[15px] font-medium">{T.minima.labels[m.key][0]} <span style={{ color: C.inkSoft, fontWeight: 400 }}>({m.dir === "max" ? T.minima.max : T.minima.min})</span></span>
                        <Stepper value={minVals[m.key]} min={m.min} max={m.max} step={m.step} unit={m.unit} onChange={(v) => setMinVals({ ...minVals, [m.key]: v })} />
                      </div>
                      {T.minima.labels[m.key][1] && <p className="text-[12px] mt-1" style={{ color: C.inkSoft }}>{T.minima.labels[m.key][1]}</p>}
                    </div>
                  ))}
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: `0.5px solid ${C.line}` }}>
                    <span className="text-[15px] font-medium">{T.minima.surface}</span>
                    <div className="flex gap-1 p-1 rounded-xl" style={{ background: C.fill }}>
                      {[["asfalt", T.minima.surfAsphalt], ["gras", T.minima.surfGrass]].map(([v, l]) => (
                        <button key={v} onClick={() => setSurfaceOk(v)} className="px-3 py-1.5 rounded-lg text-[13px] font-semibold"
                          style={{ background: surfaceOk === v ? C.card : "transparent", color: surfaceOk === v ? C.ink : C.inkSoft, boxShadow: surfaceOk === v ? "0 1px 3px rgba(0,0,0,0.12)" : "none" }}>{l}</button>
                      ))}
                    </div>
                  </div>
                </Card>
                <button className="w-full py-3 rounded-2xl text-[15px] font-semibold active:opacity-60 mb-4"
                  style={{ background: C.card, color: C.blue, border: `1px solid ${C.cardBorder}` }}
                  onClick={() => { setPrintMode("minima"); setTimeout(() => { window.print(); setTimeout(() => setPrintMode("report"), 500); }, 150); }}>
                  {{ sv: "🖶 Skapa lathund (PDF) – för kneeboard eller klubbrummet", en: "🖶 Create cheat sheet (PDF)", de: "🖶 Spickzettel erstellen (PDF)" }[lang]}
                </button>
                <Card>
                  <CardHead title={T.minima.vmcTitle} sub={T.minima.vmcSub} />
                  {T.minima.vmcRows.map((r) => (
                    <div key={r[0]} className="px-4 py-3 flex items-baseline justify-between gap-3" style={{ borderTop: `0.5px solid ${C.line}` }}>
                      <span className="text-[15px] font-medium flex-1">{r[0]}</span>
                      <span className="text-[15px]" style={mono}>{r[1]}</span>
                      <span className="text-[12px] text-right" style={{ color: C.inkSoft, maxWidth: 130 }}>{r[2]}</span>
                    </div>
                  ))}
                  <p className="text-[12px] px-4 py-3" style={{ color: C.inkSoft }}>{T.minima.vmcFoot}</p>
                </Card>
              </>
            )}

            {moreView === "install" && (
              <Card>
                <CardHead title={{ sv: "Spara imsafe som app 📲", en: "Save imsafe as an app 📲", de: "imsafe als App speichern 📲" }[lang]}
                  sub={{ sv: "Egen ikon, fullskärm, blixtsnabb start – ingen App Store behövs", en: "Own icon, full screen, instant start – no App Store needed", de: "Eigenes Icon, Vollbild, sofortiger Start – kein App Store nötig" }[lang]} />
                <div className="px-4 pb-4 space-y-4">
                  {installEvt && (
                    <button className="w-full py-3 rounded-xl font-semibold text-white active:opacity-70" style={{ background: C.grad }}
                      onClick={async () => { installEvt.prompt(); await installEvt.userChoice; setInstallEvt(null); }}>
                      {{ sv: "Installera nu – ett tryck", en: "Install now – one tap", de: "Jetzt installieren – ein Tipp" }[lang]}
                    </button>
                  )}
                  <div>
                    <p className="text-[15px] font-bold mb-1.5">🍎 iPhone / iPad (Safari)</p>
                    {({ sv: ["1. Tryck på Dela-knappen (rutan med pil uppåt)", "2. Skrolla ner → ”Lägg till på hemskärmen”", "3. Tryck ”Lägg till” – klart!"],
                       en: ["1. Tap the Share button (square with arrow)", "2. Scroll down → ”Add to Home Screen”", "3. Tap ”Add” – done!"],
                       de: ["1. Tippe auf Teilen (Quadrat mit Pfeil)", "2. Nach unten scrollen → „Zum Home-Bildschirm“", "3. „Hinzufügen“ tippen – fertig!"] }[lang]).map((s) => (
                      <p key={s} className="text-[13px] py-0.5" style={{ color: C.ink2 }}>{s}</p>
                    ))}
                  </div>
                  <div>
                    <p className="text-[15px] font-bold mb-1.5">🤖 Android (Chrome)</p>
                    {({ sv: ["1. Tryck på menyn ⋮ uppe till höger", "2. Välj ”Lägg till på startskärmen” eller ”Installera app”", "3. Bekräfta – klart!"],
                       en: ["1. Tap the ⋮ menu top right", "2. Choose ”Add to Home screen” or ”Install app”", "3. Confirm – done!"],
                       de: ["1. Tippe auf das ⋮-Menü oben rechts", "2. „Zum Startbildschirm“ oder „App installieren“ wählen", "3. Bestätigen – fertig!"] }[lang]).map((s) => (
                      <p key={s} className="text-[13px] py-0.5" style={{ color: C.ink2 }}>{s}</p>
                    ))}
                  </div>
                </div>
              </Card>
            )}

                        {moreView === "guide" && (
              <Card>
                <CardHead title={{ sv: "Så funkar imsafe", en: "How imsafe works", de: "So funktioniert imsafe" }[lang]} />
                <div className="px-4 pb-4 space-y-3">
                  {({
                    sv: [
                      ["🧍 Piloten", "IMSAFE är ICAO:s självkontroll: Illness, Medication, Stress, Alcohol, Fatigue, Eating. Är du inte grön här spelar resten mindre roll – därför börjar allt med dig."],
                      ["🌤 Risker", "Kryssa ärligt i det som stämmer idag. Faktorerna är viktade efter haveristatistik – väder nära minima väger tyngre än en ny flygplats. TEM-rutan fångar det som inte står i listan."],
                      ["📋 Briefing", "Legalt (certifikat, medical, 90-dagarsregeln) och planering (NOTAM, väder, bränsle, massa & balans). Punkterna följer EASA Part-NCO."],
                      ["🛩 Planet", "Generisk walkaround i tre grupper: vätskor, elektronik, skick. Typens POH-checklista har alltid företräde."],
                      ["⚖️ Beslut", "Modellen bygger på Swiss cheese: varje område är en barriär, dina kryss öppnar hål, och när hålen radar upp sig släpps hotet igenom. Siffran är ett underlag – befälhavaren bestämmer."],
                      ["📏 Minima", "Dina personliga gränser är starkare än lagens. Sätt dem i lugn och ro hemma – och håll dem heliga vid planet."],
                    ],
                    en: [
                      ["🧍 Pilot", "IMSAFE is ICAO's self-check: Illness, Medication, Stress, Alcohol, Fatigue, Eating. If you are not green here, the rest matters less – that is why everything starts with you."],
                      ["🌤 Risks", "Check honestly what applies today. Factors are weighted by accident statistics – weather near minimums weighs more than an unfamiliar airfield. The TEM box catches what the list misses."],
                      ["📋 Briefing", "Legal (licence, medical, 90-day rule) and planning (NOTAM, weather, fuel, mass & balance). Items follow EASA Part-NCO."],
                      ["🛩 Aircraft", "Generic walkaround in three groups: fluids, electrics, condition. Your type's POH checklist always takes precedence."],
                      ["⚖️ Decision", "The model is Swiss cheese: each area is a barrier, your checks open holes, and when holes line up the threat gets through. The number is guidance – the pilot in command decides."],
                      ["📏 Minimums", "Your personal limits are stronger than the law's. Set them calmly at home – and keep them sacred at the aircraft."],
                    ],
                    de: [
                      ["🧍 Pilot", "IMSAFE ist die ICAO-Selbstkontrolle: Illness, Medication, Stress, Alcohol, Fatigue, Eating. Bist du hier nicht grün, zählt der Rest weniger – deshalb beginnt alles bei dir."],
                      ["🌤 Risiken", "Kreuze ehrlich an, was heute zutrifft. Die Faktoren sind nach Unfallstatistik gewichtet. Das TEM-Feld fängt auf, was die Liste nicht abdeckt."],
                      ["📋 Briefing", "Rechtliches (Lizenz, Medical, 90-Tage-Regel) und Planung (NOTAM, Wetter, Kraftstoff, Masse & Schwerpunkt) nach EASA Part-NCO."],
                      ["🛩 Flugzeug", "Generischer Walkaround in drei Gruppen: Flüssigkeiten, Elektrik, Zustand. Die POH-Checkliste des Musters hat immer Vorrang."],
                      ["⚖️ Entscheidung", "Das Modell ist Swiss Cheese: jeder Bereich eine Barriere, deine Kreuze öffnen Löcher – überlappen sie sich, kommt die Gefahr durch. Die Zahl ist Hilfe – der verantwortliche Pilot entscheidet."],
                      ["📏 Minima", "Deine persönlichen Grenzen sind stärker als das Gesetz. Lege sie zuhause fest – und halte sie am Flugzeug heilig."],
                    ],
                  })[lang].map(([h, t]) => (
                    <div key={h}>
                      <p className="text-[15px] font-bold">{h}</p>
                      <p className="text-[13px] mt-0.5" style={{ color: C.ink2 }}>{t}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

                        {moreView === "news" && (
              <Card>
                <CardHead title={T.news.title} sub={{ sv: "Mentour Pilot, Haverikommissionen, EASA m.fl. – hämtas live", en: "Mentour Pilot, EASA, NTSB and more – fetched live", de: "Mentour Pilot, EASA, BFU u.a. – live geladen" }[lang]} />
                <div className="px-4 pb-4">
                  <button onClick={fetchNews} disabled={news.status === "loading"} className="w-full py-3 rounded-xl text-[15px] font-semibold text-white active:opacity-70"
                    style={{ background: C.blue, opacity: news.status === "loading" ? 0.6 : 1 }}>
                    {news.status === "loading" ? T.news.loading : T.news.btn}
                  </button>
                  {news.text && <div className="mt-3 rounded-xl p-3 text-[13px] whitespace-pre-wrap" style={{ background: C.fill, color: C.ink2 }}>{news.text}</div>}
                </div>
              </Card>
            )}

            {moreView === "blog" && (
              <>
                <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
                  {T.blog.cats.map((c, i) => (
                    <button key={c} onClick={() => setBlogCat(i)} className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap"
                      style={{ background: blogCat === i ? C.ink : C.card, color: blogCat === i ? C.bg : C.inkSoft }}>{c}</button>
                  ))}
                </div>
                {blogPosts.filter((p) => blogCat === 0 || p.cat === T.blog.cats[blogCat]).map((p) => (
                  <Card key={p.id}>
                    <div className="p-4">
                      <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: C.blue }}>
                        <span className="px-2 py-0.5 rounded-full" style={{ background: C.blue + "14" }}>{p.cat}</span>
                        <span style={{ color: C.inkSoft, fontWeight: 400 }}>{p.date} · {p.read}</span>
                      </div>
                      <h3 className="text-[17px] font-bold mt-1.5 leading-snug">{p.title}</h3>
                      <p className="text-[13px] mt-1" style={{ color: C.inkSoft }}>{p.excerpt}</p>
                    </div>
                  </Card>
                ))}
                {!showDraft ? (
                  <button onClick={() => setShowDraft(true)} className="w-full py-3 rounded-2xl text-[15px] font-semibold active:opacity-60 mb-4" style={{ background: C.card, color: C.blue }}>{T.blog.newBtn}</button>
                ) : (
                  <Card>
                    <CardHead title={T.blog.newTitle} />
                    <div className="px-4 pb-4 space-y-2">
                      <input style={inputF()} placeholder={T.blog.phTitle} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                      <select style={inputF()} value={draft.cat} onChange={(e) => setDraft({ ...draft, cat: +e.target.value })}>{T.blog.cats.slice(1).map((c, i) => <option key={c} value={i + 1}>{c}</option>)}</select>
                      <textarea style={{ ...inputF(), minHeight: 80 }} placeholder={T.blog.phExcerpt} value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} />
                      <div className="flex gap-2">
                        <button className="flex-1 py-2.5 rounded-xl font-semibold text-white" style={{ background: C.blue }}
                          onClick={() => { if (!draft.title) return; setPosts([{ id: Date.now(), title: draft.title, excerpt: draft.excerpt, cat: T.blog.cats[draft.cat], date: new Date().toISOString().slice(0, 10), read: "—" }, ...blogPosts]); setDraft({ title: "", cat: 1, excerpt: "" }); setShowDraft(false); }}>{T.blog.publish}</button>
                        <button className="flex-1 py-2.5 rounded-xl font-semibold" style={{ background: C.fill, color: C.inkSoft }} onClick={() => setShowDraft(false)}>{T.blog.cancel}</button>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            )}

            {moreView === "stats" && (
              <Card>
                <CardHead title={{ sv: "Haveristatistik – vad lär den oss?", en: "Accident insights", de: "Unfallstatistik – was lernen wir?" }[lang]} sub={T.stats.sub} />
                {ACC_DEF.map((d) => (
                  <div key={d.key} className="px-4 py-3" style={{ borderTop: `0.5px solid ${C.line}` }}>
                    <span className="text-[15px] font-semibold">{T.stats.cats[d.key][0]}</span>
                    <div className="mt-1.5 space-y-1">
                      <div className="flex items-center gap-2"><div className="h-2.5 rounded-full" style={{ width: `${d.shareFatal * 2.4}%`, minWidth: 8, background: C.blue }} /><span className="text-[12px]" style={{ ...mono, color: C.inkSoft }}>{d.shareFatal} {T.stats.share}</span></div>
                      <div className="flex items-center gap-2"><div className="h-2.5 rounded-full" style={{ width: `${d.lethality * 0.9}%`, minWidth: 8, background: C.red, opacity: 0.85 }} /><span className="text-[12px]" style={{ ...mono, color: C.inkSoft }}>{d.lethality} {T.stats.lethality}</span></div>
                    </div>
                    <p className="text-[12px] mt-1" style={{ color: C.inkSoft }}>{T.stats.cats[d.key][1]}</p>
                  </div>
                ))}
              </Card>
            )}

            {moreView === "support" && lang === "sv" && T.support && (
              <Card>
                <CardHead title={T.support.title} sub={T.support.sub} />
                <div className="px-4 pb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <img src={EDWIN_IMG} alt="Edwin Müller"
                      style={{ width: 68, height: 68, borderRadius: "50%", objectFit: "cover", border: `2.5px solid ${C.blue}`, flexShrink: 0 }} />
                    <div>
                      <p className="text-[15px] font-bold">Edwin Müller, {ageNow()} år</p>
                      <p className="text-[13px] mt-0.5" style={{ color: C.ink2 }}>
                        Privatpilot sedan 2024. imsafe.se började som min egen checklista i mobilen – nu delar jag den för att bidra till flygsäkerheten. Appen är gratis och utan reklam.
                      </p>
                    </div>
                  </div>
                  {/* Swish-nummer + kopiera (deep-links stöds inte längre av Swish) */}
                  <div className="rounded-2xl p-4 text-center" style={{ background: C.fill }}>
                    <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: C.inkSoft }}>Swisha till</p>
                    <p className="text-[26px] font-bold mt-1" style={{ ...mono, color: C.ink, letterSpacing: 1 }}>0708&nbsp;86&nbsp;96&nbsp;97</p>
                    <button className="mt-3 px-5 py-2.5 rounded-xl font-semibold text-white active:opacity-70" style={{ background: C.grad }}
                      onClick={async () => {
                        try { await navigator.clipboard.writeText("0708869697"); showToast("📋", "Nummer kopierat – öppna Swish"); }
                        catch { showToast("⚠️", "Kunde inte kopiera – skriv av numret"); }
                        if (game.soundOn) SND.tick();
                      }}>
                      Kopiera nummer
                    </button>
                  </div>
                  <p className="text-[12px] mt-3" style={{ color: C.inkSoft }}>{T.support.thanks}</p>
                </div>
              </Card>
            )}

          </>
        )}

        <footer className="text-[12px] pb-4 px-2" style={{ color: C.inkSoft }}>{T.footer}</footer>
      </main>

      {/* ===== Bottenflikar ===== */}
      <nav className="fixed bottom-0 left-0 right-0 z-20" style={{ background: C.navGlass, backdropFilter: "blur(20px)", borderTop: `0.5px solid ${C.line}`, paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-2xl mx-auto flex">
          {TABS.map(([id, label, icon]) => (
            <button key={id} onClick={() => { setTab(id); if (id === "more") setMoreView("menu"); }} className="flex-1 pt-2 pb-2.5 flex flex-col items-center gap-0.5 active:opacity-50">
              <span className="leading-none flex items-center justify-center"
                style={{ fontSize: 19, width: 46, height: 28, borderRadius: 14, background: tab === id ? C.blue + "16" : "transparent", color: tab === id ? C.blue : C.inkSoft, transition: "background .2s" }}>{icon}</span>
              <span className="text-[10px] font-semibold" style={{ color: tab === id ? C.blue : C.inkSoft }}>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ===== PDF-RAPPORT ===== */}
      {/* ===== MINIMA-LATHUND (PDF) ===== */}
      <div id="lathund" style={{ display: "none", ...SF, color: "#111", padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{{ sv: "Mina personliga minima", en: "My personal minimums", de: "Meine persönlichen Minima" }[lang]} · imsafe.se</h1>
        <p style={{ fontSize: 12, color: "#555" }}>{new Date().toLocaleDateString(T.locale)}</p>
        <hr style={{ margin: "12px 0" }} />
        <table style={{ width: "100%", fontSize: 15, borderCollapse: "collapse" }}><tbody>
          {MIN_DEF.map((m) => (
            <tr key={m.key} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px 0", fontWeight: 600 }}>{T.minima.labels[m.key][0]}</td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{m.dir === "max" ? T.minima.max : T.minima.min} {minVals[m.key]} {m.unit}</td>
            </tr>
          ))}
          <tr><td style={{ padding: "8px 0", fontWeight: 600 }}>{T.minima.surface}</td>
            <td style={{ textAlign: "right", fontWeight: 700 }}>{surfaceOk === "asfalt" ? T.minima.surfAsphalt : T.minima.surfGrass}</td></tr>
        </tbody></table>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 16 }}>{T.minima.vmcTitle} · {T.minima.vmcSub}</h3>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}><tbody>
          {T.minima.vmcRows.map((r) => (
            <tr key={r[0]} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "5px 0" }}>{r[0]}</td><td>{r[1]}</td><td style={{ color: "#555" }}>{r[2]}</td>
            </tr>
          ))}
        </tbody></table>
        <p style={{ fontSize: 12, color: "#555", marginTop: 16 }}>{{ sv: "Håll dem heliga – särskilt när du vill flyga som mest.", en: "Keep them sacred – especially when you most want to fly.", de: "Halte sie heilig – besonders wenn du am liebsten fliegen willst." }[lang]}</p>
        <p style={{ fontSize: 12, marginTop: 24 }}>{{ sv: "Underskrift", en: "Signature", de: "Unterschrift" }[lang]}: ______________________________</p>
      </div>

      <div id="report" style={{ display: "none", ...SF, color: "#111", padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{T.report.title}</h1>
        <p style={{ fontSize: 12, color: "#555" }}>{T.report.generated} {new Date().toLocaleString(T.locale)}{user ? ` · ${T.report.pilot}: ${user.name}` : ""}</p>
        <hr style={{ margin: "12px 0" }} />
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>{T.report.verdict}: {model.verdict} — {T.report.risk} {model.level} ({model.riskPct}/100, {T.report.protection} {Math.round(model.protection * 100)} %)</h2>
        <p style={{ fontSize: 13 }}>{model.advice}</p>
        {decision && <p style={{ fontSize: 13, fontWeight: 700 }}>{T.report.decision}: {decision === "nogo" ? T.report.decNogo : T.report.decGo}</p>}
        <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 14 }}>{T.report.barriers}</h3>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}><tbody>
          {model.layers.map((l) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "4px 0", fontWeight: 600 }}>{l.name}</td><td>{l.score}/{l.max} p</td><td>{T.report.pen} {Math.round(l.pen * 100)} %</td>
            </tr>
          ))}
        </tbody></table>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 14 }}>{T.report.factors}</h3>
        {model.active.length === 0 ? <p style={{ fontSize: 12 }}>{T.report.noneF}</p> : (
          <ul style={{ fontSize: 12, paddingLeft: 18 }}>{model.active.map((f) => <li key={f.key} style={{ marginBottom: 6 }}><b>{T.factors[f.key][0]}</b> ({f.barrier}, +{f.w})<br />{T.report.action}: {T.factors[f.key][1]}</li>)}</ul>
        )}
        {temNotes && (<>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 14 }}>TEM</h3>
          <p style={{ fontSize: 12 }}>{temNotes}</p>
        </>)}
        <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 14 }}>{T.report.status}</h3>
        <p style={{ fontSize: 12 }}>{T.decide.cols[0]} {Math.round(imsafePct * 100)} % · {T.decide.cols[2]} {Math.round(briefPct * 100)} % · {T.decide.cols[3]} {Math.round(walkPct * 100)} %</p>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 14 }}>{T.report.minima}</h3>
        <p style={{ fontSize: 12 }}>{MIN_DEF.map((m) => `${T.minima.labels[m.key][0]}: ${m.dir === "max" ? T.minima.max : T.minima.min} ${minVals[m.key]} ${m.unit}`).join(" · ")} · {T.minima.surface}: {surfaceOk === "asfalt" ? T.report.surfA : T.report.surfG}</p>
        <hr style={{ margin: "16px 0" }} />
        <p style={{ fontSize: 12, color: "#555" }}>{T.report.formula}</p>
        <p style={{ fontSize: 12, marginTop: 24 }}>{T.report.sign}: ______________________________ {T.report.date}: ______________</p>
      </div>
    </div>
  );
}
