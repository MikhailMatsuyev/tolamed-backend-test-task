import { NextFunction, Request, Response } from 'express';

import { bonusQueue } from '../queue';
import { spendBonus } from '../services/bonus.service';

type AppError = Error & { status?: number };

function createAppError(message: string, status: number): AppError {
  const error = new Error(message) as AppError;
  error.status = status;
  return error;
}

export async function spendUserBonus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const amount = Number(req.body?.amount);

    const requestId = (req.headers['idempotency-key'] as string) || req.body?.requestId;

    if (!requestId) {
      throw createAppError('requestId is required (in body or Idempotency-Key header)', 400);
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      throw createAppError('amount must be a positive integer', 400);
    }

    const result = await spendBonus(req.params.id, amount, requestId);
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof Error && (error as any).status) {
      res.status((error as any).status).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function enqueueExpireAccrualsJob(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await bonusQueue.add(
      'expireAccruals',
      { createdAt: new Date().toISOString() },
      {
        jobId: 'expire-accruals',

        attempts: 3,

        backoff: {
          type: 'fixed',
          delay: 1000
        },

        removeOnComplete: true
      }
    );

    res.json({ queued: true });
  } catch (error) {
    next(error);
  }
}
