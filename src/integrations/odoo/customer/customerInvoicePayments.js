const Mappers = require('../mappers');

const {
	AddCustomerInvoicePayment,
} = require('../../../queries');

const log = Common.Utils.logging;

class CustomerInvoicePaymentsController {
	constructor(queue, config, odoo, client) {
		this.queue = queue;
		this.odoo = odoo;
		this.client = client;
		this.config = config;
	}

	register(config) {
		this.queue.process(`${config.namespace}.odoo.customers.payments.fetch`, 1, (job, done) => this.import(job, done));
	}

	// todo invoice number?
	async addCustomerInvoicePayment(item, token) {
		const payment = Mappers.Payment({}, item);
		const response = await this.client.execute(
			AddCustomerInvoicePayment,
			{
				input: payment,
			},
			token
		);

		if (response.errors && response.errors.length > 0) {
			throw new Error(JSON.stringify(response.errors));
		}

		log.info(`Imported Customer invoice payment ${response.data.addCustomerInvoicePayment.meta.invoiceNumber} and assigned it UUID : ${response.data.addCustomerInvoicePayment._id}`);

		return response;
	}

	async import(job, done) {
		console.log('Odoo: Fetching Customer Invoice Payments');
		log.log('Odoo: Fetching Customer Invoice Payments');

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
				const payments = await this.odoo.fetch({
					config: integration.config,
					model: 'account.payment',
					params: [['payment_type', '=', 'inbound']],
					token,
					lastSynchronized: integration.lastSynchronized,
				});
				for (const payment of payments) {
					this.addCustomerInvoicePayment(payment, token);
				}
				done();
			}
		} catch (e) {
			log.error(e);
			done(e);
		}
	}
}

module.exports = CustomerInvoicePaymentsController;
