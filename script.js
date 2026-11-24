const SUPABASE_URL = "https://wvzejipxusngsuopzyic.supabase.co";
const SUPABASE_KEY = "sb_publishable_E0-L4WIo2J9XQK-6YLg1cQ_mxSBaanx";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const a = document.getElementById("a");
const op = document.getElementById("op");
const b = document.getElementById("b");
const btn = document.getElementById("izracunaj");
const rezultat = document.getElementById("rezultat");
const listaIstorije = document.getElementById("istorija");

let aktivno = a;

function postaviAktivno(el) {
  aktivno = el;
  a.classList.toggle("aktivno", el === a);
  b.classList.toggle("aktivno", el === b);
}

a.addEventListener("click", () => postaviAktivno(a));
b.addEventListener("click", () => postaviAktivno(b));
postaviAktivno(a);

const OPERACIJE = { "+": "+", "-": "-", "*": "*", "x": "*", "X": "*", "/": "/" };
const UNARNE = ["√", "%"];

function unesi(znak) {
  if (znak === "C") {
    a.value = "";
    b.value = "";
    op.value = "+";
    rezultat.textContent = "";
    postaviAktivno(a);
    return;
  }
  if (znak === "⌫") {
    aktivno.value = aktivno.value.slice(0, -1);
    return;
  }
  if (UNARNE.includes(znak)) {
    izvrsiUnarnu(znak);
    return;
  }
  if (OPERACIJE[znak]) {
    op.value = OPERACIJE[znak];
    if (a.value !== "") postaviAktivno(b);
    return;
  }
  if (znak === ".") {
    if (!aktivno.value.includes(".")) {
      aktivno.value = (aktivno.value || "0") + ".";
    }
    return;
  }
  aktivno.value += znak;
}

async function izvrsiUnarnu(tip) {
  const x = parseFloat(a.value);
  if (isNaN(x)) {
    rezultat.textContent = "Unesi broj";
    return;
  }

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
  rezultat.textContent = r;

  const { error } = await db.from("istorija").insert({
    broj_a: x,
    operacija: tip,
    broj_b: 0,
    rezultat: String(r),
  });
  if (error) {
    console.error(error);
    return;
  }
  await ucitajIstoriju();
}

document.querySelectorAll(".tipka").forEach((t) => {
  t.addEventListener("click", () => unesi(t.dataset.k));
});

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;

  if (/^[0-9]$/.test(k)) {
    e.preventDefault();
    unesi(k);
  } else if (k === "." || k === ",") {
    e.preventDefault();
    unesi(".");
  } else if (OPERACIJE[k]) {
    e.preventDefault();
    unesi(k);
  } else if (k === "%") {
    e.preventDefault();
    unesi("%");
  } else if (k === "r" || k === "R") {
    e.preventDefault();
    unesi("√");
  } else if (k === "Enter" || k === "=") {
    e.preventDefault();
    btn.click();
  } else if (k === "Backspace") {
    e.preventDefault();
    unesi("⌫");
  } else if (k === "Escape" || k === "c" || k === "C") {
    e.preventDefault();
    unesi("C");
  }
});

function opisiRed(red) {
  if (red.operacija === "√") return `√${red.broj_a}`;
  if (red.operacija === "%") return `${red.broj_a}%`;
  return `${red.broj_a} ${red.operacija} ${red.broj_b}`;
}

async function ucitajIstoriju() {
  const { data, error } = await db
    .from("istorija")
    .select("broj_a, operacija, broj_b, rezultat")
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
    const izraz = document.createElement("span");
    izraz.className = "izraz";
    izraz.textContent = opisiRed(red);
    const rez = document.createElement("span");
    rez.className = "rez";
    rez.textContent = `= ${red.rezultat}`;
    li.append(izraz, rez);
    listaIstorije.appendChild(li);
  });
}

btn.addEventListener("click", async () => {
  const x = parseFloat(a.value);
  const y = parseFloat(b.value);
  if (isNaN(x) || isNaN(y)) {
    rezultat.textContent = "Unesi oba broja";
    return;
  }

  let r;
  switch (op.value) {
    case "+": r = x + y; break;
    case "-": r = x - y; break;
    case "*": r = x * y; break;
    case "/": r = y === 0 ? "Greška: dijeljenje nulom" : x / y; break;
  }
  rezultat.textContent = r;

  const { error } = await db.from("istorija").insert({
    broj_a: x,
    operacija: op.value,
    broj_b: y,
    rezultat: String(r),
  });
  if (error) {
    console.error(error);
    return;
  }
  await ucitajIstoriju();
});

ucitajIstoriju();