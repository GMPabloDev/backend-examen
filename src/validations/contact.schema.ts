import z from "zod";

export const createContactSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(7, "Teléfono inválido").optional().nullable(),
  message: z.string().min(10, "El mensaje debe tener al menos 10 caracteres"),
  listingId: z.number().int().positive("ID de anuncio inválido"),
});
