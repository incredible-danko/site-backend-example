const config = require('../config/config');
const kue = require('kue');
const cluster = require('cluster');
const http = require('http');
const Redis = require('ioredis');
const fs = require('fs');
const MongoDB = require('mongodb');
const JWT = require('jsonwebtoken');

const Integrations = require('./integrations');

const log = Common.Utils.logging;

const redis = new Redis(config.services.redis.uri);
const queue = kue.createQueue({
	redis: config.services.redis.uri,
});

const clusterWorkerSize = 1;// require('os').cpus().length;

const generateToken = (auth) => {
	return JWT.sign(
		{
			data: auth,
		},
		Common.Key,
		{
			expiresIn: '12h',
		}
	);
};

if (cluster.isMaster) {
	for (let i = 0; i < clusterWorkerSize; i += 1) {
		cluster.fork();
	}

	queue.on('error', (err) => {
		log.log('Oops... ', err);
	});

	queue.inactive((err, ids) => { // others are active, complete, failed, delayed
		log.log(`Jobs Waiting: ${ids.length}`);
	});

	queue.delayed((err, ids) => { // others are active, complete, failed, delayed
		log.log(`Jobs delayed: ${ids.length}`);
	});

	queue.failed((err, ids) => { // others are active, complete, failed, delayed
		log.log(`Jobs failed: ${ids.length}`);
	});

	queue.active((err, ids) => { // others are active, complete, failed, delayed
		log.log(`Jobs Active: ${ids.length}`);
	});

	const requestHandler = (request, response) => {
		response.end('Welcome to Bank Integrations');
	};

	const server = http.createServer(requestHandler);
	MongoDB.init(config).then(async () => {
		server.listen(config.port, (err) => {
			if (err) {
				log.error('something bad happened', err);
				throw err;
			}

			log.log(`server is listening on ${config.port}`);
		});

		//TODO: Move this somewhere else and cleanup!!!
		const sync = (company) => {
			const {
				integrations = [],
			} = company;

			const longLivedToken = generateToken({ companyId: company._id });

			const integration = integrations.find(item => item.key === 'fortnox');

			if (!integration) {
				return false;
			}

			const {
				config: {
					client: {
						authenticated = false,
					},
				} = {},
			} = integration;

			if (authenticated === false) {
				return false;
			}

			log.info(`Adding job to queue to update fortnox for ${company._id}`);

			queue.create(
				'erp.fortnox.import',
				{
					token: longLivedToken,
				}
			)
				.attempts(1)
				.removeOnComplete(true)
				.save(() => {});
		};

		const syncAll = async () => {
			const cursor = MongoDB.connection.collection('companies').find();
			const companies = await cursor.toArray();

			companies.map(company => sync(company));
		};

		if (process.env.NODE_ENV === 'production') {
			setInterval(() => syncAll(), 30 * 60 * 1000);
			syncAll();
		}

		//syncAll();
	});

// 	queue.create(
// 		'erp.exact.import',
// 		{
// 			token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7Il9pZCI6IjVhNTQxZTEwNDQxMDEyMDAwMTdlNjIxMSIsImZ1bGxuYW1lIjoiRGV2ZWxvcG1lbnQiLCJ1c2VybmFtZSI6ImRldmVsb3BtZW50QGFzdGVyaWFpbmMuc2UiLCJjb21wYW55SWQiOiI1YTE2ZDZjNzYzZWVkMjg1MTY5YWM0NTMiLCJjcmVhdGVkIjoiMjAxOC0wMS0wOVQwMTo0Mjo0MC40OTNaIiwibW9kaWZpZWQiOiIyMDE4LTAyLTI3VDE0OjEzOjMxLjU1MloiLCJjb21wYW5pZXNJZCI6WyI1YTE2ZDZjNzYzZWVkMjg1MTY5YWM0NTMiLCI1YTc0NTY2ZGU1NDY5NTM5MzRkMmIwYjciLCI1YTc0NTY2ZGU1NDY5NTM5MzRkMmIwYjciXSwiZmlyc3RuYW1lIjoiTGF1IExhdSIsImxhc3RuYW1lIjoiRGluZy1Eb25nIiwiYWxlcnRzIjp7ImVtYWlsIjoiaW5mb0Bhc3RlcmlhaW5jLnNlIiwibmV3c2xldHRlciI6dHJ1ZX19LCJpYXQiOjE1MjY1NTMxMzcsImV4cCI6MTUyNjU1NjczN30.-wN_DWa6o_mrvK1T435wAp4I9SoPlIRP_82DHRj1tS8',
// 		}
// 	)
// 		.attempts(1)
// 		.removeOnComplete(true)
// 		.save(() => {});

// 	queue.create(
// 		'erp.odoo.import',
// 		{
// 			token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7Il9pZCI6IjVhNTQxZTEwNDQxMDEyMDAwMTdlNjIxMSIsImZ1bGxuYW1lIjoiRGV2ZWxvcG1lbnQiLCJ1c2VybmFtZSI6ImRldmVsb3BtZW50QGFzdGVyaWFpbmMuc2UiLCJjb21wYW55SWQiOiI1YTE2ZDZjNzYzZWVkMjg1MTY5YWM0NTMiLCJjcmVhdGVkIjoiMjAxOC0wMS0wOVQwMTo0Mjo0MC40OTNaIiwibW9kaWZpZWQiOiIyMDE4LTAyLTI3VDE0OjEzOjMxLjU1MloiLCJjb21wYW5pZXNJZCI6WyI1YTE2ZDZjNzYzZWVkMjg1MTY5YWM0NTMiLCI1YTc0NTY2ZGU1NDY5NTM5MzRkMmIwYjciLCI1YTc0NTY2ZGU1NDY5NTM5MzRkMmIwYjciXSwiZmlyc3RuYW1lIjoiTGF1IExhdSIsImxhc3RuYW1lIjoiRGluZy1Eb25nIiwiYWxlcnRzIjp7ImVtYWlsIjoiaW5mb0Bhc3RlcmlhaW5jLnNlIiwibmV3c2xldHRlciI6dHJ1ZX19LCJpYXQiOjE1MjY1NTMxMzcsImV4cCI6MTUyNjU1NjczN30.-wN_DWa6o_mrvK1T435wAp4I9SoPlIRP_82DHRj1tS8',
// 		}
// 	)
// 		.attempts(1)
// 		.removeOnComplete(true)
// 		.save(() => {});

// 	queue.create(
// 		'erp.vismaeekonomi.import',
// 		{
// 			token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7Il9pZCI6IjVhNTQxZTEwNDQxMDEyMDAwMTdlNjIxMSIsImZ1bGxuYW1lIjoiRGV2ZWxvcG1lbnQiLCJ1c2VybmFtZSI6ImRldmVsb3BtZW50QGFzdGVyaWFpbmMuc2UiLCJjb21wYW55SWQiOiI1YTE2ZDZjNzYzZWVkMjg1MTY5YWM0NTMiLCJjcmVhdGVkIjoiMjAxOC0wMS0wOVQwMTo0Mjo0MC40OTNaIiwibW9kaWZpZWQiOiIyMDE4LTAyLTI3VDE0OjEzOjMxLjU1MloiLCJjb21wYW5pZXNJZCI6WyI1YTE2ZDZjNzYzZWVkMjg1MTY5YWM0NTMiLCI1YTc0NTY2ZGU1NDY5NTM5MzRkMmIwYjciLCI1YTc0NTY2ZGU1NDY5NTM5MzRkMmIwYjciXSwiZmlyc3RuYW1lIjoiTGF1IExhdSIsImxhc3RuYW1lIjoiRGluZy1Eb25nIiwiYWxlcnRzIjp7ImVtYWlsIjoiaW5mb0Bhc3RlcmlhaW5jLnNlIiwibmV3c2xldHRlciI6dHJ1ZX19LCJpYXQiOjE1MjY1NTMxMzcsImV4cCI6MTUyNjU1NjczN30.-wN_DWa6o_mrvK1T435wAp4I9SoPlIRP_82DHRj1tS8',
// 		}
// 	)
// 		.attempts(1)
// 		.removeOnComplete(true)
// 		.save(() => {});

} else {
	log.info(`Starting ERP File Worker: ${process.pid}`);

	queue.on('error', (err) => {
		log.error('Oops... ', err);
	});

	queue.watchStuckJobs(1000);

	Integrations.register(queue, redis, config);
}

process.once('SIGTERM', () => {
	queue.shutdown(5000, (err) => {
		log.log('Kue shutdown: ', err || '');
		process.exit(0);
	});
});
