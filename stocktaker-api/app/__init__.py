"""Stocktaker API - the shared backend for the web dashboard and the
warehouse-worker mobile app. One database, one set of business rules;
every client (web or mobile) talks to this instead of the database
directly.
"""

__version__ = "0.1.0"
