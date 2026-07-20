import { createClient } from "@/lib/supabase/server";

export const revalidate = 0;

export default async function JoinPage() {
  const supabase = createClient();
  const { data: settings } = await supabase.from("site_settings").select("hiring_open").eq("id", 1).single();
  const hiringOpen = !!settings?.hiring_open;

  return (
    <div className="max-w-3xl mx-auto px-6 py-14">
      <div className="text-center mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-accent2">Join the team</span>
        <h1 className="text-3xl sm:text-4xl font-bold mt-1">Become a Booster</h1>
        <p className="text-gray-400 mt-2">
          Real players, flexible hours. Tell us what you play and how good you are.
        </p>
      </div>

      {hiringOpen ? (
        <div className="card overflow-hidden">
          <iframe
            src="https://form.jotform.com/260727828158063"
            title="XpeedCarry Booster Application"
            className="w-full"
            style={{ height: "1400px", border: "none" }}
          />
        </div>
      ) : (
        <div className="card p-10 text-center">
          <p className="text-lg font-semibold mb-2">We're not actively hiring right now.</p>
          <p className="text-gray-400 text-sm">
            Check back soon — we bring on new boosters in waves as demand picks up.
          </p>
        </div>
      )}
    </div>
  );
}
