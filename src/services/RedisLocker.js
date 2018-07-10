const { promisify } = require('util');

const sleep = time => new Promise(resolve => setTimeout(resolve, time));
const defaultDelay = 50;
const defaultRetryTimeout = 100;

class RedisLocker {
	constructor(client, config) {
		this.client = client;
		this.config = config;
	}

	async lock(name, delay = defaultDelay) {
		if (!name) {
			throw new Error('You must specify a lock string. It is on the redis key `lock.[string]` that the lock is acquired.');
		}

		async function acquireLock(client, lockName, retryDelay) {
			try {
				return await promisify(client.set).bind(client)(`lock.${lockName}`, true, 'NX');
			} catch (err) {
				// Only attempt to get the lock once
				if (retryDelay === 0) {
					return false;
				}

				await sleep(retryDelay);
				return acquireLock(client, lockName, retryDelay);
			}
		}

		return acquireLock(this.client, name, delay);
	}

	async waitForUnlock(name) {
		let isTokenLocked = await this.isLocked(name);
		// ToDo - limit number of attempts?
		while (isTokenLocked) {
			await sleep(defaultRetryTimeout);
			isTokenLocked = await this.isLocked(name);
		}
		return isTokenLocked;
	}

	async unlock(name) {
		return promisify(this.client.del).bind(this.client)(`lock.${this.config.integration}.${name}`);
	}

	async isLocked(name) {
		const result = await promisify(this.client.get).bind(this.client)(`lock.${name}`);
		return Boolean(result);
	}
}

module.exports = RedisLocker;
