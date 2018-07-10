const Mappers = require('../mappers');

const {
	AddExpense,
} = require('../../../queries');

const log = Common.Utils.logging;

class ExpensesController {
	constructor(queue, config, exact, client) {
		this.queue = queue;
		this.exact = exact;
		this.client = client;
		this.config = config;
	}

	register(config) {
		// this.queue.process(`${config.namespace}.exact.salaries.fetch`, 1, (job, done) => this.fetchSalaries(job, done));
		this.queue.process(`${config.namespace}.exact.GLAccount.fetch`, 1, (job, done) => this.fetchGLAccount(job, done));
	}

	async insertExpense(item, token) {
		const expenses = Mappers.Expense(item, null);

		const response = await this.client.execute(
			AddExpense,
			{
				input: expense,
			},
			token
		);

		if (response.errors && response.errors.length > 0) {
			log.error('Insert Expense Error')
			throw new Error(JSON.stringify(response.errors));
		}

		log.info(`Imported Expense ${response.data.updateExpense.meta.reference} and assigned it UUID : ${response.data.updateExpense._id}`);
	}

	async fetchSalaries(job, done) {
		log.log('Fetching Salaries');

		const {
			token = false,
			integration = false,
		} = job.data;

		try {
			if (!integration.server) {
				throw new Error('Missing AccessToken');
			}

			const fetchData = await this.exact.fetchList({
				entityUrl: '/v1/2164341/payroll/EmploymentSalaries?$select=ID,AverageDaysPerWeek,AverageHoursPerWeek,Created,Creator,CreatorFullName,Division,Employee,EmployeeFullName,EmployeeHID,Employment,EmploymentHID,EmploymentSalaryType,EmploymentSalaryTypeDescription,EndDate,FulltimeAmount,HourlyWage,InternalRate,JobLevel,Modified,Modifier,ModifierFullName,ParttimeAmount,ParttimeFactor,Scale,Schedule,ScheduleCode,ScheduleDescription,StartDate',
				accessToken: integration.server.accessToken,
				// latest: integration.lastSynchronized,
			})

			for (const item of fetchData.results) {
				try {
					await this.insertExpense(item, token);
				} catch (e) {
					log.warn('ExactService::ExpensesController::insertExpense failed');
				}
			}

			done();
		} catch (e) {
			log.error(e);
			done(e);
		}
	}

	async fetchGLAccount(job, done) {
		log.log('Fetching GLAccount');

		const {
			token = false,
			integration = false,
		} = job.data;

		try {
			if (!integration.server) {
				throw new Error('Missing AccessToken');
			}

			const fetchData = await this.exact.fetchList({
				entityUrl: '/v1/2164341/financial/GLAccounts?$select=ID,AssimilatedVATBox,BalanceSide,BalanceType,BelcotaxType,Code,Compress,Costcenter,CostcenterDescription,Costunit,CostunitDescription,Created,Creator,CreatorFullName,Description,Division,ExcludeVATListing,ExpenseNonDeductiblePercentage,IsBlocked,Matching,Modified,Modifier,ModifierFullName,PrivateGLAccount,PrivatePercentage,ReportingCode,RevalueCurrency,SearchCode,Type,TypeDescription,UseCostcenter,UseCostunit,VATCode,VATDescription,VATGLAccountType,VATNonDeductibleGLAccount,VATNonDeductiblePercentage,VATSystem,YearEndCostGLAccount,YearEndReflectionGLAccount',
				accessToken: integration.server.accessToken,
				// latest: integration.lastSynchronized,
			});
			// console.log(fetchData.length)
			console.log('GLAccounts', fetchData);
			return false;

		// 	for (const item of fetchData.results) {
		// 		try {
		// 			await this.insertExpense(item, token);
		// 		} catch (e) {
		// 			log.warn('ExactService::ExpensesController::insertExpense failed');
		// 		}
		// 	}

			done();
		} catch (e) {
			log.error(e);
			done(e);
		}
	}
}

module.exports = ExpensesController;
