"""
Формулировки уровней риска — из технического задания, дословно.

Их ставит код по уровню, а не модель: ТЗ запрещает системе выносить заключение
«акт неконституционен», и единственный способ гарантировать это — не давать
модели писать итоговую строку вовсе.
"""

LEVELS = (0, 1, 2, 3)

_WORDING = {
    0: {
        'ru': 'признаков противоречия в рамках автоматизированного анализа не выявлено',
        'kk': 'автоматтандырылған талдау шеңберінде қайшылық белгілері анықталмады',
        'en': 'no signs of conflict were found within the automated analysis',
    },
    1: {
        'ru': 'норма требует экспертной проверки',
        'kk': 'норма сараптамалық тексеруді қажет етеді',
        'en': 'the provision requires expert review',
    },
    2: {
        'ru': 'обнаружено возможное противоречие',
        'kk': 'ықтимал қайшылық анықталды',
        'en': 'a possible conflict was found',
    },
    3: {
        'ru': 'выявлен высокий риск несоответствия',
        'kk': 'сәйкессіздіктің жоғары тәуекелі анықталды',
        'en': 'a high risk of non-conformity was found',
    },
}

CATEGORIES = ('terminology', 'competence', 'rights', 'procedure', 'reference', 'none')

_CATEGORY = {
    'terminology': {'ru': 'орган или институт, которого нет в Конституции 2026',
                    'kk': '2026 жылғы Конституцияда жоқ орган немесе институт',
                    'en': 'a body or institution absent from the 2026 Constitution'},
    'competence': {'ru': 'полномочие закреплено за другим органом или иначе',
                   'kk': 'өкілеттік басқа органға немесе басқаша бекітілген',
                   'en': 'a power is vested differently or in another body'},
    'rights': {'ru': 'сужает право или гарантию Конституции 2026',
               'kk': '2026 жылғы Конституцияның құқығын немесе кепілдігін тарылтады',
               'en': 'narrows a right or guarantee of the 2026 Constitution'},
    'procedure': {'ru': 'порядок, срок или процедура расходятся с Конституцией 2026',
                  'kk': 'тәртіп, мерзім немесе рәсім 2026 жылғы Конституциямен алшақ',
                  'en': 'a procedure, term or order diverges from the 2026 Constitution'},
    'reference': {'ru': 'ссылка на статью Конституции, которой нет или она изменилась',
                  'kk': 'жоқ немесе өзгерген Конституция бабына сілтеме',
                  'en': 'a reference to a Constitution article that is gone or changed'},
    'none': {'ru': 'без замечаний', 'kk': 'ескертусіз', 'en': 'no remarks'},
}


def wording(level: int, lang: str = 'ru') -> str:
    if level not in _WORDING:
        raise ValueError(f'неизвестный уровень {level!r}')
    return _WORDING[level].get(lang) or _WORDING[level]['ru']


def category_label(category: str, lang: str = 'ru') -> str:
    row = _CATEGORY.get(category) or _CATEGORY['none']
    return row.get(lang) or row['ru']
