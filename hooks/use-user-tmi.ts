"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Returns the user's TMI as a decimal (e.g. 0.3 for 30%).
 * Defaults to 0.3 until the profile is loaded.
 */
export function useUserTmi(): number {
  const [tmi, setTmi] = useState(0.3);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("users")
        .select("tax_bracket")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.tax_bracket != null) setTmi(data.tax_bracket / 100);
        });
    });
  }, []);

  return tmi;
}
