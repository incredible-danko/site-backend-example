const moment = require('moment');
const momentTZ = require('moment-timezone');

const HttpService = require('../../services/HttpService');

momentTZ.tz.setDefault('Europe/Stockholm');

class Exact extends HttpService {
	constructor(config, queue, rateLimiter) {
		super(config.services.exact);

		this.queue = queue;
		this.rateLimiter = rateLimiter;
	}

	async fetchList(query, prevData = false) {
		const {
			accessToken,
			entityUrl,
		} = query;

		try {
			await this.rateLimiter.limit(`exact.${accessToken}`, 12);
			const response = await this.get(
				this.config.uri + entityUrl,
				{},
				{
					headers: {
						authorization: `Bearer ${accessToken}`,
						'Content-Type': 'application/json',
						Accept: 'application/json',
					},
				}
			);
			// if __next - perform subsequent requests
			if (response.body.d.__next === undefined) {
				let result = response.body.d.results
				if (prevData) {
					result = result.concat(prevData);
				}
				return result;
			}
			let nextData = response.body.d.results
			if (prevData) {
				nextData = nextData.concat(prevData);
			}
			let nextEntityUrl = response.body.d.__next.substring(32); // 32 is the length of config.uri
			return this.fetchList({ entityUrl: nextEntityUrl, accessToken: accessToken }, nextData);
		} catch (err) {
			if (err.statusCode === 401) {
				log.error('ExactService::fetchList: 401 Unauthorized');
			}
			log.warn('ExactService::fetchList: Unable to fetch entity');
			throw err;
		}
	}

}

module.exports = Exact;
