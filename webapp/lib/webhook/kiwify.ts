import type { ProviderAdapter } from "./types";

export const kiwifyAdapter: ProviderAdapter = {
  name: "kiwify",
  async parse(req, body) {
    const expected = process.env.KIWIFY_WEBHOOK_SECRET;
    if (expected) {
      const got = req.headers.get("x-kiwify-signature");
      if (!got || got !== expected) return null;
    }
    const p = body as {
      order_status?: string;
      Customer?: { email?: string; full_name?: string; CPF?: string };
      Product?: { product_id?: string };
      order_id?: string;
    };
    const email = p.Customer?.email;
    const productId = p.Product?.product_id;
    if (!email || !productId) return null;
    const action =
      p.order_status === "paid" || p.order_status === "approved"
        ? "grant"
        : p.order_status === "refunded" || p.order_status === "chargedback"
          ? "revoke"
          : null;
    if (!action) return null;
    return [
      {
        email,
        full_name: p.Customer?.full_name,
        cpf: p.Customer?.CPF,
        external_order_id: p.order_id,
        external_product_id: productId,
        action,
        raw: body,
      },
    ];
  },
};
