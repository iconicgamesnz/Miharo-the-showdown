import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { soundManager } from "@/lib/audio/sound-manager";
import type { AceVoiceEvent } from "@/config/ace";

type Clip = { id: string; event_key: string; audio_url: string | null; weight: number };

/**
 * Loads Ace's uploaded voice clips and picks one at random (weighted) per
 * event so the same line doesn't repeat. No synthetic voice is ever generated.
 */
export function useAceVoice() {
  const [clips, setClips] = useState<Clip[]>([]);

  useEffect(() => {
    let active = true;
    supabase
      .from("ace_audio")
      .select("id, event_key, audio_url, weight")
      .eq("active", true)
      .then(({ data }) => {
        if (active && data) setClips(data);
      });
    return () => {
      active = false;
    };
  }, []);

  const say = useCallback(
    (event: AceVoiceEvent) => {
      const pool = clips.filter((c) => c.event_key === event && c.audio_url);
      if (pool.length === 0) return false;
      const total = pool.reduce((sum, c) => sum + Math.max(1, c.weight), 0);
      let roll = Math.random() * total;
      for (const clip of pool) {
        roll -= Math.max(1, clip.weight);
        if (roll <= 0) {
          soundManager.playAceClip(clip.audio_url);
          return true;
        }
      }
      return false;
    },
    [clips],
  );

  return { say, clipCount: clips.length };
}
