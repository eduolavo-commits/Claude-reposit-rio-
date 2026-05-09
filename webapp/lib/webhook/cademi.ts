import type { ProviderAdapter } from "./types";

export const cademiAdapter: ProviderAdapter = {
  name: "cademi",
  async parse(req, body) {
    const expected = process.env.CADEMI_WEBHOOK_SECRET;
    if (expected) {
      const got = req.headers.get("x-cademi-token");
      if (!got || got !== expected) return null;
    }
    const p = body as {
      event?: string;
      user?: { email?: string; name?: string; cpf?: string };
      product?: { id?: string | number };
      order?: { id?: string };
    };
    const email = p.user?.email;
    const productId = String(p.product?.id ?? "");
    if (!email || !productId) return null;
    const action =
      p.event === "purchase.approved"
        ? "grant"
        : p.event === "purchase.refunded" || p.event === "subscription.cancelled"
          ? "revoke"
          : null;
    if (!action) return null;
    return [
      {
        email,
        full_name: p.user?.name,
        cpf: p.user?.cpf,
        external_order_id: p.order?.id,
        external_product_id: productId,
        action,
        raw: body,
      },
    ];
  },
};
