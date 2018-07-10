class TokenRefreshService {
	constructor(http, main, expiredRegex) {
		this.http = http;
		this.main = main;
		this.expiredRegex = expiredRegex;
	}

	async ensureCorrectToken(apiUrl, integration, token, companyId, params) {
		let actualIntegration = integration;
		let response;
		try {
			response = await this.http.get(
				apiUrl,
				{
					...params,
				},
				{
					headers: {
						Authorization: `Bearer ${actualIntegration.server.accessToken || ''}`,
					},
				}
			);
		} catch (e) {
			if (e.statusCode === 401 && this.expiredRegex.test(e.body.error)) {
				log.info('Got expired token response code. Refreshing token...');
				actualIntegration = await this.main
					.renewToken(token, companyId, actualIntegration.server.refreshToken);

				response = await this.http.get(
					apiUrl,
					{
						...params,
					},
					{
						headers: {
							Authorization: `Bearer ${actualIntegration.server.accessToken || ''}`,
						},
					}
				);
			} else throw e;
		}
		return { response, actualIntegration };
	}
}

module.exports = TokenRefreshService;
