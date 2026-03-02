import { User } from '../models/User';
import { BonusTransaction } from '../models/BonusTransaction';
import { sequelize } from '../db';
import { Op } from 'sequelize';

type AppError = Error & { status?: number };

function createAppError(message: string, status: number): AppError {
  const error = new Error(message) as AppError;
  error.status = status;
  return error;
}

export async function getUserBalance(userId: string, transaction?: any): Promise<number> {
  const now = new Date();

  const totalAccruals = await BonusTransaction.sum('amount', {
    where: {
      user_id: userId,
      type: 'accrual',
      expires_at: { [Op.gt]: now } // TODO: учитывать expires_at — FIXED
    },
    transaction
  }) || 0;

  const totalSpends = await BonusTransaction.sum('amount', {
    where: {
      user_id: userId,
      type: 'spend'
    },
    transaction
  }) || 0; // TODO: учитывать spend — FIXED

  return totalAccruals - totalSpends;
}

export async function spendBonus(userId: string, amount: number, requestId: string) {
  // Legacy-набросок: намеренно наивная реализация для задания.
  // Здесь специально нет транзакции, защиты от гонок и идемпотентности.
  return await sequelize.transaction(async (t) => {

    const existing = await BonusTransaction.findOne({
      where: { user_id: userId, request_id: requestId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (existing) {
      if (existing.amount === amount) return { success: true, duplicated: true };
      throw createAppError('Conflict: same requestId with different payload', 409);
    }

    await User.findByPk(userId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    const currentBalance = await getUserBalance(userId, t);

    if (currentBalance < amount) {
      throw createAppError('Insufficient balance', 400);
    }

    await BonusTransaction.create({
      user_id: userId,
      type: 'spend',
      amount,
      request_id: requestId,
      expires_at: null
    }, { transaction: t });

    return { success: true, duplicated: false };
  });
}
