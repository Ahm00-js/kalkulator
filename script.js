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

let izraz = "";
let zadnjiRezultat = null;
let jeRezultat = false;

/* ---------- Tema ---------- */
function primijeniTemu(tamna) {
  document.body.classList.toggle("tamna", tamna);
  localStorage.setItem("tema", tamna ? "tamna" : "svijetla");
}
primijeniTemu(localStorage.getItem("tema") === "tamna");
el("temaBtn").addEventListener("click", () =>
  primijeniTemu(!document.body.classList.contains("tamna"))
);

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
      izraz += znak;
    } else if (znak === ".") {
      const m = izraz.match(/[\d.]*$/)[0];
      if (!m.includes(".")) izraz += m === "" ? "0." : ".";
    } else if (OP[znak]) {
      const op = OP[znak];
      if (izraz === "") {
        if (op === "-") izraz = "-";
      } else if (/[+\-*\/]$/.test(izraz)) {
        izraz = izraz.slice(0, -1) + op;
      } else {
        izraz += op;
      }
    }
  }
  izrazPolje.value = izraz;
}

function primijeniFunkciju(tip) {
  const m = izraz.match(/(\d+\.?\d*)$/);
  if (!m) return;
  const x = parseFloat(m[1]);
  let r;
  if (tip === "√") {
    if (x < 0) {
      rezultat.textContent = "Greška: korijen negativnog broja";
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
    rezultat.textContent = "Nema prethodnog rezultata";
    return;
  }
  if (zadnjiRezultat < 0) {
    rezultat.textContent = "ANS je negativan, unesi ručno";
    return;
  }
  if (/[\d.]$/.test(izraz)) {
    rezultat.textContent = "Prvo unesi operaciju";
    return;
  }
  izraz += String(zadnjiRezultat);
  jeRezultat = false;
  izrazPolje.value = izraz;
}

/* ---------- Izračun i čuvanje ---------- */
async function izracunaj() {
  if (!izraz) return;
  let r;
  try {
    r = evaluate(izraz);
  } catch (e) {
    rezultat.textContent = "Greška: dijeljenje nulom";
    return;
  }
  if (r === null || !isFinite(r)) {
    rezultat.textContent = "Nepotpun izraz";
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

    const izrazSpan = document.createElement("span");
    izrazSpan.className = "izraz";
    izrazSpan.textContent = red.izraz ?? `${red.broj_a} ${red.operacija} ${red.broj_b}`;

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

/* ---------- Dugmad i tastatura ---------- */
document.querySelectorAll(".tipka").forEach((t) => {
  t.addEventListener("click", () => dodaj(t.dataset.k));
});
el("izracunaj").addEventListener("click", izracunaj);

document.addEventListener("keydown", (e) => {
  if (app.hidden) return;
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