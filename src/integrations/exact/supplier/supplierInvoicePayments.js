const Mappers = require('../mappers');

const {
	AddSupplierInvoicePayment,
} = require('../../../queries');

const log = Common.Utils.logging;

class SupplierInvoicePaymentsController {
	constructor(queue, config, exact, client) {
		this.queue = queue;
		this.exact = exact;
		this.client = client;
		this.config = config;
	}

	register(config) {
		this.queue.process(`${config.namespace}.exact.suppliers.payments.fetch`, 1, (job, done) => this.import(job, done));
		// this.queue.process(`${config.namespace}.exact.suppliers.payment.fetch`, 1, (job, done) => this.fetchPayment(job, done));
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
			log.error('Add Supplier Invoice Payment Error')
			throw new Error(JSON.stringify(response.errors));
		}

		log.info(`Imported Supplier invoice payment ${response.data.addSupplierInvoicePayment.meta.serialNumber} and assigned it UUID : ${response.data.addSupplierInvoicePayment._id}`);

		return response;
	}

	async import(job, done) {
		log.log('Fetching Supplier Invoice Payments');

		const {
			token = false,
			integration = false,
		} = job.data;

		try {
			if (!integration.server) {
				throw new Error('Missing AccessToken');
			}

			const fetchData = await this.exact.fetchList({
				entityUrl: '/v1/2164341/cashflow/Payments?$select=ID,Account,AccountBankAccountID,AccountBankAccountNumber,AccountCode,AccountContact,AccountContactName,AccountName,AmountDC,AmountDiscountDC,AmountDiscountFC,AmountFC,BankAccountID,BankAccountNumber,CashflowTransactionBatchCode,Created,Creator,CreatorFullName,Currency,Description,DiscountDueDate,Division,Document,DocumentNumber,DocumentSubject,DueDate,EndDate,EndPeriod,EndYear,EntryDate,EntryID,EntryNumber,GLAccount,GLAccountCode,GLAccountDescription,InvoiceDate,InvoiceNumber,IsBatchBooking,Journal,JournalDescription,Modified,Modifier,ModifierFullName,PaymentBatchNumber,PaymentCondition,PaymentConditionDescription,PaymentDays,PaymentDaysDiscount,PaymentDiscountPercentage,PaymentMethod,PaymentReference,PaymentSelected,PaymentSelector,PaymentSelectorFullName,RateFC,Source,Status,TransactionAmountDC,TransactionAmountFC,TransactionDueDate,TransactionEntryID,TransactionID,TransactionIsReversal,TransactionReportingPeriod,TransactionReportingYear,TransactionStatus,TransactionType,YourRef',
				accessToken: integration.server.accessToken,
				// latest: integration.lastSynchronized,
			})

			for (const item of fetchData) {
				try {
					await this.addSupplierInvoicePayment(item, token);
				} catch (e) {
					log.warn('ExactService::SupplierInvoicePaymentController::addInvoice failed');
				}
			}

			done();
		} catch (e) {
			log.error('ExactService::SupplierInvoicePaymentController::import');
			done(e);
		}
	}
}

module.exports = SupplierInvoicePaymentsController;
