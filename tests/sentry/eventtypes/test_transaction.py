from __future__ import absolute_import
import time
import six

from sentry.eventtypes import TransactionEvent
from unittest import TestCase


class TransactionEventTest(TestCase):
    def test_get_metadata(self):
        inst = TransactionEvent()
        timestamp = time.time()
        data = {
            'contexts': {
                'trace': {
                    'type': 'trace',
                    'parent_span_id': None,
                    'trace_id': 'deadbeef',
                    'description': '/api/version'
                }
            },
            'transaction': 'api_version',
            'start_timestamp': timestamp,
            'timestamp': timestamp + 2,
        }
        assert inst.get_metadata(data) == {
            'title': '/api/version',
            'location': 'api_version',
            'startTimestamp': timestamp,
            'timestamp': timestamp + 2
        }

    def test_get_metadata_none(self):
        inst = TransactionEvent()
        data = {}
        assert inst.get_metadata(data) == {
            'title': None,
            'location': None,
            'startTimestamp': None,
            'timestamp': None,
        }

    def test_build_search_message(self):
        inst = TransactionEvent()
        timestamp = time.time()
        data = {
            'title': '/api/version',
            'location': 'api_version',
            'startTimestamp': timestamp,
            'timestamp': timestamp + 2
        }
        result = inst.build_search_message('', data)
        assert '/api/version' in result
        assert 'api_version' in result
        assert six.text_type(timestamp) not in result
