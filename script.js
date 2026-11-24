const a = document.getElementById("a");
const op = document.getElementById("op");
const b = document.getElementById("b");
const btn = document.getElementById("izracunaj");
const rezultat = document.getElementById("rezultat");

btn.addEventListener("click", () => {
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
});