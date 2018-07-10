const moment = require('moment');

const {
	GetCompany,
	UpdateIntegration,
} = require('../queries');

class TokenRefreshService {
	constructor(client, locker) {
		this.client = client;
		this.locker = locker;
	}

	async get(key, token) {
		const response = await this.client.execute(
			GetCompany,
			{},
			token
		);

		if (!response || !response.data) {
			throw new Error(JSON.stringify('Enable to get response from server'));
		}

		if (response.errors && response.errors.length > 0) {
			throw new Error(JSON.stringify(response.errors));
		}

		if (response.data.company === null) {
			throw new Error(JSON.stringify('Unable to find company'));
		}

		const {
			company: {
				integrations = [],
			} = {},
		} = response.data;

		return integrations.find(item => item.key === key);
	}

	async getIntegration(key, token, refreshFunc = () => ({})) {
		const response = await this.client.execute(
			GetCompany,
			{},
			token
		);

		if (!response || !response.data) {
			throw new Error(JSON.stringify('Enable to get response from server'));
		}

		if (response.errors && response.errors.length > 0) {
			throw new Error(JSON.stringify(response.errors));
		}

		if (response.data.company === null) {
			throw new Error(JSON.stringify('Unable to find company'));
		}

		const {
			company: {
				integrations = [],
			} = {},
		} = response.data;

		const integration = integrations.find(item => item.key === key);
		return this.validateIntegration(integration, token, refreshFunc);
	}

	async renewToken(key, token, prevRefreshToken, refreshFunc = () => ({})) {
		try {
			const response = await refreshFunc(prevRefreshToken);
			const {
				accessToken = false,
				refreshToken = false,
				expires = 30000,
			} = response;

			if (accessToken === false) {
				throw new Error('Unable to update access token');
			}

			return this.updateIntegration(
				{
					client: {
						authenticated: true,
					},
					server: {
						accessToken,
						refreshToken,
						expires: moment().add(expires, 'seconds').subtract(3600, 'seconds'),
					},
					connected: true,
					errors: null,
				},
				key,
				token
			);
		} catch (e) {
			this.client.execute(
				UpdateIntegration,
				{
					input: {
						key,
						config: {
							connected: false,
							errors: [{ code: 0, message: 'Unable to get new access token' }],
						},
					},
				},
				token
			);
			throw e;
		}
	}

	async updateIntegration(config, key, token) {
		await this.client.execute(
			UpdateIntegration,
			{
				input: {
					key,
					config,
				},
			},
			token
		);

		return this.getIntegration(key, token);
	}

	async validateIntegration(integration, token, refreshFunc) {
		const {
			config: {
				server: {
					accessToken = false,
					refreshToken = false,
					expires = false,
				} = {},
				client: {
					authenticated = false,
				} = {},
			} = {},
			key = '',
		} = integration;

		if (authenticated === false || expires === false) {
			throw new Error('Company not authenticated to bank');
		}

		if (accessToken === 'dummy') {
			return integration;
		}

		if (moment().isAfter(expires)) {
			const lockerName = `token:${key}:${refreshToken}`;
			// Attempt to get lock, if failed return false
			const aquired = await this.locker.lock(lockerName, 0);
			if (aquired === false) {
				// Someone else has the lock, wait for it to renew the token..
				await this.locker.waitForUnlock(lockerName);
				return this.getIntegration(key, token);
			}

			const newIntegration = await this.renewToken(key, token, refreshToken, refreshFunc);
			await this.locker.unlock(lockerName);

			return newIntegration;
		}

		if (accessToken) {
			return integration;
		}

		throw new Error('Company missing integration configuration');
	}
}

module.exports = TokenRefreshService;
