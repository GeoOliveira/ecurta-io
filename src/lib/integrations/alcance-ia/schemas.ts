import { z } from "zod";
import { isValidSlug } from "@/lib/short-links/slug";
import { validateBrazilianPhone } from "@/lib/whatsapp";

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

export type CreateInternalLinkInput = z.infer<typeof createInternalLinkSchema>;
export type UpdateInternalLinkInput = z.infer<typeof updateInternalLinkSchema>;
