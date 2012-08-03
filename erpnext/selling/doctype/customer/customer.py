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
import webnotes.model
from webnotes.utils import cstr, get_defaults
from webnotes.model.doc import Document, make_autoname
from webnotes.model.code import get_obj
from webnotes import msgprint
from webnotes.model.controller import DocListController

class CustomerController(DocListController):
	def autoname(self):
		if get_defaults('cust_master_name') == 'Customer Name':
			if webnotes.conn.exists('Supplier', self.doc.customer):
				msgprint("You already have a Supplier with same name, \
					please change the customer name", raise_exception=1)
			else:
				self.doc.name = self.doc.customer_name
		else:
			self.doc.name = make_autoname(self.doc.naming_series+'.#####')

	def validate(self):
		self.validate_series()

	def validate_series(self):
		""" If master name by naming series, series field mandatory"""
		if get_defaults('cust_master_name') == 'Naming Series' and not self.doc.naming_series:
			msgprint("Series is Mandatory.", raise_exception=webnotes.MandatoryError)

	def on_update(self):
		self.update_lead_status('Converted')
		self.create_account_head()
		self.update_credit_days_limit()
		self.create_address_and_contact()

	def update_lead_status(self, status):
		if self.doc.lead_name:
			webnotes.conn.set_value('Lead', self.doc.lead_name, 'status', status)

	def create_account_head(self):
		""" 
			create customer account head, parent as per 
			receivable group mentioned in company master
		"""
		for comp in webnotes.conn.sql("select name, abbr from `tabCompany`", as_dict=1):
			if not webnotes.conn.exists('Account', self.doc.name+" - "+comp['abbr']):
				ac = get_obj('GL Control').add_ac(cstr({
					'account_name':self.doc.name,
					'parent_account': self.get_receivables_group(comp['name']), 
					'group_or_ledger':'Ledger', 
					'company':comp['name'],
					'master_type':'Customer',
					'master_name':self.doc.name
				}))
				msgprint("Account Head: %s created" % ac)

	def get_receivables_group(self, company):
		rg = webnotes.conn.get_value('Company', company, 'receivables_group')
		if not rg:
			msgprint("Assign a default group for Receivables in company: %s" % company, raise_exception=1)
		return rg

	def update_credit_days_limit(self):
		webnotes.conn.sql("""
			update tabAccount 
			set credit_days = %s, credit_limit = %s
			where master_type = 'Customer' and master_name = %s
		""", (self.doc.credit_days, self.doc.credit_limit, self.doc.name))

	def create_address_and_contact(self):
		""" Create address and contact from lead details"""
		if self.doc.lead_name:
			lead_details = webnotes.conn.sql("""
				select name, lead_name, address_line1, address_line2, city, 
					country, state, pincode, phone, mobile_no, fax, email_id 
				from `tabLead` where name = %s
			""", self.doc.lead_name, as_dict = 1)[0]
				
			
			lead_details.update({
				'customer': self.doc.name,
				'customer_name': self.doc.customer_name,
				'address_type': 'Office', 
				'is_primary_address': 1,
				'first_name': lead_details['lead_name'],
				'is_primary_contact': 1
			})
			
			# create address
			webnotes.model.insert_variants(lead_details, [{'doctype': 'Address'}], ignore_fields=1)			
			# create contact
			#self.create_doc('Contact', lead_details)
			
	
	def on_trash(self):
		self.delete_customer_address_and_contact()
		self.delete_customer_communication()
		self.delete_customer_account()
		self.update_lead_status('Interested')
			
	def delete_customer_address_and_contact(self):
		for dt in ['Address', 'Contact']:
			webnotes.conn.sql("delete from `tab%s` where customer=%s" % ('%s', self.doc.name), dt)

	def delete_customer_communication(self):
		webnotes.conn.webnotes.conn.sql("""delete from `tabCommunication`
			where customer = %s and supplier is null""", self.doc.name)

	def delete_customer_account(self):
		"""delete customer's ledger if exist and check balance before deletion"""
		acc = sql("select name from `tabAccount` where master_type = 'Customer' \
			and master_name = %s", self.doc.name)
		if acc:
			from webnotes.model import delete_doc
			delete_doc('Account', acc[0][0])
			
	def on_rename(self,newdn,olddn):
		"""
			update customer_name in all documents, 
			if customer id is set by customer name
		"""
		if get_defaults().get('cust_master_name') == 'Customer Name':
			for dt in sql("select parent from `tabDocField` \
				where fieldname = 'customer_name' and parent != 'Customer'"):
				sql("update `tab%s` set customer_name = %s where customer = %s" % (dt, '%s', '%s'), newdn, olddn)

		#update new master_name in customer account
		webnotes.conn.sql("update `tabAccount` set master_name = %s, master_type = 'Customer' \
			where master_name = '%s'", (newdn,olddn))