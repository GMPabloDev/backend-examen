import z from "zod";

export const createListingSchema = z.object({
  title: z.string().min(5, "El título debe tener al menos 5 caracteres"),
  description: z.string().min(20, "La descripción debe tener al menos 20 caracteres"),
  price: z.number().positive("El precio debe ser positivo"),
  priceType: z.enum(["VENTA", "ALQUILER", "AMBOS"]),
  propertyType: z.enum(["CASA", "DEPARTAMENTO", "TERRENO", "LOCAL_COMERCIAL", "OFICINA"]),
  
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  parkingSpaces: z.number().int().min(0).optional(),
  area: z.number().positive().optional(),
  builtArea: z.number().positive().optional(),
  lotArea: z.number().positive().optional(),
  floors: z.number().int().min(1).optional(),
  yearBuilt: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  condition: z.enum(["NUEVO", "USADO", "A_REMODELAR"]).optional(),
  amenities: z.array(z.string()).optional(),
  
  address: z.string().min(5, "La dirección es requerida"),
  city: z.string().min(2, "La ciudad es requerida"),
  state: z.string().min(2, "El estado es requerido"),
  zipCode: z.string().optional(),
  neighborhood: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  
  agencyId: z.number().int().positive().optional(),
  images: z.array(z.object({
    url: z.string().url("URL de imagen inválida"),
    order: z.number().int().min(0).default(0),
  })).optional(),
});

export const updateListingSchema = createListingSchema.partial();
