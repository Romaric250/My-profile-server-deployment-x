"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.otpVerificationSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
// Registration schema with all fields
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Please enter a valid email address'),
    password: zod_1.z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    fullName: zod_1.z.string().min(2, 'Full name must be at least 2 characters'),
    firstName: zod_1.z.string().min(1, 'First name is required'),
    lastName: zod_1.z.string().min(1, 'Last name is required'),
    username: zod_1.z.string()
        .min(3, 'Username must be at least 3 characters')
        .regex(/^[a-zA-Z0-9_~]+$/, 'Username can only contain letters, numbers, underscores, and the ~ symbol'),
    accountType: zod_1.z.enum(['MYSELF', 'SOMEONE_ELSE'], {
        errorMap: () => ({ message: 'Account type must be either MYSELF or SOMEONE_ELSE' }),
    }),
    dateOfBirth: zod_1.z.string(),
    countryOfResidence: zod_1.z.string(),
    accountCategory: zod_1.z.enum(['PRIMARY_ACCOUNT', 'SECONDARY_ACCOUNT']),
    phoneNumber: zod_1.z.string()
        .regex(/^[\+\-\(\)\s0-9]+$/, 'Please enter a valid phone number'),
    verificationMethod: zod_1.z.enum(['PHONE', 'EMAIL']),
    referralCode: zod_1.z.string().optional()
});
// Login schema
exports.loginSchema = zod_1.z.object({
    identifier: zod_1.z.string().min(1, "Email or username is required"),
    password: zod_1.z.string().min(1, "Password is required"),
    rememberMe: zod_1.z.boolean().default(false),
});
// OTP Verification schema
exports.otpVerificationSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    otp: zod_1.z.string().length(6, 'OTP must be 6 digits'),
    verificationMethod: zod_1.z.enum(['PHONE', 'EMAIL'])
});
