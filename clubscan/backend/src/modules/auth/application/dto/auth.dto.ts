import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Shared field schemas mirror backend validation rules (Phase 3 §10) and are
// intended to be kept in sync with the mobile client's Zod schemas.
export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[0-9]/, 'Must contain a digit');

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, 'Username must be 3-20 chars: a-z, 0-9, underscore');

export const RegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
});
export class RegisterDto extends createZodDto(RegisterSchema) {}

export const LoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export class LoginDto extends createZodDto(LoginSchema) {}

export const VerifyEmailSchema = z.object({ token: z.string().min(10) });
export class VerifyEmailDto extends createZodDto(VerifyEmailSchema) {}

export const RefreshSchema = z.object({ refreshToken: z.string().min(10) });
export class RefreshDto extends createZodDto(RefreshSchema) {}

export const ForgotPasswordSchema = z.object({ email: emailSchema });
export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}

export const ResetPasswordSchema = z.object({
  token: z.string().min(10),
  password: passwordSchema,
});
export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}

export const OAuthGoogleSchema = z.object({
  idToken: z.string().min(10),
  username: usernameSchema.optional(),
});
export class OAuthGoogleDto extends createZodDto(OAuthGoogleSchema) {}

export const OAuthAppleSchema = z.object({
  identityToken: z.string().min(10),
  username: usernameSchema.optional(),
});
export class OAuthAppleDto extends createZodDto(OAuthAppleSchema) {}
