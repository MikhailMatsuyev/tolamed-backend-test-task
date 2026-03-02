import { Queue, Worker } from 'bullmq';
import { Op } from 'sequelize';

import { redis } from './redis';
import { BonusTransaction } from "./models/BonusTransaction";

const queueConnection = redis.duplicate();

export const bonusQueue = new Queue('bonusQueue', {
  connection: queueConnection,
});

let expireAccrualsWorker: Worker | null = null;

export function startExpireAccrualsWorker(): Worker {
  if (expireAccrualsWorker) return expireAccrualsWorker;

  expireAccrualsWorker = new Worker(
    'bonusQueue',
    async (job) => {
      if (job.name === 'expireAccruals') {
        const now = new Date();

        const expiredCount = await BonusTransaction.count({
          where: {
            type: 'accrual',
            expires_at: { [Op.lt]: now }
          }
        });

        return { processed: expiredCount, at: now.toISOString() };
      }
    },
    { connection: redis.duplicate() }
  );

  return expireAccrualsWorker;
}
