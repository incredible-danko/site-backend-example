const Mappers = require('../mappers');

const {
	AddCustomerInvoicePayment,
} = require('../../../queries');

const log = Common.Utils.logging;

class CustomerInvoicePaymentsController {
	constructor(queue, config, fortnox, client) {
		this.queue = queue;
		this.fortnox = fortnox;
		this.client = client;
		this.config = config;
	}

	register(config) {
		this.queue.process(`${config.namespace}.fortnox.customers.payments.fetch`, 1, (job, done) => this.import(job, done));
		this.queue.process(`${config.namespace}.fortnox.customers.payment.fetch`, 1, (job, done) => this.fetchPayment(job, done));
	}

	async addCustomerInvoicePayment(item, token) {
		const payment = Mappers.Payment({}, item);

		if (payment.sums.total === 0) {
			payment.sums.total = item.Amount;
		}

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

	async fetchPayment(job, done) {
		log.log('Fetching Customer Invoice Payment');

		const {
			token = false,
			integration = false,
			itemUrl = false,
		} = job.data;

		try {
			if (!integration.server) {
				throw new Error('Missing AccessToken');
			}

			const response = await this.fortnox.fetchOne({
				entity: 'InvoicePayment',
				entityUrl: itemUrl,
				accessToken: integration.server.accessToken,
			});

			await this.addCustomerInvoicePayment(response, token);

			done();
		} catch (e) {
			log.error(e);
			done(e);
		}
	}

	async import(job, done) {
		log.log('Fetching Customer Invoice Payments');

		const {
			token = false,
			integration = false,
		} = job.data;

		try {
			if (!integration.server) {
				throw new Error('Missing AccessToken');
			}

			await this.fortnox.fetchPages({
				entity: 'InvoicePayments',
				accessToken: integration.server.accessToken,
				latest: integration.lastSynchronized,
			}, async (item) => {
				this.queue.create(
					`${this.config.namespace}.fortnox.customers.payment.fetch`,
					{
						token,
						integration,
						itemUrl: item['@url'],
					}
				)
					.attempts(10)
					.backoff({ delay: 60 * 1000, type: 'fixed' })
					.removeOnComplete(true)
					.save(() => {});
			});

			done();
		} catch (e) {
			log.error(e);
			done(e);
		}
	}
}

module.exports = CustomerInvoicePaymentsController;
