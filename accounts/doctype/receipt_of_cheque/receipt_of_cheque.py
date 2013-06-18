# For license information, please see license.txt

from __future__ import unicode_literals
import webnotes, json

class DocType:
	def __init__(self, d, dl):
		self.doc = d
		self.doclist = dl or []


@webnotes.whitelist()
def generate_cheques(payment, qty):
	pmt = webnotes.conn.sql("""
		SELECT 
		    `tabSales Order Payment`.`mode_of_payment`,
			`tabSales Order Payment`.`first_payment_date`,
			`tabSales Order Payment`.`number_of_payments`,
			`tabSales Order Payment`.`payment_value`
		FROM `tabSales Order Payment`
		WHERE `tabSales Order Payment`.`name` = %s
	""", payment, as_dict=True)[0]
	qty = int(qty)
	pendding = int(get_pendding_qty(payment)['cheques_pendding_to_receive'])
	if qty <= pendding:
		dl = []
		for i in range(1, int(qty+1)):
			dl.append({
				'doctype':'Cheque',
				'parcel': (pmt['number_of_payments'] - pendding) + i,
				'cheque_amount': pmt['payment_value'],
				'cheque_debit_date': webnotes.utils.add_months(
					pmt['first_payment_date'], 
					((pmt['number_of_payments'] - pendding) + i)
				)
			})
		return dl
	else:
		webnotes.msgprint("The qty informed is less gran than the qty pendding to receive!")
		raise Exception

@webnotes.whitelist()
def get_pendding_qty(payment):
	pendding =  webnotes.conn.sql("""
		SELECT
			`tabSales Order Payment`.`number_of_payments` - count(`tabCheque`.`name`) as `pendding`
		FROM `tabSales Order Payment`
		INNER JOIN `tabCheque` ON `tabCheque`.`sales_order_payment`=`tabSales Order Payment`.`name`
		WHERE `tabSales Order Payment`.`name`= %s
	""", payment, as_dict=True)[0]
	return {'cheques_pendding_to_receive': pendding['pendding']}

@webnotes.whitelist()
def has_cheques_pendding(sales_order):
	pass
	