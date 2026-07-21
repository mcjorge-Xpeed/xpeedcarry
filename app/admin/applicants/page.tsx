import { createClient } from "@/lib/supabase/server";
import HiringToggle from "@/components/HiringToggle";

export const revalidate = 0;

// Alias para cuando el nombre del juego en el formulario de Jotform no
// coincide exacto con el nombre en nuestro catálogo (typos, abreviaciones).
const GAME_ALIASES: Record<string, string[]> = {
  "diablo 4": ["diablo iv"],
  "elden ring nightreign": ["elden ring nightrein"],
  "monster hunter wilds": ["mh wilds"],
  "call of duty: black ops 6": ["cod"],
};

const FIELD_LABELS: Record<string, string> = {
  q5_number3: "Years of experience",
  q6_textarea4: "Achievements / ranks",
  q8_textarea6: "Why they want to join",
  telegramUsername: "Telegram",
  discordUsername: "Discord",
  whatIs: "Weekly availability",
  canYou: "Can stream orders?",
  ifSelected: "Other games (not in our list)",
  selectThe: "Platforms",
  whereAre: "Location",
  areYou: "18 or older?",
  areYou20: "Willing to do a gameplay test?",
};

type JotformAnswer = {
  name: string;
  text: string;
  type: string;
  answer?: any;
  prettyFormat?: string;
};

type Applicant = {
  id: string;
  createdAt: string;
  fullName: string;
  email: string;
  games: string[];
  fields: { label: string; value: string }[];
  proofUrls: string[];
};

function normalize(s: string) {
  return s.trim().toLowerCase();
}

async function fetchApplicants(): Promise<Applicant[]> {
  const apiKey = process.env.JOTFORM_API_KEY;
  const formId = process.env.JOTFORM_FORM_ID;
  if (!apiKey || !formId) return [];

  const res = await fetch(
    `https://api.jotform.com/form/${formId}/submissions?apiKey=${apiKey}&limit=1000&orderby=created_at`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const json = await res.json();
  const submissions = json.content ?? [];

  return submissions.map((sub: any) => {
    const answers: Record<string, JotformAnswer> = sub.answers ?? {};
    let fullName = "-";
    let email = "-";
    let games: string[] = [];
    let proofUrls: string[] = [];
    const fields: { label: string; value: string }[] = [];

    for (const a of Object.values(answers)) {
      if (a.type === "control_fullname") {
        fullName = a.prettyFormat || "-";
      } else if (a.type === "control_email") {
        email = a.answer || "-";
      } else if (a.name === "q4_checkbox2") {
        games = Array.isArray(a.answer) ? a.answer : [];
      } else if (a.type === "control_fileupload") {
        proofUrls = Array.isArray(a.answer) ? a.answer : [];
      } else if (FIELD_LABELS[a.name] && (a.prettyFormat || a.answer)) {
        fields.push({ label: FIELD_LABELS[a.name], value: a.prettyFormat || String(a.answer) });
      }
    }

    return {
      id: sub.id,
      createdAt: sub.created_at,
      fullName,
      email,
      games,
      fields,
      proofUrls,
    };
  });
}

export default async function ApplicantsPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  const isStaff = me?.role === "admin" || me?.role === "support";

  if (!isStaff) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p>You don't have admin permissions.</p>
      </div>
    );
  }

  const [{ data: games }, applicants, { data: proGames }] = await Promise.all([
    supabase.from("games").select("id, name").order("name"),
    fetchApplicants(),
    supabase.from("pro_games").select("game_id"),
  ]);

  const coverage = (games ?? []).map((g) => {
    const gameNorm = normalize(g.name);
    const aliases = GAME_ALIASES[gameNorm] ?? [];
    const count = applicants.filter((app) =>
      app.games.some((game) => {
        const gn = normalize(game);
        return gn === gameNorm || aliases.includes(gn);
      })
    ).length;
    return { name: g.name, count };
  });

  const activeCoverage = (games ?? []).map((g) => ({
    name: g.name,
    count: (proGames ?? []).filter((pg) => pg.game_id === g.id).length,
  }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Applicants</h1>
        <HiringToggle />
      </div>
      <p className="text-gray-400 text-sm mb-8">
        Pulled live from your{" "}
        <a href="https://www.jotform.com/form/260727828158063" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          Jotform recruitment form
        </a>
        . {applicants.length} applicant(s) so far.
      </p>

      <h2 className="text-lg font-semibold mb-3">Active pro coverage (self-reported by your hired pros)</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-10">
        {activeCoverage.map((g) => (
          <div
            key={g.name}
            className={`card p-3 text-center ${g.count === 0 ? "border-red-500/40" : ""}`}
          >
            <p className="text-sm truncate">{g.name}</p>
            <p className={`text-xl font-bold ${g.count === 0 ? "text-red-400" : "text-accent2"}`}>{g.count}</p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold mb-3">Applicant coverage (from Jotform, snapshot at time of applying)</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-10">
        {coverage.map((g) => (
          <div
            key={g.name}
            className={`card p-3 text-center ${g.count === 0 ? "border-red-500/40" : ""}`}
          >
            <p className="text-sm truncate">{g.name}</p>
            <p className={`text-xl font-bold ${g.count === 0 ? "text-red-400" : "text-accent2"}`}>{g.count}</p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold mb-3">Applicants</h2>
      {applicants.length === 0 ? (
        <p className="text-gray-500 text-sm">No applicants yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {applicants
            .slice()
            .reverse()
            .map((app) => (
              <details key={app.id} className="card p-4">
                <summary className="cursor-pointer flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold">{app.fullName}</span>
                    <span className="text-gray-400 text-sm ml-2">{app.email}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {app.games.length} game(s) · {new Date(app.createdAt).toLocaleDateString()}
                  </span>
                </summary>
                <div className="mt-4 flex flex-col gap-3 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Games</p>
                    <p>{app.games.join(", ") || "-"}</p>
                  </div>
                  {app.fields.map((f) => (
                    <div key={f.label}>
                      <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{f.label}</p>
                      <p className="whitespace-pre-line">{f.value}</p>
                    </div>
                  ))}
                  {app.proofUrls.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Proof</p>
                      <div className="flex flex-col gap-1">
                        {app.proofUrls.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                            {url}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            ))}
        </div>
      )}
    </div>
  );
}
