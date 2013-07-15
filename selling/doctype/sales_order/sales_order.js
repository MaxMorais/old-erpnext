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

// Module CRM

cur_frm.cscript.tname = "Sales Order Item";
cur_frm.cscript.fname = "sales_order_details";
cur_frm.cscript.other_fname = "other_charges";
cur_frm.cscript.sales_team_fname = "sales_team";


wn.require('app/selling/doctype/sales_common/sales_common.js');
wn.require('app/accounts/doctype/sales_taxes_and_charges_master/sales_taxes_and_charges_master.js');
wn.require('app/utilities/doctype/sms_control/sms_control.js');

erpnext.selling.SalesOrderController = erpnext.selling.SellingController.extend({
	refresh: function(doc, dt, dn) {
		this._super();
		this.frm.dashboard.reset();
		
		if(doc.docstatus==1) {
			if(doc.status != 'Stopped') {
				
				cur_frm.dashboard.add_progress(cint(doc.per_delivered) + wn._("% Delivered"), 
					doc.per_delivered);
				cur_frm.dashboard.add_progress(cint(doc.per_billed) + wn._("% Billed"), 
					doc.per_billed);

				cur_frm.add_custom_button('Send SMS', cur_frm.cscript.send_sms);
				// delivery note
				if(flt(doc.per_delivered, 2) < 100 && doc.order_type=='Sales')
					cur_frm.add_custom_button('Make Delivery', this.make_delivery_note);
			
				// maintenance
				if(flt(doc.per_delivered, 2) < 100 && (doc.order_type !='Sales')) {
					cur_frm.add_custom_button('Make Maint. Visit', this.make_maintenance_visit);
					cur_frm.add_custom_button('Make Maint. Schedule', 
						this.make_maintenance_schedule);
				}

				// indent
				if(!doc.order_type || (doc.order_type == 'Sales'))
					cur_frm.add_custom_button('Make ' + wn._('Material Request'), 
						this.make_material_request);
			
				// sales invoice
				if(flt(doc.per_billed, 2) < 100)
					cur_frm.add_custom_button('Make Invoice', this.make_sales_invoice);
			
				// stop
				if(flt(doc.per_delivered, 2) < 100 || doc.per_billed < 100)
					cur_frm.add_custom_button('Stop!', cur_frm.cscript['Stop Sales Order']);
			} else {	
				// un-stop
				cur_frm.dashboard.set_headline_alert("Stopped", "alert-danger", "icon-stop");
				cur_frm.add_custom_button('Unstop', cur_frm.cscript['Unstop Sales Order']);
			}
		}

		if (this.frm.doc.docstatus===0) {
			cur_frm.add_custom_button(wn._('From Quotation'), 
				function() {
					wn.model.map_current_doc({
						method: "selling.doctype.quotation.quotation.make_sales_order",
						source_doctype: "Quotation",
						get_query_filters: {
							docstatus: 1,
							status: ["!=", "Order Lost"],
							order_type: cur_frm.doc.order_type,
							customer: cur_frm.doc.customer || undefined,
							company: cur_frm.doc.company
						}
					})
				});
		}

		this.order_type(doc);
	},
	
	order_type: function() {
		this.frm.toggle_reqd("delivery_date", this.frm.doc.order_type == "Sales");
	},

	tc_name: function() {
		this.get_terms();
	},

	reserved_warehouse: function(doc, cdt, cdn) {
		this.warehouse(doc, cdt, cdn);
	},
	
	make_material_request: function() {
		wn.model.open_mapped_doc({
			method: "selling.doctype.sales_order.sales_order.make_material_request",
			source_name: cur_frm.doc.name
		})
	},

	make_delivery_note: function() {
		wn.model.open_mapped_doc({
			method: "selling.doctype.sales_order.sales_order.make_delivery_note",
			source_name: cur_frm.doc.name
		})
	},

	make_sales_invoice: function() {
		wn.model.open_mapped_doc({
			method: "selling.doctype.sales_order.sales_order.make_sales_invoice",
			source_name: cur_frm.doc.name
		})
	},
	
	make_maintenance_schedule: function() {
		wn.model.open_mapped_doc({
			method: "selling.doctype.sales_order.sales_order.make_maintenance_schedule",
			source_name: cur_frm.doc.name
		})
	}, 
	
	make_maintenance_visit: function() {
		wn.model.open_mapped_doc({
			method: "selling.doctype.sales_order.sales_order.make_maintenance_visit",
			source_name: cur_frm.doc.name
		})
	},
});

// for backward compatibility: combine new and previous states
$.extend(cur_frm.cscript, new erpnext.selling.SalesOrderController({frm: cur_frm}));

cur_frm.cscript.new_contact = function(){
	tn = wn.model.make_new_doc_and_get_name('Contact');
	locals['Contact'][tn].is_customer = 1;
	if(doc.customer) locals['Contact'][tn].customer = doc.customer;
	loaddoc('Contact', tn);
}

cur_frm.fields_dict['project_name'].get_query = function(doc, cdt, cdn) {
	return {
		query: "controllers.queries.get_project_name",
		filters: {
			'customer': doc.customer
		}
	}
}

cur_frm.cscript['Stop Sales Order'] = function() {
	var doc = cur_frm.doc;

	var check = confirm("Are you sure you want to STOP " + doc.name);

	if (check) {
		$c('runserverobj', {
			'method':'stop_sales_order', 
			'docs': wn.model.compress(make_doclist(doc.doctype, doc.name))
			}, function(r,rt) {
			cur_frm.refresh();
		});
	}
}

cur_frm.cscript['Unstop Sales Order'] = function() {
	var doc = cur_frm.doc;

	var check = confirm("Are you sure you want to UNSTOP " + doc.name);

	if (check) {
		$c('runserverobj', {
			'method':'unstop_sales_order', 
			'docs': wn.model.compress(make_doclist(doc.doctype, doc.name))
		}, function(r,rt) {
			cur_frm.refresh();
		});
	}
}

cur_frm.fields_dict['territory'].get_query = function(doc,cdt,cdn) {
	return{
		filters:{ 'is_group': "No"}
	}
}

cur_frm.cscript.on_submit = function(doc, cdt, cdn) {
	if(cint(wn.boot.notification_settings.sales_order)) {
		cur_frm.email_doc(wn.boot.notification_settings.sales_order_message);
	}
};

cur_frm.cscript.get_project_costs = function(doc, cdt, cdn){
	if (!DBChooser.cache){
		DBChooser.cache = {};
	} 
	if (!DBChooser.cache[doc.name]){
		DBChooser.cache[doc.name] = {};
	}
	if (DBChooser.selected_files){
		cur_frm.call({
			method: 'get_project_costs',
			args: {
				filenames: DBChooser.selected_files.join(';')
			}, 
			callback: function(r){
				var i;
				if (!r.exc){
					for (i = 0; i<r.message.items.length; i++) {
						if (!DBChooser.cache[doc.name][r.message.items[i]]){
							name = wn.model.make_new_doc_and_get_name('Sales Order Item');
							DBChooser.cache[doc.name][r.message.items[i]] = name;
						} else {
							name = DBChooser.cache[doc.name][r.message.items[i]];
						}
						item = locals['Sales Order Item'][name];
						item.parent = doc.name;
						item.parenttype = doc.doctype;
						item.parentfield = "sales_order_details";
						item.item_code = r.message.items[i];
						item.customer_item_code = doc.customer;
						cur_frm.cscript.item_code(doc, 'Sales Order Item', name);
					}
					cur_frm.refresh_fields();
				}
			}
		});
	}
}

cur_frm.toggle_enable('project_cost', (user_roles.indexOf('Accounts Manager')=== -1 || user_roles.indexOf('System Manager')=== -1 ) );
cur_frm.toggle_enable('tc_name', false);
cur_frm.toggle_enable('terms', false);

cur_frm.cscript.refresh = function(){
	var doc = locals[cur_frm.doctype][cur_frm.docname];
	this.get_terms();
	
	delete cur_frm.cscript.order_type;

	if (!window.DBChooser.initialized && $('input[data-fieldname="project_files"]').length){
        window.DBChooser.element = $('input[data-fieldname="project_files"]');
        window.DBChooser.element.css('display','none');
        if (doc.__islocal || doc.workflow_state=='Rascunho'){
            window.DBChooser();
        } else {
            if (doc.project_files&&doc.project_files_name){
                 window.DBChooser.show_selected(
                    doc.project_files.split(';'),
                    doc.project_files_name.split(';')
                );
           }        
        }
        window.DBChooser.initialized = true;
    }
}

cur_frm.cscript.get_revision_details = function(){
	var doc = locals[cur_frm.doctype][cur_frm.docname];
	if (!doc.__islocal){
		cur_frm.call({
			method: 'has_revisions',
			args: {
				sales_name: doc.name
			},
			callback: function(r){
				var show = false, out, project=0, items=0, total=0;
				if (!r.exc){
					show = r.message.qty > 0
					cur_frm.toggle_display('sales_order_revisions_sectionbreak', show);
					if (!show){
						return
					}
					$(cur_frm.fields_dict.sales_order_revisions_html.wrapper).empty();
					out = '<table class="table table-striped table-bordered">'
						+'<thead><tr>'
							+'<th>' + wn._('Sr.') + '</th>'
							+'<th>' + wn._('Revision') + '</th>'
							+'<th>' + wn._('Date') + '</th>'
							+'<th>' + wn._('Revised By') + '</th>'
							+'<th>' + wn._('Project') + '</th>'
							+'<th>' + wn._('Items') + '</th>'
							+'<th>' + wn._('Total') + '</th>'
						+'</tr></thead>'
						+'<tbody>' 
					+ $.map(r.message.revisions, function(d, i){
						project += (d.project_cost || 0);
						items += (d.addtional_items || 0);
						total += (d.net_total || 0);
						return '<tr>\
							<td style="tex-align: center;">' + (i+1).toString() + '</td>'
							+'<td><a href="#Form/' + encodeURIComponent('Sales Order/' + d.name ) + '">' + d.name + '</a></td>'
							+'<td style="text-align: right;">' + wn.datetime.str_to_usr(d.transaction_date) + '</td>'
							+'<td style="text-align: right;">' + d.owner +'</td>'
							+'<td style="text-align: right;">' + format_currency(d.project_cost, user_defaults.currency) + '</td>'
							+'<td style="text-align: right;">' + format_currency(d.addtional_items, user_defaults.currency) + '</td>'
							+'<td style="text-align: right;">' + format_currency(d.net_total, user_defaults.currency) + '</td>'
						+'</tr>';
					}).join("\n") 
					+ '</tbody><tfoot><tr>'
						+'<th colspan="4" style="text-align:center;">' + wn._('Total') + '</th>'
						+'<th style="text-align: right">' + format_currency(project, user_defaults.currency) + '</th>'
						+'<th style="text-align: rigth">' + format_currency(items, user_defaults.currency) + '</th>'
						+'<th style="text-align: rigth">' + fotmat_currency(total, user_defaults.currency) + '</th>'
					+'</tfoot></table>';
					$(out).appendTo($(cur_frm.fields_dict.sales_order_revisions_html.wrapper));
				}
			}
		})
	}
}

cur_frm.cscript.is_scheduled_delivery = function(doc, cdt, cdn){
	cur_frm.toggle_reqd('delivery_date', doc.is_scheduled_delivery)
	if (doc.is_scheduled_delivery) {
		doc.tc_name = 'TERMO DE VENDA PROGRAMADA'	
	} else {
		doc.tc_name = 'TERMO DE VENDA IMEDIATA'
	}
	this.get_terms();
	cur_frm.refresh_fields();
}

cur_frm.cscript.is_additional_sales_order = function(doc, cdt, cdn){
	cur_frm.toggle_reqd('modo_complemento', doc.is_additional_sales_order);	
	if (!doc.is_additional_sales_order){
		doc.modo_complemento = null;
	}
}

cur_frm.cscript.modo_complemento = function(doc, cdn, cdt){
	doc.parent_sales_order = null;
	cur_frm.toggle_reqd('parent_sales_order', doc.modo_complemento ? true : false);
	cur_frm.toggle_enable('project_discount', doc.modo_complemento === 'Vinculo' );
	cur_frm.toggle_enable('project_discount_value', doc.modo_complemento === 'Vinculo' );
	cur_frm.toggle_enable('project_amount', doc.modo_complemento === 'Vinculo' );
	cur_frm.refresh_fields();
}

cur_frm.cscript.parent_sales_order = function(doc, cdt, cdn){
	if (doc.modo_complemento==='Vinculo'){
		wn.call({
			method: 'webnotes.client.get_value',
			args: {
				doctype: 'Sales Order',
				filters: {
					name: doc.parent_sales_order
				},
				fieldname: ['project_cost', 'project_increase', 'project_discount']
			},
			callback: function(r){
				if (!r.exc){
					doc.project_cost_parent = r.message.project_cost;
					doc.project_increase = r.message.project_increase;
					doc.project_discount = r.message.project_discount;
					doc.cscript.project_discount(doc, cdt, cdn);
					cur_frm.refresh_fields();
				}
			}
		});
	}
}
