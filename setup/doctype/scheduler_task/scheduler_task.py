# For license information, please see license.txt

from __future__ import unicode_literals
import webnotes

from setup.doctype.scheduler_task import TASK_STATUS, QUEUED, PERIOD_MAPPER
from uuid import uuid4
from json import loads, dumps
from datetime import datetime

class DocType:
	def __init__(self, d, dl):
		self.doc, self.doclist = d, dl

	def validate(self):
		if self.doc.fields.get('__islocal'):
			args={}
			if not self.doc.fields.get('task_uuid'):
				args['task_uuid']=str(uuid4())
			if not self.doc.fields.get('task_next_run_time'):
				if self.doc.fields.get('task_execution_interval') in PERIOD_MAPPER.keys():
					args['task_next_run_time'] = self.task_next_run_time()

		fvars = self.doc.field.get('function_vars')
		try:
			obj.loads(fvars)
		except:
			webnotes.msgprint('Vars contains a invalid json', raise_exception=1)
		else:
			if not isinstance(obj, dict):
				webnotes.msgprint('Vars don\'t contains a Object', raise_exception=1)
	
	def get_task_execution_interval(self):
		return PERIOD_MAPPER.get(self.doc.fields.get('task_execution_interval'), 1) or 1

	def task_next_run_time(self):
		timedelta = datetime.timedelta(seconds = self.get_task_execution_interval())
		return self.doc.fields.get('task_start_time') + timedelta

	def task_stop_time(self):
		if self.docs.fields.get('task_maximun_repeats') > 0:
			interval = self.docs.fields.get('task_maximun_repeats')*self.get_task_execution_interval()
			timedelta = datetime.timedelta(seconds=interval):
			return self.docs.fields.get('task_start_time') + timedelta

	def on_update(self):
		if self.task_start_time()
