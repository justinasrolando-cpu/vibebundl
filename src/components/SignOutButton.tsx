"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="nav-item w-full justify-start text-xs disabled:opacity-60"
    >
      <span className="w-4 shrink-0 text-center" aria-hidden>
        ⏻
      </span>
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
