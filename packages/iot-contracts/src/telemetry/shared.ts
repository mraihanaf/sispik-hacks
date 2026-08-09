import { z } from 'zod';

export const DeviceIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Device IDs may contain letters, digits, hyphens, and underscores.');

export const MessageIdSchema = z.string().min(1).max(128);

export const ObservedAtSchema = z.iso.datetime({ offset: true });

export const LatitudeSchema = z.number().finite().min(-90).max(90);

export const LongitudeSchema = z.number().finite().min(-180).max(180);
