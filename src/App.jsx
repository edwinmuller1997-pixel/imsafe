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
const PREFLIGHT_KEYS = ["notam", "airspace", "wx", "booking", "massbalance", "fuelplan", "freq", "ppr", "dryfly", "efb", "paxbrief"];
const PREFLIGHT_REF = { massbalance: "NCO.POL", fuelplan: "NCO.OP.125", paxbrief: "NCO.OP.130" };
const WALK_DEF = [
  { id: "fluids", icon: "💧", colorKey: "blue", keys: ["oil", "fuelQty", "drain", "fuelCaps", "leaks"] },
  { id: "electric", icon: "⚡", colorKey: "purple", keys: ["master", "lights", "pitot", "stall", "flaps"] },
  { id: "condition", icon: "🔍", colorKey: "green", keys: ["prop", "cowl", "wings", "tires", "struts", "static", "tiedown"] },
];
const BARRIER_DEF = [
  { id: "pilot", colorKey: "purple", icon: "🧍", factors: [{ key: "imsafe", w: 4 }, { key: "lowRecent", w: 3 }, { key: "recency90", w: 2 }, { key: "newType", w: 3 }, { key: "noDryFly", w: 1 }] },
  { id: "wx", colorKey: "blue", icon: "🌤", factors: [{ key: "marginal", w: 5 }, { key: "deterio", w: 4 }, { key: "xwind", w: 3 }, { key: "dusk", w: 4 }, { key: "terrain", w: 2 }, { key: "icing", w: 3 }] },
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
const I18N = {
  /* ================= SVENSKA ================= */
  sv: {
    locale: "sv-SE",
    greet: { m: "God morgon", d: "Hej", e: "God kväll" },
    tabs: { fly: "Flyg", more: "Mer" },
    titles: { fly: "Dagens flygning", menu: "Mer", links: "Väder & briefing", minima: "Minima", news: "Nyheter", blog: "Säkerhetsblogg", stats: "Haveribild", account: "Konto", support: "Stöd imsafe" },
    steps: [
      { name: "Piloten", q: "Är jag i skick att flyga idag?", time: "~30 sek" },
      { name: "Risker", q: "Vilka hot finns idag? Var ärlig – varje kryss får en åtgärd.", time: "~1 min" },
      { name: "Briefing", q: "Papper, briefing och planering på plats?", time: "~2 min" },
      { name: "Planet", q: "Runt planet – i lugn takt. Låt ingen stressa dig.", time: "vid planet" },
      { name: "Beslut", q: "Dags att väga ihop allt.", time: "~30 sek" },
    ],
    stepOf: (n) => `Steg ${n} av 5`,
    onboard: { hi: "Välkommen 👋", tag: "Fem steg. Fem minuter. Ett tydligt beslut.", tip: "Tips: ställ in dina minima under Mer → Minima.", start: "Sätt igång", langLabel: "Språk / Language / Sprache" },
    imsafe: {
      title: "IMSAFE", subDone: "Du är grön – vidare till riskerna ✓", subTodo: "Bocka av uppifrån och ner – som på papperschecklistan",
      items: { illness: ["Illness – fri från sjukdom", "Nej"], medication: ["Medication – inga påverkande mediciner", "Nej"], stress: ["Stress – under kontroll", "Nej"], alcohol: ["Alcohol – 8 h flaska→spak, under laggräns", "Nej"], fatigue: ["Fatigue – utvilad", "Ja"], eating: ["Eating – ätit & druckit", "Ja"] },
    },
    riskStep: {
      title: "Dagens riskfaktorer", sub: "Öppna varje område och kryssa det som stämmer idag. Inga kryss = stark dag.",
      none: "Inget markerat", marked: (n) => `${n} markerad${n > 1 ? "e" : ""}`,
      foot: "Resultatet visas inte här – du väger ihop allt i sista steget. Ärlighet nu ger ett bättre beslut sen.",
      autoOk: "IMSAFE grön – hämtas från steg 1", autoBad: "IMSAFE är inte komplett – tryck för att gå till steg 1",
    },
    barriers: { pilot: "Pilot", wx: "Väder & miljö", acft: "Flygplan", plan: "Planering & press" },
    factors: {
      imsafe: ["IMSAFE ej helt grön", "Flyg inte idag – eller kort lokalflygning med instruktör."],
      lowRecent: ["Under 10 h senaste 90 dagarna", "Boka en timme med instruktör, eller börja med tre varv ensam i lugnt väder."],
      recency90: ["90-dagarsregeln utan marginal (FCL.060)", "Flyg starter och landningar solo först – ta passagerarna nästa gång."],
      newType: ["Under 10 h på typen", "Läs nödprocedurerna kvällen innan och höj dina minima tills du har 10 h på typen."],
      noDryFly: ["Ingen torrflygning gjord", "Ta 5 minuter nu: blunda och flyg trafikvarvet och en avbruten landning."],
      marginal: ["Sikt eller molnbas nära dina minima", "Vänta. Sätt en hård vändpunkt: under X ft molnbas vänder jag – utan diskussion."],
      deterio: ["Prognosen försämras under dagen", "Flyg det långa benet först, eller lägg hemresan tre timmar före försämringen."],
      xwind: ["Sidvind eller byar över din gräns", "Välj ett fält med bättre vindriktning – eller vänta tills vinden mojnar."],
      dusk: ["Skymning eller mörker", "Planera landning senast 30 minuter före solnedgång – och håll den marginalen helig."],
      terrain: ["Terräng eller vatten utan nödlandningsalternativ", "Lägg rutten längs fält och vägar, flyg högre. Över vatten: flytvästar på."],
      icing: ["Risk för förgasaris eller isbildning", "Förgasarvärme i god tid – och alltid före planén."],
      fuelTight: ["Bränslereserv under din gräns", "Tanka fullt eller planera en mellanlandning. Bränsle är den billigaste försäkringen."],
      nearMtow: ["Nära max startvikt eller bakre tyngdpunkt", "Flytta last framåt eller lämna en väska hemma."],
      defect: ["Kvarstående anmärkning på flygplanet", "Ring teknikern före flygning. Utan tydligt besked – inget flyg."],
      unfamiliarEquip: ["Ovan vid avioniken eller utrustningen", "Sitt kvar på marken i 15 minuter och programmera hela rutten före start."],
      pressure: ["Tidspress eller förväntanstryck", "Säg det högt till passagerarna redan nu: vi kan behöva vända eller ta bilen."],
      newAd: ["Ny eller obekant flygplats", "Studera kartan och satellitbilden, rita trafikvarvet, ring fältet om något är oklart."],
      grassShort: ["Gräsbana eller kort bana utan beräkning", "Gör prestandaberäkningen med tillägg: gräs +20 %, vått +30 %."],
      noAltn: ["Ingen tydlig plan B", "Välj ett alternativ med bättre väder eller längre bana – skriv upp frekvens och kurs dit."],
      noBrief: ["Ofullständig briefing", "Ta 10 minuter: NOTAM, TAF och PPR. Länkarna finns under Mer."],
    },
    brief: {
      legalTitle: "Legalt & dokument", legalSub: "Part-FCL · Part-MED · NCO.GEN.135",
      legal: { license: "Certifikat och SEP-behörighet giltiga", medical: "Medical giltigt", recency: "90-dagarsregeln för passagerare uppfylld", docsAboard: "Dokument ombord: registreringsbevis, ARC, radiotillstånd, försäkring, flyghandbok", techlog: "Techlog: gångtid OK, inga öppna anmärkningar" },
      preTitle: "Briefing & planering", preSub: "Länkar till väder och NOTAM finns under Mer → Väder & briefing",
      pre: { notam: "NOTAM – hela rutten och alternativen", airspace: "Luftrum: restriktionsområden, TMA, drönarzoner", wx: "Väder: METAR/TAF · LHP · SWC · SMHI", booking: "Bokningen bekräftad (MyWeblog)", massbalance: "Massa & balans samt prestanda", fuelplan: "Bränsle: trip + 30 min dag / 45 min natt", freq: "Frekvenser och transponderkoder", ppr: "PPR och öppettider", dryfly: "Torrflygning – visualisera trafikvarvet", efb: "SkyDemon: rutt och kartor nedladdade", paxbrief: "Passagerarbriefing" },
    },
    walk: {
      title: "Walkaround", subDone: "Planet genomgånget – sista blicken: inget kvarglömt på vingen? ✓", subTodo: "Vätskor → Elektronik → Skick. I din takt.",
      groups: { fluids: "Vätskor", electric: "Elektronik", condition: "Skick" },
      items: { oil: "Olja – nivå inom gränser, lock åtdraget", fuelQty: "Bränslemängd – verifierad med ögonen i båda tankarna", drain: "Dränering – alla punkter, fritt från vatten och partiklar", fuelCaps: "Tanklock stängda och låsta", leaks: "Inga droppar eller fläckar under motor och vingar", master: "Huvudström på – batterispänning OK", lights: "Belysning: beacon, strobe, nav- och landningsljus", pitot: "Pitotvärme – känn att den blir varm (kort test)", stall: "Stallvarnare testad", flaps: "Klaffar – ut och in, symmetriskt", prop: "Propeller – inga hack, sprickor eller glapp", cowl: "Motorkåpa fäst, inga lösa föremål", wings: "Vingar och roder – hela ytor, fria rörelser", tires: "Däck – tryck och mönster OK", struts: "Fjäderben – rätt utskjut, inget läckage", static: "Statiska portar och pitotrör fria", tiedown: "Förtöjning, klossar och pitotskydd BORTTAGNA" },
      poh: "Generisk lista – flygplanstypens egen checklista har alltid företräde.",
    },
    decide: {
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
      decidedNogo: ["🧠 Rätt beslut. Flygplanet står kvar imorgon.", "Skriv gärna ner varför – framtida du tackar dig."],
      decidedGo: ["✈️ Beslut fattat – flyg din plan, inte dina förhoppningar.", "Håll minima heliga och vändpunkten skarp."],
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
      { name: "Risks", q: "What threats exist today? Be honest – every tick gets an action.", time: "~1 min" },
      { name: "Briefing", q: "Paperwork, briefing and planning in place?", time: "~2 min" },
      { name: "Aircraft", q: "Around the aircraft – at your pace. Let no one rush you.", time: "at the acft" },
      { name: "Decision", q: "Time to weigh it all up.", time: "~30 sec" },
    ],
    stepOf: (n) => `Step ${n} of 5`,
    onboard: { hi: "Welcome 👋", tag: "Five steps. Five minutes. One clear decision.", tip: "Tip: set your personal minimums under More → Minimums.", start: "Let's go", langLabel: "Språk / Language / Sprache" },
    imsafe: {
      title: "IMSAFE", subDone: "You're green – on to the risks ✓", subTodo: "Tick top to bottom – like the paper checklist",
      items: { illness: ["Illness – free of illness", "No"], medication: ["Medication – nothing impairing", "No"], stress: ["Stress – under control", "No"], alcohol: ["Alcohol – 8 h bottle-to-throttle, within legal limits", "No"], fatigue: ["Fatigue – well rested", "Yes"], eating: ["Eating – fed & hydrated", "Yes"] },
    },
    riskStep: {
      title: "Today's risk factors", sub: "Open each area and tick what applies today. No ticks = a strong day.",
      none: "Nothing ticked", marked: (n) => `${n} ticked`,
      foot: "No result shown here – you weigh everything up in the final step. Honesty now means a better decision later.",
      autoOk: "IMSAFE green – imported from step 1", autoBad: "IMSAFE incomplete – tap to go to step 1",
    },
    barriers: { pilot: "Pilot", wx: "Weather & environment", acft: "Aircraft", plan: "Planning & pressure" },
    factors: {
      imsafe: ["IMSAFE not fully green", "Don't fly today – or a short local flight with an instructor."],
      lowRecent: ["Under 10 h in the last 90 days", "Book an hour with an instructor, or start with three solo circuits in calm weather."],
      recency90: ["90-day rule without margin (FCL.060)", "Fly take-offs and landings solo first – bring passengers next time."],
      newType: ["Under 10 h on type", "Read the emergency procedures the night before and raise your minimums until 10 h on type."],
      noDryFly: ["No chair-flying done", "Take 5 minutes now: close your eyes and fly the circuit and a go-around."],
      marginal: ["Visibility or ceiling near your minimums", "Wait. Set a hard turn-back point: below X ft ceiling I turn back – no debate."],
      deterio: ["Forecast deteriorating during the day", "Fly the long leg first, or plan the return three hours before the deterioration."],
      xwind: ["Crosswind or gusts above your limit", "Choose a field with a better wind angle – or wait for the wind to ease."],
      dusk: ["Dusk or darkness", "Plan to land no later than 30 minutes before sunset – keep that margin sacred."],
      terrain: ["Terrain or water without forced-landing options", "Route along fields and roads, fly higher. Over water: life jackets on."],
      icing: ["Risk of carburettor or airframe icing", "Carb heat early – and always before descent."],
      fuelTight: ["Fuel reserve below your limit", "Fill up or plan a fuel stop. Fuel is the cheapest insurance there is."],
      nearMtow: ["Near MTOW or aft CG", "Move load forward or leave a bag behind."],
      defect: ["Open defect on the aircraft", "Call the engineer before flight. No clear release – no flight."],
      unfamiliarEquip: ["Unfamiliar avionics or equipment", "Sit on the ground for 15 minutes and programme the whole route before start."],
      pressure: ["Time pressure or expectations", "Say it out loud to your passengers now: we may turn back or take the car."],
      newAd: ["New or unfamiliar aerodrome", "Study the chart and satellite view, draw the circuit, call the field if unsure."],
      grassShort: ["Grass or short runway without calculation", "Do the performance calculation with factors: grass +20 %, wet +30 %."],
      noAltn: ["No clear plan B", "Pick an alternate with better weather or a longer runway – note frequency and heading."],
      noBrief: ["Incomplete briefing", "Take 10 minutes: NOTAM, TAF and PPR. Links are under More."],
    },
    brief: {
      legalTitle: "Legal & documents", legalSub: "Part-FCL · Part-MED · NCO.GEN.135",
      legal: { license: "Licence and SEP rating valid", medical: "Medical valid", recency: "90-day rule for passengers met", docsAboard: "On board: registration, ARC, radio licence, insurance, flight manual", techlog: "Tech log: hours OK, no open defects" },
      preTitle: "Briefing & planning", preSub: "Weather and NOTAM links are under More → Weather & briefing",
      pre: { notam: "NOTAM – whole route and alternates", airspace: "Airspace: restricted areas, TMA, drone zones", wx: "Weather: METAR/TAF · area forecast · charts", booking: "Booking confirmed", massbalance: "Mass & balance and performance", fuelplan: "Fuel: trip + 30 min day / 45 min night", freq: "Frequencies and transponder codes", ppr: "PPR and opening hours", dryfly: "Chair-flying – visualise the circuit", efb: "EFB: route and charts downloaded", paxbrief: "Passenger briefing" },
    },
    walk: {
      title: "Walkaround", subDone: "Aircraft checked – one last look: nothing left on the wing? ✓", subTodo: "Fluids → Electrics → Condition. At your pace.",
      groups: { fluids: "Fluids", electric: "Electrics", condition: "Condition" },
      items: { oil: "Oil – level within limits, cap secure", fuelQty: "Fuel quantity – visually verified in both tanks", drain: "Fuel drains – all points, free of water and debris", fuelCaps: "Fuel caps closed and locked", leaks: "No drips or stains under engine or wings", master: "Master on – battery voltage OK", lights: "Lights: beacon, strobe, nav and landing", pitot: "Pitot heat – feel it getting warm (brief test)", stall: "Stall warner tested", flaps: "Flaps – out and in, symmetrical", prop: "Propeller – no nicks, cracks or play", cowl: "Cowling secure, no loose objects", wings: "Wings and controls – surfaces intact, free movement", tires: "Tyres – pressure and tread OK", struts: "Struts – correct extension, no leaks", static: "Static ports and pitot clear", tiedown: "Tie-downs, chocks and pitot cover REMOVED" },
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
      decidedNogo: ["🧠 The right call. The aircraft will still be there tomorrow.", "Note down why – future you will be grateful."],
      decidedGo: ["✈️ Decision made – fly your plan, not your hopes.", "Keep your minimums sacred and your turn-back point sharp."],
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
      { name: "Risiken", q: "Welche Gefahren gibt es heute? Sei ehrlich – jedes Häkchen bekommt eine Maßnahme.", time: "~1 Min" },
      { name: "Briefing", q: "Papiere, Briefing und Planung erledigt?", time: "~2 Min" },
      { name: "Flugzeug", q: "Rund ums Flugzeug – in Ruhe. Lass dich von niemandem hetzen.", time: "am Flugzeug" },
      { name: "Entscheidung", q: "Zeit, alles abzuwägen.", time: "~30 Sek" },
    ],
    stepOf: (n) => `Schritt ${n} von 5`,
    onboard: { hi: "Willkommen 👋", tag: "Fünf Schritte. Fünf Minuten. Eine klare Entscheidung.", tip: "Tipp: Stelle deine Minima unter Mehr → Minima ein.", start: "Los geht's", langLabel: "Språk / Language / Sprache" },
    imsafe: {
      title: "IMSAFE", subDone: "Du bist grün – weiter zu den Risiken ✓", subTodo: "Von oben nach unten abhaken – wie auf der Papier-Checkliste",
      items: { illness: ["Illness – frei von Krankheit", "Nein"], medication: ["Medication – keine beeinträchtigenden Medikamente", "Nein"], stress: ["Stress – unter Kontrolle", "Nein"], alcohol: ["Alcohol – 8 h Flasche→Steuer, innerhalb der Grenzen", "Nein"], fatigue: ["Fatigue – ausgeruht", "Ja"], eating: ["Eating – gegessen & getrunken", "Ja"] },
    },
    riskStep: {
      title: "Heutige Risikofaktoren", sub: "Öffne jeden Bereich und hake an, was heute zutrifft. Keine Häkchen = starker Tag.",
      none: "Nichts markiert", marked: (n) => `${n} markiert`,
      foot: "Hier wird kein Ergebnis angezeigt – du wägst alles im letzten Schritt ab. Ehrlichkeit jetzt bedeutet eine bessere Entscheidung später.",
      autoOk: "IMSAFE grün – aus Schritt 1 übernommen", autoBad: "IMSAFE unvollständig – tippe, um zu Schritt 1 zu gehen",
    },
    barriers: { pilot: "Pilot", wx: "Wetter & Umgebung", acft: "Flugzeug", plan: "Planung & Druck" },
    factors: {
      imsafe: ["IMSAFE nicht ganz grün", "Heute nicht fliegen – oder ein kurzer Platzflug mit Fluglehrer."],
      lowRecent: ["Unter 10 h in den letzten 90 Tagen", "Buche eine Stunde mit Fluglehrer, oder starte mit drei Platzrunden solo bei ruhigem Wetter."],
      recency90: ["90-Tage-Regel ohne Reserve (FCL.060)", "Erst Starts und Landungen solo fliegen – Passagiere beim nächsten Mal."],
      newType: ["Unter 10 h auf dem Muster", "Notverfahren am Vorabend lesen und Minima erhöhen, bis 10 h auf dem Muster erreicht sind."],
      noDryFly: ["Kein Trockentraining gemacht", "Nimm dir 5 Minuten: Augen zu, Platzrunde und Durchstarten mental durchfliegen."],
      marginal: ["Sicht oder Wolkenuntergrenze nahe deiner Minima", "Warten. Setze einen harten Umkehrpunkt: unter X ft Untergrenze kehre ich um – ohne Diskussion."],
      deterio: ["Vorhersage verschlechtert sich im Tagesverlauf", "Das lange Bein zuerst fliegen, oder den Rückflug drei Stunden vor der Verschlechterung planen."],
      xwind: ["Seitenwind oder Böen über deiner Grenze", "Wähle einen Platz mit besserer Windrichtung – oder warte, bis der Wind nachlässt."],
      dusk: ["Dämmerung oder Dunkelheit", "Landung spätestens 30 Minuten vor Sonnenuntergang planen – diese Reserve ist heilig."],
      terrain: ["Gelände oder Wasser ohne Notlandemöglichkeit", "Route entlang Feldern und Straßen, höher fliegen. Über Wasser: Schwimmwesten an."],
      icing: ["Gefahr von Vergaser- oder Flugzeugvereisung", "Vergaservorwärmung frühzeitig – und immer vor dem Sinkflug."],
      fuelTight: ["Kraftstoffreserve unter deiner Grenze", "Volltanken oder Tankstopp planen. Sprit ist die günstigste Versicherung."],
      nearMtow: ["Nahe MTOW oder hinterer Schwerpunkt", "Ladung nach vorn verlagern oder eine Tasche zu Hause lassen."],
      defect: ["Offene Beanstandung am Flugzeug", "Vor dem Flug den Techniker anrufen. Ohne klare Freigabe – kein Flug."],
      unfamiliarEquip: ["Ungewohnte Avionik oder Ausrüstung", "15 Minuten am Boden sitzen bleiben und die ganze Route vor dem Start programmieren."],
      pressure: ["Zeitdruck oder Erwartungsdruck", "Sag es den Passagieren jetzt laut: Wir müssen vielleicht umkehren oder das Auto nehmen."],
      newAd: ["Neuer oder unbekannter Flugplatz", "Karte und Satellitenbild studieren, Platzrunde zeichnen, bei Unklarheit anrufen."],
      grassShort: ["Gras- oder kurze Bahn ohne Berechnung", "Leistungsberechnung mit Zuschlägen: Gras +20 %, nass +30 %."],
      noAltn: ["Kein klarer Plan B", "Wähle einen Ausweichplatz mit besserem Wetter oder längerer Bahn – Frequenz und Kurs notieren."],
      noBrief: ["Unvollständiges Briefing", "Nimm dir 10 Minuten: NOTAM, TAF und PPR. Links unter Mehr."],
    },
    brief: {
      legalTitle: "Recht & Dokumente", legalSub: "Part-FCL · Part-MED · NCO.GEN.135",
      legal: { license: "Lizenz und SEP-Berechtigung gültig", medical: "Medical gültig", recency: "90-Tage-Regel für Passagiere erfüllt", docsAboard: "An Bord: Eintragungsschein, ARC, Funkzulassung, Versicherung, Flughandbuch", techlog: "Bordbuch: Stunden OK, keine offenen Beanstandungen" },
      preTitle: "Briefing & Planung", preSub: "Wetter- und NOTAM-Links unter Mehr → Wetter & Briefing",
      pre: { notam: "NOTAM – gesamte Route und Ausweichplätze", airspace: "Luftraum: Sperrgebiete, TMA, Drohnenzonen", wx: "Wetter: METAR/TAF · GAFOR · Karten", booking: "Buchung bestätigt", massbalance: "Masse & Schwerpunkt sowie Leistung", fuelplan: "Kraftstoff: Trip + 30 Min Tag / 45 Min Nacht", freq: "Frequenzen und Transpondercodes", ppr: "PPR und Öffnungszeiten", dryfly: "Trockentraining – Platzrunde visualisieren", efb: "EFB: Route und Karten heruntergeladen", paxbrief: "Passagier-Briefing" },
    },
    walk: {
      title: "Außencheck", subDone: "Flugzeug geprüft – letzter Blick: nichts auf der Fläche vergessen? ✓", subTodo: "Flüssigkeiten → Elektrik → Zustand. In deinem Tempo.",
      groups: { fluids: "Flüssigkeiten", electric: "Elektrik", condition: "Zustand" },
      items: { oil: "Öl – Stand innerhalb der Grenzen, Deckel fest", fuelQty: "Kraftstoffmenge – in beiden Tanks per Auge geprüft", drain: "Drainage – alle Punkte, frei von Wasser und Partikeln", fuelCaps: "Tankdeckel geschlossen und verriegelt", leaks: "Keine Tropfen oder Flecken unter Motor und Flächen", master: "Hauptschalter ein – Batteriespannung OK", lights: "Beleuchtung: Beacon, Strobe, Nav- und Landelicht", pitot: "Pitotheizung – kurz testen, wird warm", stall: "Überziehwarnung getestet", flaps: "Klappen – aus- und einfahren, symmetrisch", prop: "Propeller – keine Kerben, Risse oder Spiel", cowl: "Motorhaube fest, keine losen Gegenstände", wings: "Flächen und Ruder – Oberflächen intakt, freigängig", tires: "Reifen – Druck und Profil OK", struts: "Federbeine – korrekter Ausschub, keine Lecks", static: "Statikports und Pitotrohr frei", tiedown: "Verzurrung, Bremsklötze und Pitotabdeckung ENTFERNT" },
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
      decidedNogo: ["🧠 Die richtige Entscheidung. Das Flugzeug steht morgen noch da.", "Notiere, warum – dein zukünftiges Ich dankt dir."],
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
        <span className="text-[16px]">{toast.icon}</span>
        <span className="text-[14px] font-semibold">{toast.text}</span>
      </div>
    </div>
  );
}

/* Swish egen QR-payload (A+46708869697) som inbäddad bild */


/* ============================================================ */

export default function ImsafeApp() {
  const [lang, setLang] = useState(() => {
    const nav = (typeof navigator !== "undefined" && navigator.language) || "en";
    return nav.startsWith("sv") ? "sv" : nav.startsWith("de") ? "de" : "en";
  });
  const T = I18N[lang];

  const [tab, setTab] = useState("fly");
  const [step, setStep] = useState(0);
  const [assessed, setAssessed] = useState(false);
  const [decision, setDecision] = useState(null);
  const [moreView, setMoreView] = useState("menu");
  const [expandedBarrier, setExpandedBarrier] = useState("pilot");
  const [seenIntro, setSeenIntro] = useState(true);
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
  const [confetti, setConfetti] = useState(false);
  const [toast, setToast] = useState(null);
  const [shownPct, setShownPct] = useState(null);
  const toastTimer = useRef(null);
  const celebrated = useRef({});

  /* Tema före render */
  Object.assign(C, night ? DARK : LIGHT);
  useEffect(() => { document.body.style.background = C.bg; }, [night]);
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
  function award(id) {
    setGame((g) => {
      if (g.badges.includes(id)) return g;
      const name = T.account.badges[id]?.[0] || id;
      if (g.soundOn) SND.badge();
      setTimeout(() => showToast(BADGE_DEF.find((b) => b.id === id)?.icon || "🏅", `${T.xpEvents.badge}: ${name}!`), 300);
      setConfetti(true); setTimeout(() => setConfetti(false), 2600);
      return { ...g, badges: [...g.badges, id] };
    });
  }
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
          if (typeof d.step === "number") setStep(Math.min(4, d.step));
          if (d.lastAssessment) setLastAssessment(d.lastAssessment);
          if (d.night) setNight(true);
          if (d.lang && I18N[d.lang]) setLang(d.lang);
          setSeenIntro(!!d.seenIntro);
        } else { setSeenIntro(false); }
      } catch { setSeenIntro(false); }
      setLoaded(true);
    })();
  }, []);
  useEffect(() => {
    if (!loaded) return;
    (async () => { try { await window.storage.set("imsafe-profile-v7", JSON.stringify({ user, minVals, game, step, seenIntro, lastAssessment, night, lang })); } catch {} })();
  }, [user, minVals, game, step, seenIntro, lastAssessment, night, lang, loaded]);

  /* IMSAFE auto-import + riskmodell */
  const imsafePct = IMSAFE_KEYS.filter((k) => imsafe[k]).length / IMSAFE_KEYS.length;
  const effRisks = useMemo(() => ({ ...risks, imsafe: imsafePct < 1 }), [risks, imsafePct]);
  const AUTO_INFO = { imsafe: { go: 0 } };

  const model = useMemo(() => {
    const layers = BARRIER_DEF.map((b) => {
      const max = b.factors.reduce((s, f) => s + f.w, 0);
      const score = b.factors.reduce((s, f) => s + (effRisks[f.key] ? f.w : 0), 0);
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
    const active = BARRIER_DEF.flatMap((b) => b.factors.filter((f) => effRisks[f.key]).map((f) => ({ ...f, color: C[b.colorKey], barrier: T.barriers[b.id] }))).sort((a, b2) => b2.w - a.w);
    return { layers, protection, riskPct, level: T.decide.levels[lvKey], color, advice: T.decide.advice[lvKey], verdict: T.decide.verdicts[vKey], aligned, active };
    // eslint-disable-next-line
  }, [effRisks, lang, night]);

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
    const target = model.riskPct;
    setShownPct(0);
    if (game.soundOn) tone(520, 0.06, 0, "sine", 0.05);
    const t0 = performance.now(), dur = 900;
    const tick = (t) => {
      const f = Math.min(1, (t - t0) / dur);
      setShownPct(Math.round((1 - Math.pow(1 - f, 3)) * target));
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
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1200, messages: [{ role: "user", content: T.news.prompt }], tools: [{ type: "web_search_20250305", name: "web_search" }] }),
      });
      const data = await res.json();
      const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      setNews({ status: "done", text: text || T.news.empty });
    } catch { setNews({ status: "error", text: T.news.fail }); }
  }

  function Row({ checked, onChange, children, trailing, color, highlight = false }) {
    return (
      <label className="flex items-center gap-3 px-4 cursor-pointer active:opacity-60"
        style={{ paddingTop: 15, paddingBottom: 15, borderTop: `0.5px solid ${C.line}`, background: highlight ? color + "0C" : "transparent", boxShadow: highlight ? `inset 3px 0 0 ${color}` : "none", transition: "all .25s" }}>
        <span style={{ width: 29, height: 29, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: checked ? color : "transparent", border: checked ? "none" : `2px solid ${highlight ? color : "rgba(120,128,140,0.4)"}`, transition: "all .15s", transform: checked ? "scale(1.05)" : "scale(1)" }}>
          {checked && <svg width="16" height="16" viewBox="0 0 12 12"><path d="M2 6.5L4.7 9 10 3.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
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
      de: "Jeder Schild ist eine Barriere zwischen dir und einem Unfall. Deine Kreuze öffnen Löcher. Der Pfeil ist die heutige Gefahr – die erste intakte Barriere stoppt ihn, doch wenn die Löcher fluchten, geht er ganz durch.",
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
  const imsafeItems = IMSAFE_KEYS.map((k) => ({ key: k, label: T.imsafe.items[k][0], target: T.imsafe.items[k][1] }));
  const legalItems = LEGAL_DEF.map((d) => ({ ...d, label: T.brief.legal[d.key] }));
  const preItems = PREFLIGHT_KEYS.map((k) => ({ key: k, label: T.brief.pre[k], ref: PREFLIGHT_REF[k] || "" }));
  const langNames = { sv: "Svenska", en: "English", de: "Deutsch" };
  const langMeta = { sv: ["🇸🇪", "Svenska"], en: ["🇬🇧", "English"], de: ["🇩🇪", "Deutsch"] };

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.ink, paddingBottom: 96, ...SF }}>
      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        @keyframes imsafeFall { to { transform: translateY(105vh) rotate(720deg); opacity: 0.9; } }
        @keyframes imsafePop { from { transform: translateX(-50%) scale(0.7); opacity: 0; } to { transform: translateX(-50%) scale(1); opacity: 1; } }
        @keyframes imsafeReveal { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes imsafeSlide { from { transform: translateX(18px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes imsafePopIn { from { transform: translateY(-6px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
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
            <svg width="30" height="30" viewBox="0 0 30 30" style={{ flexShrink: 0 }}>
              <defs>
                <linearGradient id="imLogoGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={night ? "#4D8DF0" : "#0B5CD6"} />
                  <stop offset="100%" stopColor={night ? "#7B74F0" : "#4F46E5"} />
                </linearGradient>
              </defs>
              <rect width="30" height="30" rx="9" fill="url(#imLogoGrad)" />
              {/* Bocken som lyfter: check vars övre streck blir en stigande flygbana */}
              <path d="M7 16.5 L12 21.5 L22 9.5" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M19.5 8.5 L24 7 L23 11.5" stroke="#fff" strokeWidth="0" fill="#fff" />
              <circle cx="9.5" cy="10" r="1.1" fill="rgba(255,255,255,0.5)" />
              <circle cx="13" cy="8" r="0.8" fill="rgba(255,255,255,0.35)" />
            </svg>
            <span className="text-[16px] font-bold" style={{ letterSpacing: "-0.02em" }}>imsafe<span style={{ color: C.blue }}>.se</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-full text-[14px]" style={{ background: night ? C.gold + "28" : C.fill }}
              title={T.night} onClick={() => { setNight(!night); if (game.soundOn) SND.tick(); }}>{night ? "☀️" : "🌙"}</button>
            <div style={{ position: "relative" }}>
              <button className="w-8 h-8 rounded-full text-[14px]" style={{ background: langMenuOpen ? C.blue + "22" : C.fill }}
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
                        <span className="flex-1 text-[14px] font-semibold" style={{ color: lang === l ? C.blue : C.ink }}>{langMeta[l][1]}</span>
                        {lang === l && <span style={{ color: C.blue, fontWeight: 700 }}>✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button className="w-8 h-8 rounded-full text-[14px]" style={{ background: C.fill }}
              title="Reset" onClick={() => {
                const msg = { sv: "Nollställa hela genomgången?", en: "Reset the entire walkthrough?", de: "Gesamten Durchgang zurücksetzen?" }[lang];
                if (!window.confirm(msg)) return;
                setRisks({}); setImsafe({}); setLegal({}); setPre({}); setWalk({});
                setAssessed(false); setDecision(null); setShownPct(null); setStep(0);
                celebrated.current = {};
                showToast("↺", { sv: "Nollställd – ny genomgång", en: "Reset – fresh walkthrough", de: "Zurückgesetzt – neuer Durchgang" }[lang]);
                if (game.soundOn) SND.tick();
              }}>↺</button>
            <button className="w-8 h-8 rounded-full text-[14px]" style={{ background: C.fill }}
              onClick={() => setGame((g) => ({ ...g, soundOn: !g.soundOn }))}>{game.soundOn ? "🔊" : "🔇"}</button>
            <button onClick={() => { setTab("more"); setMoreView("account"); }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold"
              style={{ background: C.gold + "22", color: C.gold }}>
              🏅
            </button>
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

            {/* Onboarding */}
            {!seenIntro && (
              <Card style={{ background: `linear-gradient(135deg, ${C.blue}14, ${C.indigo}08)`, border: `1px solid ${C.blue}30` }}>
                <div className="p-4">
                  <p className="text-[17px] font-bold">{T.onboard.hi}</p>
                  <p className="text-[14px] mt-1.5" style={{ color: C.ink2 }}>{T.onboard.tag}</p>
                  <p className="mt-2.5 text-[13px]" style={{ color: C.ink2 }}>🧍 → 🌤 → 📋 → 🛩 → ⚖️</p>
                  <p className="mt-1.5 text-[12px]" style={{ color: C.inkSoft }}>{T.onboard.tip}</p>
                  <div className="grid grid-cols-3 gap-1.5 mt-3">
                    {["sv", "en", "de"].map((l) => (
                      <button key={l} onClick={() => setLang(l)} className="py-2.5 rounded-xl active:opacity-70"
                        style={{ background: lang === l ? C.blue + "14" : C.fill, border: lang === l ? `1.5px solid ${C.blue}` : "1.5px solid transparent" }}>
                        <span className="block text-[20px] leading-none">{langMeta[l][0]}</span>
                        <span className="block text-[12px] font-semibold mt-1" style={{ color: lang === l ? C.blue : C.inkSoft }}>{langMeta[l][1]}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setSeenIntro(true)} className="w-full mt-3 py-2.5 rounded-xl font-semibold text-white active:opacity-70" style={{ background: C.blue }}>
                    {T.onboard.start}
                  </button>
                </div>
              </Card>
            )}

            <div key={step + lang} style={{ animation: "imsafeSlide .25s ease-out" }}>
              {/* Stegets fråga */}
              <Card style={{ background: `linear-gradient(135deg, ${C[S.colorKey]}12, ${C[S.colorKey]}04)`, border: `1px solid ${C[S.colorKey]}30` }}>
                <div className="p-4 flex items-center gap-3">
                  <span className="text-[26px]">{S.icon}</span>
                  <div className="flex-1">
                    <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: C[S.colorKey] }}>{T.stepOf(step + 1)} · {ST.name} · {ST.time}</p>
                    <p className="text-[14px] mt-0.5" style={{ color: C.ink2 }}>{ST.q}</p>
                  </div>
                </div>
              </Card>

              {/* --- STEG 0 --- */}
              {step === 0 && (
                <Card>
                  <CardHead title={T.imsafe.title} sub={imsafePct === 1 ? T.imsafe.subDone : T.imsafe.subTodo} right={<Ring pct={imsafePct} color={C.purple} />} />
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
                            <span className="block text-[12px]" style={{ color: n > 0 ? col : C.inkSoft }}>{n > 0 ? T.riskStep.marked(n) : T.riskStep.none}</span>
                          </span>
                          {n > 0 && <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold text-white" style={{ background: col }}>{n}</span>}
                          <span style={{ color: "rgba(120,128,140,0.4)", transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }}>›</span>
                        </button>
                        {open && b.factors.map((f) => AUTO_INFO[f.key] ? (
                          /* Statusrad (ej kryssbar): grön bock när IMSAFE är klar, varning annars */
                          <button key={f.key} className="w-full flex items-center gap-3 px-4 active:opacity-60 text-left"
                            style={{ paddingTop: 15, paddingBottom: 15, borderTop: `0.5px solid ${C.line}`,
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
                          <Row key={f.key} checked={!!risks[f.key]} color={col}
                            onChange={(e) => { setRisks({ ...risks, [f.key]: e.target.checked }); if (game.soundOn) (e.target.checked ? SND.tick() : SND.untick()); }}>
                            {T.factors[f.key][0]}
                          </Row>
                        ))}
                      </div>
                    );
                  })}
                  <p className="text-[11px] px-4 py-3" style={{ color: C.inkSoft }}>{T.riskStep.foot}</p>
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
                  {WALK_DEF.map((g) => (
                    <div key={g.id}>
                      <div className="flex items-center gap-2 px-4 py-2" style={{ background: C.fill }}>
                        <span className="text-[14px]">{g.icon}</span>
                        <span className="text-[13px] font-semibold uppercase tracking-wide flex-1" style={{ color: C[g.colorKey] }}>{T.walk.groups[g.id]}</span>
                        <span className="text-[11px]" style={{ ...mono, color: C.inkSoft }}>{g.keys.filter((k) => walk[k]).length}/{g.keys.length}</span>
                      </div>
                      <Checklist items={g.keys.map((k) => ({ key: k, label: T.walk.items[k] }))} state={walk} set={setWalk} color={C[g.colorKey]} />
                    </div>
                  ))}
                  <p className="text-[11px] px-4 py-3" style={{ color: C.inkSoft }}>{T.walk.poh}</p>
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
                  <Card>
                    <CardHead title={T.decide.basisTitle} sub={T.decide.basisSub} />
                    <div className="px-4 pb-4 grid grid-cols-4 gap-2 text-center">
                      {[[T.decide.cols[0], imsafePct, C.purple], [T.decide.cols[1], null, C.blue], [T.decide.cols[2], briefPct, C.indigo], [T.decide.cols[3], walkPct, C.green]].map(([k, p, col]) => (
                        <div key={k} className="flex flex-col items-center">
                          {p === null
                            ? <div style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: `5px solid ${model.active.length ? col : "rgba(120,128,140,0.15)"}`, color: model.active.length ? col : C.inkSoft, fontSize: 14, fontWeight: 700, boxSizing: "border-box" }}>{model.active.length}</div>
                            : <Ring pct={p} color={col} />}
                          <p className="text-[11px] mt-1 font-semibold" style={{ color: C.inkSoft }}>
                            {p === null ? `${k} · ${model.active.length} ${T.decide.threats}` : `${k}${p === 1 ? " ✓" : ""}`}
                          </p>
                        </div>
                      ))}
                    </div>
                    {(imsafePct < 1 || briefPct < 1 || walkPct < 1) && (
                      <p className="text-[12px] px-4 pb-3" style={{ color: C.orange }}>{T.decide.incomplete}</p>
                    )}
                  </Card>

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
                      <Card style={{ background: shownPct !== null ? C.card : `linear-gradient(135deg, ${model.color}16, ${model.color}06)`, border: `1.5px solid ${shownPct !== null ? C.line : model.color}`, transition: "all .3s" }}>
                        <div className="p-4">
                          <div className="flex items-center gap-4">
                            <Ring pct={(shownPct !== null ? shownPct : model.riskPct) / 100} color={shownPct !== null ? C.inkSoft : model.color} size={64} />
                            <div className="flex-1">
                              {shownPct !== null ? (
                                <p className="text-[16px] font-semibold" style={{ color: C.inkSoft }}>{T.decide.weighing}</p>
                              ) : (
                                <>
                                  <p className="text-[20px] font-bold" style={{ color: model.color }}>{model.verdict}</p>
                                  <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: C.inkSoft }}>{T.decide.riskLabel} {model.level} · {model.riskPct}/100</p>
                                </>
                              )}
                            </div>
                          </div>
                          {shownPct === null && <p className="text-[14px] mt-3" style={{ color: C.ink2 }}>{model.advice}</p>}
                        </div>
                      </Card>

                      {shownPct === null && (<>
                        <Card>
                          <CardHead title={T.decide.barriersNow} />
                          <div className="px-3 pb-4"><CheeseBoard /></div>
                        </Card>

                        <Card style={{ border: `1.5px solid ${C.blue}40`, background: `linear-gradient(180deg, ${C.blue}08, transparent)` }}>
                          <CardHead title={T.decide.actionsTitle} sub={model.active.length ? T.decide.actionsSub : T.decide.actionsEmpty} />
                          {model.active.length === 0 ? (
                            <p className="px-4 pb-4 text-[14px]" style={{ color: C.ink2 }}>{T.decide.strongDay}</p>
                          ) : (
                            <>
                              {model.active.slice(0, 5).map((f, idx) => (
                                <div key={f.key} className="px-4 py-3 flex gap-3" style={{ borderTop: `0.5px solid ${C.line}` }}>
                                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0" style={{ background: f.color + "1A", color: f.color }}>{idx + 1}</span>
                                  <div>
                                    <p className="text-[14px] font-semibold">{T.factors[f.key][0]}</p>
                                    <p className="text-[13px] mt-0.5" style={{ color: C.ink2 }}>{T.factors[f.key][1]}</p>
                                  </div>
                                </div>
                              ))}
                              {model.active.length > 5 && <p className="px-4 pb-3 text-[12px]" style={{ color: C.inkSoft }}>{T.decide.moreN(model.active.length - 5)}</p>}
                            </>
                          )}
                        </Card>

                        {!decision ? (
                          <div className="grid grid-cols-2 gap-2 mb-4">
                            <button onClick={() => decide("go")} disabled={model.riskPct > 80}
                              className="py-3.5 rounded-2xl text-[16px] font-bold text-white active:opacity-70"
                              style={{ background: C.green, opacity: model.riskPct > 80 ? 0.35 : 1 }}>
                              {T.decide.fly}
                            </button>
                            <button onClick={() => decide("nogo")} className="py-3.5 rounded-2xl text-[16px] font-bold text-white active:opacity-70" style={{ background: C.ink }}>
                              {T.decide.abstain}
                            </button>
                          </div>
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
                className="w-full py-3.5 rounded-2xl text-[16px] font-bold text-white active:opacity-70 mb-2"
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
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.indigo }}>{T.tipTitle}</p>
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
                  ["minima", "📏", ...T.menu.minima, C.indigo],
                  ["news", "📰", ...T.menu.news, C.teal],
                  ["blog", "✍️", ...T.menu.blog, C.orange],
                  ["stats", "📊", ...T.menu.stats, C.red],
                  ...(lang === "sv" && T.menu.support ? [["support", "💙", ...T.menu.support, C.blue]] : []),
                  ["account", "🏅", T.account.badgesTitle, `${game.badges.length} / ${BADGE_DEF.length}`, C.gold],
                  ["lang", "🌐", ...T.menu.lang, C.purple],
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
                <Card>
                  <CardHead title={T.minima.vmcTitle} sub={T.minima.vmcSub} />
                  {T.minima.vmcRows.map((r) => (
                    <div key={r[0]} className="px-4 py-3 flex items-baseline justify-between gap-3" style={{ borderTop: `0.5px solid ${C.line}` }}>
                      <span className="text-[14px] font-medium flex-1">{r[0]}</span>
                      <span className="text-[14px]" style={mono}>{r[1]}</span>
                      <span className="text-[11px] text-right" style={{ color: C.inkSoft, maxWidth: 130 }}>{r[2]}</span>
                    </div>
                  ))}
                  <p className="text-[11px] px-4 py-3" style={{ color: C.inkSoft }}>{T.minima.vmcFoot}</p>
                </Card>
              </>
            )}

            {moreView === "news" && (
              <Card>
                <CardHead title={T.news.title} sub={T.news.sub} />
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
                <CardHead title={T.stats.title} sub={T.stats.sub} />
                {ACC_DEF.map((d) => (
                  <div key={d.key} className="px-4 py-3" style={{ borderTop: `0.5px solid ${C.line}` }}>
                    <span className="text-[14px] font-semibold">{T.stats.cats[d.key][0]}</span>
                    <div className="mt-1.5 space-y-1">
                      <div className="flex items-center gap-2"><div className="h-2.5 rounded-full" style={{ width: `${d.shareFatal * 2.4}%`, minWidth: 8, background: C.blue }} /><span className="text-[11px]" style={{ ...mono, color: C.inkSoft }}>{d.shareFatal} {T.stats.share}</span></div>
                      <div className="flex items-center gap-2"><div className="h-2.5 rounded-full" style={{ width: `${d.lethality * 0.9}%`, minWidth: 8, background: C.red, opacity: 0.85 }} /><span className="text-[11px]" style={{ ...mono, color: C.inkSoft }}>{d.lethality} {T.stats.lethality}</span></div>
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
                  {/* Swish-nummer + kopiera (deep-links stöds inte längre av Swish) */}
                  <div className="rounded-2xl p-4 text-center" style={{ background: C.fill }}>
                    <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.inkSoft }}>Swisha till</p>
                    <p className="text-[26px] font-bold mt-1" style={{ ...mono, color: C.ink, letterSpacing: 1 }}>0708&nbsp;86&nbsp;96&nbsp;97</p>
                    <button className="mt-3 px-5 py-2.5 rounded-xl font-semibold text-white active:opacity-70" style={{ background: C.grad }}
                      onClick={async () => {
                        try { await navigator.clipboard.writeText("0708869697"); showToast("📋", "Nummer kopierat – öppna Swish"); }
                        catch { showToast("⚠️", "Kunde inte kopiera – skriv av numret"); }
                        if (game.soundOn) SND.tick();
                      }}>
                      Kopiera nummer
                    </button>
                    <p className="text-[12px] mt-2" style={{ color: C.inkSoft }}>Förslag: 29 · 59 · 99 kr – varje krona håller sajten flygande ✈️</p>
                  </div>
                  <p className="text-[12px] mt-3" style={{ color: C.inkSoft }}>{T.support.thanks}</p>
                </div>
              </Card>
            )}

            {moreView === "account" && (
              <>
                <Card>
                  <CardHead title={T.account.badgesTitle} sub={T.account.badgesSub(game.badges.length, BADGE_DEF.length, game.nogoCount)} />
                  <div className="px-4 pb-4 grid grid-cols-3 gap-2">
                    {BADGE_DEF.map((b) => {
                      const has = game.badges.includes(b.id);
                      return (
                        <div key={b.id} className="rounded-xl p-2.5 text-center" style={{ background: has ? C.gold + "18" : C.fill, opacity: has ? 1 : 0.55, border: has ? `1px solid ${C.gold}55` : "1px solid transparent" }}>
                          <span className="text-[22px]" style={{ filter: has ? "none" : "grayscale(1)" }}>{b.icon}</span>
                          <p className="text-[11px] font-bold mt-0.5">{T.account.badges[b.id][0]}</p>
                          <p className="text-[9.5px] leading-tight" style={{ color: C.inkSoft }}>{T.account.badges[b.id][1]}</p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </>
            )}
          </>
        )}

        <footer className="text-[11px] pb-4 px-2" style={{ color: C.inkSoft }}>{T.footer}</footer>
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
      <div id="report" style={{ display: "none", ...SF, color: "#111", padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{T.report.title}</h1>
        <p style={{ fontSize: 12, color: "#555" }}>{T.report.generated} {new Date().toLocaleString(T.locale)}{user ? ` · ${T.report.pilot}: ${user.name}` : ""}</p>
        <hr style={{ margin: "12px 0" }} />
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>{T.report.verdict}: {model.verdict} — {T.report.risk} {model.level} ({model.riskPct}/100, {T.report.protection} {Math.round(model.protection * 100)} %)</h2>
        <p style={{ fontSize: 13 }}>{model.advice}</p>
        {decision && <p style={{ fontSize: 13, fontWeight: 700 }}>{T.report.decision}: {decision === "nogo" ? T.report.decNogo : T.report.decGo}</p>}
        <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 14 }}>{T.report.barriers}</h3>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}><tbody>
          {model.layers.map((l) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "4px 0", fontWeight: 600 }}>{l.name}</td><td>{l.score}/{l.max} p</td><td>{T.report.pen} {Math.round(l.pen * 100)} %</td>
            </tr>
          ))}
        </tbody></table>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 14 }}>{T.report.factors}</h3>
        {model.active.length === 0 ? <p style={{ fontSize: 12 }}>{T.report.noneF}</p> : (
          <ul style={{ fontSize: 12, paddingLeft: 18 }}>{model.active.map((f) => <li key={f.key} style={{ marginBottom: 6 }}><b>{T.factors[f.key][0]}</b> ({f.barrier}, +{f.w})<br />{T.report.action}: {T.factors[f.key][1]}</li>)}</ul>
        )}
        <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 14 }}>{T.report.status}</h3>
        <p style={{ fontSize: 12 }}>{T.decide.cols[0]} {Math.round(imsafePct * 100)} % · {T.decide.cols[2]} {Math.round(briefPct * 100)} % · {T.decide.cols[3]} {Math.round(walkPct * 100)} %</p>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 14 }}>{T.report.minima}</h3>
        <p style={{ fontSize: 12 }}>{MIN_DEF.map((m) => `${T.minima.labels[m.key][0]}: ${m.dir === "max" ? T.minima.max : T.minima.min} ${minVals[m.key]} ${m.unit}`).join(" · ")} · {T.minima.surface}: {surfaceOk === "asfalt" ? T.report.surfA : T.report.surfG}</p>
        <hr style={{ margin: "16px 0" }} />
        <p style={{ fontSize: 11, color: "#555" }}>{T.report.formula}</p>
        <p style={{ fontSize: 12, marginTop: 24 }}>{T.report.sign}: ______________________________ {T.report.date}: ______________</p>
      </div>
    </div>
  );
}
