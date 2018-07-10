const moment = require('moment');
const momentTZ = require('moment-timezone');

const HttpService = require('../../services/HttpService');

const log = Common.Utils.logging;
momentTZ.tz.setDefault('Europe/Stockholm');

class Fortnox extends HttpService {
	constructor(config, queue, rateLimiter) {
		super(config.services.fortnox);

		this.queue = queue;
		this.rateLimiter = rateLimiter;
	}

	async fetchList(query, page = 1, attempts = 5) {
		const {
			entity,
			accessToken,
			latest,
			financialyear,
		} = query;

		const data = {
			page,
			limit: 100,
		};

		if (latest) {
			data.lastmodified = momentTZ(latest).format('YYYY-MM-DD HH:mm');
		}

		if (financialyear) {
			data.financialyear = financialyear;
		}

		try {
			await this.rateLimiter.limit(`fortnox.${accessToken}`, 12);
			const response = await this.get(`/3/${entity.toLowerCase()}`, data, {
				headers: {
					'Access-Token': accessToken,
					'Client-Secret': this.config.clientSecret,
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
			});

			return { meta: response.body.MetaInformation, list: response.body[entity] };
		} catch (err) {
			const {
				body = {}
			} = err;

			if (body.ErrorInformation && body.ErrorInformation.code === 2000663) {
				log.warn('FortnoxService::fetch: Missing scope for company');
				throw err;
			}

			log.warn(err);

			log.warn('FortnoxService::fetch: Unable to fetch entity', entity.name);
			if (attempts > 0) {
				return this.fetchList(query, page, attempts - 1);
			}

			log.error(err);

			throw err;
		}
	}

	async fetchPages(query, progressCB, page = 1) {
		const fetchPage = async (currentPage = 1) => {
			const response = await this.fetchList(query, currentPage);
			const {
				meta = {},
				list = [],
			} = response;

			if (list.length === 0) {
				return { list, meta };
			}

			await Promise.all(list.map(item => progressCB(item)));

			return { list, meta };
		};


		const response = await fetchPage(page);
		const {
			meta = {},
		} = response;

		const totalPages = meta['@TotalPages'] || 0;
		const currentPage = meta['@CurrentPage'] || 0;

		if (totalPages <= currentPage) {
			return response;
		}

		return this.fetchPages(query, progressCB, currentPage + 1);
	}

	async fetchOne(query) {
		const {
			entity,
			entityUrl,
			accessToken,
		} = query;

		await this.rateLimiter.limit(`fortnox.${accessToken}`, 12);

		const response = await this.get(
			entityUrl,
			{},
			{
				headers: {
					'Access-Token': accessToken,
					'Client-Secret': this.config.clientSecret,
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
			}
		);

		return response.body[entity];
	}
}

module.exports = Fortnox;
