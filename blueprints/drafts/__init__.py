from flask import Blueprint

drafts_bp = Blueprint('drafts', __name__, url_prefix='/api/drafts')

from . import routes  # noqa: E402,F401
