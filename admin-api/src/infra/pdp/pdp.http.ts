import axios, { AxiosError } from 'axios';
import { Injectable, HttpException } from '@nestjs/common';
import { PdpPort } from '../../core/pdp/pdp.port';
import { ValidateReq, ValidateRes, TestActiveReq, TestOverrideReq, TestRes } from '../../core/pdp/pdp.types';

@Injectable()
export class PdpHttp implements PdpPort {
  private base = process.env.PDP_BASE_URL || 'http://pdp:8081';

  async validate(req: ValidateReq): Promise<ValidateRes> {
    try {
      console.log("VALIDATE");
      console.log(req);
      const { data } = await axios.post(`${this.base}/admin/validate`, req);
      console.log("Response VALIDATE");
      console.log(data)
      return data;
    } catch (e) {
      const err = e as AxiosError;
      const status = err.response?.status ?? 500;
      const data = err.response?.data ?? { message: 'pdp error' };
      throw new HttpException(data, status);
    }
  }

  async testDraft(req: TestOverrideReq): Promise<TestRes> {
    try {
      const { data } = await axios.post(`${this.base}/admin/test`, {
        ...req,
        principal: typeof (req as any).principal === 'string'
          ? (req as any).principal
          : `${(req as any).principal.type}::"${(req as any).principal.id}"`,
        resource: typeof (req as any).resource === 'string'
          ? (req as any).resource
          : `${(req as any).resource.type}::"${(req as any).resource.id}"`,
        action: typeof (req as any).action === 'string'
          ? (req as any).action
          : (req as any).action.id,
      });
      return data;
    } catch (e) {
      const err = e as AxiosError;
      const status = err.response?.status ?? 500;
      const data = err.response?.data ?? { message: 'pdp error' };
      throw new HttpException(data, status);
    }
  }

  async testActive(req: TestActiveReq): Promise<TestRes> {
    try {
      const { data } = await axios.post(`${this.base}/admin/test`, {
        tenant_id: req.tenant_id,
        principal: typeof (req as any).principal === 'string'
          ? (req as any).principal
          : `${(req as any).principal.type}::"${(req as any).principal.id}"`,
        resource: typeof (req as any).resource === 'string'
          ? (req as any).resource
          : `${(req as any).resource.type}::"${(req as any).resource.id}"`,
        action: typeof (req as any).action === 'string'
          ? (req as any).action
          : (req as any).action.id,
        context: (req as any).context,
      });
      return data;
    } catch (e) {
      const err = e as AxiosError;
      const status = err.response?.status ?? 500;
      const data = err.response?.data ?? { message: 'pdp error' };
      throw new HttpException(data, status);
    }
  }
}
