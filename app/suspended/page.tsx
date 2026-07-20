import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Account Suspended | XpeedCarry" };
export const revalidate = 0;

export default async function SuspendedPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("under_investigation")
    .eq("id", user?.id)
    .maybeSingle();

  const investigating = !!profile?.under_investigation;

  return (
    <div className="max-w-md mx-auto mt-24 card p-8 text-center">
      <h1 className="text-xl font-bold mb-3 text-red-400">
        {investigating ? "Account Under Review" : "Account Suspended"}
      </h1>
      <p className="text-sm text-gray-300">
        {investigating
          ? "Your account is temporarily on hold while we look into a report on one of your orders. This isn't a final decision, we'll follow up with you shortly."
          : "Your account has been suspended for violating our community guidelines. If you think this is a mistake, reach out to us."}{" "}
        Questions? Email{" "}
        <a href="mailto:support@xpeedcarry.net" className="text-accent hover:underline">
          support@xpeedcarry.net
        </a>
        .
      </p>
    </div>
  );
}
