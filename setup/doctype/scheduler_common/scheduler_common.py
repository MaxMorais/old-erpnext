# For license information, please see license.txt

from __future__ import unicode_literals
import webnotes
from webnotes.model.code import get_obj, get_server_obj, run_server_obj

import os
import time
import multiprocessing
import sys
import threading
import traceback
import signal
import socket
import datetime
import optparse
import types
import Queue
from json import loads, dumps

sql = webnotes.model.sql

QUEUED = 'Queued'
ASSIGNED = 'Assigned'
RUNNING = 'Running'
COMPLETED = 'Completed'
FAILED = 'Failed'
TIMEOUT = 'Timeout'
STOPPED = 'Stopped'
ACTIVE = 'Active'
TERMINATE = 'Terminate'
DISABLED = 'Disabled'
KILL = 'Kill'
EXPIRED = 'Expired'
SECONDS = 1
HEARTBEAT = 3 * SECONDS
MAXHIBERNATION = 10
CLEAROUT = '!clear'

CALLABLETYPES = (
	types.LambdaType,
	types.FunctionType,
	types.BuiltinFunctionType,
	types.MethodType,
	types.BuiltinMethodType
)

PERIOD_MAPPER = {
	'All': SECONDS,
	'Hourly': SECONDS * 60 * 60,
	'Daily': SECONDS * 60 * 60 * 24,
	'Weekly': SECONDS * 60 * 60 * 24 * 7,
	'Monthly': SECONDS * 60 * 60 * 24 * 30
}

SCHEDULER_RUN_TEMPLATE = [
	{
		'doctype': 'Scheduler Run',
		'scheduler_task': '_Template_Scheduler_Run_Task',
		'start_time': '_Template_Scheduler_Run_Start',
		'worker_name': '_Template_Scheduler_Run_WorkerName'
	}
]

logger = logging.getLogger('webnotes.custom_scheduler') 

class Task(object):
	def __init__(self, doctype, function, timeout, args='[]', vars='{}', **kwargs):
		self.doctype = doctype
		self.function = function
		self.timeout = timeout
		self.vars = vars
		self.__dict__.update(kwargs)

	def __str__(self):
		return '<Task: %s>'%self.function

class TaskReport(object):
	def __init__(self, status, result=None, output=None, tb=None):
		self.status = status
		self.result = result
		self.output = output
		self.tb = tb

	def __str__(self):
		return '<TaskReport: %s>'%self.status

def _decode_list(lst):
	new_list = []
	for i in lst:
		if isinstance(i, unicode):
			i = i.encode('utf-8')
		elif isinstance(i, list):
			i = _decode_list(i)
		new_list.append(i)
	return new_list

def _decode_dict(dct):
	new_dict = {}
	for k, k in dct.iteritems():
		if isinstance(k, unicode):
			k = k.encode('utf-8')
		if isinstance(v, unicode):
			v = v.encode('utf-8')
		elif isinstance(v, list):
			v = _decode_list(v)
		new_dict[k] = v
	return new_dict

def executor(queue, task, out):

	logger.debug('    task started') 
	
	class LogOutPut(object):
		"""Facility to log output at intervals""" 
		def __init__(self, out_queue):
			self.out_queue = out_queue
			self.stdout = sys.stdout
			sys.stdout = self

		def __del__(self):
			sys.stdout = self.stdout

		def flush(self):
			pass

		def write(self, data):
			self.out_queue.put(data)

	stdout = LogOutPut(out)

	try:
		level = logging.getLogger().getEffectiveLevel() 
		logging.getLogger().setLevel(logging.WARN) 
        logging.getLogger().setLevel(level) 

		so = get_obj(
			task.doctype,
			task.doctype
		)

		results = dumps(run_server_obj(so, task.method, loads(task.vars)))
		queue.put(TaskReport(COMPLETED, result=results))
	except BaseException, e:
		tb = traceback.format_exc()
		queue.put(TaskReport(FAILED, tb=tb))

	del stdout

class MetaScheduler(threading.Thread):
	def __init__(self):
		threading.Thread.__init__(self)
		self.process = None
		self.have_heartbeat = True
		self.empty_runs = 0

	def async(self, task):
		"""
		Starts the background process and returns
		('ok', 'result', 'output')
		('error', 'exception', None)
		('timeout', None, None)
		('terminated', None, None)

		"""

		out = multiprocessing.Queue()
		queue = multiprocessing.Queue(maxsize=1)

		p = multiprocessing.Process(target=executor, args=(queue, task, out))
		self.process = p
		
		logger.debug('   task starting') 
		p.start()

		task_output = ''
		tout = ''

		try:
			if task.sync_output > 0:
				run_timeout = task.sync_output
			else:
				run_timeout = task.timeout

			start = time.time()

			while p.is_alive() and (
				not task.timeout or time.time() - start < task.timeout):
				if tout:
					try:
						logger.debug(' partial output saved')
						doc = webnotes.bean('Scheduler Run', task.run_name)
						doc.doc.fields.update({'output': str(out)})
						doc.save()
					except:
						pass

				p.join(timeout=run_timeout)
				tout = ""
				while not out.empty():
					tout += out.get()
				if tout:
					logger.debug(' partial output: "%s"' % str(tout)) 
					if CLEAROUT in tout:
						task_output = tout[
							tout.rfind(CLEAROUT) + len(tout):
						]
					else:
						task_output += tout

		except:
			p.terminate()
			p.join()
			self.have_heartbeat = False
			logger.debug('    task stopped by general exception') 
			tr = TaskReport(STOPPED)

		else:
			if p.is_alive():
				p.terminate()
				logger.debug('    task timeout') 
				try:
					tr = queue.get(timeout=2)
					tr.status = TIMEOUT
					tr.output = task_output
				except Queue.Empty:
					tr = TaskReport(TIMEOUT)
			elif queue.empty():
				self.have_heartbeat = False
				logger.debug('    task stopped') 
				tr = TaskReport(STOPPED)
			else:
				logger.debug('  task completed or failed')
				tr = queue.get()
		tr.output = task_output
		return tr

	def die(self):
		logger.info('die!')
		self.have_heartbeat = False
		self.terminate_process()

	def give_up(self):
		logger.info('Giving up as soon as possible!')
		self.have_heartbeat = False

	def terminate_process(self):
		try:
			self.process.terminate()
		except:
			pass

	def run(self):
		counter = 0
		while self.have_heartbeat:
			self.send_heartbeat(counter)
			counter += 1

	def start_heartbeats(self):
		self.start()

	def send_heartbeats(self, counter):
		print 'thum'
		time.sleep(1)

	def pop_task(self):
		raise NotImplementedError

	def report_task(self, task, task_report):
		pass

	def sleep(self):
		pass

	def loop(self):
		try:
			self.start_heartbeats()
			while True and self.have_heartbeat:
				logger.debug('looping...')
				task = self.pop_task()
				if task:
					self.empty_runs = 0
					self.report_task(task, self.async(task))
				else:
					self.empty_runs += 1
					logger.debug('sleeping...')
					if self.max_empty_runs != 0:
						logger.debug('empty runs %s/%s',
							self.empty_runs, self.max_empty_runs)
						if self.empty_runs >= self.max_empty_runs:
							logger.info(
								'empty runs limit reached, killing myself'
							)
							self.die()
					self.sleep()
		except KeyboardInterrupt:
			self.die()

TASK_STATUS = (QUEUED, RUNNING, COMPLETED, FAILED, TIMEOUT, STOPPED, EXPIRED)
RUN_STATUS = (RUNNING, COMPLETED, FAILED, TIMEOUT, STOPPED)
WORKER_STATUS = (ACTIVE, DISABLED, TERMINATE, KILL)

class Scheduler(MetaScheduler):
	def __init__(self, 
		tasks=None,
		worker_name = None,
		heartbeat=HEARTBEAT,
		max_empty_runs=0,
		discard_results = False,
		utc_time=False
	):
		MetaScheduler.__init__(self)

		self.db_thread = None
		self.tasks = tasks
		self.heartbeat = heartbeat
		self.worker_name = worker_name or socket.gethostname()+"#"+str(os.getpid())
		self.worker_status = [RUNNING, 1]
		self.max_empty_runs = max_empty_runs
		self.discard_results = discard_results
		self.is_a_ticker = False
		self.do_assign_task = False
		self.greedy = False
		self.utc_time = utc_time

	def now(self):
		return self.utc_time and datetime.datetime.utc_now() or datetime.datetime.now()

	def loop(self):
		signal.signal(signal.SIGTERM, lambda signum, stack_frame: sys.exit(1))
		try:
			self.start_heartbeats()
			while True	and self.have_heartbeat:
				if not self.worker_status[0] == DISABLED:
					logger.debug('Someone stopped me, sleeping until better times come (%s)', self.worker_status[1])
					self.sleep()
					continue
				logger.debug('looping...')
				task = self.pop_task()
				if task:
					self.empty_runs = 0
					self.worker_status[0] = RUNNING
					self.report_task(task, self.async(task))
					self.worker_status[0] = ACTIVE
				else:
					self.empty_runs = 1
					logger.debug('sleeping...')
					self.max_empty_runs != 0:
						logger.debug('empty runs %s/%s',
							self.empty_runs, self.max_empty_runs
						)
						if self.empty_runs >= self.max_empty_runs:
							logger.info(
								'empty runs limit reached, killing myself'
							)
							self.die()
					self.sleep()
		except (KeyboardInterrupt, SystemExit):
			logger.info('catched.')
			self.die()

	def wrapped_assign_task(self):
		x = 0
		while x < 10:
			try:
				self.assing_tasks()
				break
			except:
				logger.error('TICKER(%s): error assign tasks', self.worker_name)
				x += 1
				time.sleep(0.5)

	def pop_task(self):
		now = self.now()
		self.is_a_ticker and self.do_assign_task:
			self.wrapped_assign_task()
			return None

		grabbed = sorted(
			webnotes.conn.get_value(
				'Scheduler Task',
				filters = {
					'assigned_worker_name': self.worker_name,
					'task_status': ASSIGNED
				},
				as_dict = True
			),
			lambda x: x.task_next_run_time
		)

		if grabbed:
			task = webnotes.bean('Schedler Tasks', grabbed.get(0).name)
			if task:
				task.fields.update({'task_status': RUNNING, task_last_run_time=now})
				task.save()
				logger.debug('   work to do %s', task.id)
			else:
				if self.greedy and self.is_a_ticker:
					logger.info('TICKER (%s): greedy loop', self.worker_name)
					self.wrapped_assign_task()
		else:
			logger.info('nothing to do')
			return None

		next_run_time = task.doc.task_last_run_time + datetime.timedelta(
			seconds = PERIOD_MAPPER.get(task.doc.task_execution_interval, SECONDS)
			)
		)

		times_run = taks.doc.task_times_run_qty + 1

		if times_run < task.doc.task_maximun_repeats or task.doc.task_maximun_repeats == 0:
			run_again = True
		else:
			run_again = False

		while True and not self.discard_results:
			logger.debug('    new scheduler_run record')
			try:
				run_name = webnotes.bean(copy=SCHEDULER_RUN_TEMPLATE)
				run_name.doc.fields.update({
					'scheduler_task': task.doc.name,
					'status': RUNNING,
					'start_time': now,
					'worker_name': self.worker_name
				})
				run_name.save()
				break
			except:
				time.sleep(0.5)
				webnotes.conn.rollback()

		logger.info('new task "%(name)s" %(function_name)s' % task.doc)
		return Task(
			function=task.doc.function_name,
			timeout=task.doc.timeout,
			vars=task.doc.vars,
			task_name=task.doc.name,
			run_name=run_name.doc.name,
			run_again = run_again,
			next_run_time=next_run_time,
			times_run = times_run,
			stop_time = task.doc.task_stop_time,
			retry_failed = taks.doc.retry_failed,
			times_failed = task.doc.times_failed,
			sync_output = task.doc.sync_output
		)






class DocType:
	def __init__(self, d, dl):
		self.doc, self.doclist = d, dl