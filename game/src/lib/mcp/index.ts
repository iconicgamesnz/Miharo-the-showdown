import { defineMcp } from "@lovable.dev/mcp-js";
import listCharactersTool from "./tools/list-characters";
import listGamePacksTool from "./tools/list-game-packs";
import getRoomStatusTool from "./tools/get-room-status";

export default defineMcp({
  name: "kiwi-as-showdown",
  title: "Kiwi As Showdown",
  version: "0.1.0",
  instructions:
    "Public read-only tools for the Kiwi As party game. Use `list_characters` for the playable birds and `list_game_packs` for available question packs. `get_room_status` only confirms whether a room code is currently valid and its broad stage — it never returns players, scores or question data.",
  tools: [listCharactersTool, listGamePacksTool, getRoomStatusTool] as unknown as Parameters<typeof defineMcp>[0]["tools"],
});
