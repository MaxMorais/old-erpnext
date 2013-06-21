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
cur_frm.add_fetch('sales_order', 'customer_name', 'customer');	
cur_frm.add_fetch('customer', 'customer_name', 'customer_name');

cur_frm.add_fetch('sales_order_payment', 'first_payment_date', 'cheque_first_date');
cur_frm.add_fetch('sales_order_payment', 'last_payment_date', 'cheque_last_date');
cur_frm.add_fetch('sales_order_payment', 'number_of_payments', 'cheque_qty');
cur_frm.add_fetch('sales_order_payment', 'payment_value', 'cheque_amount');

cur_frm.add_fetch('bank_code', 'bank_name', 'bank_name');

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

cur_frm.cscript.generate_cheques = function(doc, cdt, cdn){
	var qty = prompt(wn._("Enter the number of cheques to be generated", doc.cheques_pendding_to_receive)),
	d = locals[cdt][cdn];
	if (!parseInt(qty)){	
		msgprint(wn._("You must enter a number"), "Ops...")
	} else if (parseInt(qty)>parseInt(doc.cheques_pendding_to_receive) || parseInt(qty) === 0){
		msgprint(wn._("You must enter a number from 1 to ")+doc,cheques_pendding_to_receive, "Ops...")
	} else {
		qty = parseInt(qty);
	}
	var callback = function(r, rt){
		var i, dt="Cheque";
		if (!r.exec){
			console.log(r.message);
			cheques = r.message;
			console.log(doc);
			for (i=0; i<cheques.length;i++){
				cn = wn.model.make_new_doc_and_get_name(dt);
				doccheque = locals[dt][cn];
				cheque = cheques[i];
				doccheque.sales_order = doc.sales_order;
				doccheque.sales_order_payment = d.name;
				doccheque.customer = doc.customer;
				doccheque.customer_name = doc.customer_name;
				doccheque.parcel = cheque.parcel;
				doccheque.cheque_amount = cheque.cheque_amount;
				doccheque.cheque_debit_date = cheque.cheque_debit_date;
				doccheque.parent = cur_frm.docname;
				doccheque.parenttype = cur_frm.doctype;
				doccheque.parentfield = 'cheques'
			} 
			cur_frm.refresh();
		}
	}
	cur_frm.call({
		method: "generate_cheques",
		args: {
			payment: d.sales_order_payment,
			qty: qty
		},
		callback: callback
	});
}

cur_frm.cscript.sales_order_payment = function(doc, cdt, cdn){
	var d = locals[cdt][cdn];
	if (d.sales_order_payment){
		cur_frm.call({
			child: d,
			method: "get_pendding_qty",
			args: {
				payment: d.sales_order_payment
			},
			callback: function(r){
				d.cheques_pendding_to_receive = r.message.cheques_pendding_to_receive;
				refresh_field('cheques_penddind_to_receive',d.name, 'related_payments');
				console.log(d.name);
			}
		});
	}
}