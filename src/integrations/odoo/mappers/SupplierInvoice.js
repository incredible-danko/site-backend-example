module.exports = Common.Utils.Mapper([
// 	{ src: 'invoiceType', dest: 'type', default: 'invoice', required: true },
	{ src: 'number', dest: 'meta.invoiceNumber', required: true },
	{ src: 'number', dest: 'meta.serialNumber' },
// 	{ src: 'OcrNumber', dest: 'meta.message' },
	{ src: 'date', dest: 'dates.invoiceSent', type: 'date' },
	{ src: 'date_due', dest: 'dates.invoiceDue', type: 'date' },
	{ src: 'amount_tax', dest: 'sums.tax', type: 'float' },
	{ src: 'amount_total', dest: 'sums.invoiceTotal', type: 'float', required: true },
	{ src: 'currency_id[1]', dest: 'sums.currency', default: 'SEK' },
	{ src: 'partner_id[0]', dest: 'meta.supplierNumber' },
]);
