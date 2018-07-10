process.env.database = process.env.database || 'worker';
process.env.dbhost = process.env.dbhost || 'localhost';
process.env.MONGODB_BINDING = process.env.MONGODB_BINDING || '{}';
process.env.REDIS_BINDING = process.env.REDIS_BINDING || '{}';

const mongoDBConfig = JSON.parse(process.env.MONGODB_BINDING);
const redisConfig = JSON.parse(process.env.REDIS_BINDING);

module.exports = {
	port: process.env.PORT || 80,
	host: '0.0.0.0',
	services: {
		mongodb: {
			uri: mongoDBConfig.uri,
			ca_certificate_base64: mongoDBConfig.ca_certificate_base64,
			database: process.env.database,
		},
		redis: {
			uri: redisConfig.uri,
		},
		invoiceService: {
			uri: 'URI',
		},
		fortnox: {
			uri: 'https://api.fortnox.se/',
			clientSecret: 'SECRET',
			clientId: 'CLIENTID',
		},
	},
};
