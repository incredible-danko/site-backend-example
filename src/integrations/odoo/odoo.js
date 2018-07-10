const moment = require('moment');
const momentTZ = require('moment-timezone');
const HttpService = require('../../services/HttpService');
const Odooxmlrpc = require('odoo-xmlrpc');

const log = Common.Utils.logging;
momentTZ.tz.setDefault('Europe/Stockholm');

class OdooHttp extends HttpService {
	constructor(config, queue, rateLimiter, authModule, client) {
		super(config.services.odoo);
		this.queue = queue;
		this.rateLimiter = rateLimiter;
		this.authModule = authModule;
		this.client = client;
	}

	async fetch(query) {
		const {
			model,
			config,
			params,
			token,
			fields = false,
		} = query;

		const odooclient = new Odooxmlrpc({
			url: config.metaUrl,
			port: 443,
			db: config.db,
			username: config.username,
			password: config.password,
		});

		await this.rateLimiter.limit(`odoo.${token}`, 12);
		try {
			// execute search and read, and return data
			const result = await this.execute(odooclient, model, 'search_read', params, fields);
			return result;
		} catch (e) {
			console.log('Odoo: Fetch Error')
			throw e;
		}
	}

	async execute(xmlrpc, model, method, inParams, fields) {
		const result = await new Promise((resolve, reject) => {
			xmlrpc.connect(function (err) {
				if (err) { reject(err); }
				// query building
				const criteria = []
				criteria.push(inParams)
				if (fields !== false) { criteria.push(fields); }
				const params = [];
				params.push(criteria);
				xmlrpc.execute_kw(model, method, params, function (error, value) {
					if (error) { console.log(error); reject(error); }
					resolve(value);
				});
			});
		})
		return result;
	}
}

module.exports = OdooHttp;
