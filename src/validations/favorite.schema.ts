import z from "zod";

export const toggleFavoriteSchema = z.object({
  listingId: z.number().int().positive().optional(),
  agencyId: z.number().int().positive().optional(),
}).refine(
  (data) => data.listingId || data.agencyId,
  { message: "Debes proporcionar listingId o agencyId" }
).refine(
  (data) => !data.listingId || !data.agencyId,
  { message: "Solo puedes agregar un favorito a la vez (listing o agency)" }
);
