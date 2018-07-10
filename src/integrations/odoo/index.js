const OdooClient = require('./graphQlClient');
const RedisLocker = require('../../services/RedisLocker');

const log = Common.Utils.logging;

const CustomerImport = require('./customer/customers');
const CustomerImportInvoice = require('./customer/customerInvoices');
const CustomerInvoicePaymentsController = require('./customer/customerInvoicePayments');

const SupplierImport = require('./supplier/suppliers');
const SupplierImportInvoice = require('./supplier/supplierInvoices');
const SupplierInvoicePaymentsController = require('./supplier/supplierInvoicePayments');

//
// const ExpensesImport = require('./expenses/expenses');

const RateLimiter = require('../../services/RateLimiter');
const OdooHttp = require('./odoo');

const moment = require('moment');

class Odoo {
	constructor(queue, config, odoo, client, locker) {
		this.queue = queue;
		this.config = config;
		this.odoo = odoo;
		this.client = client;
		this.locker = locker;
	}

	register(config) {
		this.queue.process(`${config.namespace}.odoo.import`, 1, (job, done) => this.import(job, done));
	}

	async init(token) {
		const integration = await this.client.getIntegration(token);

		if (!integration) {
			throw new Error('Company missing odoo configuration');
		}

		return integration;
	}

	sendJob(action, token, integration) {
		return this.queue.create(
			action,
			{
				token,
				integration,
			}
		)
			.attempts(1)
			.removeOnComplete(true)
			.attempts(10)
			.backoff({ delay: 60 * 1000, type: 'fixed' })
			.save(() => {
			});
	}

	async import(job, done) {
		const {
			token = false,
		} = job.data;

		try {
			const integration = await this.init(token);
			await this.client.updateLastSync(token);
			//  this.sendJob(`${this.config.namespace}.odoo.customers.fetch`, token, {integration: integration, config: this.config.services.odoo});
			//  this.sendJob(`${this.config.namespace}.odoo.suppliers.fetch`, token, {integration: integration, config: this.config.services.odoo});
			//  this.sendJob(`${this.config.namespace}.odoo.customers.invoices.fetch`, token, {integration: integration, config: this.config.services.odoo});
			//  this.sendJob(`${this.config.namespace}.odoo.suppliers.invoices.fetch`, token, {integration: integration, config: this.config.services.odoo});
			//  this.sendJob(`${this.config.namespace}.odoo.customers.payments.fetch`, token, {integration: integration, config: this.config.services.odoo});
			this.sendJob(`${this.config.namespace}.odoo.suppliers.payments.fetch`, token, {integration: integration, config: this.config.services.odoo});

			done();
		} catch (e) {
			log.error(e);
			done(e);
		}
	}
}

module.exports = {};
module.exports.register = (queue, redis, config) => {
	const rateLimiter = new RateLimiter(config, redis);
	const redisLocker = new RedisLocker(redis, { integration: 'exact' });
	const odoo = new OdooHttp(config, redis, rateLimiter);

	const client = new OdooClient({
		uri: config.services.invoiceService.uri,
	});

	(new CustomerImport(queue, config, odoo, client)).register(config);
	(new CustomerImportInvoice(queue, config, odoo, client)).register(config);
	(new CustomerInvoicePaymentsController(queue, config, odoo, client)).register(config);

	(new SupplierImport(queue, config, odoo, client)).register(config);
	(new SupplierImportInvoice(queue, config, odoo, client)).register(config);
	(new SupplierInvoicePaymentsController(queue, config, odoo, client)).register(config);

//
// 	(new ExpensesImport(queue, config, odoo, client)).register(config);

	(new Odoo(queue, config, odoo, client, redisLocker)).register(config);
};
