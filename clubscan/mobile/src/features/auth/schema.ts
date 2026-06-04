import { z } from 'zod';

// Mirrors backend validation (Phase 3 §10) so the client and server agree.
export const emailSchema = z.string().trim().toLowerCase().email();
export const passwordSchema = z
  .string()
  .min(10, 'At least 10 characters')
  .regex(/[a-z]/, 'Add a lowercase letter')
  .regex(/[A-Z]/, 'Add an uppercase letter')
  .regex(/[0-9]/, 'Add a digit');
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, '3-20 chars: a-z, 0-9, underscore');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
});
export type RegisterForm = z.infer<typeof registerSchema>;
