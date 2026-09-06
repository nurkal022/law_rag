/** Формы ответа анализатора договоров (contracts/analyzer.py). */

export interface Risk {
  severity: 'high' | 'medium' | 'low'
  title: string
  description?: string
  clause_reference?: string
  recommendation?: string
}

export interface MissingClause {
  clause: string
  importance: 'critical' | 'recommended' | 'optional'
  reason?: string
}

export interface Compliance {
  law: string
  status: 'compliant' | 'warning' | 'violation'
  note?: string
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low'
  title: string
  description?: string
}

export interface Analysis {
  contract_type_detected?: string
  overall_score: number
  risk_level: 'high' | 'medium' | 'low'
  summary?: string
  parties?: string[]
  risks?: Risk[]
  missing_clauses?: MissingClause[]
  compliance?: Compliance[]
  recommendations?: Recommendation[]
  strengths?: string[]
  risk_counts?: { high: number; medium: number; low: number }
}
