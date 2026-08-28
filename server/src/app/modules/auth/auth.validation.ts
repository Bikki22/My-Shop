import { z } from "zod";

export const registerSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name cannot exceed 100 characters"),
  lastName: z
    .string()
    .trim()
    .min(3, "Last name must be at least 3 character")
    .max(50, "last name cannot exceed 50 character")
    .optional(),
  email: z
    .string()
    .trim()
    .email("Please provide a valid email")
    .transform((email) => email.toLowerCase()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password cannot exceed 72 characters"),
  phone: z
    .string()
    .max(10, "phone should not be more than 10")
    .min(10, "phone should not be less than 10"),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please provide a valid email")
    .transform((email) => email.toLowerCase()),

  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
