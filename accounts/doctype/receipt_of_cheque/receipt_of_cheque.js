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
cur_frm.add_fetch('sales_order', 'customer', 'customer');
cur_frm.add_fetch('customer', 'customer_name', 'customer_name');
cur_frm.add_fetch('sales_order_payment', 'first_payment_date', 'cheque_first_date');
cur_frm.add_fetch('sales_order_payment', 'last_payment_date', 'cheque_last_date');
cur_frm.add_fetch('sales_order_payment', 'payment_value', 'cheque_amount');

//cur_frm.dict_fields.customer.get_query = erpnext.utils.customer_query;

cur_frm.cscript.sales_order = function(doc, cdt, cdn){
	if (doc.sales_order){
		cur_frm.call({
			method: 'has_pendding',
			args :{
				so_name: doc.sales_order
			},
			callback: function(r){
				if (!r.exc){
					if (!r.message.qty){
						var msg = wn._("The Sales Order ") + doc.sales_order + wn._(" has no checks to be received!");
						//doc.sales_order = null;
						//doc.customer = null;
						//doc.customer_name = null;
						//cur_frm.refresh_fields()
						validated = false;
						msgprint(msg);
						throw msg;
					}
				}
			}
		});
	}
}

cur_frm.cscript.sales_order_payment = function (doc, cdt,cdn){
	var d = locals[cdt][cdn];
	if(doc.sales_order && d.sales_order_payment){
		cur_frm.call({
			method: 'has_pendding',
			args: {
				so_name: doc.sales_order,
				sop_name: d.sales_order_payment
			},
			callback: function(r){
				
				if(!r.exc){
					if(!r.message.qty){
						var msg = wn._("The Sales Order ") + doc.sales_order+"/"+d.sales_order_payment + wn._(" has no checks to be received!");
						validated = false;
						msgprint(msg);
						d.pendding_qty = 10;//r.message.qty;
						d.cheque_qty = r.message.qty;
						cur_frm.refresh_fields();
						throw msg;
						
					}
					else{
						d.pendding_qty = r.message.qty;
						d.cheque_qty = r.message.qty;
						cur_frm.refresh_fields();
					}
				}
			}
		});
	}
}
cur_frm.cscript.cheque_qty = function (doc, cdt, cdn){
	var d = locals[cdt][cdn], rel_qty = 0, rel_amount = 0, rel;
	if(doc.sales_order && d.sales_order_payment){
		if(d.pendding_qty < d.cheque_qty){
			var msg2 = wn._("The quantity of pending cheques is smaller than cheques quantity ");
			msgprint(msg2)
			validated = false;
		}
		for (var obj in locals[cdt]){
			rel = locals[cdt][obj];
			rel_qty += rel.cheque_qty;
			rel_amount += (rel.cheque_amount*rel.cheque_qty);
		}
		doc.related_cheque_qty = rel_qty;
		doc.related_cheque_amount = rel_amount;
		cur_frm.refresh_fields();
	}
}

cur_frm.cscript.generate_cheques = function(doc, cdt, cdn){
	var d = locals[cdt][cdn];
	var ch = locals["Cheque"];
	for (var i=d.pendding_qty; i>0; i--){
		c = wn.model.make_new_doc_and_get_name('Cheque');
		c.parcel = i;
		c.sales_order = doc.sales_order;
		c.sales_order_payment = d.sales_order_payment;
		c.customer = doc.customer;
		c.customer_name = doc.customer_name;
		c.cheque_amount = d.cheque_amount;
		c.receipt_of_cheque = d.name;
		//c.cheque_debit_date = wn.date.add_month(d.cheque_first_date, i-(i-1));
		cur_frm.refresh_fields();
		validated = true;
	}
}
