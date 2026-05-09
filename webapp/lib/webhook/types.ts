export type WebhookAction = "grant" | "revoke";

export interface NormalizedEvent {
  email: string;
  full_name?: string;
  cpf?: string;
  external_order_id?: string;
  /** External product/course identifier coming from the gateway */
  external_product_id: string;
  action: WebhookAction;
  raw: unknown;
}

export interface ProviderAdapter {
  name: "hotmart" | "kiwify" | "eduzz" | "cademi";
  parse(req: Request, payload: unknown): Promise<NormalizedEvent[] | null>;
}
