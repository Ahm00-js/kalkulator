const SUPABASE_URL = "https://wvzejipxusngsuopzyic.supabase.co";
const SUPABASE_KEY = "sb_publishable_E0-L4WIo2J9XQK-6YLg1cQ_mxSBaanx";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const el = (id) => document.getElementById(id);
let grafDan = null;
let grafOp = null;

async function provjeriAdmina() {
  const { data, error } = await db.rpc("je_admin");
  return !error && data === true;
}

async function ucitajStatistiku() {
  const [dan, op, ukupno] = await Promise.all([
    db.rpc("statistika_po_danu"),
    db.rpc("statistika_operacija"),
    db.from("istorija").select("id", { count: "exact", head: true }),
  ]);

  if (dan.error || op.error) {
    el("porukaGreska").textContent = (dan.error || op.error).message;
    return;
  }
  el("porukaGreska").textContent = "";

  el("ukupno").textContent = ukupno.count ?? 0;

  const danasKljuc = new Date().toISOString().slice(0, 10);
  const danasRed = dan.data.find((r) => String(r.dan) === danasKljuc);
  el("danas").textContent = danasRed ? danasRed.broj : 0;

  el("najcesca").textContent = op.data.length ? op.data[0].operacija : "–";

  const labeleDan = dan.data.map((r) => r.dan);
  const vrijednostiDan = dan.data.map((r) => r.broj);
  if (grafDan) grafDan.destroy();
  grafDan = new Chart(el("grafDan"), {
    type: "bar",
    data: { labels: labeleDan, datasets: [{ label: "Računa", data: vrijednostiDan, backgroundColor: "#2a5298" }] },
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

function pokreniRealtime() {
  db.channel("istorija-promjene")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "istorija" }, () => {
      ucitajStatistiku();
      el("zivo").textContent = "● uživo";
    })
    .subscribe();
}

async function pokaziSadrzaj(session) {
  const admin = session ? await provjeriAdmina() : false;
  el("odjava").hidden = !session;
  el("prijava").hidden = !!admin;
  el("sadrzaj").hidden = !admin;
  if (session && !admin) {
    el("porukaPrijava").textContent = "Ovaj nalog nema admin pristup.";
  }
  if (admin) {
    await ucitajStatistiku();
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