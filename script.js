const SUPABASE_URL = "https://wvzejipxusngsuopzyic.supabase.co";
const SUPABASE_KEY = "sb_publishable_E0-L4WIo2J9XQK-6YLg1cQ_mxSBaanx";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const el = (id) => document.getElementById(id);
const izrazPolje = el("izraz");
const rezultat = el("rezultat");
const listaIstorije = el("istorija");
const authSekcija = el("auth");
const app = el("app");
const korisnik = el("korisnik");
const odjavaBtn = el("odjava");
const dashboardBtn = el("dashboardBtn");
const emailPolje = el("email");
const lozinkaPolje = el("lozinka");
const authPoruka = el("authPoruka");

const MAX_DUZINA_IZRAZA = 60;
const MAX_CIFARA_BROJA = 15;

let izraz = "";
let zadnjiRezultat = null;
let jeRezultat = false;

/* ---------- Poruke ---------- */
function prikaziGresku(tekst) {
  rezultat.textContent = tekst;
}

/* ---------- Tema ---------- */
function primijeniTemu(tamna) {
  document.body.classList.toggle("tamna", tamna);
  localStorage.setItem("tema", tamna ? "tamna" : "svijetla");
}
primijeniTemu(localStorage.getItem("tema") === "tamna");
el("temaBtn").addEventListener("click", () =>
  primijeniTemu(!document.body.classList.contains("tamna"))
);

/* ---------- Slack obavještenje o grešci upisa ---------- */
// Ne čekamo odgovor i ne blokiramo korisnika ako Slack ne radi
function prijaviGresku(poruka) {
  db.functions
    .invoke("notify-slack", { body: { akcija: "greska upisa", meta: poruka } })
    .then(({ error, data }) => {
      if (error || data?.error) console.error("Slack:", error?.message ?? data?.error);
    })
    .catch((e) => console.error("Slack:", e));
}

/* ---------- Validacija izraza ---------- */
function validiraj(s) {
  if (!s) return "Unesi izraz";
  if (s.length > MAX_DUZINA_IZRAZA) return "Izraz je predugačak";
  if (/[+\-*\/]$/.test(s)) return "Izraz ne smije završiti operacijom";
  if (/\.[0-9]*\./.test(s)) return "Broj ima više decimalnih tačaka";
  const brojevi = s.match(/\d+(\.\d+)?/g) ?? [];
  if (brojevi.some((b) => b.replace(".", "").length > MAX_CIFARA_BROJA)) {
    return "Broj je predug";
  }
  return null;
}

/* ---------- Računanje (redoslijed operacija) ---------- */
function evaluate(s) {
  let t = s.match(/\d+\.?\d*|[+\-*\/]/g);
  if (!t) return null;
  if (t[0] === "-") t = ["0", ...t];
  if (isNaN(parseFloat(t[0]))) return null;

  const vals = [parseFloat(t[0])];
  const ops = [];
  for (let i = 1; i < t.length; i += 2) {
    const o = t[i];
    const n = parseFloat(t[i + 1]);
    if (isNaN(n)) return null;
    if (o === "*" || o === "/") {
      const p = vals.pop();
      if (o === "/" && n === 0) throw new Error("NULA");
      vals.push(o === "*" ? p * n : p / n);
    } else {
      ops.push(o);
      vals.push(n);
    }
  }
  let r = vals[0];
  ops.forEach((o, j) => {
    r = o === "+" ? r + vals[j + 1] : r - vals[j + 1];
  });
  return Number(r.toFixed(10));
}

/* ---------- Unos ---------- */
const OP = { "+": "+", "-": "-", "*": "*", "/": "/", x: "*", X: "*" };

function dodaj(znak) {
  if (znak === "C") {
    izraz = "";
    rezultat.textContent = "";
    jeRezultat = false;
  } else if (znak === "⌫") {
    izraz = izraz.slice(0, -1);
    jeRezultat = false;
  } else if (znak === "√" || znak === "%") {
    primijeniFunkciju(znak);
  } else if (znak === "ANS") {
    umetniAns();
  } else {
    if (jeRezultat && /[0-9.]/.test(znak)) izraz = "";
    jeRezultat = false;

    if (/[0-9]/.test(znak)) {
      const m = izraz.match(/\d*$/)[0];
      if (m.length >= MAX_CIFARA_BROJA) {
        prikaziGresku("Broj je predug");
        izrazPolje.value = izraz;
        return;
      }
      if (izraz.length >= MAX_DUZINA_IZRAZA) {
        prikaziGresku("Izraz je predugačak");
        izrazPolje.value = izraz;
        return;
      }
      izraz += znak;
    } else if (znak === ".") {
      const m = izraz.match(/[\d.]*$/)[0];
      if (m.includes(".")) {
        prikaziGresku("Broj već ima decimalnu tačku");
      } else {
        izraz += m === "" ? "0." : ".";
      }
    } else if (OP[znak]) {
      const op = OP[znak];
      if (izraz === "") {
        if (op === "-") izraz = "-";
      } else if (/[+\-*\/]$/.test(izraz)) {
        izraz = izraz.slice(0, -1) + op;
      } else {
        if (izraz.length >= MAX_DUZINA_IZRAZA) {
          prikaziGresku("Izraz je predugačak");
          izrazPolje.value = izraz;
          return;
        }
        izraz += op;
      }
    }
  }
  izrazPolje.value = izraz;
}

function primijeniFunkciju(tip) {
  const m = izraz.match(/(\d+\.?\d*)$/);
  if (!m) {
    prikaziGresku("Unesi broj");
    return;
  }
  const x = parseFloat(m[1]);
  let r;
  if (tip === "√") {
    if (x < 0) {
      prikaziGresku("Greška: korijen negativnog broja");
      return;
    }
    r = Math.sqrt(x);
  } else {
    r = x / 100;
  }
  izraz = izraz.slice(0, m.index) + String(Number(r.toFixed(10)));
  jeRezultat = false;
  izrazPolje.value = izraz;
}

function umetniAns() {
  if (jeRezultat) izraz = "";
  if (zadnjiRezultat === null) {
    prikaziGresku("Nema prethodnog rezultata");
    return;
  }
  if (zadnjiRezultat < 0) {
    prikaziGresku("ANS je negativan, unesi ručno");
    return;
  }
  if (/[\d.]$/.test(izraz)) {
    prikaziGresku("Prvo unesi operaciju");
    return;
  }
  izraz += String(zadnjiRezultat);
  jeRezultat = false;
  izrazPolje.value = izraz;
}

/* ---------- Izračun i čuvanje ---------- */
async function izracunaj() {
  const greska = validiraj(izraz);
  if (greska) {
    prikaziGresku(greska);
    return;
  }

  let r;
  try {
    r = evaluate(izraz);
  } catch (e) {
    prikaziGresku("Greška: dijeljenje nulom");
    return;
  }
  if (r === null || !isFinite(r)) {
    prikaziGresku("Nepotpun izraz");
    return;
  }

  const tekst = String(r);
  rezultat.textContent = tekst;
  zadnjiRezultat = r;

  const { error } = await db.from("istorija").insert({ izraz, rezultat: tekst });

  izraz = tekst;
  izrazPolje.value = izraz;
  jeRezultat = true;

  if (error) {
    console.error(error);
    prikaziGresku("Račun nije sačuvan");
    prijaviGresku(`Izraz: ${izraz}, greška: ${error.message}`);
    return;
  }
  await ucitajIstoriju();
}

/* ---------- Historija ---------- */
async function obrisi(id) {
  const { error } = await db.from("istorija").delete().eq("id", id);
  if (error) {
    console.error(error);
    return;
  }
  await ucitajIstoriju();
}

listaIstorije.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-izraz]");
  if (!li) return;
  if (e.target.closest(".brisi")) return;
  izraz = li.dataset.izraz;
  rezultat.textContent = "";
  jeRezultat = false;
  izrazPolje.value = izraz;
});

async function ucitajIstoriju() {
  const { data, error } = await db
    .from("istorija")
    .select("id, izraz, rezultat, broj_a, operacija, broj_b")
    .order("id", { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
    return;
  }

  listaIstorije.innerHTML = "";
  if (data.length === 0) {
    const li = document.createElement("li");
    li.className = "prazno";
    li.textContent = "Još nema računa.";
    listaIstorije.appendChild(li);
    return;
  }

  data.forEach((red) => {
    const li = document.createElement("li");
    const izrazTekst = red.izraz ?? `${red.broj_a} ${red.operacija} ${red.broj_b}`;
    li.dataset.izraz = izrazTekst;
    li.title = "Klikni da vratiš izraz na ekran";

    const izrazSpan = document.createElement("span");
    izrazSpan.className = "izraz";
    izrazSpan.textContent = izrazTekst;

    const desno = document.createElement("div");
    desno.className = "desno";

    const rez = document.createElement("span");
    rez.className = "rez";
    rez.textContent = `= ${red.rezultat}`;

    const brisi = document.createElement("button");
    brisi.className = "brisi";
    brisi.type = "button";
    brisi.setAttribute("aria-label", "Obriši račun");
    brisi.textContent = "×";
    brisi.addEventListener("click", () => obrisi(red.id));

    desno.append(rez, brisi);
    li.append(izrazSpan, desno);
    listaIstorije.appendChild(li);
  });
}

/* ---------- Prijava ---------- */
async function prijava() {
  authPoruka.textContent = "";
  const { error } = await db.auth.signInWithPassword({
    email: emailPolje.value.trim(),
    password: lozinkaPolje.value,
  });
  if (error) authPoruka.textContent = error.message;
}

async function registracija() {
  authPoruka.textContent = "";
  const { data, error } = await db.auth.signUp({
    email: emailPolje.value.trim(),
    password: lozinkaPolje.value,
  });
  if (error) {
    authPoruka.textContent = error.message;
    return;
  }
  if (!data.session) {
    authPoruka.textContent = "Registracija uspjela. Prijavi se.";
  }
}

async function provjeriAdmina() {
  const { data, error } = await db.rpc("je_admin");
  return !error && data === true;
}

async function prikaziStanje(session) {
  const prijavljen = !!session;
  authSekcija.hidden = prijavljen;
  app.hidden = !prijavljen;
  korisnik.hidden = !prijavljen;
  odjavaBtn.hidden = !prijavljen;
  dashboardBtn.hidden = true;

  if (prijavljen) {
    korisnik.textContent = session.user.email;
    ucitajIstoriju();
    dashboardBtn.hidden = !(await provjeriAdmina());
  }
}

db.auth.onAuthStateChange((_event, session) => prikaziStanje(session));

el("prijavi").addEventListener("click", prijava);
el("registruj").addEventListener("click", registracija);
odjavaBtn.addEventListener("click", () => db.auth.signOut());

/* ---------- Modal s prečicama ---------- */
const modal = el("modal");
const modalKutija = el("modalKutija");
const precicaBtn = el("precicaBtn");
let zadnjiFokus = null;

function otvoriPrecice() {
  zadnjiFokus = document.activeElement;
  modal.hidden = false;
  el("modalZatvori").focus();
}

function zatvoriPrecice() {
  modal.hidden = true;
  if (zadnjiFokus) zadnjiFokus.focus();
}

precicaBtn.addEventListener("click", otvoriPrecice);
el("modalZatvori").addEventListener("click", zatvoriPrecice);
modal.addEventListener("click", (e) => {
  if (!modalKutija.contains(e.target)) zatvoriPrecice();
});

modal.addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const fokusabilni = modal.querySelectorAll("button, [href], input, [tabindex]:not([tabindex='-1'])");
  const prvi = fokusabilni[0];
  const zadnji = fokusabilni[fokusabilni.length - 1];
  if (e.shiftKey && document.activeElement === prvi) {
    e.preventDefault();
    zadnji.focus();
  } else if (!e.shiftKey && document.activeElement === zadnji) {
    e.preventDefault();
    prvi.focus();
  }
});

/* ---------- Dugmad i tastatura ---------- */
document.querySelectorAll(".tipka").forEach((t) => {
  t.addEventListener("click", () => dodaj(t.dataset.k));
});
el("izracunaj").addEventListener("click", izracunaj);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) {
    e.preventDefault();
    zatvoriPrecice();
    return;
  }
  if (app.hidden || !modal.hidden) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  const k = e.key;

  if (/^[0-9]$/.test(k)) { e.preventDefault(); dodaj(k); }
  else if (k === "." || k === ",") { e.preventDefault(); dodaj("."); }
  else if (OP[k]) { e.preventDefault(); dodaj(k); }
  else if (k === "%") { e.preventDefault(); dodaj("%"); }
  else if (k === "r" || k === "R") { e.preventDefault(); dodaj("√"); }
  else if (k === "a" || k === "A") { e.preventDefault(); dodaj("ANS"); }
  else if (k === "Enter" || k === "=") { e.preventDefault(); izracunaj(); }
  else if (k === "Backspace") { e.preventDefault(); dodaj("⌫"); }
  else if (k === "Escape" || k === "c" || k === "C") { e.preventDefault(); dodaj("C"); }
});