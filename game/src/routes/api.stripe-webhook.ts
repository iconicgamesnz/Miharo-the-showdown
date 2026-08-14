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
      customer_email?: string | null;
      customer_details?: {
        email?: string | null;
      } | null;
      metadata?: Record<string, string>;
    };
  };
};


const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * A purchase always generates the same human-friendly code.
 * The raw code is never stored in Supabase — only its SHA-256 hash.
 */
async function accessCodeForPurchase(purchaseId: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const digest = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`showdown-access:${purchaseId}`),
    ),
  );

  const chars = Array.from(digest.slice(0, 8))
    .map((byte) => ACCESS_CODE_ALPHABET[byte % ACCESS_CODE_ALPHABET.length])
    .join("");

  return `MIH-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

async function hashAccessCode(code: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(code.trim().toUpperCase()),
  );
  return bytesToHex(digest);
}

async function sendAccessCodeEmail({
  email,
  code,
  purchaseId,
}: {
  email: string;
  code: string;
  purchaseId: string;
}) {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM_EMAIL"];

  if (!apiKey || !from) {
    throw new Error("Resend email is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `showdown-access/${purchaseId}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Your Mīharo: The Showdown access code",
      text: [
        "Kia ora!",
        "",
        "Your Kiwi As — Full Showdown purchase is ready.",
        "",
        `ACCESS CODE: ${code}`,
        "",
        "Go to https://showdown.playmiharo.co.nz",
        "Enter this code to launch the Full Showdown.",
        "",
        "Your purchase is permanent, so keep this email.",
        "Up to 6 players can join each game.",
        "",
        "Mīharo: The Showdown",
        "An Iconic Games platform",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;background:#05070c;color:#ffffff;padding:32px;max-width:620px;margin:auto">
          <p style="font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:#8c9aac">
            ICONIC GAMES PRESENTS
          </p>

          <h1 style="font-size:34px;margin-bottom:8px">
            Mīharo: The Showdown
          </h1>

          <p style="font-size:18px">
            Kia ora! Your <strong>Kiwi As — Full Showdown</strong> purchase is ready.
          </p>

          <div style="margin:32px 0;padding:24px;border:2px solid #39d9ff;border-radius:16px;text-align:center">
            <p style="margin:0 0 10px;font-size:12px;letter-spacing:.25em;color:#8c9aac">
              YOUR PERMANENT ACCESS CODE
            </p>
            <div style="font-size:34px;font-weight:800;letter-spacing:.12em;color:#39d9ff">
              ${code}
            </div>
          </div>

          <p>
            Enter this code at
            <strong>showdown.playmiharo.co.nz</strong>
            to launch the Full Game.
          </p>

          <p>
            Your purchase is permanent, so keep this email.
            Up to 6 players can join each Showdown.
          </p>

          <p style="margin-top:32px;color:#8c9aac">
            Mīharo: The Showdown<br>
            An Iconic Games platform
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Couldn't send access email (${response.status}): ${detail.slice(0, 200)}`);
  }
}

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
  const packId = session.metadata?.game_pack_id;
  const purchaseId = session.metadata?.purchase_id;
  if (!packId || !purchaseId) throw new Error("Checkout metadata missing purchase identity");

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
    .eq("game_pack_id", packId)
    .eq("provider", "stripe")
    .select("id, user_id, customer_email")
    .maybeSingle();
  if (!purchase) throw new Error("Purchase not found for completed checkout");

  // Keep legacy account ownership working for older signed-in purchases.
  if (purchase.user_id) {
    await supabaseAdmin.from("pack_entitlements").upsert({
      user_id: purchase.user_id,
      game_pack_id: packId,
      purchase_id: purchase.id,
      revoked_at: null,
      granted_at: new Date().toISOString(),
    }, { onConflict: "user_id,game_pack_id" });
  }

  const customerEmail =
    session.customer_details?.email?.trim().toLowerCase() ??
    session.customer_email?.trim().toLowerCase() ??
    purchase.customer_email?.trim().toLowerCase();

  if (!customerEmail) {
    throw new Error("Completed checkout has no customer email.");
  }

  const accessSecret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!accessSecret) throw new Error("Access-code secret is unavailable.");

  const accessCode = await accessCodeForPurchase(purchase.id, accessSecret);
  const codeHash = await hashAccessCode(accessCode);

  const { error: codeError } = await supabaseAdmin
    .from("pack_access_codes")
    .upsert({
      purchase_id: purchase.id,
      game_pack_id: packId,
      customer_email: customerEmail,
      code_hash: codeHash,
      code_hint: accessCode.slice(-4),
      max_players: 6,
      active: true,
      revoked_at: null,
    }, { onConflict: "purchase_id" });

  if (codeError) {
    throw new Error(`Couldn't create access code: ${codeError.message}`);
  }

  await sendAccessCodeEmail({
    email: customerEmail,
    code: accessCode,
    purchaseId: purchase.id,
  });
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
    supabaseAdmin
      .from("pack_access_codes")
      .update({ active: false, revoked_at: now })
      .eq("purchase_id", purchase.id),
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
