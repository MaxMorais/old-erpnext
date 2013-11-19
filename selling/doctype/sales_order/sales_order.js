// Copyright (c) 2013, Web Notes Technologies Pvt. Ltd.
// License: GNU General Public License v3. See license.txt

// Module CRM

cur_frm.cscript.tname = "Sales Order Item";
cur_frm.cscript.fname = "sales_order_details";
cur_frm.cscript.other_fname = "other_charges";
cur_frm.cscript.sales_team_fname = "sales_team";


wn.require('app/selling/sales_common.js');
wn.require('app/accounts/doctype/sales_taxes_and_charges_master/sales_taxes_and_charges_master.js');
wn.require('app/utilities/doctype/sms_control/sms_control.js');
wn.require('app/accounts/doctype/sales_invoice/pos.js');

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

				cur_frm.add_custom_button(wn._('Send SMS'), cur_frm.cscript.send_sms, "icon-mobile-phone");
				// delivery note
				if(flt(doc.per_delivered, 2) < 100 && doc.order_type=='Sales')
					cur_frm.add_custom_button(wn._('Make Delivery'), this.make_delivery_note);
			
				// maintenance
				if(flt(doc.per_delivered, 2) < 100 && (doc.order_type !='Sales')) {
					cur_frm.add_custom_button(wn._('Make Maint. Visit'), this.make_maintenance_visit);
					cur_frm.add_custom_button(wn._('Make Maint. Schedule'), 
						this.make_maintenance_schedule);
				}

				// indent
				if(!doc.order_type || (doc.order_type == 'Sales'))
					cur_frm.add_custom_button(wn._('Make ') + wn._('Material Request'), 
						this.make_material_request);
			
				// sales invoice
				if(flt(doc.per_billed, 2) < 100)
					cur_frm.add_custom_button(wn._('Make Invoice'), this.make_sales_invoice);
			
				// stop
				if(flt(doc.per_delivered, 2) < 100 || doc.per_billed < 100)
					cur_frm.add_custom_button(wn._('Stop!'), cur_frm.cscript['Stop Sales Order'],"icon-exclamation");
			} else {	
				// un-stop
				cur_frm.dashboard.set_headline_alert(wn._("Stopped"), "alert-danger", "icon-stop");
				cur_frm.add_custom_button(wn._('Unstop'), cur_frm.cscript['Unstop Sales Order'], "icon-check");
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
							status: ["!=", "Lost"],
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
		var item = wn.model.get_doc(cdt, cdn);
		if(item.item_code && item.reserved_warehouse) {
			return this.frm.call({
				method: "selling.utils.get_available_qty",
				child: item,
				args: {
					item_code: item.item_code,
					warehouse: item.reserved_warehouse,
				},
			});
		}
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
	
	make_journal_voucher: function(){
		wn.model.open_mapped_doc({
			method: "selling.doctype.sales_order.sales_order.make_journal_voucher",
			source: cur_frm.name
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

	var check = confirm(wn._("Are you sure you want to STOP ") + doc.name);

	if (check) {
		return $c('runserverobj', {
			'method':'stop_sales_order', 
			'docs': wn.model.compress(make_doclist(doc.doctype, doc.name))
			}, function(r,rt) {
			cur_frm.refresh();
		});
	}
}

cur_frm.cscript['Unstop Sales Order'] = function() {
	var doc = cur_frm.doc;

	var check = confirm(wn._("Are you sure you want to UNSTOP ") + doc.name);

	if (check) {
		return $c('runserverobj', {
			'method':'unstop_sales_order', 
			'docs': wn.model.compress(make_doclist(doc.doctype, doc.name))
		}, function(r,rt) {
			cur_frm.refresh();
		});
	}
}

cur_frm.cscript.on_submit = function(doc, cdt, cdn) {
	if(cint(wn.boot.notification_settings.sales_order)) {
		cur_frm.email_doc(wn.boot.notification_settings.sales_order_message);
	}
};

window['DBCHOOSER'] = Class.extend({
	init: function(){
		this.db_choose_key = 'e6sxh3ayfd4bj49';
		this.db_choose_url = 'https://www.dropbox.com/static/api/1/dropins.js';
		this.cache = {};
		this.script = document.createElement('script');
		this.script.type = 'text/javascript';
		this.script.id='dropboxjs';
		this.script.setAttribute('data-app-key', this.db_choose_key);
		this.script.src = this.db_choose_url;
		document.head.appendChild(this.script);
		console.log("Dropbox Started");
	},
	create_chooser: function(form, elem){
		if (!this.cache.hasOwnProperty(form.docname)) {this.create_cache_entry(form.docname)};
		var id = 'db-chooser-' + form.docname,
			html = '<input type="dropbox-chooser" name="db-selected-files"'
			+'style="visibility: hidden;" data-multiselect="true"'
			+'data-link-type="direct" data-extensions=".promob" id="' + id + '"><div id="files-' + form.docname + '"></div>',
			docname=form.docname, db_element = $(html), cache = this.cache[docname];
		cache.$db_element = db_element;
		cache.element = elem;
		db_element.insertAfter($(elem));
		document.getElementById(id).addEventListener('DbxChooserSuccess', this.on_dropbox_success(docname), false);
		form.toggle_display('project_files',false);
	},
	create_cache_entry: function(key){
		this.cache[key] = {
			element: undefined,
			$db_element: undefined,
			selected_names: [],
			selected_files: [],
			items: {}
		}
		return this.cache[key];
	},
	on_dropbox_success: function(key){
		var cache = this.cache[key], self=this;
		return function(event){
			var files = event.files, i=0, l, fname, flink, fnames=[];
			// Insere um novo arquivo na listagem caso nao exista
			for (i=0, l = files.length; i< l; i++){
				fname = files[i].name;
				flink = files[i].link;
				fnames.push(files[i].name)
				if (cache.selected_names.indexOf(fname)==-1){
					cache.selected_names.push(fname);	
					cache.selected_files.push(flink);
				}
			}
			// Remove um arquivo da lista caso seja atualizada a selecao
			for (i=0, l = cache.selected_names.length; i < l; i++ ){
				fname = cache.selected_names[i];
				if((fnames.indexOf(fname)==-1)){
					cache.selected_names = cache.selected_names.slice(0, i).concat(cache.selected_names.slice(i+1, cache.selected_names.length));
					cache.selected_files = cache.selected_files.slice(0, i).concat(cache.selected_files.slice(i+1, cache.selected_files.length));
				}
			}
			self.cache[key] = cache;
			if (cache.selected_names.length){
				self.show_selected(key);
			}
		}
	},
	show_selected: function(key){
		var i=0, cache = this.cache[key], fnames = cache.selected_names, flinks = cache.selected_files, html="<ul style='list-style:none'>";
		for (; i < fnames.length; i++){
			html += "\t<li><a href='" + flinks[i] + "'><i class='icon-file'></i> " + fnames[i] + "</a></li>\n";
		}
		html += "</ul>";
		$('div[id="files-'+key+'"]').html(html);
	}
});
if (!window.DBChooser){
	window['DBChooser'] = new DBCHOOSER();
}
cur_frm.cscript.get_project_costs = function(doc, cdt, cdn){
	if (!doc.customer) {
		var msg = 'Voce deve selecionar primeiro o cliente!';
		msgprint(msg);
		throw msg;
	}
	if (DBChooser.cache[doc.name].selected_files){
		cur_frm.call({
			method: 'get_project_costs',
			args: {
				filenames: DBChooser.cache[doc.name].selected_files.join(';'),
				customer_code: doc.customer
			}, 
			callback: function(r){
				var i;
				if (!r.exc){
					console.log(r.message);
					for (i = 0; i<r.message.items.length; i++) {
						if (!DBChooser.cache[doc.name]['items'][r.message.items[i]]){
							name = wn.model.make_new_doc_and_get_name('Sales Order Item');
							DBChooser.cache[doc.name]['items'][r.message.items[i]] = name;
						} else {
							name = DBChooser.cache[doc.name]['items'][r.message.items[i]];
						}
						item = locals['Sales Order Item'][name];
						item.idx = i+1;
						item.parent = doc.name;
						item.parenttype = doc.doctype;
						item.parentfield = "sales_order_details";
						item.item_code = r.message.items[i];
						item.customer_item_code = doc.customer;
						item.item_classification='Wood';
						cur_frm.cscript.item_code(doc, 'Sales Order Item', name);
					}
					cur_frm.refresh_fields();
				}
			}
		});
	} else {
		msgprint('Voce deve selecionar primeiro os arquivos de projeto!', 'Ops...')
	}
}

cur_frm.cscript.refresh = function(doc, cdt, cdn){
	//var doc = locals[cur_frm.doctype][cur_frm.docname],
	var display = ((user_roles.indexOf('Accounts User')>=0)||
				   (user_roles.indexOf('Accounts Manager')>=0)||
				   (user_roles.indexOf('Administrator')>=0||
				   (user_roles.indexOf('System Manager')>=0))
				  );
	this.get_terms();
	
	delete cur_frm.cscript.order_type;
	
	var key, fields = {
		'project_cost': 1,
		'letter_head': 1,
		'transaction_date': 1,
		'select_print_heading': 1,
		'project_cost_net': 1,
		'project_increase': 1,
		'project_estimate': 1,
		'project_amount_net': 1,
		'payment_amount_net': 1,
		'commission_rate': 1,
		'total_comission': 1,
		'sales_team': 1,
		'fiscal_year': 1,
		'tc_name': 1,
		'terms': 1,
	};

	if (doc.__islocal || doc.workflow_state==='Rascunho'){
		DBChooser.create_chooser(cur_frm, cur_frm.fields_dict['project_files'].wrapper);
	}
	for(var key in fields){
		if ((key === 'project_cost')
			||(key === 'letter_head')
			||(key === 'transaction_date')
			||(key === 'select_print_heading')
			||(key === 'tc_name')
			||(key === 'terms')){
			cur_frm.toggle_enable(key, display);
		} else {
			cur_frm.toggle_display(key, display);
		}
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

cur_frm.cscript.delivery_date = function(doc, cdt, cdn){
	if ((doc.delivery_date) && 
		(doc.delivery_date<
		 wn.datetime.add_months(wn.datetime.str_to_obj(doc.transaction_date), 3)
		)
	) {
		msgprint('A data da entrega deve ser superior a 90 dias a contar da data do pedido!', title="Ops...");
		doc.delivery_date = null;
		cur_frm.refresh_field('delivery_date');
	}
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

// Adiciona uma validacao customizada a 'Sales Order'
cur_frm.cscript.custom_validate = function(doc, cdt, cdn){
	var payment_total = 0, msg='';

	if (doc.__islocal){
		doc.project_files = DBChooser.cache[doc.name] ? DBChooser.cache[doc.name].selected_files.join(';') : '';
		doc.project_files_name = DBChooser.cache[doc.name] ? DBChooser.cache[doc.name].selected_names.join(';') : '';
		refresh_field('project_files');

	}

	if (doc.status=='Draft'){

		if (!locals.hasOwnProperty('Sales Order Payment')){
			validated = false;
			msg = msg + "Informe a forma de pagamento do pedido!<br>";
		} else {
			doc.payment_amount_net = 0;
			$.map(locals['Sales Order Payment'], function(d){ 
				if (d.parent===doc.name){
					doc.payment_amount_net += d.net_payment_amount; 
					payment_total += d.gross_payment_amount;
				}
			});
			if (payment_total.toFixed(2)!==doc.grand_total_export.toFixed(2)){
				validated = false;
				msg = msg + "A soma de pagamentos difere do total do pedido!<br>"
					+ "Dica: <br>\t<b>Soma de Pagamentos: </b>"+format_currency(payment_total, user_defaults.currency)
					+ "<b>Total do Pedido: </b>" + format_currency(doc.net_total_export, user_defaults.currency);
			}
		}
		
		if (doc.is_scheduled_delivery) {
			doc.tc_name = 'TERMO DE VENDA PROGRAMADA'	
		} else {
			doc.tc_name = 'TERMO DE VENDA IMEDIATA'
		}
		this.get_terms();
		cur_frm.refresh_fields();
		


		// A data de uma nova ordem de vendas nao pode ser diferente da data atual.
		if (wn.datetime.get_day_diff(new Date(), wn.datetime.str_to_obj(doc.transaction_date)) > 0) {
			validated = false;
			msg = msg + 'A data da Ordem de Venda nao pode uma data passada<br>'
		}
		// A data prevista de entrega prevista deve ser preenchida caso 'naming_series' seja 'VP'
		if ((doc.is_scheduled_delivery) && (!doc.delivery_date)){
			validated = false;
			msg = msg + 'A Data Prevista de Entrega deve ser informada, no caso de vendas programadas!<br>';
		}
		// A data prevista de entrega deve ser superior a 90 dias a contar da data atual
		if (doc.is_scheduled_delivery && wn.datetime.get_day(wn.datetime.str_to_obj(doc.delivery_date)<wn.datetime.add_months(doc.transaction_date, 3))){
			validated = false;
			msg = msg + 'A Data Prevista de Entrega deve ser superior a 90 dias a contar da data do pedido';
		} else {
			doc.delivery_date = date.add_months(doc.transaction_date, 2);
		}
		// Dispara a mensagem de validacao caso o doc nao seja validado e haja uma mensagem
		if ((validated === false) && (msg !== '')) {
			msgprint(msg);
		}  
		
	}
}

// Atualiza os valores da forma de pagamento e deflaciona
function update_payment_values(doc, so){
	var i, fl, period=0, ldate, total=0, pays = [], debug=false;
	if (!doc.payment_value || !doc.number_of_payments) {
		return;
	}
	doc.gross_payment_amount = doc.payment_value*doc.number_of_payments;
	refresh_field('gross_payment_amount', doc.name, 'payments');
	doc.service_rate_value = doc.gross_payment_amount*doc.service_rate/100.0;
	refresh_field('service_rate_value', doc.name, 'payments');
	if (debug){
		console.log('DEBUG START HERE');
		console.log('Transaction Date: ' + date.str_to_user(so.transaction_date));
		console.log('Gross Payment Amoun: ' + doc.gross_payment_amount.toString());
		console.log('Service Rate Value: ' + doc.service_rate_value.toString());
		console.log('Is At Sight? ' + ((doc.is_at_sight) ? 'Yes': 'No'));
	}
	if (doc.is_at_sight){
		// Pagamentos a vista
		doc.net_payment_amount=doc.gross_payment_amount;
		refresh_field('net_payment_amount', doc.name, 'payments');
		if (debug) {console.log('  + Net Payment Amount: ' + doc.net_payment_amount.toString());}
	} else if (!so.is_scheduled_delivery && !so.delivery_date){
		// Vendas Imediatas
		if (debug){
			console.log('Is Scheduled Delivery? ' + ((so.is_scheduled_delivery)? 'Yes': 'No'));
			console.log('   + First Payment Date: ' + date.str_to_user(doc.first_payment_date));
			console.log('   + Last Payment Date: ' + date.str_to_user(doc.last_payment_date));
			console.log('     + Time from Start to End: ' + wn.datetime.get_diff(wn.datetime.add_months(doc.first_payment_date, doc.number_of_payments), doc.first_payment_date).toString());
		}
		if ((wn.datetime.get_day_diff(
				wn.datetime.str_to_obj(doc.first_payment_date), 
				wn.datetime.str_to_obj(so.transaction_date)
			))<=15){
			// Com Entrada
			if (debug){
				console.log('   + Has Entry Value:');
				console.log('     + Entry Value Gross: ' + doc.payment_value.toString());
				console.log('     + Entry Value Net: ' + (doc.payment_value*(1-(doc.service_rate/100))).toString())
				console.log('     + # Payments: 1');
				console.log('     + With Deduction Rate: ' + doc.deduction_rate.toString())
			}
			pays.push({
				tag: 'entrada', 
				value: doc.payment_value * (1 - (doc.service_rate/100)),
				qty: 1,
				tax: doc.deduction_rate
			});
			if (doc.number_of_payments-1 > 0){
				if (debug) {
					console.log('   Has Founded Value:');
					console.log('     Founded Value Gross: ' + doc.payment_value);
					console.log('     Founded Value Net: ' + (doc.payment_value  * (1 - (doc.service_rate/100))).toString());
					console.log('     + # Payments: ' + (doc.number_of_payments-1).toString());
					console.log('     + With Deduction Rate: ' + doc.deduction_rate.toString());
				}
				pays.push({
					tag:'financeira',
					value: doc.payment_value  * (1 - (doc.service_rate/100)),
					qty: doc.number_of_payments - 1,
					tax: doc.deduction_rate
				});
			}
			//console.log(pays);
		} else {
			// Sem Entrada
			if (debug){
				console.log('   + Has Founded Value:');
				console.log('     + Founded Value Gross: ' + doc.payment_value);
				console.log('     + Founded Value Net: ' + (doc.payment_value  * (1 - (doc.service_rate/100))).toString());
				console.log('     + # Payments: ' + (doc.number_of_payments).toString());
				console.log('     + With Deduction Rate: ' + doc.deduction_rate.toString());
			}
			pays.push({
				tag: 'financeira',
				value: doc.payment_value * (1 - (doc.service_rate/100)),
				qty: doc.number_of_payments,
				tax: doc.deduction_rate
			});
			//console.log(pays);
		}
	} else {
		// Vendas Programadas
		if (debug){
			console.log('Is Scheduled Delivery? ' + ((so.is_scheduled_delivery)? 'Yes': 'No'));
			console.log('Scheduled Delivery Date: ' + date.str_to_user(so.delivery_date));
			console.log('   + First Payment Date: ' + date.str_to_user(doc.first_payment_date));
			console.log('   + Last Payment Date: ' + date.str_to_user(doc.last_payment_date));
			console.log('     + Time from Start to End: ' + wn.datetime.get_diff(wn.datetime.add_months(doc.first_payment_date, doc.number_of_payments), doc.first_payment_date).toString());
			console.log('     + Time from Start to Delivery: ' + wn.datetime.get_diff(so.transaction_date, doc.first_payment_date).toString());        
		}
		period = 0;
		while ((wn.datetime.get_diff(
				so.delivery_date,
				wn.datetime.add_months(doc.first_payment_date,period)
			) > 0)  && (period <= doc.number_of_payments)
		){
			if (debug){
				console.log('       + In ' + wn.datetime.add_months(doc.first_payment_date, period) + ' months ' +
						' is elapsed ' + wn.datetime.get_day_diff(
								date.str_to_obj(so.delivery_date),
								date.str_to_obj(wn.datetime.add_months(doc.first_payment_date, period))
							) + 
						' days'
						);
			}
			period++;
		}
		if (debug){
			console.log('   + Has Entry Value:');
			console.log('     + Entry Value Gross: ' + doc.payment_value.toString());
			console.log('     + Entry Value Net: ' + (doc.payment_value*(1-(doc.service_rate/100))).toString())
			console.log('     + # Payments: ' + period.toString());
			console.log('     + With Deduction Rate: ' + doc.deduction_rate.toString())
		}
		pays.push({
			tag: 'avista',
			value: doc.payment_value  * (1 - (doc.service_rate/100)),
			qty: period,
			tax: doc.deduction_rate
		});
		if ((doc.number_of_payments - period) > 0){
			if (debug) {
				console.log('   + Has Founded Value:');
				console.log('     + Founded Value Gross: ' + doc.payment_value);
				console.log('     + Founded Value Net: ' + (doc.payment_value  * (1 - (doc.service_rate/100))).toString());
				console.log('     + # Payments: ' + (doc.number_of_payments-period).toString());
				console.log('     + With Deduction Rate: ' + doc.deduction_rate.toString());
			}
			pays.push({
				tag: 'financeira',
				value: doc.payment_value  * (1 - (doc.service_rate/100)),
				qty: doc.number_of_payments - period,
				tax: doc.deduction_rate
			});
		}
	}
	if (debug) { console.log('Pays:'); }
	$.each(pays, function(i, pmt){
		if (debug) {
			console.log('   + #: ' + i.toString());
			console.log('     + Payment Tag: ' + pmt.tag.toString());
			console.log('     + Payment Qty: ' + pmt.qty.toString());
			console.log('     + Payment Tax: ' + pmt.tax.toString());
			console.log('     + Payment Val: ' + pmt.value.toString());
			if (pmt.tag==='financeira'){
				console.log('     + Payment Sbt: ' + ((pmt.qty*pmt.value)/(1+(pmt.qty*pmt.tax))).toString());
				console.log('     + Expression : ' + '(' + pmt.qty.toString() + '*' + 
						pmt.value.toString() + ')/(1+(' + pmt.qty.toString() + '*' + 
						pmt.tax.toString() + ')))'
				);
			} else {
				console.log('     + Payment Sbt: ' + (pmt.qty*pmt.value).toString());
				console.log('     + Expression : ' + '(' + pmt.qty.toString() + '*' + pmt.value.toString() +')');            
			}
		}
		if (pmt.tag==='financeira'){
			doc.net_payment_amount = (doc.net_payment_amount||0) + ((pmt.qty*pmt.value)/(1+(pmt.qty*pmt.tax)));
		} else {
			doc.net_payment_amount = (doc.net_payment_amount||0) + (pmt.qty*pmt.value);
		}
		total += doc.gross_payment_amount;
		if (total>so.grand_total_export){
			console.log();
			msgprint('A soma de pagamentos ultrapassa o valor do pedido!', 'Ops...');
		}
		refresh_field('net_payment_amount', doc.name, 'payments');
	}); 
		
	doc.rate_value = doc.gross_payment_amount - doc.net_payment_amount;
	refresh_field('rate_value', doc.name, 'payments');
	doc.rate = (doc.rate_value / doc.gross_payment_amount) * 100;
	refresh_field('rate', doc.name, 'payments');
	doc.deduction_rate_value = (doc.gross_payment_amount - doc.service_rate_value - doc.net_payment_amount);
	refresh_field('deduction_rate_value', doc.name, 'payments');
	
	var value = 0.0;
	$.each(wn.model.get('Sales Order Payment', {parent: 'New Sales Order 1'}), function(i,dt){ value += dt.net_payment_amount; });
	so.payment_amount_net = value;
	cur_frm.refresh_field('payment_amount_net');
}

// Insere automaticamente o valor da taxa de servico
cur_frm.add_fetch('mode_of_payment', 'service_rate', 'service_rate');

// Insere automaticamente a taxa de deducao
cur_frm.add_fetch('mode_of_payment', 'deduction_rate', 'deduction_rate');

// Insere automaticamente a informacao se a forma de pagamento eh avista
cur_frm.add_fetch('mode_of_payment', 'is_at_sight', 'is_at_sight');

// Libera/Bloqueia a quantidade de parcelas baseado na forma de pagamento
cur_frm.cscript.mode_of_payment = function(doc, cdt, cdn){
	var d = locals[cdt][cdn], i=0, options = [], field, msg;
	// Nao podem haver boletos em vendas imediatas
	if (d.mode_of_payment=="Boleto"){
		if (!doc.delivery_date){
			d.mode_of_payment = null;
			refresh_field('mode_of_payment', d.name, 'payments');
			msg = 'Voce nao pode incluir boletos em uma Venda Imediata!';
			msgprint(msg, title='Ops...');
			throw msg;
		} 
	}
	//Se o pagamento for avista o numero de parcelas devera ser igual a 1
	if (d.is_at_sight){
		cur_frm.fields_dict['payments'].frm.set_df_property(
			'number_of_payments', 
			'read_only', 
			true
		);
		d.number_of_payments=1;
		refresh_field('number_of_payments', d.name, 'payments');
		cur_frm.cscript.first_payment_date(doc, cdt, cdn);
	} 
	if (d.payment_value && d.number_of_payments){
		update_payment_values(d, doc);
	}
}

// Atualiza a data ultima parcela com base na data da primeira parcela
cur_frm.cscript.first_payment_date = function(doc, cdt, cdn){
	var d = locals[cdt][cdn];
	//Se houver o numero de parcelas 
	if (d.number_of_payments){
		d.last_payment_date = wn.datetime.obj_to_str(
			wn.datetime.add_months(
				wn.datetime.str_to_obj(d.first_payment_date),
				(d.number_of_payments - 1)
			)
		);
		refresh_field('last_payment_date', d.name, 'payments');
	}
}

// Atualiza a data da ultima parcela com base no numero de parcelas
cur_frm.cscript.number_of_payments = function(doc, cdt, cdn){
	var d = locals[cdt][cdn], allowed = 0;
	// Nao podem haver boletos em vendas imediatas
	if(d.mode_of_payment=="Boleto"){
		if (!doc.delivery_date){
			d.number_of_payments = 0;
			refresh_field('number_of_payments', d.name, 'payments');
			msgprint('Voce nao pode incluir boletos em uma Venda Imediata!', title='Ops...');
		} 
		while (wn.datetime.get_diff(
			wn.datetime.add_months(d.first_payment_date,allowed),
			doc.delivery_date
		) < 0 ) {
			allowed++;
		}
		if (allowed<d.number_of_payments){
			doc.number_of_payments = 0;
			refresh_field('number_of_payments', d.name, 'payments');
			msgprint("O numero maximo de parcelas permitidas para esta forma de pagamento e de <strong>" + allowed + "</strong> parcelas.", title="Ops...");
		}
	} 
	
	//Se houver a data do primeiro vencimento
	if (d.first_payment_date){
		d.last_payment_date = wn.datetime.obj_to_str(
			wn.datetime.add_months(
				wn.datetime.str_to_obj(d.first_payment_date),
				(d.number_of_payments - 1)
			)
		);
		refresh_field('last_payment_date', d.name, 'payments');
	}
	// Se houver o valor das parcelas
	if (d.payment_value){
		update_payment_values(d, doc);
	}
}
//Atualiza o sub-total com base no valor da parcela
cur_frm.cscript.payment_value = function(doc, cdt, cdn){
	var d = locals[cdt][cdn];    
	// Se houver o numero de parcelas
	if(d.number_of_payments){
		update_payment_values(d, doc);
	}   
}

// Adiciona um gatilho para atualizacao de valores de projeto.
function value_calculation_decorated(caller){
	return function(doc, cdt, cdn){
		var cost, cache, item, key, msg;
		if (doc.is_additional_sales_order && (doc.modo_complemento==='Revis\u00E3o')){
			cost = doc.project_cost_parent - doc.project_cost;
		} else {
			cost = doc.project_cost;
		}
		if (caller && doc.project_cost){
			switch(caller){
				case 'project_cost':
					doc.project_amount = cost;
					doc.project_discount = 0.0;
					doc.project_discount_value = 0.0;
					break;
				case 'project_discount':
					if (doc.project_discount<0||doc.project_discount>100) {
						doc.project_discount=0;
						msg = wn._("The discount should be between 0 and 100");
						msgprint(msg);
						refresh_field(caller);
						throw msg;
					}
					doc.project_discount_value = (cost*(doc.project_discount/100));
					doc.project_amount = (cost-doc.project_discount_value);
					break;
				case 'project_discount_value':
					if (doc.project_discount_value<0||doc.project_discount_value>cost){
						doc.project_discount=0;
						msg = wn._("The discount must be greater or equal to zero");
						msgprint(msg);
						refresh_field(caller);
						throw msg;
					}
					doc.project_discount = ((doc.project_discount_value/cost)*100);
					doc.project_amount = (cost-doc.project_discount_value);
					break;
				case 'project_amount':
					if (doc.project_amount<(cost*0.64)||doc.project_amount>cost){
						doc.project_amount = 0;
						msg = wn._("The amount of furniture, must be beetween ") + (cost*0.64) + wn._(" and ") + cost ;
						msgprint(msgprint);
						refresh_field(caller);
						throw msg;
					}
					doc.project_discount_value = (cost-doc.project_amount);
					doc.project_discount = ((doc.project_discount_value/cost)*100);
					break;
			}
			//cur_frm.refresh_field('project_discount');
			//cur_frm.refresh_field('project_discount_value');
			//cur_frm.refresh_field('project_amount');
		}
		cache = DBChooser.cache[doc.name].items;
		for (var key in cache){
			item = locals['Sales Order Item'][cache[key]];
			item.adj_rate = doc.project_discount;
			cur_frm.cscript.adj_rate(doc, 'Sales Order Item', item.name)
		}
		cur_frm.refresh_fields();
	}
}
cur_frm.cscript.project_cost = value_calculation_decorated('project_cost');
cur_frm.cscript.project_discount = value_calculation_decorated('project_discount');
cur_frm.cscript.project_discount_value = value_calculation_decorated('project_discount_value');
cur_frm.cscript.project_amount = value_calculation_decorated('project_amount');
cur_frm.cscript.net_payment_amount = value_calculation_decorated('net_payment_amount');

// Define o filtro do campo de Pedido Principal, para vendas do cliente selecionado
// e restinge os pedidos para nao complementares
cur_frm.fields_dict['parent_sales_order'].get_query = function(doc){
	var cond = '';
	if (doc.customer) {
		cond += ' ifnull(`tabSales Order`.`customer`, "") = "' + doc.customer + '" and';
	}
	if (doc.order_type) {
		cond += ' ifnull(`tabSales Order`.`order_type`, "") = "' + doc.order_type + '" and';
	}
	return repl('SELECT DISTINCT `tabSales Order`.`name` FROM `tabSales Order` \
		WHERE `tabSales Order`.`company` = "' 
		 + doc.company + '" and `tabSales Order`.`docstatus` = 1 \
			and `tabSales Order`.`is_additional_sales_order` = 0 \
			and %(cond)s `tabSales Order`.`%(key)s` LIKE "%s" \
			ORDER BY `tabSales Order`.`name` DESC LIMIT 50', {cond:cond});
}

// Adiciona um gatilho para a definicao de valores padroes na criacao de uma nova ficha de financeira
cur_frm.fields_dict.registration_data_personal_financial.on_new = function(dn){
	locals['Registration Data Personal Financial'][dn].customer = locals[cur_frm.doctype][cur_frm.docname].customer;
}
