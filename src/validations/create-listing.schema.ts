import z from "zod";

export const createListingSchema = z
  .object({
    title: z.string().min(5, "El título debe tener al menos 5 caracteres"),
    description: z
      .string()
      .min(20, "La descripción debe tener al menos 20 caracteres"),
    price: z.number().positive("El precio debe ser positivo"),
    priceType: z.enum(["VENTA", "ALQUILER", "AMBOS"]),
    propertyType: z.enum([
      "CASA",
      "DEPARTAMENTO",
      "TERRENO",
      "LOCAL_COMERCIAL",
      "OFICINA",
    ]),
    bedrooms: z.number().int().min(0).optional(),
    bathrooms: z.number().int().min(0).optional(),
    parkingSpaces: z.number().int().min(0).optional(),
    area: z.number().positive().optional(),
    address: z.string().min(5, "Dirección inválida"),
    city: z.string().min(2, "Ciudad inválida"),
    state: z.string().min(2, "Estado inválido"),
    userId: z.number().optional(),
    agencyId: z.number().optional(),
  })
  .refine((data) => data.userId || data.agencyId, {
    message: "Debes especificar si el anuncio es de persona o agencia",
  })
  .refine((data) => !(data.userId && data.agencyId), {
    message:
      "Un anuncio solo puede pertenecer a una persona O a una agencia, no a ambos",
  });
