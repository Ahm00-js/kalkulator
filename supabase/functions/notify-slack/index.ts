import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DOZVOLJENE_AKCIJE = [
  "admin postavljen",
  "admin uklonjen",
  "deaktiviran",
  "aktiviran",
];

const SLACK_CHANNEL = "C0CLTU8T5RS";

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
    // Klijent koji koristi JWT prijavljenog korisnika, da provjerimo da je admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: jeAdmin, error: adminErr } = await db.rpc("je_admin");
    if (adminErr || jeAdmin !== true) {
      return json({ error: "Nema pristupa" }, 403);
    }

    const { data: userData } = await db.auth.getUser();
    const email = userData?.user?.email ?? "nepoznato";

    const { akcija, meta } = await req.json();
    if (!DOZVOLJENE_AKCIJE.includes(akcija)) {
      return json({ error: "Nepoznata akcija" }, 400);
    }

    const vrijeme = new Date().toLocaleString("bs-BA", { timeZone: "Europe/Sarajevo" });
    const tekst = `:bell: *Kalkulator – ${akcija}*\n${meta ?? ""}\nPoduzeo: ${email}\nVrijeme: ${vrijeme}`;

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