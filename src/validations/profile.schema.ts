import z from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").optional(),
  phone: z.string().min(7, "Teléfono inválido").optional().nullable(),
  avatarUrl: z.string().url("URL de avatar inválida").optional().nullable(),
});
