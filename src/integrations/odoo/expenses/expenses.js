const Mappers = require('../mappers');

const {
	AddExpense,
} = require('../../../../queries');

const log = Common.Utils.logging;

class ExpensesController {
	constructor(queue, config,  visma, client) {
		this.queue = queue;
		this.visma = visma;
		this.client = client;
		this.config = config;
	}

	register(config) {
		this.queue.process(`${config.namespace}.vismaeekonomi.expenses.fetch`, 1, (job, done) => this.import(job, done));
//		this.queue.process(`${config.namespace}.vismaeekonomi.expense.fetch`, 1, (job, done) => this.insertExpense(job, done));
	}

	async insertExpense(expense, token) {

		const response = await this.client.execute(
			AddExpense,
			{
				input: expense,
			},
			token
		);

		if (response.errors && response.errors.length > 0) {
			log.error(response);
			throw new Error(JSON.stringify(response.errors));
		}

		log.info(`Imported Expense ${response.data.updateExpense.meta.reference} and assigned it UUID : ${response.data.updateExpense._id}`);
	}

// 	async addExpense(item, token) {
// 		const expenses = Mappers.Expense(item, null);
//
// 		await Promise.all(expenses.map(expense => this.insertExpense(expense, token)));
//
// 		return true;
// 	}

	async import(job, done) {
		log.log('Fetching Expenses');

		const {
			token = false,
			integration = false,
		} = job.data;

		try {
			if (!integration.server) {
				throw new Error('Missing AccessToken');
			}

			let expenses = await this.visma.fetchPages({
				entity: 'Vouchers',
				accessToken: integration.server.accessToken,
				latest: integration.lastSynchronized,
			});

			for (const expense of expenses.list) {
				const mappedExpense = Mappers.Expense(expense);
				if (mappedExpense !== false) {
					await this.insertExpense(mappedExpense, token);
				}
			}
			done();
		} catch (e) {
			log.error(e);
			done(e);
		}
	}

}

module.exports = ExpensesController;
