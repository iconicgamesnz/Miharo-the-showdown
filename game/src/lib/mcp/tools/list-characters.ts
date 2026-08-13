import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "list_characters",
  title: "List Kiwi As birds",
  description:
    "List the playable Kiwi As bird characters with their slug, name, tagline, personality, accessory and accent colour.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const supabase = supabaseAnon();
    const { data, error } = await supabase
      .from("characters")
      .select("slug, name, tagline, personality, accessory, accent_color, active, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const birds = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(birds, null, 2) }],
      structuredContent: { count: birds.length, characters: birds },
    };
  },
});
