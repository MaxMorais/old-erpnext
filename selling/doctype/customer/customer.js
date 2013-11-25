// Copyright (c) 2013, Web Notes Technologies Pvt. Ltd.
// License: GNU General Public License v3. See license.txt

wn.require('app/setup/doctype/contact_control/contact_control.js');

cur_frm.cscript.onload = function(doc,dt,dn){
	cur_frm.cscript.load_defaults(doc, dt, dn);
}

cur_frm.cscript.load_defaults = function(doc, dt, dn) {
	doc = locals[doc.doctype][doc.name];
	if(!(doc.__islocal && doc.lead_name)) { return; }

	var fields_to_refresh = wn.model.set_default_values(doc);
	if(fields_to_refresh) { refresh_many(fields_to_refresh); }
}

cur_frm.add_fetch('lead_name', 'company_name', 'customer_name');
cur_frm.add_fetch('default_sales_partner','commission_rate','default_commission_rate');

cur_frm.cscript.refresh = function(doc,dt,dn) {
	cur_frm.cscript.setup_dashboard(doc);
	erpnext.hide_naming_series();

	if(doc.__islocal){		
		hide_field(['address_html','contact_html']);
	}else{		
		unhide_field(['address_html','contact_html']);
		// make lists
		cur_frm.cscript.make_address(doc,dt,dn);
		cur_frm.cscript.make_contact(doc,dt,dn);

		cur_frm.communication_view = new wn.views.CommunicationList({
			parent: cur_frm.fields_dict.communication_html.wrapper,
			doc: doc,
		});
        cur_frm.toggle_enable(doc.customer_type === 'Individual' ? 'documentos_cpf': 'documentos_cnpj', false);
	}
}

cur_frm.cscript.setup_dashboard = function(doc) {
	cur_frm.dashboard.reset(doc);
	if(doc.__islocal) 
		return;
	if (in_list(user_roles, "Accounts User") || in_list(user_roles, "Accounts Manager"))
	    cur_frm.dashboard.set_headline('<span class="text-muted">'+ wn._('Loading...')+ '</span>')
	
    cur_frm.dashboard.add_doctype_badge(wn._("Opportunity"), "customer");
    cur_frm.dashboard.add_doctype_badge(wn._("Quotation"), "customer");
    cur_frm.dashboard.add_doctype_badge(wn._("Sales Order"), "customer");
    cur_frm.dashboard.add_doctype_badge(wn._("Delivery Note"), "customer");
    cur_frm.dashboard.add_doctype_badge(wn._("Sales Invoice"), "customer");
	
	return wn.call({
		type: "GET",
		method:"selling.doctype.customer.customer.get_dashboard_info",
		args: {
			customer: cur_frm.doc.name
		},
		callback: function(r) {
			if (in_list(user_roles, "Accounts User") || in_list(user_roles, "Accounts Manager")) {
			    cur_frm.dashboard.set_headline(
				wn._("Total Billing This Year: ") + "<b>" 
				+ format_currency(r.message.total_billing, cur_frm.doc.default_currency)
				+ '</b> / <span class="text-muted">' + wn._("Unpaid") + ": <b>" 
				+ format_currency(r.message.total_unpaid, cur_frm.doc.default_currency) 
				+ '</b></span>');
			}
			cur_frm.dashboard.set_badge_count(r.message);
		}
	})
}

cur_frm.cscript.make_address = function() {
	if(!cur_frm.address_list) {
		cur_frm.address_list = new wn.ui.Listing({
			parent: cur_frm.fields_dict['address_html'].wrapper,
			page_length: 5,
			new_doctype: "Address",
			get_query: function() {
				return "select name, address_type, address_line1, address_line2, city, state, country, pincode, fax, email_id, phone, is_primary_address, is_shipping_address from tabAddress where customer='"+cur_frm.docname+"' and docstatus != 2 order by is_primary_address desc"
			},
			as_dict: 1,
			no_results_message: wn._('No addresses created'),
			render_row: cur_frm.cscript.render_address_row,
		});
		// note: render_address_row is defined in contact_control.js
	}
	cur_frm.address_list.run();
}

cur_frm.cscript.make_contact = function() {
	if(!cur_frm.contact_list) {
		cur_frm.contact_list = new wn.ui.Listing({
			parent: cur_frm.fields_dict['contact_html'].wrapper,
			page_length: 5,
			new_doctype: "Contact",
			get_query: function() {
				return "select name, first_name, last_name, email_id, phone, mobile_no, department, designation, is_primary_contact from tabContact where customer='"+cur_frm.docname+"' and docstatus != 2 order by is_primary_contact desc"
			},
			as_dict: 1,
			no_results_message: wn._('No contacts created'),
			render_row: cur_frm.cscript.render_contact_row,
		});
		// note: render_contact_row is defined in contact_control.js
	}
	cur_frm.contact_list.run();

}

cur_frm.fields_dict['customer_group'].get_query = function(doc,dt,dn) {
	return{
		filters:{'is_group': 'No'}
	}	
}


cur_frm.fields_dict.lead_name.get_query = function(doc,cdt,cdn) {
	return{
		query:"controllers.queries.lead_query"
	}
}

cur_frm.fields_dict['default_price_list'].get_query = function(doc,cdt,cdn) {
	return{
		filters:{'buying_or_selling': "Selling"}
	}
}

cur_frm.cscript.custom_refresh = function(doc, cdt, cdn){
	cur_frm.cscript.customer_type(doc, cdt, cdn);
}

cur_frm.cscript.customer_type = function(doc, cdt, cdn){
	if (doc.customer_type=='Company'){
		cur_frm.toggle_reqd('documentos_cnpj', true);
		cur_frm.toggle_reqd('documentos_cpf', false);
	} else {
		cur_frm.toggle_reqd('documentos_cpf', true);
		cur_frm.toggle_reqd('documentos_cnpj', false);
	}
}

// funcao para validacao do CPF
function validar_cpf(cpf){
    var Soma = 0, Resto, i;
    if (cpf == "00000000000"){
    		return false;a
        }
    for (i=1; i<=9; i++){
    	Soma = Soma + parseInt(cpf.substring(i-1, i)) * (11 - i); 
    }
    Resto = (Soma * 10) % 11;
    if ((Resto == 10) || (Resto == 11)) {
    	Resto = 0;	
    }
    if (Resto != parseInt(cpf.substring(9, 10)) ){
    	return false;	
    }
	Soma = 0;
    for (i = 1; i <= 10; i++){
    	Soma = Soma + parseInt(cpf.substring(i-1, i)) * (12 - i);
    }
    Resto = (Soma * 10) % 11;
    if ((Resto == 10) || (Resto == 11)) {
    	Resto = 0;	
    }
    if (Resto != parseInt(cpf.substring(10, 11) ) )
        return false;
    return true;
}
// funcao para validar CNPJ
function validar_cnpj(cnpj) {
    cnpj = cnpj.replace(/[^\d]+/g,'');
    if(cnpj == '') {
        return false
    };
    if (cnpj.length != 14) {
        return false;
    }
    // Elimina CNPJs invalidos conhecidos
    if (cnpj == "00000000000000" || 
        cnpj == "11111111111111" || 
        cnpj == "22222222222222" || 
        cnpj == "33333333333333" || 
        cnpj == "44444444444444" || 
        cnpj == "55555555555555" || 
        cnpj == "66666666666666" || 
        cnpj == "77777777777777" || 
        cnpj == "88888888888888" || 
        cnpj == "99999999999999"){
        return false;
   }      
    // Valida DVs
    tamanho = cnpj.length - 2
    numeros = cnpj.substring(0,tamanho);
    digitos = cnpj.substring(tamanho);
    soma = 0;
    pos = tamanho - 7;
    for (i = tamanho; i >= 1; i--) {
      soma += numeros.charAt(tamanho - i) * pos--;
      if (pos < 2){
            pos = 9;
      }
    }
    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado != digitos.charAt(0)){
        return false;
    }
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0,tamanho);
    soma = 0;
    pos = tamanho - 7;
    for (i = tamanho; i >= 1; i--) {
      soma += numeros.charAt(tamanho - i) * pos--;
      if (pos < 2){
            pos = 9;
      }
    }
    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado != digitos.charAt(1)){
          return false;
    }
    return true;
}

cur_frm.cscript.custom_validate = function(doc, cdt, cdn){
    // Verifica se o cliente eh do tipo Individual, caso seja, verifica se o
    // cpf esta preenchido e se o mesmo e valido.
    var msg = "";
    if (doc.customer_type==="Individual"){
        if (!doc.documentos_cpf){
            msg = msg + "Informe o CPF.\n"
            validated = false;
        } else {
            validated = validar_cpf(doc.documentos_cpf);
            if (!validated){
                msg = msg + "CPF Inv\xC3\xA1lido.\n";
            }
        }
    } else if (doc.customer_type==="Company"){
        if (!doc.documentos_cnpj){
            msg = msg + "Informe o CNPJ.\n";
            validated=false;
        } else {
            validated = validar_cnpj(doc.documentos_cnpj);
            if (!validated){
                msg = msg + "CNPJ Inv\xC3\xA1lido.\n";
            }
        }
    }
    if ((!validated) && (msg != "")){
        msgprint(msg);
    }
}


