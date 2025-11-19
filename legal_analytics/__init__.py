"""
Модуль правовой аналитики для анализа комментариев к законопроектам
"""

from .analyzer import LegalCommentAnalyzer
from .dashboard import AnalyticsDashboard
from .data_loader import DataLoader

__all__ = ['LegalCommentAnalyzer', 'AnalyticsDashboard', 'DataLoader'] 