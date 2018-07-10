const Mappers = require('../mappers');

const {
	AddSupplierInvoice,
} = require('../../../queries');

const log = Common.Utils.logging;

class InvoiceController {
	constructor(queue, config, exact, client) {
		this.queue = queue;
		this.exact = exact;
		this.client = client;
		this.config = config;
	}

	register(config) {
		this.queue.process(`${config.namespace}.exact.suppliers.invoices.fetch`, 1, (job, done) => this.import(job, done));
		//this.queue.process(`${config.namespace}.exact.suppliers.invoice.fetch`, 1, (job, done) => this.fetchInvoice(job, done));
	}

	async addInvoice(item, token) {
		const invoice = Mappers.SupplierInvoice({}, item);

		const response = await this.client.execute(
			AddSupplierInvoice,
			{
				input: invoice,
			},
			token
		);

		if (response.errors && response.errors.length > 0) {
			log.error('Add Supplier Invoice Error')
			throw new Error(JSON.stringify(response.errors));
		}

		log.info(`Imported Supplier invoice ${response.data.updateSupplierInvoice.meta.invoiceNumber} and assigned it UUID : ${response.data.updateSupplierInvoice._id}`);

		return response;
	}

	async import(job, done) {
		log.log('Fetching Supplier Invoices');

		const {
			token = false,
			integration = false,
		} = job.data;


		try {
			if (!integration.server) {
				throw new Error('Missing AccessToken');
			}

			const fetchData = await this.exact.fetchList({
				entityUrl: '/v1/2164341/purchase/PurchaseInvoices?$select=ID,Amount,ContactPerson,Currency,Description,Document,DueDate,EntryNumber,ExchangeRate,FinancialPeriod,FinancialYear,InvoiceDate,Journal,Modified,PaymentCondition,PaymentReference,PurchaseInvoiceLines,Remarks,Source,Status,Supplier,Type,VATAmount,Warehouse,YourRef&$expand=PurchaseInvoiceLines',
				accessToken: integration.server.accessToken,
				// latest: integration.lastSynchronized,
			})

			for (const item of fetchData) {
				try {
					await this.addInvoice(item, token);
				} catch (e) {
					log.warn('ExactService::SupplierInvoiceController::addInvoice failed');
				}
			}

			done();
		} catch (e) {
			log.error(e);
			done(e);
		}
	}
}

module.exports = InvoiceController;
