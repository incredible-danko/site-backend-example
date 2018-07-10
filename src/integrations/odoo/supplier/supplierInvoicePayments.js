const Mappers = require('../mappers');

const {
	AddSupplierInvoicePayment,
} = require('../../../queries/index');

const log = Common.Utils.logging;

class SupplierInvoicePaymentsController {
	constructor(queue, config, odoo, client) {
		this.queue = queue;
		this.odoo = odoo;
		this.client = client;
		this.config = config;
	}

	register(config) {
		this.queue.process(`${config.namespace}.odoo.suppliers.payments.fetch`, 1, (job, done) => this.import(job, done));
	}

	async addSupplierInvoicePayment(item, token) {
		const payment = Mappers.Payment({}, item);
		const response = await this.client.execute(
			AddSupplierInvoicePayment,
			{
				input: payment,
			},
			token
		);

		if (response.errors && response.errors.length > 0) {
			throw new Error(JSON.stringify(response.errors));
		}

		log.info(`Imported Supplier invoice payment ${response.data.addSupplierInvoicePayment.meta.serialNumber} and assigned it UUID : ${response.data.addSupplierInvoicePayment._id}`);

		return response;
	}

	async import(job, done) {
		console.log('Fetching Supplier Invoice Payments')
		log.log('Fetching Supplier Invoice Payments');

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
					params: [['payment_type', '=', 'outbound']],
					token,
					lastSynchronized: integration.lastSynchronized,
				});
				for (const payment of payments) {
					this.addSupplierInvoicePayment(payment, token);
				}
				done();
			}
		} catch (e) {
			log.error(e);
			done(e);
		}
	}
}

module.exports = SupplierInvoicePaymentsController;
