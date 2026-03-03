import { Queue, Worker } from 'bullmq';
import { Op } from 'sequelize';
import { redis } from './redis';
import { sequelize } from './db';
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

        const expiredAccruals = await BonusTransaction.findAll({
          where: {
            type: 'accrual',
            expires_at: { [Op.lt]: now }
          }
        });

        let processedCount = 0;

        for (const accrual of expiredAccruals) {
          const requestId = `expire:${accrual.id}`;

          await sequelize.transaction(async (t) => {
            const existingSpend = await BonusTransaction.findOne({
              where: { request_id: requestId },
              transaction: t,
              lock: t.LOCK.UPDATE
            });

            if (!existingSpend) {
              await BonusTransaction.create({
                user_id: accrual.user_id,
                type: 'spend',
                amount: accrual.amount,
                request_id: requestId,
                expires_at: null
              }, { transaction: t });

              processedCount++;
            }
          });
        }

        console.log(`[worker] Обработано просрочек: ${processedCount}`);
        return { processed: processedCount, at: now.toISOString() };
      }
    },
    { connection: redis.duplicate() }
  );

  return expireAccrualsWorker;
}
