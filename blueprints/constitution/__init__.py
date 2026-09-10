from flask import Blueprint

constitution_bp = Blueprint('constitution', __name__, url_prefix='/api/constitution')

from . import routes  # noqa: E402,F401
