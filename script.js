const SUPABASE_URL = "https://wvzejipxusngsuopzyic.supabase.co";
const SUPABASE_KEY = "sb_publishable_E0-L4WIo2J9XQK-6YLg1cQ_mxSBaanx";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const a = document.getElementById("a");
const op = document.getElementById("op");
const b = document.getElementById("b");
const btn = document.getElementById("izracunaj");
const rezultat = document.getElementById("rezultat");

btn.addEventListener("click", async () => {
  const x = parseFloat(a.value);
  const y = parseFloat(b.value);
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
    rezultat: String(r)
  });
  if (error) console.error(error);
});