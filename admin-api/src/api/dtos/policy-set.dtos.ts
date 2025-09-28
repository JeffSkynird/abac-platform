import { z } from 'zod';
export const CreateDraftDto = z.object({
  tenantId: z.string().uuid(),
  baseVersion: z.number().int().positive().optional()
});
export const AddPolicyDto = z.object({
  policySetId: z.string().uuid(),
  cedar: z.string().min(1)
});
export const PreValidatePoliciesDto = z.object({
  policies: z.array(z.string().min(1))
});
export const ValidateDto = z.object({
  id: z.string().uuid()
});
export const TestDraftDto = z.object({
  id: z.string().uuid(),
  principal: z.any(),
  resource: z.any(),
  action: z.string().min(1),
  context: z.any().optional()
});
export const PreTestDraftDto = z.object({
  policies: z.array(z.string().min(1)),
  principal: z.any(),
  resource: z.any(),
  action: z.union([
    z.string().min(1),
    z.object({ type: z.string(), id: z.string() })
  ]),
  context: z.any().optional()
});
export const TestActiveDto = z.object({
  tenantId: z.string().uuid(),
  principal: z.any(),
  resource: z.any(),
  action: z.string().min(1),
  context: z.any().optional()
});
