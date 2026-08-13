import { createFileRoute } from "@tanstack/react-router";

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeHexEqual(a: string, b: string) {
  if (a.length !== b.length || a.length % 2 !== 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 2) {
    diff |= Number.parseInt(a.slice(i, i + 2), 16) ^ Number.parseInt(b.slice(i, i + 2), 16);
  }
  return diff === 0;
}

async function validStripeSignature(body: string, header: string, secret: string) {
  const fields = header.split(",").map((part) => part.trim().split("=", 2) as [string, string]);
  const timestamp = fields.find(([key]) => key === "t")?.[1];
  const signatures = fields.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;
  const time = Number(timestamp);
  if (!Number.isFinite(time) || Math.abs(Date.now() / 1000 - time) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  const expected = bytesToHex(digest);
  return signatures.some((signature) => constantTimeHexEqual(expected, signature));
}

type StripeEvent = {
  id?: string;
  type?: string;
  data?: {
    object?: {
      id?: string;
      payment_status?: string;
      payment_intent?: string | null;
      amount?: number;
      amount_refunded?: number;
      metadata?: Record<string, string>;
    };
  };
};

async function alreadyProcessed(eventId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("stripe_webhook_events").select("event_id").eq("event_id", eventId).maybeSingle();
  return Boolean(data);
}

async function markProcessed(eventId: string, eventType: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("stripe_webhook_events").upsert({ event_id: eventId, event_type: eventType }, { onConflict: "event_id" });
}

async function handleCheckoutCompleted(session: NonNullable<StripeEvent["data"]>["object"]) {
  if (!session?.id || session.payment_status !== "paid") return;
  const userId = session.metadata?.user_id;
  const packId = session.metadata?.game_pack_id;
  const purchaseId = session.metadata?.purchase_id;
  if (!userId || !packId || !purchaseId) throw new Error("Checkout metadata missing purchase identity");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: purchase } = await supabaseAdmin.from("purchases")
    .update({
      status: "paid",
      provider_reference: session.id,
      provider_payment_intent: session.payment_intent ?? null,
      paid_at: new Date().toISOString(),
      refunded_at: null,
    })
    .eq("id", purchaseId)
    .eq("user_id", userId)
    .eq("game_pack_id", packId)
    .eq("provider", "stripe")
    .select("id")
    .maybeSingle();
  if (!purchase) throw new Error("Purchase not found for completed checkout");

  await supabaseAdmin.from("pack_entitlements").upsert({
    user_id: userId,
    game_pack_id: packId,
    purchase_id: purchase.id,
    revoked_at: null,
    granted_at: new Date().toISOString(),
  }, { onConflict: "user_id,game_pack_id" });
}

async function handleCheckoutExpired(session: NonNullable<StripeEvent["data"]>["object"]) {
  if (!session?.id) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("purchases")
    .update({ status: "failed" })
    .eq("provider", "stripe")
    .eq("provider_reference", session.id)
    .eq("status", "pending");
}

async function handleChargeRefunded(charge: NonNullable<StripeEvent["data"]>["object"]) {
  if (!charge) return;
  const amount = charge.amount ?? 0;
  const amountRefunded = charge.amount_refunded ?? 0;
  // Keep entitlement for partial refunds; a full refund revokes ownership.
  if (amount <= 0 || amountRefunded < amount) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const purchaseIdFromMetadata = charge.metadata?.purchase_id;
  let query = supabaseAdmin.from("purchases").select("id, user_id, game_pack_id").eq("provider", "stripe");
  if (purchaseIdFromMetadata) query = query.eq("id", purchaseIdFromMetadata);
  else if (charge.payment_intent) query = query.eq("provider_payment_intent", charge.payment_intent);
  else return;

  const { data: purchase } = await query.maybeSingle();
  if (!purchase) return;
  const now = new Date().toISOString();
  await Promise.all([
    supabaseAdmin.from("purchases").update({ status: "refunded", refunded_at: now }).eq("id", purchase.id),
    supabaseAdmin.from("pack_entitlements").update({ revoked_at: now }).eq("purchase_id", purchase.id).is("revoked_at", null),
  ]);
}

export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });
        const body = await request.text();
        const signature = request.headers.get("stripe-signature") ?? "";
        if (!(await validStripeSignature(body, signature, secret))) return new Response("Invalid signature", { status: 400 });

        let event: StripeEvent;
        try { event = JSON.parse(body) as StripeEvent; }
        catch { return new Response("Invalid JSON", { status: 400 }); }
        if (!event.id || !event.type) return new Response("Missing event identity", { status: 400 });
        if (await alreadyProcessed(event.id)) return new Response("ok");

        try {
          if (event.type === "checkout.session.completed") await handleCheckoutCompleted(event.data?.object);
          else if (event.type === "checkout.session.expired") await handleCheckoutExpired(event.data?.object);
          else if (event.type === "charge.refunded") await handleChargeRefunded(event.data?.object);
          await markProcessed(event.id, event.type);
          return new Response("ok");
        } catch (error) {
          console.error("Stripe webhook failed", { eventId: event.id, type: event.type, error });
          return new Response("Webhook processing failed", { status: 500 });
        }
      },
    },
  },
});
