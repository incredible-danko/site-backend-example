const Mappers = require('../mappers');

const {
	AddSupplier,
} = require('../../../queries/index');

const log = Common.Utils.logging;

class SupplierController {
	constructor(queue, config, odoo, client) {
		this.queue = queue;
		this.odoo = odoo;
		this.client = client;
		this.config = config;
	}

	register(config) {
		this.queue.process(`${config.namespace}.odoo.suppliers.fetch`, 1, (job, done) => this.import(job, done));
	}

	async addSupplier(item, token) {
		const supplier = Mappers.Supplier({}, item);

		const response = await this.client.execute(
			AddSupplier,
			{
				input: supplier,
			},
			token
		);

		if (response.errors && response.errors.length > 0) {
			throw new Error(JSON.stringify(response.errors));
		}

		log.info(`Imported Supplier ${response.data.updateSupplier.meta.supplierNumber} and assigned it UUID : ${response.data.updateSupplier._id}`);

		return response;
	}

	async import(job, done) {
		console.log('Fetching Suppliers');
		log.log('Fetching Suppliers');

		const {
			token = false,
			integration = false,
		} = job.data;

		try {
			if (!integration.integration) {
				const error = new Error('Odoo: Missing Integration');
				log.error(error);
				done(error);
			} else {
				const suppliers = await this.odoo.fetch({
					config: integration.config,
					model: 'res.partner',
					params: [['supplier', '=', true]],
					fields: ['name', 'bank_ids', 'contact_address', 'city', 'company_name', 'vat', 'id', 'phone', 'email'],
					token,
					lastSynchronized: integration.lastSynchronized,
				});
				for (const supplier of suppliers) {
					this.addSupplier(supplier, token);
				}
				done();
			}
		} catch (e) {
			log.error(e);
			done(e);
		}
	}
}

module.exports = SupplierController;
