from flask import Blueprint

# Расшифровка голоса для чата.
voice_bp = Blueprint('voice', __name__)

from . import routes  # noqa: E402, F401
