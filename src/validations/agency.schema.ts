import z from "zod";

export const createAgencySchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(7, "Teléfono inválido"),
  address: z.string().optional(),
  description: z.string().optional(),
  logo: z.string().url("URL de logo inválida").optional().nullable(),
  website: z.string().url("URL de website inválida").optional().nullable(),
});

export const updateAgencySchema = createAgencySchema.partial();
