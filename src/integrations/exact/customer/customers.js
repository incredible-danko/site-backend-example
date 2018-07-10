const Mappers = require('../mappers');
const _ = require('lodash');

const {
	AddCustomer,
} = require('../../../queries');

const log = Common.Utils.logging;

class CustomerController {
	constructor(queue, config, exact, client) {
		this.queue = queue;
		this.exact = exact;
		this.client = client;
		this.config = config;
	}

	register(config) {
		this.queue.process(`${config.namespace}.exact.customers.fetch`, 1, (job, done) => this.import(job, done));
	}

	async addCustomer(item, token) {
		// mapper
		const customer = Mappers.Customer({}, item);
		// manual adding of bank accounts
		const bankAccounts = item.BankAccounts.results;
		bankAccounts.forEach((ba, i, bankAccounts) => {
			_.set(customer, `info.accounts[${i}].bank`, ba.BankName);
			_.set(customer, `info.accounts[${i}].bankAccountNumber`, ba.BankAccount);
			_.set(customer, `info.accounts[${i}].bic`, ba.BICCode);
			_.set(customer, `info.accounts[${i}].iban`, ba.IBAN);
		});

		const response = await this.client.execute(
			AddCustomer,
			{
				input: customer,
			},
			token
		);

		if (response.errors && response.errors.length > 0) {
			log.error('Add Customer Error')
			throw new Error(JSON.stringify(response.errors));
		}

		log.info(`Imported Customer ${response.data.updateCustomer.meta.customerNumber} and assigned it UUID : ${response.data.updateCustomer._id}`);

		return response;
	}

	async import(job, done) {
		log.log('Fetching Customers');

		const {
			token = false,
			integration = false,
		} = job.data;

		try {
			if (!integration.server) {
				throw new Error('Missing AccessToken');
			}

			const fetchData = await this.exact.fetchList({
				entityUrl: '/v1/2164341/crm/Accounts?$select=ID,Accountant,AccountManager,AccountManagerFullName,AccountManagerHID,ActivitySector,ActivitySubSector,AddressLine1,AddressLine2,AddressLine3,BankAccounts,Blocked,BusinessType,CanDropShip,ChamberOfCommerce,City,Classification1,Code,CodeAtSupplier,CompanySize,ConsolidationScenario,ControlledDate,Country,CountryName,Created,Creator,CreatorFullName,CreditLinePurchase,CreditLineSales,DatevCreditorCode,DatevDebtorCode,DiscountPurchase,DiscountSales,Division,Email,EndDate,EstablishedDate,Fax,GLAccountPurchase,GLAccountSales,GLAP,GLAR,HasWithholdingTaxSales,IgnoreDatevWarningMessage,IntraStatArea,IntraStatDeliveryTerm,IntraStatSystem,IntraStatTransactionA,IntraStatTransactionB,IntraStatTransportMethod,InvoiceAccount,InvoiceAccountCode,InvoiceAccountName,InvoiceAttachmentType,InvoicingMethod,IsAccountant,IsAgency,IsCompetitor,IsExtraDuty,IsMailing,IsPilot,IsReseller,IsSales,IsSupplier,Language,LanguageDescription,Latitude,LeadPurpose,LeadSource,Logo,LogoFileName,LogoThumbnailUrl,LogoUrl,Longitude,MainContact,Modified,Modifier,ModifierFullName,Name,OINNumber,Parent,PayAsYouEarn,PaymentConditionPurchase,PaymentConditionPurchaseDescription,PaymentConditionSales,PaymentConditionSalesDescription,Phone,PhoneExtension,Postcode,PriceList,PurchaseCurrency,PurchaseCurrencyDescription,PurchaseLeadDays,PurchaseVATCode,PurchaseVATCodeDescription,RecepientOfCommissions,Remarks,Reseller,ResellerCode,ResellerName,RSIN,SalesCurrency,SalesCurrencyDescription,SalesVATCode,SalesVATCodeDescription,SearchCode,SecurityLevel,SeparateInvPerProject,SeparateInvPerSubscription,ShippingLeadDays,ShippingMethod,StartDate,State,StateName,Status,TradeName,Type,UniqueTaxpayerReference,VATLiability,VATNumber,Website&$expand=BankAccounts',
				accessToken: integration.server.accessToken,
				// latest: integration.lastSynchronized,
			})

			for (let item of fetchData) {
				if (item.IsSupplier === false) {
					try {
						await this.addCustomer(item, token);
					} catch (e) {
						log.warn('ExactService::CustomerController::addCustomer failed');
					}
				}
			}

			done();
		} catch (e) {
			log.error('ExactService::CustomerController::import');
			done(e);
		}
	}
}

module.exports = CustomerController;
