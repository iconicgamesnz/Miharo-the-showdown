import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "list_game_packs",
  title: "List game packs",
  description:
    "List the available Iconic Games question packs, including title, subtitle, description, price in NZD cents and whether the pack is free.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const supabase = supabaseAnon();
    const { data, error } = await supabase
      .from("game_packs")
      .select("slug, title, subtitle, description, is_free, price_nzd_cents, question_count_target")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const packs = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(packs, null, 2) }],
      structuredContent: { count: packs.length, packs },
    };
  },
});
