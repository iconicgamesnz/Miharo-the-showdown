import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ROOM_RULES } from "@/config/rounds";
import {
  generateRoomCode,
  generateToken,
  hashToken,
  normalizeCode,
  sanitizeNickname,
} from "@/lib/rooms.server";

async function hashAccessCode(code: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(code.trim().toUpperCase()),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * All room mutations run here. The browser has read-only access to rooms and
 * players via RLS; every write goes through these authoritative handlers.
 */

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      packSlug: z.enum(["kiwi-as-quickie", "kiwi-as-full"]),
      accessToken: z.string().min(20).optional(),
      accessCode: z.string().min(8).max(32).optional(),
      hostNickname: z.string().min(1).max(20).optional(),
      hostCharacterSlug: z.string().min(2).max(20).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pack, error: packError } = await supabaseAdmin
      .from("game_packs")
      .select("id, slug, is_free, title")
      .eq("slug", data.packSlug)
      .maybeSingle();
    if (packError || !pack) throw new Error("That game pack isn't available.");

    let accessCodeId: string | null = null;
    let accessMaxPlayers = ROOM_RULES.maxPlayers;

    if (!pack.is_free) {
      if (data.accessCode) {
        const normalizedAccessCode = data.accessCode.trim().toUpperCase();
        const codeHash = await hashAccessCode(normalizedAccessCode);

        const { data: accessCode } = await supabaseAdmin
          .from("pack_access_codes")
          .select("id, max_players")
          .eq("code_hash", codeHash)
          .eq("game_pack_id", pack.id)
          .eq("active", true)
          .is("revoked_at", null)
          .maybeSingle();

        if (!accessCode) {
          throw new Error("That Full Showdown access code isn't valid.");
        }

        accessCodeId = accessCode.id;
        accessMaxPlayers = Math.min(accessCode.max_players ?? ROOM_RULES.maxPlayers, ROOM_RULES.maxPlayers);

        await supabaseAdmin
          .from("pack_access_codes")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", accessCode.id);
      } else if (data.accessToken) {
        // Legacy account ownership still works during the transition.
        const { data: authData, error: authError } =
          await supabaseAdmin.auth.getUser(data.accessToken);

        if (authError || !authData.user) {
          throw new Error("Your sign-in expired.");
        }

        const { data: entitlement } = await supabaseAdmin
          .from("pack_entitlements")
          .select("id")
          .eq("user_id", authData.user.id)
          .eq("game_pack_id", pack.id)
          .is("revoked_at", null)
          .maybeSingle();

        if (!entitlement) {
          throw new Error("Kiwi As — Full Showdown isn't unlocked on this account yet.");
        }
      } else {
        throw new Error("Enter your Full Showdown access code.");
      }
    }

    let hostNickname: string | null = null;
    let hostCharacter: { id: string; slug: string; name: string } | null = null;

    if (data.hostNickname || data.hostCharacterSlug) {
      if (!data.hostNickname || !data.hostCharacterSlug) {
        throw new Error("Choose your nickname and bird first.");
      }

      hostNickname = sanitizeNickname(data.hostNickname);
      if (!hostNickname) throw new Error("Pop in a nickname first.");

      const { data: character } = await supabaseAdmin
        .from("characters")
        .select("id, slug, name")
        .eq("slug", data.hostCharacterSlug)
        .maybeSingle();

      if (!character) throw new Error("Pick one of the birds.");
      hostCharacter = character;
    }

    const hostToken = generateToken();
    const hostTokenHash = await hashToken(hostToken);

    let code = "";
    let roomId = "";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = generateRoomCode();
      const { data: room, error } = await supabaseAdmin
        .from("rooms")
        .insert({
          code: candidate,
          game_pack_id: pack.id,
          host_token_hash: hostTokenHash,
          max_players: accessMaxPlayers,
          access_code_id: accessCodeId,
        })
        .select("id, code")
        .maybeSingle();
      if (room) {
        code = room.code;
        roomId = room.id;
        break;
      }
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    }
    if (!code) throw new Error("Couldn't create a room right now. Give it another crack.");

    await supabaseAdmin.from("showdown_game_sessions").insert({
      room_id: roomId,
      game_pack_id: pack.id,
      status: "pending",
      phase: "lobby",
    });

    await supabaseAdmin.from("analytics_events").insert({
      event_key: "room_created",
      room_id: roomId,
      game_pack_id: pack.id,
      properties: { pack: pack.slug },
    });

    let playerToken: string | null = null;
    let playerId: string | null = null;

    if (hostNickname && hostCharacter) {
      playerToken = generateToken();
      const playerTokenHash = await hashToken(playerToken);

      const { data: player, error: playerError } = await supabaseAdmin
        .from("room_players")
        .insert({
          room_id: roomId,
          character_id: hostCharacter.id,
          nickname: hostNickname,
          player_token_hash: playerTokenHash,
          status: "ready",
          is_host: true,
        })
        .select("id")
        .maybeSingle();

      if (playerError || !player) {
        await supabaseAdmin.from("rooms").delete().eq("id", roomId);
        throw new Error("Couldn't create your player seat. Try again.");
      }

      playerId = player.id;

      await supabaseAdmin.from("analytics_events").insert({
        event_key: "player_joined",
        room_id: roomId,
        game_pack_id: pack.id,
        properties: {
          character: hostCharacter.slug,
          host: true,
        },
      });
    }

    return {
      code,
      roomId,
      hostToken,
      playerToken,
      playerId,
      packTitle: pack.title,
    };
  });

export const getRoomSummary = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ code: z.string().min(3).max(8) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = normalizeCode(data.code);
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, code, status, max_players, expires_at, game_packs(slug, title)")
      .eq("code", code)
      .maybeSingle();
    if (!room) return { found: false as const };
    if (new Date(room.expires_at) < new Date() || room.status === "expired") {
      return { found: false as const, expired: true };
    }
    const { count } = await supabaseAdmin
      .from("room_players")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id)
      .neq("status", "left");
    return {
      found: true as const,
      roomId: room.id,
      code: room.code,
      status: room.status,
      playerCount: count ?? 0,
      maxPlayers: room.max_players,
    };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().min(3).max(8),
        nickname: z.string().min(1).max(20),
        characterSlug: z.string().min(2).max(20),
        playerToken: z.string().min(10).max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = normalizeCode(data.code);
    const nickname = sanitizeNickname(data.nickname);
    if (!nickname) throw new Error("Pop in a nickname first.");

    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, status, max_players, expires_at, game_pack_id")
      .eq("code", code)
      .maybeSingle();
    if (!room) throw new Error("No room with that code.");
    if (new Date(room.expires_at) < new Date()) throw new Error("That room has expired.");
    if (room.status !== "lobby") throw new Error("That game has already kicked off.");

    const { data: character } = await supabaseAdmin
      .from("characters")
      .select("id, slug, name")
      .eq("slug", data.characterSlug)
      .maybeSingle();
    if (!character) throw new Error("Pick one of the birds.");

    const { data: existing } = await supabaseAdmin
      .from("room_players")
      .select("id, nickname, character_id, player_token_hash, status")
      .eq("room_id", room.id)
      .neq("status", "left");

    const players = existing ?? [];

    // Reconnect path: a device presenting a known token keeps its seat.
    if (data.playerToken) {
      const tokenHash = await hashToken(data.playerToken);
      const mine = players.find((p) => p.player_token_hash === tokenHash);
      if (mine) {
        const takenByOther = players.some(
          (p) => p.id !== mine.id && p.character_id === character.id,
        );
        if (takenByOther) throw new Error(`${character.name} has already been nabbed.`);
        await supabaseAdmin
          .from("room_players")
          .update({
            nickname,
            character_id: character.id,
            status: "ready",
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", mine.id);
        return { roomId: room.id, playerId: mine.id, playerToken: data.playerToken, code };
      }
    }

    if (players.length >= room.max_players) throw new Error("This room is full — six is the max.");
    if (players.some((p) => p.character_id === character.id))
      throw new Error(`${character.name} has already been nabbed.`);
    if (players.some((p) => p.nickname.toLowerCase() === nickname.toLowerCase()))
      throw new Error("Someone's already using that nickname.");

    const playerToken = generateToken();
    const playerTokenHash = await hashToken(playerToken);
    const isHost = players.length === 0;

    const { data: inserted, error } = await supabaseAdmin
      .from("room_players")
      .insert({
        room_id: room.id,
        character_id: character.id,
        nickname,
        player_token_hash: playerTokenHash,
        status: "ready",
        is_host: isHost,
      })
      .select("id")
      .maybeSingle();
    if (error || !inserted) throw new Error("Couldn't join that room. Try again.");

    await supabaseAdmin.from("analytics_events").insert({
      event_key: "player_joined",
      room_id: room.id,
      game_pack_id: room.game_pack_id,
      properties: { character: character.slug },
    });

    return { roomId: room.id, playerId: inserted.id, playerToken, code };
  });

export const swapCharacter = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().min(3).max(8),
        playerToken: z.string().min(10).max(80),
        characterSlug: z.string().min(2).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = normalizeCode(data.code);
    const tokenHash = await hashToken(data.playerToken);

    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, status")
      .eq("code", code)
      .maybeSingle();
    if (!room) throw new Error("No room with that code.");
    if (room.status !== "lobby") throw new Error("Too late to change bird.");

    const { data: character } = await supabaseAdmin
      .from("characters")
      .select("id, name")
      .eq("slug", data.characterSlug)
      .maybeSingle();
    if (!character) throw new Error("Pick one of the birds.");

    const { data: me } = await supabaseAdmin
      .from("room_players")
      .select("id")
      .eq("room_id", room.id)
      .eq("player_token_hash", tokenHash)
      .maybeSingle();
    if (!me) throw new Error("You're not in this room.");

    const { error } = await supabaseAdmin
      .from("room_players")
      .update({ character_id: character.id })
      .eq("id", me.id);
    if (error) throw new Error(`${character.name} has already been nabbed.`);
    return { ok: true };
  });

export const heartbeat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().min(3).max(8), playerToken: z.string().min(10).max(80) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = await hashToken(data.playerToken);
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id")
      .eq("code", normalizeCode(data.code))
      .maybeSingle();
    if (!room) return { ok: false };
    await supabaseAdmin
      .from("room_players")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("room_id", room.id)
      .eq("player_token_hash", tokenHash);
    return { ok: true };
  });

export const leaveRoom = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().min(3).max(8), playerToken: z.string().min(10).max(80) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = await hashToken(data.playerToken);
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id")
      .eq("code", normalizeCode(data.code))
      .maybeSingle();
    if (!room) return { ok: true };
    await supabaseAdmin
      .from("room_players")
      .update({ status: "left", character_id: null })
      .eq("room_id", room.id)
      .eq("player_token_hash", tokenHash);
    return { ok: true };
  });

/**
 * Starts the authoritative game session after host/player validation.
 * Question selection, timers and scoring are handled by the server game engine.
 */
export const startGame = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().min(3).max(8), hostToken: z.string().min(10).max(80) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isRoomHost } = await import("@/lib/host-auth.server");
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, host_token_hash, status, game_pack_id")
      .eq("code", normalizeCode(data.code))
      .maybeSingle();
    if (!room) throw new Error("No room with that code.");
    if (!(await isRoomHost(supabaseAdmin, room.id, room.host_token_hash, data.hostToken)))
      throw new Error("Only the host can start the show.");

    const { count } = await supabaseAdmin
      .from("room_players")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id)
      .neq("status", "left");
    if ((count ?? 0) < ROOM_RULES.minPlayers) throw new Error("Need at least one player.");

    const { createRoundQuestions, beginRoundIntro, loadContext, startingRoundForPack } = await import("@/lib/game.server");
    const ctx = await loadContext(supabaseAdmin, normalizeCode(data.code));
    if (!ctx) throw new Error("That game session is missing.");
    if (ctx.session.phase !== "lobby") return { ok: true };

    const startRound = await startingRoundForPack(supabaseAdmin, room.game_pack_id);
    const { offset, total } = await createRoundQuestions(
      supabaseAdmin,
      ctx.session.id,
      room.game_pack_id,
      startRound,
    );

    await supabaseAdmin.from("rooms").update({ status: "in_progress" }).eq("id", room.id);
    await supabaseAdmin
      .from("room_players")
      .update({ score: 0, streak: 0, status: "playing" })
      .eq("room_id", room.id)
      .neq("status", "left");
    await beginRoundIntro(supabaseAdmin, ctx.session.id, room.id, total, startRound, offset);
    return { ok: true };
  });

