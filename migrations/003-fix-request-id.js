'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.removeIndex('bonus_transactions', 'bonus_transactions_request_id_uq');

        await queryInterface.addIndex('bonus_transactions', ['user_id', 'request_id'], {
            unique: true,
            name: 'bonus_transactions_user_id_request_id_uq'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeIndex('bonus_transactions', 'bonus_transactions_user_id_request_id_uq');
        await queryInterface.addIndex('bonus_transactions', ['request_id'], {
            unique: true,
            name: 'bonus_transactions_request_id_uq'
        });
    }
};
