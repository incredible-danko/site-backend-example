const Mappers = require('../mappers');

const {
	AddSupplierInvoice,
} = require('../../../queries/index');

const log = Common.Utils.logging;

class InvoiceController {
	constructor(queue, config, odoo, client) {
		this.queue = queue;
		this.odoo = odoo;
		this.client = client;
		this.config = config;
	}

	register(config) {
		this.queue.process(`${config.namespace}.odoo.suppliers.invoices.fetch`, 1, (job, done) => this.import(job, done));
	}

	async addInvoice(item, token) {
		const invoice = Mappers.SupplierInvoice({}, item);
		invoice.type = 'invoice';
		const response = await this.client.execute(
			AddSupplierInvoice,
			{
				input: invoice,
			},
			token
		);

		if (response.errors && response.errors.length > 0) {
			throw new Error(JSON.stringify(response.errors));
		}

		log.info(`Imported Supplier invoice ${response.data.updateSupplierInvoice.meta.invoiceNumber} and assigned it UUID : ${response.data.updateSupplierInvoice._id}`);

		return response;
	}

	async import(job, done) {
		console.log('Fetching Invoices');
		log.log('Fetching Invoices');

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
				const invoices = await this.odoo.fetch({
					config: integration.config,
					model: 'account.invoice',
					params: [['type', '=', 'in_invoice']],
					token,
					lastSynchronized: integration.lastSynchronized,
				});
				for (const invoice of invoices) {
					this.addInvoice(invoice, token);
				}
				done();
			}
		} catch (e) {
			log.error(e);
			done(e);
		}
	}
}

module.exports = InvoiceController;
