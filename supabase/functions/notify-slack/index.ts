import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Akcije koje može poslati samo admin
const ADMIN_AKCIJE = [
  "admin postavljen",
  "admin uklonjen",
  "deaktiviran",
  "aktiviran",
];

// Akcije koje može poslati bilo koji prijavljeni korisnik
const KORISNIK_AKCIJE = ["greska upisa"];

const SLACK_CHANNEL = "C0CLTU8T5RS";
const MAX_META = 300;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await db.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Nisi prijavljen" }, 401);
    }
    const email = userData.user.email ?? "nepoznato";

    const { akcija, meta } = await req.json();

    if (KORISNIK_AKCIJE.includes(akcija)) {
      // Svaki prijavljeni korisnik smije prijaviti grešku upisa
    } else if (ADMIN_AKCIJE.includes(akcija)) {
      const { data: jeAdmin, error: adminErr } = await db.rpc("je_admin");
      if (adminErr || jeAdmin !== true) {
        return json({ error: "Nema pristupa" }, 403);
      }
    } else {
      return json({ error: "Nepoznata akcija" }, 400);
    }

    const tekstMeta = String(meta ?? "").slice(0, MAX_META);
    const vrijeme = new Date().toLocaleString("bs-BA", { timeZone: "Europe/Sarajevo" });
    const tekst =
      `:bell: *Kalkulator – ${akcija}*\n${tekstMeta}\nKorisnik: ${email}\nVrijeme: ${vrijeme}`;

    const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SLACK_BOT_TOKEN")}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel: SLACK_CHANNEL, text: tekst }),
    });
    const slackData = await slackRes.json();

    if (!slackData.ok) {
      console.error("Slack greška:", slackData.error);
      return json({ error: `Slack: ${slackData.error}` }, 502);
    }

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "Greška na serveru" }, 500);
  }
});