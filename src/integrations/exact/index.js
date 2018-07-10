const moment = require('moment');

const RedisLocker = require('../../services/RedisLocker');

const CustomerImportInvoice = require('./customer/customerInvoices');
const CustomerImport = require('./customer/customers');
const CustomerImportInvoicePayment = require('./customer/customerInvoicePayments');

const SupplierImportInvoice = require('./supplier/supplierInvoices');
const SupplierImportInvoicePayment = require('./supplier/supplierInvoicePayments');
const SupplierImport = require('./supplier/suppliers');

const ExpenseImport = require('./expenses/expenses');

const RateLimiter = require('../../services/RateLimiter');
const ExactHttp = require('./exact');

const {
	GetCompany,
	UpdateIntegration,
} = require('../../queries');

class Exact {
	constructor(queue, config, exact, client, locker) {
		this.queue = queue;
		this.config = config;
		this.exact = exact;
		this.client = client;
		this.locker = locker;
	}

	register(config) {
		this.queue.process(`${config.namespace}.exact.import`, 1, (job, done) => this.import(job, done));
		this.queue.process('exact.authenticate', 1, (job, done) => this.authenticate(job, done));
	}

	async getCompany(token) {
		const result = await this.client.execute(
			GetCompany,
			{},
			token
		).catch((err) => { return err; });
		return result;
	}

	getCompanyIntegration(response) {
		const {
			company: {
				integrations = [],
			} = {},
		} = response.data;

		const integration = integrations.find(item => item.key === 'exact');

		return integration;
	}

	async init(token) {
		const response = await this.getCompany(token);

		if (response.error && response.error.length > 0) {
			throw new Error(`Exact Integration: ${response.error}, message: ${response.message}`);
		}

		const integration = this.getCompanyIntegration(response)

		const {
			config: {
				server: {
					accessToken = false,
					refreshToken = false,
					expires = false,
				} = {},
				client: {
					authorizationCode = false,
				} = {},
			} = {},
		} = integration;

		if (!accessToken && !authorizationCode) {
			throw new Error('Company missing exact configuration');
		}
		// if accessToken refreshToken - check validity, and, if necessary - perform refreshToken
		// todo DRY - clean repeats of code
		if (accessToken && refreshToken) {
			if (moment().isAfter(expires)) {
				const lockerName = `token:exact:${refreshToken}`;
				// Attempt to get lock, if failed return false
				const acquired = await this.locker.lock(lockerName, 0);
				if (acquired === false) {
					// Someone else has the lock, wait for it to renew the token
					await this.locker.waitForUnlock(lockerName);
					const newResponse = await this.getCompany(token);
					if (newResponse.errors && newResponse.errors.length > 0) {
						throw new Error(JSON.stringify(newResponse.errors));
					}
					return this.getCompanyIntegration(newResponse);
				}
				const authResult = await this.refreshAccessToken(refreshToken);
				await this.client.execute(
					UpdateIntegration,
					{
						input: {
							key: 'exact',
							config: {
								client: {
									authenticated: true,
								},
								server: {
									accessToken: authResult.accessToken,
									refreshToken: authResult.refreshToken,
									expires: moment().add(600000),
								},
								connected: true,
								errors: [],
								lastSynchronized: null,
							},
						},
					},
					token
				);
				await this.locker.unlock(lockerName);

				const newResponse = await this.getCompany(token);
				if (newResponse.errors && newResponse.errors.length > 0) {
					throw new Error(JSON.stringify(newResponse.errors));
				}
				return this.getCompanyIntegration(newResponse);
			}
			return integration;
		} else if (authorizationCode) {
			const authResult = await this.authenticate(authorizationCode);
			if (!authResult.accessToken) {
				await this.client.execute(
					UpdateIntegration,
					{
						input: {
							key: 'exact',
							config: {
								client: {
									authenticated: false,
								},
								server: {
									accessToken: '',
								},
								connected: true,
								errors: [{ code: 0, message: 'Unable to validate token' }],
								lastSynchronized: null,
							},
						},
					},
					token
				);

				throw new Error('Exact: Unable to authenticate company');
			}
			await this.client.execute(
				UpdateIntegration,
				{
					input: {
						key: 'exact',
						config: {
							client: {
								authenticated: true,
							},
							server: {
								accessToken: authResult.accessToken,
								refreshToken: authResult.refreshToken,
								expires: moment().add(600000),
							},
							connected: true,
							errors: [],
							lastSynchronized: null,
						},
					},
				},
				token
			);
			return integration;
		}
		throw new Error('Company missing exact configuration');
	}

	// auth here
	async authenticate(authorizationCode) {
		try {
			const response = await this.exact.post('/api/oauth2/token', {}, {
				code: authorizationCode,
				grant_type: 'authorization_code',
				client_id: this.config.services.exact.clientId,
				client_secret: this.config.services.exact.clientSecret,
				redirect_uri: this.config.services.exact.redirectUri,
			}, {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				form: true,
			});
			return {
				accessToken: response.body.access_token,
				refreshToken: response.body.refresh_token,
			};
		} catch (e) {
			console.log(e);
			return false;
		}
	}

	// refresh token request
	async refreshAccessToken(refreshToken) {
		try {
			const response = await this.exact.post('/api/oauth2/token', {}, {
				refresh_token: refreshToken,
				grant_type: 'refresh_token',
				client_id: this.config.services.exact.clientId,
				client_secret: this.config.services.exact.clientSecret,
			}, {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				form: true,
			});

			return {
				accessToken: response.body.access_token,
				refreshToken: response.body.refresh_token,
			};
		} catch (e) {
			return false;
		}
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
			.save(() => {});
	}

	async import(job, done) {
		const {
			token = false,
		} = job.data;

		try {
			const integration = await this.init(token);

			this.client.execute(
				UpdateIntegration,
				{
					input: {
						key: 'exact',
						config: {
							lastSynchronized: new Date(),
						},
					},
				},
				token
			);

		// 	this.sendJob(`${this.config.namespace}.exact.customers.fetch`, token, integration.config);
		// 	this.sendJob(`${this.config.namespace}.exact.customerinvoices.fetch`, token, integration.config);
		// 	this.sendJob(`${this.config.namespace}.exact.customers.payments.fetch`, token, integration.config);
		// 	this.sendJob(`${this.config.namespace}.exact.suppliers.fetch`, token, integration.config);
		// 	this.sendJob(`${this.config.namespace}.exact.suppliers.invoices.fetch`, token, integration.config);
		// 	this.sendJob(`${this.config.namespace}.exact.suppliers.payments.fetch`, token, integration.config);
		// 	this.sendJob(`${this.config.namespace}.exact.suppliers.payments.fetch`, token, integration.config);
			this.sendJob(`${this.config.namespace}.exact.GLAccount.fetch`, token, integration.config);

		//	this.sendJob(`${this.config.namespace}.exact.salaries.fetch`, token, integration.config);

			done();
		} catch (e) {
			console.error(e);
			done(e);
		}
	}
}

module.exports = {};
module.exports.register = (queue, redis, config) => {
	const rateLimiter = new RateLimiter(config, redis);
	const redisLocker = new RedisLocker(redis, { integration: 'exact' });
	const exact = new ExactHttp(config, redis, rateLimiter);

	const client = new Common.Http.GraphQLClient({
		uri: config.services.invoiceService.uri,
	});

	(new CustomerImportInvoice(queue, config, exact, client)).register(config);
	(new CustomerImport(queue, config, exact, client)).register(config);
	(new CustomerImportInvoicePayment(queue, config, exact, client)).register(config);

	(new SupplierImport(queue, config, exact, client)).register(config);
	(new SupplierImportInvoice(queue, config, exact, client)).register(config);
	(new SupplierImportInvoicePayment(queue, config, exact, client)).register(config);

	(new ExpenseImport(queue, config, exact, client)).register(config);

	(new Exact(queue, config, exact, client, redisLocker)).register(config);
};
