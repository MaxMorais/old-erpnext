#-*- coding: utf-8 -*-
# ERPNext - web based ERP (http://erpnext.com)
# Copyright (C) 2012 Web Notes Technologies Pvt Ltd
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

from __future__ import unicode_literals
import webnotes
import webnotes.utils
import json

from webnotes.utils import cstr, flt, getdate
from webnotes.model.bean import getlist
from webnotes.model.code import get_obj
from webnotes import msgprint
from webnotes.model.mapper import get_mapped_doclist

sql = webnotes.conn.sql

from controllers.selling_controller import SellingController

class DocType(SellingController):
	def __init__(self, doc, doclist=None):
		self.doc = doc
		if not doclist: doclist = []
		self.doclist = doclist
		self.tname = 'Sales Order Item'
		self.fname = 'sales_order_details'
		self.person_tname = 'Target Detail'
		self.partner_tname = 'Partner Target Detail'
		self.territory_tname = 'Territory Target Detail'

	def get_contact_details(self):
		get_obj('Sales Common').get_contact_details(self,0)

	def get_comm_rate(self, sales_partner):
		return get_obj('Sales Common').get_comm_rate(sales_partner, self)

	def get_adj_percent(self, arg=''):
		get_obj('Sales Common').get_adj_percent(self)

	def get_available_qty(self,args):
		return get_obj('Sales Common').get_available_qty(eval(args))

	def get_rate(self,arg):
		return get_obj('Sales Common').get_rate(arg)

	def validate_mandatory(self):
		# validate transaction date v/s delivery date
		if self.doc.delivery_date:
			if getdate(self.doc.transaction_date) > getdate(self.doc.delivery_date):
				msgprint("Expected Delivery Date cannot be before Sales Order Date")
				raise Exception

	def validate_po(self):
		# validate p.o date v/s delivery date
		if self.doc.po_date and self.doc.delivery_date and getdate(self.doc.po_date) > getdate(self.doc.delivery_date):
			msgprint("Expected Delivery Date cannot be before Purchase Order Date")
			raise Exception

		if self.doc.po_no and self.doc.customer:
			so = webnotes.conn.sql("select name from `tabSales Order` \
				where ifnull(po_no, '') = %s and name != %s and docstatus < 2\
				and customer = %s", (self.doc.po_no, self.doc.name, self.doc.customer))
			if so and so[0][0]:
				msgprint("""Another Sales Order (%s) exists against same PO No and Customer.
					Please be sure, you are not making duplicate entry.""" % so[0][0])

	def validate_for_items(self):
		check_list, flag = [], 0
		chk_dupl_itm = []
		for d in getlist(self.doclist, 'sales_order_details'):
			e = [d.item_code, d.description, d.reserved_warehouse, d.prevdoc_docname or '']
			f = [d.item_code, d.description]

			if webnotes.conn.get_value("Item", d.item_code, "is_stock_item") == 'Yes':
				if not d.reserved_warehouse:
					msgprint("""Please enter Reserved Warehouse for item %s
						as it is stock Item""" % d.item_code, raise_exception=1)

				if e in check_list:
					msgprint("Item %s has been entered twice." % d.item_code)
				else:
					check_list.append(e)
			else:
				if f in chk_dupl_itm:
					msgprint("Item %s has been entered twice." % d.item_code)
				else:
					chk_dupl_itm.append(f)

			# used for production plan
			d.transaction_date = self.doc.transaction_date

			tot_avail_qty = sql("select projected_qty from `tabBin` \
				where item_code = '%s' and warehouse = '%s'" % (d.item_code,d.reserved_warehouse))
			d.projected_qty = tot_avail_qty and flt(tot_avail_qty[0][0]) or 0

	def validate_sales_mntc_quotation(self):
		for d in getlist(self.doclist, 'sales_order_details'):
			if d.prevdoc_docname:
				res = sql("select name from `tabQuotation` where name=%s and order_type = %s", (d.prevdoc_docname, self.doc.order_type))
				if not res:
					msgprint("""Order Type (%s) should be same in Quotation: %s \
						and current Sales Order""" % (self.doc.order_type, d.prevdoc_docname))

	def validate_order_type(self):
		super(DocType, self).validate_order_type()

	def validate_delivery_date(self):
		if self.doc.order_type == 'Sales' and not self.doc.delivery_date:
			msgprint("Please enter 'Expected Delivery Date'")
			raise Exception

		self.validate_sales_mntc_quotation()

	def validate_proj_cust(self):
		if self.doc.project_name and self.doc.customer_name:
			res = sql("select name from `tabProject` where name = '%s' and (customer = '%s' or ifnull(customer,'')='')"%(self.doc.project_name, self.doc.customer))
			if not res:
				msgprint("Customer - %s does not belong to project - %s. \n\nIf you want to use project for multiple customers then please make customer details blank in project - %s."%(self.doc.customer,self.doc.project_name,self.doc.project_name))
				raise Exception

	def validate(self):
		super(DocType, self).validate()

		self.validate_order_type()
		self.validate_delivery_date()
		self.validate_mandatory()
		self.validate_proj_cust()
		self.validate_po()
		self.validate_uom_is_integer("stock_uom", "qty")
		if self.doc.docstatus == 1:
			self.validate_for_items()

		sales_com_obj = get_obj(dt = 'Sales Common')
		sales_com_obj.check_active_sales_items(self)
		sales_com_obj.check_conversion_rate(self)

		sales_com_obj.validate_max_discount(self,'sales_order_details')
		self.doclist = sales_com_obj.make_packing_list(self,'sales_order_details')

		self.validate_with_previous_doc()

		if not self.doc.status:
			self.doc.status = "Draft"

		import utilities
		utilities.validate_status(self.doc.status, ["Draft", "Submitted", "Stopped",
			"Cancelled"])

		if not self.doc.billing_status: self.doc.billing_status = 'Not Billed'
		if not self.doc.delivery_status: self.doc.delivery_status = 'Not Delivered'

	def validate_with_previous_doc(self):
		super(DocType, self).validate_with_previous_doc(self.tname, {
			"Quotation": {
				"ref_dn_field": "prevdoc_docname",
				"compare_fields": [["company", "="], ["currency", "="]]
			}
		})


	def check_prev_docstatus(self):
		for d in getlist(self.doclist, 'sales_order_details'):
			cancel_quo = sql("select name from `tabQuotation` where docstatus = 2 and name = '%s'" % d.prevdoc_docname)
			if cancel_quo:
				msgprint("Quotation :" + cstr(cancel_quo[0][0]) + " is already cancelled !")
				raise Exception , "Validation Error. "

	def update_enquiry_status(self, prevdoc, flag):
		enq = sql("select t2.prevdoc_docname from `tabQuotation` t1, `tabQuotation Item` t2 where t2.parent = t1.name and t1.name=%s", prevdoc)
		if enq:
			sql("update `tabOpportunity` set status = %s where name=%s",(flag,enq[0][0]))

	def update_prevdoc_status(self, flag):
		for d in getlist(self.doclist, 'sales_order_details'):
			if d.prevdoc_docname:
				if flag=='submit':
					sql("update `tabQuotation` set status = 'Order Confirmed' where name=%s",d.prevdoc_docname)

					#update enquiry
					self.update_enquiry_status(d.prevdoc_docname, 'Order Confirmed')
				elif flag == 'cancel':
					chk = sql("select t1.name from `tabSales Order` t1, `tabSales Order Item` t2 where t2.parent = t1.name and t2.prevdoc_docname=%s and t1.name!=%s and t1.docstatus=1", (d.prevdoc_docname,self.doc.name))
					if not chk:
						sql("update `tabQuotation` set status = 'Submitted' where name=%s",d.prevdoc_docname)

						#update enquiry
						self.update_enquiry_status(d.prevdoc_docname, 'Quotation Sent')

	def on_submit(self):
		self.check_prev_docstatus()
		self.update_stock_ledger(update_stock = 1)

		get_obj('Sales Common').check_credit(self,self.doc.grand_total)

		get_obj('Authorization Control').validate_approving_authority(self.doc.doctype, self.doc.grand_total, self)

		self.update_prevdoc_status('submit')
		webnotes.conn.set(self.doc, 'status', 'Submitted')

	def on_cancel(self):
		# Cannot cancel stopped SO
		if self.doc.status == 'Stopped':
			msgprint("Sales Order : '%s' cannot be cancelled as it is Stopped. Unstop it for any further transactions" %(self.doc.name))
			raise Exception
		self.check_nextdoc_docstatus()
		self.update_stock_ledger(update_stock = -1)

		self.update_prevdoc_status('cancel')

		webnotes.conn.set(self.doc, 'status', 'Cancelled')

	def check_nextdoc_docstatus(self):
		# Checks Delivery Note
		submit_dn = sql("select t1.name from `tabDelivery Note` t1,`tabDelivery Note Item` t2 where t1.name = t2.parent and t2.prevdoc_docname = '%s' and t1.docstatus = 1" % (self.doc.name))
		if submit_dn:
			msgprint("Delivery Note : " + cstr(submit_dn[0][0]) + " has been submitted against " + cstr(self.doc.doctype) + ". Please cancel Delivery Note : " + cstr(submit_dn[0][0]) + " first and then cancel "+ cstr(self.doc.doctype), raise_exception = 1)

		# Checks Sales Invoice
		submit_rv = sql("select t1.name from `tabSales Invoice` t1,`tabSales Invoice Item` t2 where t1.name = t2.parent and t2.sales_order = '%s' and t1.docstatus = 1" % (self.doc.name))
		if submit_rv:
			msgprint("Sales Invoice : " + cstr(submit_rv[0][0]) + " has already been submitted against " +cstr(self.doc.doctype)+ ". Please cancel Sales Invoice : "+ cstr(submit_rv[0][0]) + " first and then cancel "+ cstr(self.doc.doctype), raise_exception = 1)

		#check maintenance schedule
		submit_ms = sql("select t1.name from `tabMaintenance Schedule` t1, `tabMaintenance Schedule Item` t2 where t2.parent=t1.name and t2.prevdoc_docname = %s and t1.docstatus = 1",self.doc.name)
		if submit_ms:
			msgprint("Maintenance Schedule : " + cstr(submit_ms[0][0]) + " has already been submitted against " +cstr(self.doc.doctype)+ ". Please cancel Maintenance Schedule : "+ cstr(submit_ms[0][0]) + " first and then cancel "+ cstr(self.doc.doctype), raise_exception = 1)

		# check maintenance visit
		submit_mv = sql("select t1.name from `tabMaintenance Visit` t1, `tabMaintenance Visit Purpose` t2 where t2.parent=t1.name and t2.prevdoc_docname = %s and t1.docstatus = 1",self.doc.name)
		if submit_mv:
			msgprint("Maintenance Visit : " + cstr(submit_mv[0][0]) + " has already been submitted against " +cstr(self.doc.doctype)+ ". Please cancel Maintenance Visit : " + cstr(submit_mv[0][0]) + " first and then cancel "+ cstr(self.doc.doctype), raise_exception = 1)

		# check production order
		pro_order = sql("""select name from `tabProduction Order` where sales_order = %s and docstatus = 1""", self.doc.name)
		if pro_order:
			msgprint("""Production Order: %s exists against this sales order.
				Please cancel production order first and then cancel this sales order""" %
				pro_order[0][0], raise_exception=1)

	def check_modified_date(self):
		mod_db = sql("select modified from `tabSales Order` where name = '%s'" % self.doc.name)
		date_diff = sql("select TIMEDIFF('%s', '%s')" % ( mod_db[0][0],cstr(self.doc.modified)))
		if date_diff and date_diff[0][0]:
			msgprint("%s: %s has been modified after you have opened. Please Refresh"
				% (self.doc.doctype, self.doc.name), raise_exception=1)

	def stop_sales_order(self):
		self.check_modified_date()
		self.update_stock_ledger(update_stock = -1,is_stopped = 1)
		webnotes.conn.set(self.doc, 'status', 'Stopped')
		msgprint("""%s: %s has been Stopped. To make transactions against this Sales Order
			you need to Unstop it.""" % (self.doc.doctype, self.doc.name))

	def unstop_sales_order(self):
		self.check_modified_date()
		self.update_stock_ledger(update_stock = 1,is_stopped = 1)
		webnotes.conn.set(self.doc, 'status', 'Submitted')
		msgprint("%s: %s has been Unstopped" % (self.doc.doctype, self.doc.name))


	def update_stock_ledger(self, update_stock, is_stopped = 0):
		for d in self.get_item_list(is_stopped):
			if webnotes.conn.get_value("Item", d['item_code'], "is_stock_item") == "Yes":
				args = {
					"item_code": d['item_code'],
					"reserved_qty": flt(update_stock) * flt(d['reserved_qty']),
					"posting_date": self.doc.transaction_date,
					"voucher_type": self.doc.doctype,
					"voucher_no": self.doc.name,
					"is_amended": self.doc.amended_from and 'Yes' or 'No'
				}
				get_obj('Warehouse', d['reserved_warehouse']).update_bin(args)


	def get_item_list(self, is_stopped):
		return get_obj('Sales Common').get_item_list( self, is_stopped)

	def on_update(self):
		pass

@webnotes.whitelist()
def get_orders():
	# find customer id
	customer = webnotes.conn.get_value("Contact", {"email_id": webnotes.session.user},
		"customer")

	if customer:
		orders = webnotes.conn.sql("""select
			name, creation, currency from `tabSales Order`
			where customer=%s
			and docstatus=1
			order by creation desc
			limit 20
			""", customer, as_dict=1)
		for order in orders:
			order.items = webnotes.conn.sql("""select
				item_name, qty, export_rate, export_amount, delivered_qty, stock_uom
				from `tabSales Order Item`
				where parent=%s
				order by idx""", order.name, as_dict=1)

		return orders
	else:
		return []

def get_website_args():
	customer = webnotes.conn.get_value("Contact", {"email_id": webnotes.session.user},
		"customer")
	bean = webnotes.bean("Sales Order", webnotes.form_dict.name)
	if bean.doc.customer != customer:
		return {
			"doc": {"name": "Not Allowed"}
		}
	else:
		return {
			"doc": bean.doc,
			"doclist": bean.doclist,
			"webnotes": webnotes,
			"utils": webnotes.utils
		}

def get_currency_and_number_format():
	return {
		"global_number_format": webnotes.conn.get_default("number_format") or "#,###.##",
		"currency": webnotes.conn.get_default("currency"),
		"currency_symbols": json.dumps(dict(webnotes.conn.sql("""select name, symbol
			from tabCurrency where ifnull(enabled,0)=1""")))
	}

def set_missing_values(source, target):
	bean = webnotes.bean(target)
	bean.run_method("onload_post_render")

@webnotes.whitelist()
def make_material_request(source_name, target_doclist=None):
	def postprocess(source, doclist):
		doclist[0].material_request_type = "Purchase"

	doclist = get_mapped_doclist("Sales Order", source_name, {
		"Sales Order": {
			"doctype": "Material Request",
			"validation": {
				"docstatus": ["=", 1]
			}
		},
		"Sales Order Item": {
			"doctype": "Material Request Item",
			"field_map": {
				"parent": "sales_order_no",
				"reserved_warehouse": "warehouse",
				"stock_uom": "uom"
			}
		}
	}, target_doclist, postprocess)

	return [(d if isinstance(d, dict) else d.fields) for d in doclist]

@webnotes.whitelist()
def make_delivery_note(source_name, target_doclist=None):
	def update_item(obj, target, source_parent):
		target.amount = (flt(obj.qty) - flt(obj.delivered_qty)) * flt(obj.basic_rate)
		target.export_amount = (flt(obj.qty) - flt(obj.delivered_qty)) * flt(obj.export_rate)
		target.qty = flt(obj.qty) - flt(obj.delivered_qty)

	doclist = get_mapped_doclist("Sales Order", source_name, {
		"Sales Order": {
			"doctype": "Delivery Note",
			"field_map": {
				"shipping_address": "address_display",
				"shipping_address_name": "customer_address",
			},
			"validation": {
				"docstatus": ["=", 1]
			}
		},
		"Sales Order Item": {
			"doctype": "Delivery Note Item",
			"field_map": {
				"export_rate": "export_rate",
				"name": "prevdoc_detail_docname",
				"parent": "prevdoc_docname",
				"parenttype": "prevdoc_doctype",
				"reserved_warehouse": "warehouse"
			},
			"postprocess": update_item,
			"condition": lambda doc: doc.delivered_qty < doc.qty
		},
		"Sales Taxes and Charges": {
			"doctype": "Sales Taxes and Charges",
			"add_if_empty": True
		},
		"Sales Team": {
			"doctype": "Sales Team",
			"add_if_empty": True
		}
	}, target_doclist, set_missing_values)

	return [d.fields for d in doclist]

@webnotes.whitelist()
def make_sales_invoice(source_name, target_doclist=None):
	def update_item(obj, target, source_parent):
		target.export_amount = flt(obj.export_amount) - flt(obj.billed_amt)
		target.amount = target.export_amount * flt(source_parent.conversion_rate)
		target.qty = obj.export_rate and target.export_amount / flt(obj.export_rate) or obj.qty

	doclist = get_mapped_doclist("Sales Order", source_name, {
		"Sales Order": {
			"doctype": "Sales Invoice",
			"validation": {
				"docstatus": ["=", 1]
			}
		},
		"Sales Order Item": {
			"doctype": "Sales Invoice Item",
			"field_map": {
				"name": "so_detail",
				"parent": "sales_order",
				"reserved_warehouse": "warehouse"
			},
			"postprocess": update_item,
			"condition": lambda doc: doc.amount==0 or doc.billed_amt < doc.export_amount
		},
		"Sales Taxes and Charges": {
			"doctype": "Sales Taxes and Charges",
			"add_if_empty": True
		},
		"Sales Team": {
			"doctype": "Sales Team",
			"add_if_empty": True
		}
	}, target_doclist, set_missing_values)

	return [d.fields for d in doclist]

@webnotes.whitelist()
def make_maintenance_schedule(source_name, target_doclist=None):
	maint_schedule = webnotes.conn.sql("""select t1.name
		from `tabMaintenance Schedule` t1, `tabMaintenance Schedule Item` t2
		where t2.parent=t1.name and t2.prevdoc_docname=%s and t1.docstatus=1""", source_name)

	if not maint_schedule:
		doclist = get_mapped_doclist("Sales Order", source_name, {
			"Sales Order": {
				"doctype": "Maintenance Schedule",
				"field_map": {
					"name": "sales_order_no"
				},
				"validation": {
					"docstatus": ["=", 1]
				}
			},
			"Sales Order Item": {
				"doctype": "Maintenance Schedule Item",
				"field_map": {
					"parent": "prevdoc_docname"
				},
				"add_if_empty": True
			}
		}, target_doclist)

		return [d.fields for d in doclist]

@webnotes.whitelist()
def make_maintenance_visit(source_name, target_doclist=None):
	visit = webnotes.conn.sql("""select t1.name
		from `tabMaintenance Visit` t1, `tabMaintenance Visit Purpose` t2
		where t2.parent=t1.name and t2.prevdoc_docname=%s
		and t1.docstatus=1 and t1.completion_status='Fully Completed'""", source_name)

	if not visit:
		doclist = get_mapped_doclist("Sales Order", source_name, {
			"Sales Order": {
				"doctype": "Maintenance Visit",
				"field_map": {
					"name": "sales_order_no"
				},
				"validation": {
					"docstatus": ["=", 1]
				}
			},
			"Sales Order Item": {
				"doctype": "Maintenance Visit Purpose",
				"field_map": {
					"parent": "prevdoc_docname",
					"parenttype": "prevdoc_doctype"
				},
				"add_if_empty": True
			}
		}, target_doclist)

		return [d.fields for d in doclist]

@webnotes.whitelist()
def make_journal_voucher(source_name, target_doclist=None):
	doc_list = get_mapped_doclist("Sales Order", source_name, {
		"Sales Order Payment": {
			"doctype": "Journal Voucher",
			"field_map": {

			},
			"validation": {
				"mode_of_payment": ["!=", "Cheque"]
			}
		}
	})

@webnotes.whitelist()
def get_project_costs(filenames):
	from ParsePromob import PromobReader  # The file parse
	from webnotes.model.bean import getlist
	# The Item, Sales BOM and Price templates

	enviroment_template = [
		# The Item
		{
			'doctype': 'Item',
			'item_code': '_Item Template_Code',
			'item_name': '_Item Template_Name',
			'description': '__Item Template_Description',
			'brand': 'New',
			'item_group': 'Itens Projetados',
			'stock_uom': 'Un',
			'is_stock_item': 'No',
			'is_purchase_item': 'No',
			'is_sales_item': 'Yes',
			'is_service_item': 'No',
			'is_sample_item': 'No',
			'max_discount': 65,
			'default_income_account': u'Vendas - Grupo Realize Móveis',
			'default_sales_cost_center': u'Auto Inventory Accounting - Grupo Realize Móveis',
		},
		# The Price
		{
			'doctype': 'Item Price',
			'parentfield': 'ref_rate_details',
			'price_list_name': 'Itens Projetados',
			'ref_rate': '_Item Template_Price',
			'ref_currency': 'BRL',
			'buying_or_selling': 'Selling'
		}
	]

	sales_bom_template = [
		# The Sales BOM
		{
			'doctype': 'Sales BOM',
			'new_item_code': '_Item Sales BOM Template_Code',
		},
		# The Sales BOM Item
		{
			'doctype': 'Sales BOM Item',
			'parentfield': 'sales_bom_items',
			'item_code': '_Item Sales BOM Item Template_SubCode',
			'qty': '_Item Sales BOM Item Template_Qty',
			'description': '_Item Sales BOM Item Template_Description',
			'rate': 0,
			'uom': '_Item Sales BOM Item Template_UOM'
		}
	]
	item_template = [
		# The raw item
		{
			'doctype': 'Item',
			'item_code': '_Item Template_Code',
			'item_name': '_Item Template_Name',
			'description': '__Item Template_Description',
			'brand': 'New',
			'item_group': 'Itens Projetados',
			'stock_uom': '__Item Template_UOM',
			'is_stock_item': 'No',
			'is_purchase_item': 'Yes',
			'is_sales_item': 'No',
			'manufacturer_part_no': '_Item Template_Code'
		}
	]


	cost, increase = 0, 0
	items = []

	for project_files in filenames.split(';'):
		reader = PromobReader(project_files)              # Init the parse
		project = reader.getProject()                     # Get the xml root element
		data = project.toDict()                           # Get the item and subitems to compose the sales bom
		cost += data.get('project_cost', 0)               # Get the raw price of the item
		increase += data.get('project_increase', 0)       # Get the project increase

		for i in data.get('items', []):  				  								# Process each item for CAD File
			price = i.pop('price')                       								# Pop the price to append this on your doctype
			subitems = i.pop('subitems')
			try:
				item = webnotes.bean('Item', i['item_code'])                            # First can get the doctype from db
				item.doc.fields.update(i)												# Update the item data based on CAD data
				pricelist = item.doclist.get({'doctype': 'Item Price'})
				if pricelist:
					pricelist[0].ref_rate = price
				item.save()
				                                                                        # Save the item
				sales_bom = webnotes.bean(copy=sales_bom_template[0])
				sales_bom.doc.fields.update({'new_item_code': i['item_code']})

				subcodes = []
				subnames = []
				for subitem in subitems:
					subname = x['item_name']
					subcodes.append(`subname`)
					subnames.append(subname)
				webnotes.msgprint(subitem_codes);
				to_add = sql(
					'SELECT `Item`.`name` FROM `tabItem` WHERE `name` in (%s);'%','.join(subcodes), 
					 as_dict=True
				)
				for subitem in to_add:
					_item = webnotes.bean(copy=item_template[0])
					

			except Exception, e:
				webnotes.msgprint(e)
				item = webnotes.bean(copy=enviroment_template)                          # Make a new item based on template
				item.doc.fields.update(i)                                               # Update the item data based on CAD data
				item.doclist[1].fields.update({'ref_rate': price})                      # Update the price
				item.insert()                                                           # Save the item
			items.append(i['item_code']) # Append item code to

	return {
		'project_cost': cost,
		'project_increase': increase,
		'project_cost_net': cost-increase,
		'items': items
	}

@webnotes.whitelist()
def has_revision(sales_name):
	revisions = {'qty': sql(
		"""
			SELECT count(`tabSales Order`.`name`) as `qty` FROM `tabSales Order`
			WHERE `tabSales Order`.`parent_sales_order`="%s" AND
			`tabSales Order`.docstatus != 2 AND
			`tabSales Order`.modo_complemento == "Revisão"
		"""%sales_name, as_dict=True
		)[0]['qty'],
		'revisions': sql(
		"""
			SELECT
				`tabSales Order`.`name`,
				`tabSales Order`.`transaction_date`,
				`tabSales Order`.`owner`,
				`tabSales Order`.`project_cost`,
				`tabSales Order`.`net_total`-`Sales Order`.`project_amount` as `additional_items`,
				`tabSales Order`.`net_total`
			FROM `tabSales Order`
			WHERE
				`tabSales Order`.`parent_sales_order` = "%s" AND
				`tabSales Order`.`docstatus` != 2
				`tabSales Order`.`modo_complemento` == "Revisão"
			ORDER BY `tabSales Order`.`created_on` ASC
		"""%sales_name, as_dict=True
		)
	}
	return revisions
