import { z } from "zod";

export const SessionSchema = z.object({
  siteUrl: z.string(),
  token: z.string().min(1),
  privateToken: z.string().optional(),
  userId: z.number(),
  username: z.string(),
  fullName: z.string(),
  createdAt: z.string(),
  method: z.enum(["browser", "cookie", "password", "token"]),
});

export type Session = z.infer<typeof SessionSchema>;

export interface TokenPair {
  token: string;
  privateToken?: string;
}
