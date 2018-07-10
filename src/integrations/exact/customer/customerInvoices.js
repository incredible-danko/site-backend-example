const Mappers = require('../mappers');

const {
	AddCustomerInvoice,
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
		// explicitly set different redis name due to strange errors
		this.queue.process(`${config.namespace}.exact.customerinvoices.fetch`, 1, (job, done) => this.import(job, done));
	}

	async addInvoice(item, token) {
		const invoice = Mappers.CustomerInvoice({}, item);

		const response = await this.client.execute(
			AddCustomerInvoice,
			{
				input: invoice,
			},
			token
		);

		if (response.errors && response.errors.length > 0) {
			log.error('Add Customer Invoice Error')
			throw new Error(JSON.stringify(response.errors));
		}

		log.info(`Imported Customer invoice ${response.data.updateCustomerInvoice.meta.invoiceNumber} and assigned it UUID : ${response.data.updateCustomerInvoice._id}`);

		return response;
	}

	async import(job, done) {
		log.log('Fetching Customer Invoices');

		const {
			token = false,
			integration = false,
		} = job.data;

		try {
			if (!integration.server) {
				throw new Error('Missing AccessToken');
			}

			const fetchData = await this.exact.fetchList({
				entityUrl: '/v1/2164341/salesinvoice/SalesInvoices?$select=InvoiceID,AmountDC,AmountDiscount,AmountDiscountExclVat,AmountFC,AmountFCExclVat,Created,Creator,CreatorFullName,Currency,DeliverTo,DeliverToAddress,DeliverToContactPerson,DeliverToContactPersonFullName,DeliverToName,Description,Discount,Division,Document,DocumentNumber,DocumentSubject,DueDate,ExtraDutyAmountFC,GAccountAmountFC,InvoiceDate,InvoiceNumber,InvoiceTo,InvoiceToContactPerson,InvoiceToContactPersonFullName,InvoiceToName,IsExtraDuty,Journal,JournalDescription,Modified,Modifier,ModifierFullName,OrderDate,OrderedBy,OrderedByContactPerson,OrderedByContactPersonFullName,OrderedByName,OrderNumber,PaymentCondition,PaymentConditionDescription,PaymentReference,Remarks,SalesInvoiceLines,Salesperson,SalespersonFullName,StarterSalesInvoiceStatus,StarterSalesInvoiceStatusDescription,Status,StatusDescription,TaxSchedule,TaxScheduleCode,TaxScheduleDescription,Type,TypeDescription,VATAmountDC,VATAmountFC,WithholdingTaxAmountFC,WithholdingTaxBaseAmount,WithholdingTaxPercentage,YourRef',
				accessToken: integration.server.accessToken,
				// latest: integration.lastSynchronized,
			})

			for (const item of fetchData) {
				try {
					await this.addInvoice(item, token);
				} catch (e) {
					log.warn('ExactService::CustomerInvoiceController::addInvoice failed');
				}
			}

			done();
		} catch (e) {
			log.error('ExactService::CustomerInvoiceController::import');
			done(e);
		}
	}
}

module.exports = InvoiceController;
