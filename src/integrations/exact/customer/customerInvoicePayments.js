const Mappers = require('../mappers');

const {
	AddCustomerInvoicePayment,
} = require('../../../queries');

const log = Common.Utils.logging;

class CustomerInvoicePaymentController {
	constructor(queue, config, exact, client) {
		this.queue = queue;
		this.exact = exact;
		this.client = client;
		this.config = config;
	}

	register(config) {
		this.queue.process(`${config.namespace}.exact.customers.payments.fetch`, 1, (job, done) => this.import(job, done));
		// this.queue.process(`${config.namespace}.exact.customers.payment.fetch`, 1, (job, done) => this.fetchPayment(job, done));
	}

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
			log.error('Add Customer Invoice Receivable Error')
			throw new Error(JSON.stringify(response.errors));
		}

		log.info(`Imported Customer invoice payment ${response.data.addCustomerInvoicePayment.meta.invoiceNumber} and assigned it UUID : ${response.data.addCustomerInvoicePayment._id}`);

		return response;
	}

	async import(job, done) {
		log.log('Fetching Customer Invoice Receivables');

		const {
			token = false,
			integration = false,
		} = job.data;

		try {
			if (!integration.server) {
				throw new Error('Missing AccessToken');
			}

			const fetchData = await this.exact.fetchList({
				entityUrl: '/v1/2164341/cashflow/Receivables?$select=ID,Account,AccountBankAccountID,AccountBankAccountNumber,AccountCode,AccountContact,AccountContactName,AccountName,AmountDC,AmountDiscountDC,AmountDiscountFC,AmountFC,BankAccountID,BankAccountNumber,CashflowTransactionBatchCode,Created,Creator,CreatorFullName,Currency,Description,DirectDebitMandate,DirectDebitMandateDescription,DirectDebitMandatePaymentType,DirectDebitMandateReference,DirectDebitMandateType,DiscountDueDate,Division,Document,DocumentNumber,DocumentSubject,DueDate,EndDate,EndPeriod,EndToEndID,EndYear,EntryDate,EntryID,EntryNumber,GLAccount,GLAccountCode,GLAccountDescription,InvoiceDate,InvoiceNumber,IsBatchBooking,IsFullyPaid,Journal,JournalDescription,LastPaymentDate,Modified,Modifier,ModifierFullName,PaymentCondition,PaymentConditionDescription,PaymentDays,PaymentDaysDiscount,PaymentDiscountPercentage,PaymentInformationID,PaymentMethod,PaymentReference,RateFC,ReceivableBatchNumber,ReceivableSelected,ReceivableSelector,ReceivableSelectorFullName,Source,Status,TransactionAmountDC,TransactionAmountFC,TransactionDueDate,TransactionEntryID,TransactionID,TransactionIsReversal,TransactionReportingPeriod,TransactionReportingYear,TransactionStatus,TransactionType,YourRef',
				accessToken: integration.server.accessToken,
				// latest: integration.lastSynchronized,
			})

			for (const item of fetchData) {
				try {
					await this.addCustomerInvoicePayment(item, token);
				} catch (e) {
					log.warn('ExactService::CustomerInvoicePaymentController::addInvoice failed');
				}
			}

			done();
		} catch (e) {
			log.error('ExactService::CustomerInvoiceController::import');
			done(e);
		}

		done();

	}
}

module.exports = CustomerInvoicePaymentController;
