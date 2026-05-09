import type { ProviderAdapter } from "./types";

export const eduzzAdapter: ProviderAdapter = {
  name: "eduzz",
  async parse(req, body) {
    const expected = process.env.EDUZZ_WEBHOOK_SECRET;
    if (expected) {
      const got = req.headers.get("x-eduzz-signature");
      if (!got || got !== expected) return null;
    }
    const p = body as {
      trans_status?: string;
      cus_email?: string;
      cus_name?: string;
      cus_taxnumber?: string;
      product_cod?: string | number;
      trans_cod?: string;
    };
    const email = p.cus_email;
    const productId = String(p.product_cod ?? "");
    if (!email || !productId) return null;
    const action =
      p.trans_status === "paid" || p.trans_status === "free"
        ? "grant"
        : p.trans_status === "refunded" || p.trans_status === "canceled"
          ? "revoke"
          : null;
    if (!action) return null;
    return [
      {
        email,
        full_name: p.cus_name,
        cpf: p.cus_taxnumber,
        external_order_id: p.trans_cod,
        external_product_id: productId,
        action,
        raw: body,
      },
    ];
  },
};
