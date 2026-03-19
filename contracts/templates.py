"""
Шаблоны договоров для Республики Казахстан.
Содержит определения 9 типов договоров с полями, секциями и промпт-шаблонами.
"""


class ContractTemplates:
    """Управление шаблонами договоров РК."""

    COMMON_FIELDS = [
        {
            'name': 'party1_name',
            'label_ru': 'Наименование/ФИО Стороны 1',
            'label_kz': '1-тарап атауы/аты-жөні',
            'label_en': 'Party 1 Name',
            'type': 'text',
            'required': True,
        },
        {
            'name': 'party1_iin_bin',
            'label_ru': 'ИИН/БИН Стороны 1',
            'label_kz': '1-тарап ЖСН/БСН',
            'label_en': 'Party 1 IIN/BIN',
            'type': 'text',
            'required': True,
        },
        {
            'name': 'party1_address',
            'label_ru': 'Адрес Стороны 1',
            'label_kz': '1-тарап мекенжайы',
            'label_en': 'Party 1 Address',
            'type': 'text',
            'required': True,
        },
        {
            'name': 'party2_name',
            'label_ru': 'Наименование/ФИО Стороны 2',
            'label_kz': '2-тарап атауы/аты-жөні',
            'label_en': 'Party 2 Name',
            'type': 'text',
            'required': True,
        },
        {
            'name': 'party2_iin_bin',
            'label_ru': 'ИИН/БИН Стороны 2',
            'label_kz': '2-тарап ЖСН/БСН',
            'label_en': 'Party 2 IIN/BIN',
            'type': 'text',
            'required': True,
        },
        {
            'name': 'party2_address',
            'label_ru': 'Адрес Стороны 2',
            'label_kz': '2-тарап мекенжайы',
            'label_en': 'Party 2 Address',
            'type': 'text',
            'required': True,
        },
        {
            'name': 'city',
            'label_ru': 'Город',
            'label_kz': 'Қала',
            'label_en': 'City',
            'type': 'text',
            'required': True,
        },
        {
            'name': 'contract_date',
            'label_ru': 'Дата договора',
            'label_kz': 'Шарт күні',
            'label_en': 'Contract Date',
            'type': 'date',
            'required': True,
        },
    ]

    CONTRACT_TYPES = {
        'sale': {
            'id': 'sale',
            'name_ru': 'Купля-продажа',
            'name_kz': 'Сатып алу-сату',
            'name_en': 'Sale and Purchase',
            'icon': 'fa-shopping-cart',
            'description_ru': 'Договор купли-продажи товаров, имущества или имущественных прав',
            'description_kz': 'Тауарларды, мүлікті немесе мүліктік құқықтарды сатып алу-сату шарты',
            'description_en': 'Agreement for sale and purchase of goods, property or property rights',
            'legal_basis': 'ГК РК Особенная часть, глава 25',
            'sections': [
                'Предмет договора',
                'Цена и порядок расчётов',
                'Условия передачи товара',
                'Качество и гарантии',
                'Права и обязанности сторон',
                'Ответственность сторон',
                'Форс-мажор',
                'Порядок разрешения споров',
                'Заключительные положения',
                'Реквизиты и подписи сторон',
            ],
            'fields': [
                {
                    'name': 'subject',
                    'label_ru': 'Предмет договора (описание товара)',
                    'label_kz': 'Шарт мәні (тауар сипаттамасы)',
                    'label_en': 'Subject (goods description)',
                    'type': 'textarea',
                    'required': True,
                },
                {
                    'name': 'price',
                    'label_ru': 'Цена (тенге)',
                    'label_kz': 'Бағасы (теңге)',
                    'label_en': 'Price (KZT)',
                    'type': 'number',
                    'required': True,
                },
                {
                    'name': 'payment_terms',
                    'label_ru': 'Порядок оплаты',
                    'label_kz': 'Төлем тәртібі',
                    'label_en': 'Payment Terms',
                    'type': 'select',
                    'required': True,
                    'options': [
                        {'value': 'prepayment', 'label_ru': 'Предоплата 100%', 'label_kz': 'Алдын ала 100% төлем', 'label_en': '100% Prepayment'},
                        {'value': 'postpayment', 'label_ru': 'Оплата после передачи', 'label_kz': 'Тапсырғаннан кейін төлем', 'label_en': 'Payment after delivery'},
                        {'value': 'installment', 'label_ru': 'Рассрочка', 'label_kz': 'Бөліп төлеу', 'label_en': 'Installment'},
                        {'value': 'partial_prepayment', 'label_ru': 'Частичная предоплата', 'label_kz': 'Ішінара алдын ала төлем', 'label_en': 'Partial prepayment'},
                    ],
                },
                {
                    'name': 'delivery_terms',
                    'label_ru': 'Условия передачи товара',
                    'label_kz': 'Тауарды тапсыру шарттары',
                    'label_en': 'Delivery Terms',
                    'type': 'textarea',
                    'required': True,
                },
                {
                    'name': 'warranty',
                    'label_ru': 'Гарантийный срок',
                    'label_kz': 'Кепілдік мерзімі',
                    'label_en': 'Warranty Period',
                    'type': 'text',
                    'required': False,
                },
            ],
        },
        'lease': {
            'id': 'lease',
            'name_ru': 'Аренда',
            'name_kz': 'Жалға алу',
            'name_en': 'Lease',
            'icon': 'fa-building',
            'description_ru': 'Договор аренды имущества (недвижимость, оборудование, транспорт)',
            'description_kz': 'Мүлікті жалға алу шарты (жылжымайтын мүлік, жабдық, көлік)',
            'description_en': 'Lease agreement for property (real estate, equipment, transport)',
            'legal_basis': 'ГК РК Особенная часть, глава 29',
            'sections': [
                'Предмет договора',
                'Срок аренды',
                'Арендная плата и порядок расчётов',
                'Права и обязанности арендодателя',
                'Права и обязанности арендатора',
                'Условия использования имущества',
                'Ответственность сторон',
                'Досрочное расторжение',
                'Форс-мажор',
                'Порядок разрешения споров',
                'Заключительные положения',
                'Реквизиты и подписи сторон',
            ],
            'fields': [
                {
                    'name': 'property_description',
                    'label_ru': 'Описание имущества',
                    'label_kz': 'Мүлік сипаттамасы',
                    'label_en': 'Property Description',
                    'type': 'textarea',
                    'required': True,
                },
                {
                    'name': 'lease_term',
                    'label_ru': 'Срок аренды',
                    'label_kz': 'Жалға алу мерзімі',
                    'label_en': 'Lease Term',
                    'type': 'text',
                    'required': True,
                },
                {
                    'name': 'rent_amount',
                    'label_ru': 'Арендная плата (тенге/мес)',
                    'label_kz': 'Жалдау ақысы (теңге/ай)',
                    'label_en': 'Rent Amount (KZT/month)',
                    'type': 'number',
                    'required': True,
                },
                {
                    'name': 'purpose',
                    'label_ru': 'Цели использования',
                    'label_kz': 'Пайдалану мақсаттары',
                    'label_en': 'Purpose of Use',
                    'type': 'text',
                    'required': True,
                },
                {
                    'name': 'deposit',
                    'label_ru': 'Обеспечительный депозит (тенге)',
                    'label_kz': 'Кепілдік депозит (теңге)',
                    'label_en': 'Security Deposit (KZT)',
                    'type': 'number',
                    'required': False,
                },
            ],
        },
        'services': {
            'id': 'services',
            'name_ru': 'Оказание услуг',
            'name_kz': 'Қызмет көрсету',
            'name_en': 'Services',
            'icon': 'fa-handshake',
            'description_ru': 'Договор возмездного оказания услуг',
            'description_kz': 'Ақылы қызмет көрсету шарты',
            'description_en': 'Paid services agreement',
            'legal_basis': 'ГК РК Особенная часть, глава 33',
            'sections': [
                'Предмет договора',
                'Перечень и объём услуг',
                'Сроки оказания услуг',
                'Стоимость и порядок оплаты',
                'Порядок сдачи-приёмки услуг',
                'Права и обязанности сторон',
                'Ответственность сторон',
                'Конфиденциальность',
                'Форс-мажор',
                'Порядок разрешения споров',
                'Заключительные положения',
                'Реквизиты и подписи сторон',
            ],
            'fields': [
                {
                    'name': 'service_description',
                    'label_ru': 'Описание услуг',
                    'label_kz': 'Қызметтер сипаттамасы',
                    'label_en': 'Service Description',
                    'type': 'textarea',
                    'required': True,
                },
                {
                    'name': 'service_cost',
                    'label_ru': 'Стоимость услуг (тенге)',
                    'label_kz': 'Қызмет құны (теңге)',
                    'label_en': 'Service Cost (KZT)',
                    'type': 'number',
                    'required': True,
                },
                {
                    'name': 'service_term',
                    'label_ru': 'Срок оказания услуг',
                    'label_kz': 'Қызмет көрсету мерзімі',
                    'label_en': 'Service Term',
                    'type': 'text',
                    'required': True,
                },
                {
                    'name': 'acceptance_procedure',
                    'label_ru': 'Порядок приёмки',
                    'label_kz': 'Қабылдау тәртібі',
                    'label_en': 'Acceptance Procedure',
                    'type': 'select',
                    'required': True,
                    'options': [
                        {'value': 'act', 'label_ru': 'Акт выполненных работ', 'label_kz': 'Орындалған жұмыстар актісі', 'label_en': 'Completion Act'},
                        {'value': 'report', 'label_ru': 'Отчёт об оказании услуг', 'label_kz': 'Қызмет көрсету туралы есеп', 'label_en': 'Service Report'},
                        {'value': 'auto', 'label_ru': 'Автоматическая приёмка', 'label_kz': 'Автоматты қабылдау', 'label_en': 'Automatic Acceptance'},
                    ],
                },
            ],
        },
        'employment': {
            'id': 'employment',
            'name_ru': 'Трудовой договор',
            'name_kz': 'Еңбек шарты',
            'name_en': 'Employment Contract',
            'icon': 'fa-user-tie',
            'description_ru': 'Трудовой договор между работодателем и работником',
            'description_kz': 'Жұмыс беруші мен қызметкер арасындағы еңбек шарты',
            'description_en': 'Employment contract between employer and employee',
            'legal_basis': 'ТК РК, глава 4',
            'sections': [
                'Предмет договора',
                'Срок действия договора',
                'Условия труда и рабочее место',
                'Режим работы и отдыха',
                'Оплата труда',
                'Права и обязанности работодателя',
                'Права и обязанности работника',
                'Социальное страхование и гарантии',
                'Ответственность сторон',
                'Основания прекращения договора',
                'Заключительные положения',
                'Реквизиты и подписи сторон',
            ],
            'fields': [
                {
                    'name': 'position',
                    'label_ru': 'Должность',
                    'label_kz': 'Лауазым',
                    'label_en': 'Position',
                    'type': 'text',
                    'required': True,
                },
                {
                    'name': 'salary',
                    'label_ru': 'Заработная плата (тенге/мес)',
                    'label_kz': 'Жалақы (теңге/ай)',
                    'label_en': 'Salary (KZT/month)',
                    'type': 'number',
                    'required': True,
                },
                {
                    'name': 'work_schedule',
                    'label_ru': 'Режим работы',
                    'label_kz': 'Жұмыс кестесі',
                    'label_en': 'Work Schedule',
                    'type': 'select',
                    'required': True,
                    'options': [
                        {'value': 'standard', 'label_ru': 'Стандартный (5/2, 8 часов)', 'label_kz': 'Стандартты (5/2, 8 сағат)', 'label_en': 'Standard (5/2, 8 hours)'},
                        {'value': 'shift', 'label_ru': 'Сменный', 'label_kz': 'Ауысымдық', 'label_en': 'Shift work'},
                        {'value': 'flexible', 'label_ru': 'Гибкий', 'label_kz': 'Икемді', 'label_en': 'Flexible'},
                        {'value': 'remote', 'label_ru': 'Дистанционный', 'label_kz': 'Қашықтықтан', 'label_en': 'Remote'},
                    ],
                },
                {
                    'name': 'probation',
                    'label_ru': 'Испытательный срок',
                    'label_kz': 'Сынақ мерзімі',
                    'label_en': 'Probation Period',
                    'type': 'select',
                    'required': False,
                    'options': [
                        {'value': 'none', 'label_ru': 'Без испытательного срока', 'label_kz': 'Сынақ мерзімісіз', 'label_en': 'No probation'},
                        {'value': '1month', 'label_ru': '1 месяц', 'label_kz': '1 ай', 'label_en': '1 month'},
                        {'value': '2months', 'label_ru': '2 месяца', 'label_kz': '2 ай', 'label_en': '2 months'},
                        {'value': '3months', 'label_ru': '3 месяца', 'label_kz': '3 ай', 'label_en': '3 months'},
                    ],
                },
                {
                    'name': 'start_date',
                    'label_ru': 'Дата начала работы',
                    'label_kz': 'Жұмыс басталу күні',
                    'label_en': 'Start Date',
                    'type': 'date',
                    'required': True,
                },
                {
                    'name': 'vacation_days',
                    'label_ru': 'Оплачиваемый отпуск (календарных дней)',
                    'label_kz': 'Ақылы демалыс (күнтізбелік күн)',
                    'label_en': 'Paid Vacation (calendar days)',
                    'type': 'number',
                    'required': False,
                },
            ],
        },
        'loan': {
            'id': 'loan',
            'name_ru': 'Займ',
            'name_kz': 'Қарыз',
            'name_en': 'Loan',
            'icon': 'fa-money-bill-wave',
            'description_ru': 'Договор займа денежных средств',
            'description_kz': 'Ақшалай қаражат қарыз шарты',
            'description_en': 'Monetary loan agreement',
            'legal_basis': 'ГК РК Особенная часть, глава 36',
            'sections': [
                'Предмет договора',
                'Сумма и валюта займа',
                'Проценты',
                'Порядок предоставления займа',
                'Порядок и сроки возврата',
                'Права и обязанности сторон',
                'Ответственность сторон',
                'Обеспечение обязательств',
                'Форс-мажор',
                'Порядок разрешения споров',
                'Заключительные положения',
                'Реквизиты и подписи сторон',
            ],
            'fields': [
                {
                    'name': 'loan_amount',
                    'label_ru': 'Сумма займа (тенге)',
                    'label_kz': 'Қарыз сомасы (теңге)',
                    'label_en': 'Loan Amount (KZT)',
                    'type': 'number',
                    'required': True,
                },
                {
                    'name': 'interest_rate',
                    'label_ru': 'Процентная ставка (% годовых)',
                    'label_kz': 'Пайыздық мөлшерлеме (% жылдық)',
                    'label_en': 'Interest Rate (% per annum)',
                    'type': 'number',
                    'required': True,
                },
                {
                    'name': 'loan_term',
                    'label_ru': 'Срок займа',
                    'label_kz': 'Қарыз мерзімі',
                    'label_en': 'Loan Term',
                    'type': 'text',
                    'required': True,
                },
                {
                    'name': 'repayment_schedule',
                    'label_ru': 'График погашения',
                    'label_kz': 'Өтеу кестесі',
                    'label_en': 'Repayment Schedule',
                    'type': 'select',
                    'required': True,
                    'options': [
                        {'value': 'lump_sum', 'label_ru': 'Единовременно в конце срока', 'label_kz': 'Мерзім соңында бір жолғы', 'label_en': 'Lump sum at end'},
                        {'value': 'monthly', 'label_ru': 'Ежемесячно равными долями', 'label_kz': 'Ай сайын тең үлестермен', 'label_en': 'Monthly equal installments'},
                        {'value': 'quarterly', 'label_ru': 'Ежеквартально', 'label_kz': 'Тоқсан сайын', 'label_en': 'Quarterly'},
                    ],
                },
                {
                    'name': 'collateral',
                    'label_ru': 'Обеспечение (залог/поручительство)',
                    'label_kz': 'Қамтамасыз ету (кепіл/кепілдік)',
                    'label_en': 'Collateral',
                    'type': 'textarea',
                    'required': False,
                },
            ],
        },
        'supply': {
            'id': 'supply',
            'name_ru': 'Поставка',
            'name_kz': 'Жеткізу',
            'name_en': 'Supply',
            'icon': 'fa-truck',
            'description_ru': 'Договор поставки товаров для предпринимательской деятельности',
            'description_kz': 'Кәсіпкерлік қызмет үшін тауарлар жеткізу шарты',
            'description_en': 'Supply agreement for business goods',
            'legal_basis': 'ГК РК Особенная часть, глава 25',
            'sections': [
                'Предмет договора',
                'Количество и ассортимент',
                'Качество и комплектность',
                'Сроки и порядок поставки',
                'Цена и порядок расчётов',
                'Тара и упаковка',
                'Приёмка товара',
                'Права и обязанности сторон',
                'Ответственность сторон',
                'Форс-мажор',
                'Порядок разрешения споров',
                'Заключительные положения',
                'Реквизиты и подписи сторон',
            ],
            'fields': [
                {
                    'name': 'goods_description',
                    'label_ru': 'Наименование и описание товаров',
                    'label_kz': 'Тауарлардың атауы және сипаттамасы',
                    'label_en': 'Goods Description',
                    'type': 'textarea',
                    'required': True,
                },
                {
                    'name': 'total_amount',
                    'label_ru': 'Общая сумма поставки (тенге)',
                    'label_kz': 'Жеткізудің жалпы сомасы (теңге)',
                    'label_en': 'Total Supply Amount (KZT)',
                    'type': 'number',
                    'required': True,
                },
                {
                    'name': 'delivery_schedule',
                    'label_ru': 'График поставки',
                    'label_kz': 'Жеткізу кестесі',
                    'label_en': 'Delivery Schedule',
                    'type': 'textarea',
                    'required': True,
                },
                {
                    'name': 'delivery_address',
                    'label_ru': 'Адрес доставки',
                    'label_kz': 'Жеткізу мекенжайы',
                    'label_en': 'Delivery Address',
                    'type': 'text',
                    'required': True,
                },
                {
                    'name': 'penalty_rate',
                    'label_ru': 'Неустойка за просрочку (% в день)',
                    'label_kz': 'Мерзімін өткізгені үшін тұрақсыздық айыпақы (% күніне)',
                    'label_en': 'Late Delivery Penalty (% per day)',
                    'type': 'number',
                    'required': False,
                },
            ],
        },
        'construction': {
            'id': 'construction',
            'name_ru': 'Подряд',
            'name_kz': 'Мердігерлік',
            'name_en': 'Construction Contract',
            'icon': 'fa-hard-hat',
            'description_ru': 'Договор подряда на выполнение строительных или иных работ',
            'description_kz': 'Құрылыс немесе өзге жұмыстарды орындауға мердігерлік шарт',
            'description_en': 'Contract for construction or other works',
            'legal_basis': 'ГК РК Особенная часть, глава 32',
            'sections': [
                'Предмет договора',
                'Сроки выполнения работ',
                'Стоимость и порядок оплаты',
                'Порядок выполнения работ',
                'Материалы и оборудование',
                'Сдача-приёмка работ',
                'Гарантии качества',
                'Права и обязанности заказчика',
                'Права и обязанности подрядчика',
                'Ответственность сторон',
                'Форс-мажор',
                'Порядок разрешения споров',
                'Заключительные положения',
                'Реквизиты и подписи сторон',
            ],
            'fields': [
                {
                    'name': 'work_description',
                    'label_ru': 'Описание работ',
                    'label_kz': 'Жұмыстар сипаттамасы',
                    'label_en': 'Work Description',
                    'type': 'textarea',
                    'required': True,
                },
                {
                    'name': 'work_cost',
                    'label_ru': 'Стоимость работ (тенге)',
                    'label_kz': 'Жұмыс құны (теңге)',
                    'label_en': 'Work Cost (KZT)',
                    'type': 'number',
                    'required': True,
                },
                {
                    'name': 'work_deadline',
                    'label_ru': 'Срок выполнения работ',
                    'label_kz': 'Жұмыстарды орындау мерзімі',
                    'label_en': 'Work Deadline',
                    'type': 'text',
                    'required': True,
                },
                {
                    'name': 'materials_provider',
                    'label_ru': 'Кто предоставляет материалы',
                    'label_kz': 'Материалдарды кім ұсынады',
                    'label_en': 'Materials Provider',
                    'type': 'select',
                    'required': True,
                    'options': [
                        {'value': 'contractor', 'label_ru': 'Подрядчик', 'label_kz': 'Мердігер', 'label_en': 'Contractor'},
                        {'value': 'client', 'label_ru': 'Заказчик', 'label_kz': 'Тапсырыс беруші', 'label_en': 'Client'},
                        {'value': 'both', 'label_ru': 'Совместно', 'label_kz': 'Бірлесіп', 'label_en': 'Both parties'},
                    ],
                },
                {
                    'name': 'warranty_period',
                    'label_ru': 'Гарантийный срок на работы',
                    'label_kz': 'Жұмыстарға кепілдік мерзімі',
                    'label_en': 'Warranty Period',
                    'type': 'text',
                    'required': False,
                },
            ],
        },
        'nda': {
            'id': 'nda',
            'name_ru': 'Конфиденциальность',
            'name_kz': 'Құпиялылық',
            'name_en': 'Non-Disclosure Agreement',
            'icon': 'fa-lock',
            'description_ru': 'Соглашение о неразглашении конфиденциальной информации (NDA)',
            'description_kz': 'Құпия ақпаратты жарияламау туралы келісім (NDA)',
            'description_en': 'Non-disclosure agreement (NDA)',
            'legal_basis': 'ГК РК Общая часть, ст. 126; Закон РК «О коммерческой тайне»',
            'sections': [
                'Предмет соглашения',
                'Определение конфиденциальной информации',
                'Исключения из конфиденциальной информации',
                'Обязательства принимающей стороны',
                'Срок действия обязательств',
                'Порядок обращения с информацией',
                'Ответственность за нарушение',
                'Порядок разрешения споров',
                'Заключительные положения',
                'Реквизиты и подписи сторон',
            ],
            'fields': [
                {
                    'name': 'confidential_info_scope',
                    'label_ru': 'Описание конфиденциальной информации',
                    'label_kz': 'Құпия ақпараттың сипаттамасы',
                    'label_en': 'Scope of Confidential Information',
                    'type': 'textarea',
                    'required': True,
                },
                {
                    'name': 'nda_term',
                    'label_ru': 'Срок действия обязательств',
                    'label_kz': 'Міндеттемелердің қолданылу мерзімі',
                    'label_en': 'NDA Term',
                    'type': 'text',
                    'required': True,
                },
                {
                    'name': 'nda_purpose',
                    'label_ru': 'Цель раскрытия информации',
                    'label_kz': 'Ақпаратты ашу мақсаты',
                    'label_en': 'Purpose of Disclosure',
                    'type': 'textarea',
                    'required': True,
                },
                {
                    'name': 'penalty_amount',
                    'label_ru': 'Штраф за нарушение (тенге)',
                    'label_kz': 'Бұзғаны үшін айыппұл (теңге)',
                    'label_en': 'Penalty for Breach (KZT)',
                    'type': 'number',
                    'required': False,
                },
            ],
        },
        'agency': {
            'id': 'agency',
            'name_ru': 'Агентский договор',
            'name_kz': 'Агенттік шарт',
            'name_en': 'Agency Agreement',
            'icon': 'fa-users',
            'description_ru': 'Агентский договор / договор поручения',
            'description_kz': 'Агенттік шарт / тапсырма шарты',
            'description_en': 'Agency agreement / mandate contract',
            'legal_basis': 'ГК РК Особенная часть, глава 41',
            'sections': [
                'Предмет договора',
                'Полномочия агента',
                'Вознаграждение агента',
                'Порядок оказания и отчётности',
                'Права и обязанности принципала',
                'Права и обязанности агента',
                'Ответственность сторон',
                'Срок действия и расторжение',
                'Конфиденциальность',
                'Форс-мажор',
                'Порядок разрешения споров',
                'Заключительные положения',
                'Реквизиты и подписи сторон',
            ],
            'fields': [
                {
                    'name': 'agency_scope',
                    'label_ru': 'Предмет поручения / полномочия агента',
                    'label_kz': 'Тапсырма мәні / агент өкілеттіктері',
                    'label_en': 'Agency Scope / Agent Authority',
                    'type': 'textarea',
                    'required': True,
                },
                {
                    'name': 'agent_fee',
                    'label_ru': 'Вознаграждение агента (тенге или %)',
                    'label_kz': 'Агент сыйақысы (теңге немесе %)',
                    'label_en': 'Agent Fee (KZT or %)',
                    'type': 'text',
                    'required': True,
                },
                {
                    'name': 'agency_term',
                    'label_ru': 'Срок действия договора',
                    'label_kz': 'Шарттың қолданылу мерзімі',
                    'label_en': 'Agreement Term',
                    'type': 'text',
                    'required': True,
                },
                {
                    'name': 'reporting_frequency',
                    'label_ru': 'Периодичность отчётов',
                    'label_kz': 'Есеп беру мерзімділігі',
                    'label_en': 'Reporting Frequency',
                    'type': 'select',
                    'required': True,
                    'options': [
                        {'value': 'weekly', 'label_ru': 'Еженедельно', 'label_kz': 'Апта сайын', 'label_en': 'Weekly'},
                        {'value': 'monthly', 'label_ru': 'Ежемесячно', 'label_kz': 'Ай сайын', 'label_en': 'Monthly'},
                        {'value': 'quarterly', 'label_ru': 'Ежеквартально', 'label_kz': 'Тоқсан сайын', 'label_en': 'Quarterly'},
                        {'value': 'on_completion', 'label_ru': 'По завершении', 'label_kz': 'Аяқталғанда', 'label_en': 'On completion'},
                    ],
                },
                {
                    'name': 'territory',
                    'label_ru': 'Территория действия',
                    'label_kz': 'Қолданылу аумағы',
                    'label_en': 'Territory',
                    'type': 'text',
                    'required': False,
                },
            ],
        },
    }

    def get_all_types(self):
        """Возвращает список всех типов договоров с основной информацией."""
        result = []
        for type_id, info in self.CONTRACT_TYPES.items():
            result.append({
                'id': info['id'],
                'name_ru': info['name_ru'],
                'name_kz': info['name_kz'],
                'name_en': info['name_en'],
                'icon': info['icon'],
                'description_ru': info['description_ru'],
                'description_kz': info['description_kz'],
                'description_en': info['description_en'],
            })
        return result

    def get_fields(self, contract_type):
        """Возвращает общие поля + специфичные поля для данного типа договора."""
        if contract_type not in self.CONTRACT_TYPES:
            raise ValueError(f"Неизвестный тип договора: {contract_type}")
        return self.COMMON_FIELDS + self.CONTRACT_TYPES[contract_type]['fields']

    def get_sections(self, contract_type):
        """Возвращает список разделов для данного типа договора."""
        if contract_type not in self.CONTRACT_TYPES:
            raise ValueError(f"Неизвестный тип договора: {contract_type}")
        return self.CONTRACT_TYPES[contract_type]['sections']

    def get_type_info(self, contract_type):
        """Возвращает полную информацию о типе договора."""
        if contract_type not in self.CONTRACT_TYPES:
            raise ValueError(f"Неизвестный тип договора: {contract_type}")
        return self.CONTRACT_TYPES[contract_type]

    def get_prompt_template(self, contract_type, language='ru'):
        """
        Возвращает структурированный промпт для генерации договора через LLM.

        Args:
            contract_type: тип договора (ключ из CONTRACT_TYPES)
            language: язык генерации ('ru', 'kz', 'en')

        Returns:
            Строка промпта с инструкциями для LLM
        """
        if contract_type not in self.CONTRACT_TYPES:
            raise ValueError(f"Неизвестный тип договора: {contract_type}")

        info = self.CONTRACT_TYPES[contract_type]
        sections = info['sections']
        legal_basis = info['legal_basis']

        lang_key = f'name_{language}'
        contract_name = info.get(lang_key, info['name_ru'])

        sections_list = '\n'.join(f'  {i + 1}. {section}' for i, section in enumerate(sections))

        field_names = [f['name'] for f in self.COMMON_FIELDS + info['fields']]
        field_placeholders = '\n'.join(f'  - {{{name}}}' for name in field_names)

        if language == 'ru':
            prompt = (
                f"Составь полный текст договора \"{contract_name}\" в соответствии с законодательством "
                f"Республики Казахстан.\n\n"
                f"Правовая основа: {legal_basis}\n\n"
                f"Структура договора (строго соблюдай порядок разделов):\n{sections_list}\n\n"
                f"Данные для заполнения:\n{field_placeholders}\n\n"
                f"Требования к оформлению:\n"
                f"  1. Используй официальный юридический стиль на русском языке.\n"
                f"  2. Каждый раздел должен быть пронумерован и озаглавлен.\n"
                f"  3. Пункты внутри разделов нумеруй (1.1, 1.2, 2.1 и т.д.).\n"
                f"  4. Включи ссылки на соответствующие статьи {legal_basis}.\n"
                f"  5. Договор должен быть юридически корректным и готовым к подписанию.\n"
                f"  6. Укажи город, дату и реквизиты сторон.\n"
                f"  7. В конце добавь блок для подписей обеих сторон.\n"
            )
        elif language == 'kz':
            prompt = (
                f"Қазақстан Республикасының заңнамасына сәйкес \"{contract_name}\" шартының "
                f"толық мәтінін құрастырыңыз.\n\n"
                f"Құқықтық негіз: {legal_basis}\n\n"
                f"Шарт құрылымы (бөлімдер ретін қатаң сақтаңыз):\n{sections_list}\n\n"
                f"Толтыру деректері:\n{field_placeholders}\n\n"
                f"Рәсімдеу талаптары:\n"
                f"  1. Қазақ тіліндегі ресми заңдық стильді қолданыңыз.\n"
                f"  2. Әр бөлім нөмірленіп, тақырыпталуы тиіс.\n"
                f"  3. Бөлімдер ішіндегі тармақтарды нөмірлеңіз (1.1, 1.2, 2.1 т.б.).\n"
                f"  4. {legal_basis} тиісті баптарына сілтемелер қосыңыз.\n"
                f"  5. Шарт заңды жағынан дұрыс және қол қоюға дайын болуы керек.\n"
                f"  6. Қала, күн және тараптардың деректемелерін көрсетіңіз.\n"
                f"  7. Соңына екі тараптың қолтаңба блогын қосыңыз.\n"
            )
        else:
            prompt = (
                f"Draft a complete \"{contract_name}\" agreement in accordance with the legislation "
                f"of the Republic of Kazakhstan.\n\n"
                f"Legal basis: {legal_basis}\n\n"
                f"Contract structure (strictly follow the section order):\n{sections_list}\n\n"
                f"Data to fill in:\n{field_placeholders}\n\n"
                f"Formatting requirements:\n"
                f"  1. Use formal legal style in English.\n"
                f"  2. Each section must be numbered and titled.\n"
                f"  3. Number clauses within sections (1.1, 1.2, 2.1, etc.).\n"
                f"  4. Include references to relevant articles of {legal_basis}.\n"
                f"  5. The contract must be legally sound and ready for signing.\n"
                f"  6. Specify the city, date, and details of both parties.\n"
                f"  7. Add a signature block for both parties at the end.\n"
            )

        return prompt
