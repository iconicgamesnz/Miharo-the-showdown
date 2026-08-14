import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const checkoutInput = z.object({
  packSlug: z.literal("kiwi-as-full"),
  email: z.string().email(),
  returnUrl: z.string().url(),
});

const purchaseStatusInput = z.object({
  accessToken: z.string().min(20),
  checkoutSessionId: z.string().min(8),
});

async function authenticatedUser(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Sign in before buying the full game.");
  return data.user;
}

export const getFullGameAccess = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ accessToken: z.string().min(20) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await authenticatedUser(data.accessToken);
    const { data: pack } = await supabaseAdmin.from("game_packs").select("id").eq("slug", "kiwi-as-full").maybeSingle();
    if (!pack) return { unlocked: false };
    const { data: entitlement } = await supabaseAdmin
      .from("pack_entitlements")
      .select("id")
      .eq("user_id", user.id)
      .eq("game_pack_id", pack.id)
      .is("revoked_at", null)
      .maybeSingle();
    return { unlocked: Boolean(entitlement) };
  });

export const getPurchaseStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => purchaseStatusInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await authenticatedUser(data.accessToken);
    const { data: purchase } = await supabaseAdmin
      .from("purchases")
      .select("status, game_pack_id")
      .eq("user_id", user.id)
      .eq("provider", "stripe")
      .eq("provider_reference", data.checkoutSessionId)
      .maybeSingle();
    if (!purchase) return { status: "not_found" as const, unlocked: false };

    const { data: entitlement } = await supabaseAdmin
      .from("pack_entitlements")
      .select("id")
      .eq("user_id", user.id)
      .eq("game_pack_id", purchase.game_pack_id)
      .is("revoked_at", null)
      .maybeSingle();
    return { status: purchase.status, unlocked: Boolean(entitlement) };
  });

export const createFullGameCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => checkoutInput.parse(input))
  .handler(async ({ data }) => {
    const stripeKey = process.env["STRIPE_SECRET_KEY"];
    if (!stripeKey) throw new Error("Payments aren't connected yet.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();

    const { data: pack } = await supabaseAdmin
      .from("game_packs")
      .select("id, title, price_nzd_cents")
      .eq("slug", data.packSlug)
      .eq("active", true)
      .maybeSingle();

    if (!pack) throw new Error("That game pack isn't available yet.");

    // Don't accidentally charge someone twice for the same permanent unlock.
    const { data: existingCode } = await supabaseAdmin
      .from("pack_access_codes")
      .select("id")
      .eq("game_pack_id", pack.id)
      .eq("customer_email", email)
      .eq("active", true)
      .is("revoked_at", null)
      .maybeSingle();

    if (existingCode) {
      return { alreadyOwned: true as const, url: null };
    }

    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("purchases")
      .insert({
        user_id: null,
        customer_email: email,
        game_pack_id: pack.id,
        amount_nzd_cents: pack.price_nzd_cents,
        provider: "stripe",
        provider_reference: null,
        status: "pending",
      })
      .select("id")
      .single();

    if (purchaseError || !purchase) {
      throw new Error("Couldn't start the purchase. Try again.");
    }

    const origin = new URL(data.returnUrl).origin;
    const form = new URLSearchParams();

    form.set("mode", "payment");
    form.set("success_url", `${origin}/?purchase=success&session_id={CHECKOUT_SESSION_ID}`);
    form.set("cancel_url", `${origin}/?purchase=cancelled`);
    form.set("customer_email", email);
    form.set("client_reference_id", purchase.id);

    form.set("metadata[game_pack_id]", pack.id);
    form.set("metadata[pack_slug]", data.packSlug);
    form.set("metadata[purchase_id]", purchase.id);

    form.set("payment_intent_data[metadata][game_pack_id]", pack.id);
    form.set("payment_intent_data[metadata][purchase_id]", purchase.id);

    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "nzd");
    form.set("line_items[0][price_data][unit_amount]", String(pack.price_nzd_cents));
    form.set("line_items[0][price_data][product_data][name]", pack.title);
    form.set(
      "line_items[0][price_data][product_data][description]",
      "One-time host unlock for Kiwi As — Full Game",
    );

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });

    const payload = await response.json() as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };

    if (!response.ok || !payload.url || !payload.id) {
      await supabaseAdmin
        .from("purchases")
        .update({ status: "failed" })
        .eq("id", purchase.id);

      throw new Error(payload.error?.message ?? "Couldn't open checkout.");
    }

    await supabaseAdmin
      .from("purchases")
      .update({ provider_reference: payload.id })
      .eq("id", purchase.id);

    return { alreadyOwned: false as const, url: payload.url };
  });
