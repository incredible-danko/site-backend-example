module.exports = (item) => {
	// case for VoucherType 2 - manual journal entry (?)
	let resultAmount = 0
	if (item.VoucherType === 2) {
		let sum = 0;
		// get Rows
		const rows = item.Rows;
		if (rows.length !== 0){
			rows.forEach((row, i, rows) => {
				// 2710 - tax
				if (row.AccountNumber !== 2710) {
					sum += row.DebitAmount;
					sum -= row.CreditAmount;
					resultAmount += sum;
				} else {
					resultAmount -= row.DebitAmount;
				}
			});
		}

		// final object
		const expense = {
			meta: {
				reference: item.Id,
				description: item.VoucherText,
			},
			type: 'expenses.tax',
			dates: {
				created: new Date(item.VoucherDate),
				// due: new Date(keys[i]),
				// paid: new Date(keys[i]),
			},
			sums: {
				tax: 0,
				total: resultAmount,
				currency: 'SEK',
			},
		};
		return expense;
	} else {
		return false;
	}
}
