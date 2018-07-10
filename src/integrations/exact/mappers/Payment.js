module.exports = Common.Utils.Mapper([
	{ src: 'EntryID', dest: 'paymentNumber' },
	{ src: 'InvoiceNumber', dest: 'invoiceNumber' },
	{ src: 'EntryDate', dest: 'dates.paid', type: 'date' },
	{ src: 'AmountFC', dest: 'sums.total', type: 'float' },
	{ src: 'Currency', dest: 'sums.currency' },
// 	{ src: 'Source', dest: 'meta.source' },
]);
