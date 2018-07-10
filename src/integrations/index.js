const Fortnox = require('./fortnox');
const Exact = require('./exact');
const Odoo = require('./odoo');

module.exports = {};
module.exports.register = (queue, redis, config) => {
	Fortnox.register(queue, redis, config);
	Exact.register(queue, redis, config);
	Odoo.register(queue, redis, config);
};
