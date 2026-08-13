REVOKE SELECT ON public.room_players FROM anon, authenticated;
GRANT SELECT (id, room_id, character_id, nickname, status, is_host, score, streak, last_seen_at, joined_at, updated_at) ON public.room_players TO anon, authenticated;
REVOKE SELECT ON public.rooms FROM anon, authenticated;
GRANT SELECT (id, code, game_pack_id, status, max_players, display_connected, expires_at, created_at, updated_at) ON public.rooms TO anon, authenticated;