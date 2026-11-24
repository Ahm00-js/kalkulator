const SUPABASE_URL = "https://wvzejipxusngsuopzyic.supabase.co";
const SUPABASE_KEY = "sb_publishable_E0-L4WIo2J9XQK-6YLg1cQ_mxSBaanx";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const el = (id) => document.getElementById(id);
const NASLOVI = { pregled: "Pregled", racuni: "Računi", izvjestaji: "Izvještaji", admini: "Admini" };
const SEKCIJE = ["pregled", "racuni", "izvjestaji", "admini"];
let grafDan = null;
let grafOp = null;
let realtimeAktivan = false;
let aktivniTab = "pregled";
let dozvole = [];

/* ---------- Pomoćne ---------- */
function filteriZa(periodId, korisnikId) {
  const p = el(periodId).value;
  const k = el(korisnikId).value;
  return { dani: p ? Number(p) : null, korisnik: k || null };
}

function sinhroniziFiltere(izvor) {
  ["periodPregled", "periodRacuni", "periodIzvj"].forEach((id) => {
    if (id !== izvor) el(id).value = el(izvor).value;
  });
  ["korisnikPregled", "korisnikRacuni", "korisnikIzvj"].forEach((id) => {
    if (id !== izvor) el(id).value = el(izvor).value;
  });
}

function td(tekst) {
  const c = document.createElement("td");
  c.textContent = tekst;
  return c;
}

function checkbox(checked, disabled = false) {
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = checked;
  cb.disabled = disabled;
  return cb;
}

async function provjeriAdmina() {
  const { data, error } = await db.rpc("je_admin");
  return !error && data === true;
}

async function ucitajDozvole() {
  const { data, error } = await db.rpc("moje_dozvole");
  dozvole = error ? [] : data;
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.hidden = !dozvole.includes(b.dataset.tab);
  });
  if (!dozvole.includes(aktivniTab)) aktivniTab = dozvole[0] ?? "pregled";
}

/* ---------- Korisnici u filterima ---------- */
async function ucitajKorisnike() {
  const { data, error } = await db.rpc("lista_korisnika");
  if (error) {
    el("porukaGreska").textContent = error.message;
    return;
  }
  ["korisnikPregled", "korisnikRacuni", "korisnikIzvj"].forEach((id) => {
    const select = el(id);
    const trenutni = select.value;
    select.innerHTML = '<option value="">Svi korisnici</option>';
    data.forEach((k) => {
      const opt = document.createElement("option");
      opt.value = k.user_id;
      opt.textContent = k.email;
      select.appendChild(opt);
    });
    select.value = trenutni;
  });
}

/* ---------- Pregled ---------- */
async function ucitajPregled() {
  const f = filteriZa("periodPregled", "korisnikPregled");
  const [dan, op] = await Promise.all([
    db.rpc("statistika_po_danu", f),
    db.rpc("statistika_operacija", f),
  ]);
  if (dan.error || op.error) {
    el("porukaGreska").textContent = (dan.error || op.error).message;
    return;
  }
  el("porukaGreska").textContent = "";

  el("ukupno").textContent = dan.data.reduce((s, r) => s + Number(r.broj), 0);
  const danasKljuc = new Date().toISOString().slice(0, 10);
  const danasRed = dan.data.find((r) => String(r.dan) === danasKljuc);
  el("danas").textContent = danasRed ? danasRed.broj : 0;
  el("najcesca").textContent = op.data.length ? op.data[0].operacija : "–";

  if (grafDan) grafDan.destroy();
  grafDan = new Chart(el("grafDan"), {
    type: "bar",
    data: {
      labels: dan.data.map((r) => r.dan),
      datasets: [{ label: "Računa", data: dan.data.map((r) => r.broj), backgroundColor: "#2a5298" }],
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
  });

  if (grafOp) grafOp.destroy();
  grafOp = new Chart(el("grafOp"), {
    type: "doughnut",
    data: {
      labels: op.data.map((r) => r.operacija),
      datasets: [{ data: op.data.map((r) => r.broj), backgroundColor: ["#2a5298", "#5fa8ff", "#0b1f4a", "#c0392b", "#8fa0c4"] }],
    },
  });
}

/* ---------- Računi ---------- */
async function ucitajRacune() {
  const f = filteriZa("periodRacuni", "korisnikRacuni");
  const { data, error } = await db.rpc("izvjestaj", f);
  const tbody = el("tbodyRacuni");
  tbody.innerHTML = "";
  if (error) {
    el("porukaGreska").textContent = error.message;
    return;
  }
  el("porukaGreska").textContent = "";
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">Nema računa u odabranom periodu.</td></tr>';
    return;
  }
  data.forEach((r) => {
    const tr = document.createElement("tr");
    tr.append(
      td(new Date(r.created_at).toLocaleString("bs-BA")),
      td(r.email ?? "–"),
      td(r.izraz ?? "–"),
      td(r.rezultat)
    );
    tbody.appendChild(tr);
  });
}

/* ---------- CSV ---------- */
function csvPolje(v) {
  const s = String(v ?? "");
  return /[";,\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function izvezi() {
  const f = filteriZa("periodIzvj", "korisnikIzvj");
  const { data, error } = await db.rpc("izvjestaj", f);
  if (error) {
    el("porukaGreska").textContent = error.message;
    return;
  }
  const zaglavlje = ["Datum", "Korisnik", "Izraz", "Rezultat"];
  const redovi = data.map((r) => [
    new Date(r.created_at).toLocaleString("bs-BA"),
    r.email,
    r.izraz,
    r.rezultat,
  ]);
  const sadrzaj = [zaglavlje, ...redovi].map((red) => red.map(csvPolje).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + sadrzaj], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `izvjestaj-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Korisnici, dozvole i status ---------- */
async function ucitajAdmine() {
  const { data, error } = await db.rpc("lista_svih_korisnika");
  const tbody = el("tbodyAdmini");
  tbody.innerHTML = "";
  el("porukaAdmin").textContent = "";
  if (error) {
    el("porukaAdmin").textContent = error.message;
    return;
  }

  data.forEach((k) => {
    const tr = document.createElement("tr");
    const jeAdmin = checkbox(k.admin);
    const sekcije = {};
    SEKCIJE.forEach((s) => {
      sekcije[s] = checkbox(k.dozvole.includes(s), !k.admin);
    });
    jeAdmin.addEventListener("change", () => {
      SEKCIJE.forEach((s) => (sekcije[s].disabled = !jeAdmin.checked));
    });

    const sacuvaj = document.createElement("button");
    sacuvaj.type = "button";
    sacuvaj.textContent = "Sačuvaj";
    sacuvaj.addEventListener("click", () =>
      sacuvajDozvole(k.email, k.admin, jeAdmin.checked, SEKCIJE.filter((s) => sekcije[s].checked))
    );

    const status = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `badge ${k.aktivan ? "da" : "ne"}`;
    badge.textContent = k.aktivan ? "Aktivan" : "Deaktiviran";
    status.appendChild(badge);

    const tdAdmin = document.createElement("td");
    tdAdmin.appendChild(jeAdmin);
    const tdBtn = document.createElement("td");
    tdBtn.append(sacuvaj);

    if (k.email !== korisnik) {
      const akt = document.createElement("button");
      akt.type = "button";
      akt.className = k.aktivan ? "zuta" : "mala";
      akt.textContent = k.aktivan ? "Deaktiviraj" : "Aktiviraj";
      akt.addEventListener("click", () => promijeniAktivnost(k.email, !k.aktivan));
      tdBtn.append(" ", akt);
    }

    tr.append(td(k.email), tdAdmin);
    SEKCIJE.forEach((s) => {
      const c = document.createElement("td");
      c.appendChild(sekcije[s]);
      tr.appendChild(c);
    });
    tr.append(status, tdBtn);
    tbody.appendChild(tr);
  });

  ucitajAudit();
}

let korisnik = null;

async function sacuvajDozvole(email, bioAdmin, jeSada, izabrane) {
  el("porukaAdmin").textContent = "";
  let res;
  if (jeSada) {
    res = await db.rpc("postavi_admina", { p_email: email, p_dozvole: izabrane });
  } else if (bioAdmin) {
    if (!confirm(`Ukloniti admin pristup za ${email}?`)) {
      ucitajAdmine();
      return;
    }
    res = await db.rpc("ukloni_admina", { p_email: email });
  } else {
    return;
  }
  if (res.error) {
    el("porukaAdmin").textContent = res.error.message;
    return;
  }
  el("porukaAdmin").textContent = `Sačuvano: ${email}`;
  ucitajAdmine();
}

async function promijeniAktivnost(email, aktivan) {
  const poruka = aktivan ? `Aktivirati ${email}?` : `Deaktivirati ${email}? Neće se moći prijaviti.`;
  if (!confirm(poruka)) return;
  el("porukaAdmin").textContent = "";
  const { error } = await db.rpc("postavi_aktivnost", { p_email: email, p_aktivan: aktivan });
  if (error) {
    el("porukaAdmin").textContent = error.message;
    return;
  }
  el("porukaAdmin").textContent = `${aktivan ? "Aktiviran" : "Deaktiviran"}: ${email}`;
  ucitajAdmine();
}

/* ---------- Audit log ---------- */
async function ucitajAudit() {
  const { data, error } = await db.rpc("lista_audit");
  const tbody = el("tbodyAudit");
  tbody.innerHTML = "";
  if (error) {
    el("porukaAdmin").textContent = error.message;
    return;
  }
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">Nema zapisa.</td></tr>';
    return;
  }
  data.forEach((r) => {
    const tr = document.createElement("tr");
    tr.append(
      td(new Date(r.created_at).toLocaleString("bs-BA")),
      td(r.admin_email ?? "–"),
      td(r.akcija),
      td(r.meta ?? "")
    );
    tbody.appendChild(tr);
  });
}

/* ---------- Navigacija ---------- */
function prikaziTab(tab) {
  aktivniTab = tab;
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("aktivan", b.dataset.tab === tab));
  document.querySelectorAll(".tab").forEach((t) => (t.hidden = t.id !== `tab-${tab}`));
  el("naslov").textContent = NASLOVI[tab];
  if (tab === "pregled") ucitajPregled();
  if (tab === "racuni") ucitajRacune();
  if (tab === "admini") ucitajAdmine();
}

document.querySelectorAll(".nav-btn").forEach((b) => {
  b.addEventListener("click", () => prikaziTab(b.dataset.tab));
});

/* ---------- Realtime ---------- */
function pokreniRealtime() {
  if (realtimeAktivan) return;
  realtimeAktivan = true;
  db.channel("istorija-promjene")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "istorija" }, () => {
      el("zivo").textContent = "● uživo";
      if (aktivniTab === "pregled") ucitajPregled();
      if (aktivniTab === "racuni") ucitajRacune();
    })
    .subscribe();
}

/* ---------- Sesija i prijava ---------- */
async function pokaziSadrzaj(session) {
  const admin = session ? await provjeriAdmina() : false;
  el("odjava").hidden = !session;
  el("prijava").hidden = !!admin;
  el("sadrzaj").hidden = !admin;
  korisnik = session ? session.user.email : null;
  if (session && !admin) {
    el("porukaPrijava").textContent = "Ovaj nalog nema admin pristup.";
  }
  if (admin) {
    await ucitajDozvole();
    await ucitajKorisnike();
    if (dozvole.length === 0) {
      el("porukaGreska").textContent = "Nemaš dozvolu ni za jedan odjeljak. Obrati se glavnom adminu.";
    } else {
      prikaziTab(aktivniTab);
    }
    pokreniRealtime();
  }
}

db.auth.onAuthStateChange((_event, session) => pokaziSadrzaj(session));

el("prijavi").addEventListener("click", async () => {
  el("porukaPrijava").textContent = "";
  const { error } = await db.auth.signInWithPassword({
    email: el("email").value.trim(),
    password: el("lozinka").value,
  });
  if (error) el("porukaPrijava").textContent = error.message;
});

el("odjava").addEventListener("click", () => db.auth.signOut());
el("izvezi").addEventListener("click", izvezi);

["periodPregled", "korisnikPregled", "periodRacuni", "korisnikRacuni", "periodIzvj", "korisnikIzvj"].forEach((id) => {
  el(id).addEventListener("change", () => {
    sinhroniziFiltere(id);
    if (aktivniTab === "pregled") ucitajPregled();
    if (aktivniTab === "racuni") ucitajRacune();
  });
});