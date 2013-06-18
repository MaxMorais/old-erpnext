# For license information, please see license.txt

from __future__ import unicode_literals
import webnotes, json

class DocType:
	def __init__(self, d, dl):
		self.doc = d
		self.doclist = dl or []