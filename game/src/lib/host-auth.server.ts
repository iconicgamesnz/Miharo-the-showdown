/**
 * Host authorisation.
 *
 * A room can be driven either by the device that created it (host token, kept
 * on the TV/creator device) or by the player seat flagged `is_host` — the first
 * person to join. Solo play uses the second path: one phone, one bird, no
 * second device holding a host token.
 *
 * Both paths still require a legitimate secret; nothing here weakens validation.
 */
import { hashToken } from "@/lib/rooms.server";

type AdminClient = {
  from: (table: string) => any;
};

export async function isRoomHost(
  admin: AdminClient,
  roomId: string,
  roomHostTokenHash: string | null,
  token: string,
): Promise<boolean> {
  const tokenHash = await hashToken(token);
  if (roomHostTokenHash && roomHostTokenHash === tokenHash) return true;

  const { data: hostSeat } = await admin
    .from("room_players")
    .select("id")
    .eq("room_id", roomId)
    .eq("player_token_hash", tokenHash)
    .eq("is_host", true)
    .neq("status", "left")
    .maybeSingle();

  return Boolean(hostSeat);
}
