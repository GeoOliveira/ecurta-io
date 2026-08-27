import { z } from "zod";
import { isValidSlug } from "@/lib/short-links/slug";
import { validateBrazilianPhone } from "@/lib/whatsapp";
import { normalizePublicUrl } from "@/lib/short-links/public-url.mjs";

const slugSchema = z
  .string()
  .min(4)
  .max(32)
  .refine(isValidSlug, "Slug inválido");

export const createInternalLinkSchema = z.strictObject({
  destinationType: z.literal("whatsapp"),
  phone: z
    .string()
    .min(1)
    .max(32)
    .refine(validateBrazilianPhone, "Telefone inválido"),
  slug: slugSchema.optional(),
  message: z.string().max(4000).optional(),
  expiresAt: z.iso.datetime({ offset: true }).nullable().optional(),
  externalUserId: z.string().min(1).max(100).nullable().optional(),
  externalResourceId: z.string().min(1).max(100).nullable().optional(),
  externalRequestId: z.string().min(8).max(100).optional(),
  metadata: z
    .strictObject({
      accessLevel: z
        .enum(["anonymous", "public", "free", "premium", "admin"])
        .optional(),
    })
    .optional(),
});

export const updateInternalLinkSchema = z.strictObject({ slug: slugSchema });

const createUrlLinkSchema = createInternalLinkSchema.omit({ phone: true, message: true }).extend({
  destinationType: z.literal("url"),
  destinationUrl: z.string().min(1).max(4096).refine((raw) => {
    try { normalizePublicUrl(raw); return true; } catch { return false; }
  }, "Informe uma URL pública HTTP ou HTTPS válida"),
});
// Alcance retains its original, WhatsApp-only contract.
export const createGeobotLinkSchema = z.discriminatedUnion("destinationType", [createInternalLinkSchema, createUrlLinkSchema]);
export type CreateGeobotLinkInput = z.infer<typeof createGeobotLinkSchema>;

export type CreateInternalLinkInput = z.infer<typeof createInternalLinkSchema>;
export type UpdateInternalLinkInput = z.infer<typeof updateInternalLinkSchema>;
