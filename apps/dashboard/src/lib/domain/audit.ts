import prisma from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';

export type AuditInput = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

export function recordAudit(input: AuditInput) {
  return prisma.auditEvent.create({
    data: {
      ...input,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
