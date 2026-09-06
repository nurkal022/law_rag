/**
 * Формы ответов /api/workspace. Повторяют to_dict() моделей Matter,
 * UserDocument и UserDocumentVersion — если сервер поменяет поле, ошибка
 * должна вылезти при сборке, а не пустой ячейкой в реестре.
 */

export type DocStatus = 'pending' | 'indexed' | 'failed'
export type DocSource = 'upload' | 'contract' | 'law_project' | 'chat'

export interface Matter {
  id: number
  title: string
  description: string | null
  is_archived: boolean
  documents_count: number
  created_at: string | null
  updated_at: string | null
}

export interface WsDocument {
  id: number
  title: string
  original_filename: string | null
  file_size: number
  mime: string | null
  pages: number | null
  source: DocSource
  status: DocStatus
  /** Почему индексация не удалась и что с этим делать. Показывается целиком. */
  status_error: string | null
  text_length: number
  matter_id: number | null
  /** Внутренний числовой идентификатор черновика, не публичный адрес договора. */
  draft_id: number | null
  versions_count: number
  indexed_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface DocVersion {
  no: number
  file_size: number
  note: string | null
  created_at: string | null
}

export interface DocumentFull extends WsDocument {
  versions: DocVersion[]
  chunks_count: number
}

export interface Excerpt {
  chunk: number
  text: string
}

export interface FoundDocument extends WsDocument {
  excerpts: Excerpt[]
}

export interface MattersResponse {
  matters: Matter[]
}
export interface MatterResponse {
  matter: Matter
}
export interface DocumentsResponse {
  documents: WsDocument[]
}
export interface DocumentResponse {
  document: WsDocument
  /** Тот же файл уже лежал в библиотеке — сервер вернул существующий документ. */
  duplicate?: boolean
}
export interface DocumentFullResponse {
  document: DocumentFull
}
export interface TextResponse {
  text: string
  length: number
}
export interface SearchResponse {
  query: string
  documents: FoundDocument[]
}
export interface DeleteMatterResponse {
  documents_freed: number
}
