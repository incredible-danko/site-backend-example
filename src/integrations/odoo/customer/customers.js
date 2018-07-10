const Mappers = require('../mappers');

const {
	AddCustomer,
} = require('../../../queries');

const log = Common.Utils.logging;

class CustomerController {
	constructor(queue, config, odoo, client) {
		this.queue = queue;
		this.odoo = odoo;
		this.client = client;
		this.config = config;
	}

	register(config) {
		this.queue.process(`${config.namespace}.odoo.customers.fetch`, 1, (job, done) => this.import(job, done));
	}

	async addCustomer(item, token) {
		const customer = Mappers.Customer({}, item);

		const response = await this.client.execute(
			AddCustomer,
			{
				input: customer,
			},
			token
		);

		if (response.errors && response.errors.length > 0) {
			log.error(response);
			throw new Error(JSON.stringify(response.errors));
		}

		log.info(`Imported Customer ${response.data.updateCustomer.meta.customerNumber} and assigned it UUID : ${response.data.updateCustomer._id}`);

		return response;
	}

	async import(job, done) {
		console.log('Odoo: Fetching Customers');
		log.log('Odoo: Fetching Customers');

		const {
			token = false,
			integration = false,
		} = job.data;

		try {
			if (!integration.integration) {
				const error = new Error('Odoo: Missing Integration');
				log.error(error);
				done(error);
			} else {
				const customers = await this.odoo.fetch({
					config: integration.config,
					model: 'res.partner',
					params: [['customer', '=', true]],
					fields: ['name', 'company_name', 'vat', 'id', 'phone', 'email'],
					token,
					lastSynchronized: integration.lastSynchronized,
				});
				for (const customer of customers) {
					this.addCustomer(customer, token);
				}
				done();
			}
		} catch (e) {
			log.error(e);
			done(e);
		}
	}
}

module.exports = CustomerController;
