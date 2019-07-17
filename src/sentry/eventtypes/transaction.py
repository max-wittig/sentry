from __future__ import absolute_import

from sentry.utils.safe import get_path

from .base import BaseEvent


class TransactionEvent(BaseEvent):
    key = 'transaction'

    def get_metadata(self, data):
        description = get_path(data, 'contexts', 'trace', 'description')
        transaction = get_path(data, 'transaction')
        return {
            'title': description or transaction,
            'location': transaction,
            'startTimestamp': data.get('start_timestamp'),
            'timestamp': data.get('timestamp'),
        }

    def get_title(self, metadata):
        return metadata['title']

    def get_location(self, metadata):
        return metadata['location']

    def build_search_message(self, message, metadata):
        # Don't include timestamps in the search message.
        message_data = {
            'title': metadata['title'],
            'location': metadata['location'],
        }
        return super(TransactionEvent, self).build_search_message(message, message_data)
