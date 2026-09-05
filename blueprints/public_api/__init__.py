from flask import Blueprint

# Публичный API для сторонних программ. Префикс /api/v1.
public_api_bp = Blueprint('public_api', __name__, url_prefix='/api/v1')

from . import routes  # noqa: E402, F401
