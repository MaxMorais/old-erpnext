// ERPNext - web based ERP (http://erpnext.com)
// Copyright (C) 2012 Web Notes Technologies Pvt Ltd
// 
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.



cur_frm.add_fetch('sales_order', 'customer_name', 'customer_name');
cur_frm.add_fetch('customer', 'customer', 'customer');

cur_frm.fields_dict.sales_order.get_query = function(doc){
	var cond = '';
	if (doc.customer) {
		cond += ' ifnull(`tabSales Order`.`customer`, "") = "' + doc.customer + '" and';
	}
	return repl(
		'SELECT `tabSales Order`.`name` FROM `tabSales Order` \
		WHERE `tabSales Order`.`docstatus` = 1 \
		AND %(cond)s `tabSales Order`.`%(key)s` LIKE "%s" \
		ORDER BY `tabSales Order`.`name` DESC LIMIT 50', {cond:cond});
}

cur_frm.fields_dict.customer.get_query = function(doc){
	var cond = '';
	if (doc.sales_order) {
		cond += ' ifnull(`tabCustomer`.`name`, "") = "' + doc.customer_name + '" and';
	}
	return repl(
		'SELECT `tabCustomer`.`name` FROM `tabCustomer` \
		WHERE `tabCustomer`.`docstatus` = 1 \
		AND %(cond)s `tabCustomer`.`%(key)s` LIKE "%s" \
		ORDER BY `tabCustomer`.`name` DESC LIMIT 50', {cond:cond});
}
