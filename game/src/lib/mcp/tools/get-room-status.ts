import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "get_room_status",
  title: "Check room availability",
  description:
    "Check whether a Kiwi As room code is currently valid and what broad stage it is at (lobby, in progress, finished). Returns no player, score, or question information.",
  inputSchema: {
    code: z.string().describe("The room code shown on the TV display, e.g. 'K7QM'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ code }) => {
    const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (!normalized) throw new ToolError("Provide a room code.");

    const supabase = supabaseAnon();
    const { data: room, error } = await supabase
      .from("rooms")
      .select("status, expires_at")
      .eq("code", normalized)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const expired =
      !room || room.status === "expired" || new Date(room.expires_at).getTime() < Date.now();

    // Deliberately non-identifying: existence + broad stage only. No nicknames,
    // scores, player counts, answers or session internals are exposed publicly.
    const stage = !room
      ? "not_found"
      : expired
        ? "expired"
        : room.status === "lobby"
          ? "waiting_for_players"
          : room.status === "in_progress"
            ? "game_in_progress"
            : "finished";

    const result = { exists: Boolean(room) && !expired, stage };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
