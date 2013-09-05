# Copyright (c) 2013, Web Notes Technologies Pvt. Ltd.
# MIT License. See license.txt

# For license information, please see license.txt

from __future__ import unicode_literals
import webnotes
import webnotes.model 

class DocType:
	def __init__(self, d, dl):
		self.doc, self.doclist = d, dl

@webnotes.whitelist()
def import_data():
	import conf
	import os
	import glob

	os.chdir(conf.files_path)
	for filename in glob.glob("*.txt"):
		if not webnotes.conn.get('Etiquetas Log', {'filename': filename}):
			doc = webnotes.bean('Etiquetas Log')
			doc.fields.update({'filename':filename})
			doc.doclist = get_parsed_file(filename)
			doc.save()

def get_parsed_file(filename):
	import re
	re_pattern = re.compile(r'^(?P<seq>[0-9]{5})[0 ]{3}(?P<lote>[0-9]{6})[A-Z ]{50}(?P<pedido>[0-9]{9})(?P<item>[\/\.A-Z0-9 -:)(]{50})[0-9]{2}(?P<etiqueta>[0-9]{3})(?P<embarcado>[01])(?P<barcode>[0-9]{23})(?P<item_code>[A-Z0-9 ]{15})(?P<qty>[0-9]{5})(?P<oc_num>[0-9A-Z- .]{24})[A-Z ]{100}(?P<vol>[0-9]{5})$')
	doclist = []
	with open(filename, 'rb') as filedata:
		for line in filename.xreadlines():
			parsed = re_pattern.match(line)
			if not parsed is None:
				doc = {
					'doctype': 'Etiquetas'
				}
				doc.update(parsed.groups())
				doclist.append(webnotes.bean(copy=doc))
	return doclist