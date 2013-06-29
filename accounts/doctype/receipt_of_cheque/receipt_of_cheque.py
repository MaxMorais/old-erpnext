# For license information, please see license.txt

from __future__ import unicode_literals
import webnotes

sql = webnotes.conn.sql

class DocType:
	def __init__(self, d, dl):
		self.doc, self.doclist = d, dl

@webnotes.whitelist()
def has_pendding(so_name, sop_name = None):
	condition = ""

	if sop_name:
		condition += '`tabSales Order Payment`.`name` = "' + sop_name + '" AND '

	return sql('''
	SELECT
		ifnull(`tabSales Order Payment`.`number_of_payments`-count(`tabCheque`.`naming_series`),0) as `qty`
	FROM `tabSales Order`
	INNER JOIN `tabSales Order Payment` on `tabSales Order Payment`.`parent` = `tabSales Order`.`name`
	INNER JOIN `tabCheque` on `tabCheque`.`sales_order_payment` = `tabSales Order Payment`.`name`
	WHERE 
		`tabSales Order Payment`.`parenttype`='Sales Order' AND 
		`tabSales Order Payment`.`mode_of_payment`='Cheque' AND
		%(condition)s
		`tabSales Order`.`name`="%(so_name)s"; 
	'''%{'so_name': so_name, 'condition':condition}, as_dict=True)[0]

	
