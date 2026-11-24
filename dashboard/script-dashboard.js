const SUPABASE_URL = "https://wvzejipxusngsuopzyic.supabase.co";
const SUPABASE_KEY = "sb_publishable_E0-L4WIo2J9XQK-6YLg1cQ_mxSBaanx";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const el = (id) => document.getElementById(id);
let grafDan = null;
let grafOp = null;
let realtimeAktivan = false;

/* ---------- Filteri ---------- */
function filteri() {
  const p = el("period").value;
  const k = el("korisnikFilter").value;
  return {
    dani: p ? Number(p) : null,
    korisnik: k || null,
  };
}

/* ---------- Provjera admina ---------- */
async function provjeriAdmina() {
  const { data, error } = await db.rpc("je_admin");
  return !error && data === true;
}

/* ---------- Korisnici u filteru ---------- */
async function ucitajKorisnike() {
  const { data, error } = await db.rpc("lista_korisnika");
  if (error) {
    el("porukaGreska").textContent = error.message;
    return;
  }
  const select = el("korisnikFilter");
  const trenutni = select.value;
  select.innerHTML = '<option value="">Svi korisnici</option>';
  data.forEach((k) => {
    const opt = document.createElement("option");
    opt.value = k.user_id;
    opt.textContent = k.email;
    select.appendChild(opt);
  });
  select.value = trenutni;
}

/* ---------- Statistika ---------- */
async function ucitajStatistiku() {
  const f = filteri();
  const [dan, op] = await Promise.all([
    db.rpc("statistika_po_danu", f),
    db.rpc("statistika_operacija", f),
  ]);

  if (dan.error || op.error) {
    el("porukaGreska").textContent = (dan.error || op.error).message;
    return;
  }
  el("porukaGreska").textContent = "";

  const ukupno = dan.data.reduce((s, r) => s + Number(r.broj), 0);
  el("ukupno").textContent = ukupno;

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

/* ---------- CSV izvještaj ---------- */
function csvPolje(v) {
  const s = String(v ?? "");
  return /[";,\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function izvezi() {
  const { data, error } = await db.rpc("izvjestaj", filteri());
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

/* ---------- Admini ---------- */
async function ucitajAdmine() {
  const { data, error } = await db.rpc("lista_admina");
  const lista = el("listaAdmina");
  lista.innerHTML = "";
  if (error) {
    el("porukaAdmin").textContent = error.message;
    return;
  }
  data.forEach((a) => {
    const li = document.createElement("li");
    const tekst = document.createElement("span");
    tekst.textContent = a.email;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "opasnost";
    btn.textContent = "Ukloni";
    btn.addEventListener("click", () => ukloniAdmina(a.email));
    li.append(tekst, btn);
    lista.appendChild(li);
  });
}

async function dodajAdmina() {
  el("porukaAdmin").textContent = "";
  const email = el("noviAdmin").value.trim();
  if (!email) return;
  const { error } = await db.rpc("dodaj_admina", { p_email: email });
  if (error) {
    el("porukaAdmin").textContent = error.message;
    return;
  }
  el("noviAdmin").value = "";
  el("porukaAdmin").textContent = "Admin dodan.";
  ucitajAdmine();
}

async function ukloniAdmina(email) {
  if (!confirm(`Ukloniti admin pristup za ${email}?`)) return;
  el("porukaAdmin").textContent = "";
  const { error } = await db.rpc("ukloni_admina", { p_email: email });
  if (error) {
    el("porukaAdmin").textContent = error.message;
    return;
  }
  ucitajAdmine();
}

/* ---------- Realtime ---------- */
function pokreniRealtime() {
  if (realtimeAktivan) return;
  realtimeAktivan = true;
  db.channel("istorija-promjene")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "istorija" }, () => {
      ucitajStatistiku();
      el("zivo").textContent = "● uživo";
    })
    .subscribe();
}

/* ---------- Sesija i prijava ---------- */
async function pokaziSadrzaj(session) {
  const admin = session ? await provjeriAdmina() : false;
  el("odjava").hidden = !session;
  el("prijava").hidden = !!admin;
  el("sadrzaj").hidden = !admin;
  if (session && !admin) {
    el("porukaPrijava").textContent = "Ovaj nalog nema admin pristup.";
  }
  if (admin) {
    await ucitajKorisnike();
    await ucitajStatistiku();
    await ucitajAdmine();
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
el("period").addEventListener("change", ucitajStatistiku);
el("korisnikFilter").addEventListener("change", ucitajStatistiku);
el("izvezi").addEventListener("click", izvezi);
el("dodajAdmina").addEventListener("click", dodajAdmina);