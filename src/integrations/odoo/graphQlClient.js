const {
	GetCompany,
	UpdateIntegration,
} = require('../../queries/index');
const moment = require('moment');

const key = 'odoo';

class OdooClient extends Common.Http.GraphQLClient {
	async updateIntegration(integration, token) {
		if (!integration) {
			await this.execute(
				UpdateIntegration,
				{
					input: {
						key,
						config: {
							client: {
								authenticated: false,
							},
							server: {
							},
							connected: true,
							errors: [{ code: 0, message: 'Unable to validate token' }],
							lastSynchronized: null,
						},
					},
				},
				token
			);

			throw new Error('Odoo: Unable to authenticate company');
		}

		await this.execute(
			UpdateIntegration,
			{
				input: {
					key,
					config: {
						client: {
							authenticated: true,
						},
						server: {
						},
						connected: true,
						errors: [],
						lastSynchronized: null,
					},
				},
			},
			token
		);
	}

	async updateLastSync(token) {
		await this.execute(
			UpdateIntegration,
			{
				input: {
					key,
					config: {
						lastSynchronized: new Date(),
					},
				},
			},
			token
		);
	}

	async getIntegration(token) {
		const response = await this.execute(
			GetCompany,
			{},
			token
		);

		if (response.errors && response.errors.length > 0) {
			throw new Error(JSON.stringify(response.errors));
		}

		const {
			company: {
				integrations = [],
			} = {},
		} = response.data;

		return integrations.find(item => item.key === key);
	}
}

module.exports = OdooClient;
