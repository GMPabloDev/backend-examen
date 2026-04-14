import z from "zod";

export const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});
