import type { NormalizedEvent, ProviderAdapter } from "./types";

/**
 * Hotmart sends a JSON like:
 * {
 *   event: "PURCHASE_APPROVED" | "PURCHASE_REFUNDED" | "PURCHASE_CHARGEBACK" | ...,
 *   data: {
 *     buyer: { email, name, document },
 *     purchase: { transaction },
 *     product: { id }
 *   }
 * }
 * Header `x-hotmart-hottok` carries a shared secret.
 */
export const hotmartAdapter: ProviderAdapter = {
  name: "hotmart",
  async parse(req, body) {
    const expected = process.env.HOTMART_WEBHOOK_SECRET;
    if (expected) {
      const got = req.headers.get("x-hotmart-hottok");
      if (got !== expected) return null;
    }
    const p = body as {
      event?: string;
      data?: {
        buyer?: { email?: string; name?: string; document?: string };
        purchase?: { transaction?: string };
        product?: { id?: string | number };
      };
    };
    const email = p.data?.buyer?.email;
    const productId = String(p.data?.product?.id ?? "");
    if (!email || !productId) return null;

    const grantEvents = ["PURCHASE_APPROVED", "PURCHASE_COMPLETE"];
    const revokeEvents = ["PURCHASE_REFUNDED", "PURCHASE_CHARGEBACK", "PURCHASE_PROTEST"];
    let action: NormalizedEvent["action"] | null = null;
    if (grantEvents.includes(p.event ?? "")) action = "grant";
    if (revokeEvents.includes(p.event ?? "")) action = "revoke";
    if (!action) return null;

    return [
      {
        email,
        full_name: p.data?.buyer?.name,
        cpf: p.data?.buyer?.document,
        external_order_id: p.data?.purchase?.transaction,
        external_product_id: productId,
        action,
        raw: body,
      },
    ];
  },
};
