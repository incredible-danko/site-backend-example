module.exports = Common.Utils.Mapper([
	{ src: 'id', dest: 'paymentNumber' },
	// invoiceNumber empty
	{ src: 'name', dest: 'invoiceNumber' },
	{ src: 'payment_date', dest: 'dates.paid', type: 'date' },
	{ src: 'amount', dest: 'sums.total', type: 'float' },
	{ src: 'currency_id[1]', dest: 'sums.currency' },
]);
