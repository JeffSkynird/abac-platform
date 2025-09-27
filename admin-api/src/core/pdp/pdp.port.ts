import { ValidateReq, ValidateRes, TestActiveReq, TestOverrideReq, TestRes } from './pdp.types';

export interface PdpPort {
  validate(req: ValidateReq): Promise<ValidateRes>;
  testDraft(req: TestOverrideReq): Promise<TestRes>;
  testActive(req: TestActiveReq): Promise<TestRes>;
}