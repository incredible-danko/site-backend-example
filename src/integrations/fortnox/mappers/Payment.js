module.exports = Common.Utils.Mapper([
	{ src: 'Number', dest: 'paymentNumber' },
	{ src: 'InvoiceNumber', dest: 'invoiceNumber' },
	{ src: 'PaymentDate', dest: 'dates.paid', type: 'date' },
	{ src: 'AmountCurrency', dest: 'sums.total', type: 'float' },
	{ src: 'Currency', dest: 'sums.currency' },
	{ src: 'Source', dest: 'meta.source' },
]);
