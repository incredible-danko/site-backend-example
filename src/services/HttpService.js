const request = require('request');
const url = require('url');

class HttpService {
	constructor(config) {
		this.config = config;
	}

	delete(path, params, options) {
		return this.execute('DELETE', path, params, null, options);
	}

	get(path, params, options) {
		return this.execute('GET', path, params, null, options);
	}

	patch(path, params, data, options) {
		return this.execute('PATCH', path, params, data, options);
	}

	post(path, params, data, options) {
		return this.execute('POST', path, params, data, options);
	}

	put(path, params, data, options) {
		return this.execute('PUT', path, params, data, options);
	}

	execute(method, path, params, data, options = {}) {
		const requestSetup = {
			method,
			timeout: 60 * 1000,
			url: url.resolve(this.config.uri, path),
		};

		if (params !== null) {
			requestSetup.qs = params;
		}

		if (data !== null && !options.form && !options.body) {
			requestSetup.json = data;
		}

		if (data !== null && options.form) {
			requestSetup.form = data;
		}

		if (data !== null && options.body) {
			requestSetup.body = data;
		}

		if (options) {
			const { headers = {} } = options;
			requestSetup.headers = headers;
		}

		log.info('HttpService::execute:', requestSetup);

		return new Promise((resolve, reject) => {
			request(
				requestSetup,
				(error, response, body) => {
					if (error) {
						return reject(error);
					}

					if (response.statusCode === 200 || response.statusCode === 201) {
						try {
							return resolve({ body: JSON.parse(body), statusCode: response.statusCode });
						} catch (e) {
							return resolve({ body, statusCode: response.statusCode });
						}
					}

					try {
						return reject({ body: JSON.parse(body), statusCode: response.statusCode });
					} catch (e) {
						return reject({ body, statusCode: response.statusCode });
					}
				}
			);
		});
	}
}

module.exports = HttpService;
