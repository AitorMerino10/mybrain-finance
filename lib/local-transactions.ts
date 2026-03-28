import type { TransactionWithRelations } from '@/lib/transactions'
import type { FamilyMember } from '@/lib/family'
import type { Category, Subcategory, Tag } from '@/types/transactions'
import { convertMonthYearToDBFormat, formatMonthDeclared } from '@/lib/date-utils'

type LocalUserAmount = {
  id_user: string
  ft_amount_user: number
}

type LocalTransaction = {
  id_transaction: string
  id_family: string
  id_user_creator: string
  id_type: string
  id_category: string | null
  id_subcategory: string | null
  ft_amount: number
  dt_date: string
  dt_created: string
  dt_updated: string
  ds_month_declared: string // YYYY-MM
  id_tag: string | null
  ds_comments: string | null
  users: LocalUserAmount[]
  transactionType: 'Income' | 'Expense'
}

const STORAGE_KEY = 'local_transactions_v1'

export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

function loadLocalTransactions(): LocalTransaction[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLocalTransactions(transactions: LocalTransaction[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions))
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function splitAmountForUsers(totalAmount: number, userIds: string[]): LocalUserAmount[] {
  if (userIds.length === 0) return []
  const numUsers = userIds.length
  const baseAmountPerUser = Math.floor((totalAmount / numUsers) * 100) / 100
  const amounts: number[] = []
  let sumSoFar = 0

  for (let i = 0; i < numUsers - 1; i++) {
    amounts.push(baseAmountPerUser)
    sumSoFar += baseAmountPerUser
  }

  const lastAmount = Math.round((totalAmount - sumSoFar) * 100) / 100
  amounts.push(lastAmount)

  return userIds.map((id_user, index) => ({
    id_user,
    ft_amount_user: amounts[index],
  }))
}

export function createLocalTransaction(params: {
  id_family: string
  id_user_creator: string
  id_type: string
  id_category: string | null
  id_subcategory: string | null
  ft_amount: number
  dt_date: string
  ds_month_declared: string // MM-YYYY
  id_tag: string | null
  ds_comments: string | null
  transactionType: 'Income' | 'Expense'
  userIds?: string[]
}): LocalTransaction {
  const ds_month_declared_db = convertMonthYearToDBFormat(params.ds_month_declared)
  const users = splitAmountForUsers(params.ft_amount, params.userIds || [])
  const now = new Date().toISOString()
  const newTransaction: LocalTransaction = {
    id_transaction: generateId(),
    id_family: params.id_family,
    id_user_creator: params.id_user_creator,
    id_type: params.id_type,
    id_category: params.id_category,
    id_subcategory: params.id_subcategory,
    ft_amount: params.ft_amount,
    dt_date: params.dt_date,
    dt_created: now,
    dt_updated: now,
    ds_month_declared: ds_month_declared_db,
    id_tag: params.id_tag,
    ds_comments: params.ds_comments,
    users,
    transactionType: params.transactionType,
  }

  const transactions = loadLocalTransactions()
  transactions.unshift(newTransaction)
  saveLocalTransactions(transactions)
  return newTransaction
}

export function updateLocalTransactionComplete(params: {
  id_transaction: string
  id_category: string | null
  id_subcategory: string | null
  ft_amount: number
  dt_date: string
  ds_month_declared?: string | null // MM-YYYY
  id_tag: string | null
  ds_comments: string | null
  userIds?: string[]
}): LocalTransaction | null {
  const transactions = loadLocalTransactions()
  const index = transactions.findIndex(t => t.id_transaction === params.id_transaction)
  if (index === -1) return null

  const current = transactions[index]
  let dsMonthDeclared = current.ds_month_declared
  if (params.ds_month_declared) {
    dsMonthDeclared = convertMonthYearToDBFormat(params.ds_month_declared)
  } else if (params.dt_date) {
    dsMonthDeclared = formatMonthDeclared(params.dt_date)
  }

  const users = splitAmountForUsers(params.ft_amount, params.userIds || [])
  const updated: LocalTransaction = {
    ...current,
    id_category: params.id_category,
    id_subcategory: params.id_subcategory,
    ft_amount: params.ft_amount,
    dt_date: params.dt_date,
    dt_updated: new Date().toISOString(),
    ds_month_declared: dsMonthDeclared,
    id_tag: params.id_tag,
    ds_comments: params.ds_comments,
    users,
  }

  transactions[index] = updated
  saveLocalTransactions(transactions)
  return updated
}

export function deleteLocalTransaction(id_transaction: string): boolean {
  const transactions = loadLocalTransactions()
  const next = transactions.filter(t => t.id_transaction !== id_transaction)
  if (next.length === transactions.length) return false
  saveLocalTransactions(next)
  return true
}

export function getLocalTransactions(): LocalTransaction[] {
  return loadLocalTransactions()
}

export function mapLocalTransactionsToRelations(params: {
  transactions: LocalTransaction[]
  categories: Category[]
  subcategories: Subcategory[]
  tags: Tag[]
  familyMembers?: FamilyMember[]
}): TransactionWithRelations[] {
  const categoryMap = new Map(params.categories.map(c => [c.id_category, c]))
  const subcategoryMap = new Map(params.subcategories.map(s => [s.id_subcategory, s]))
  const tagMap = new Map(params.tags.map(t => [t.id_tag, t]))
  const memberMap = new Map((params.familyMembers || []).map(m => [m.id_user, m.ds_user]))

  return params.transactions.map((t) => {
    const users = t.users.map(u => ({
      id_user: u.id_user,
      ds_user: memberMap.get(u.id_user) ?? null,
      ft_amount_user: u.ft_amount_user,
    }))
    const category = t.id_category ? categoryMap.get(t.id_category) : null
    const subcategory = t.id_subcategory ? subcategoryMap.get(t.id_subcategory) : null
    const tag = t.id_tag ? tagMap.get(t.id_tag) : null

    return {
      ...t,
      category: category
        ? { id_category: category.id_category, ds_category: category.ds_category }
        : null,
      subcategory: subcategory
        ? { id_subcategory: subcategory.id_subcategory, ds_subcategory: subcategory.ds_subcategory }
        : null,
      tag: tag ? { id_tag: tag.id_tag, ds_tag: tag.ds_tag } : null,
      users,
    } as TransactionWithRelations
  })
}

export function getLocalTransactionsForHome(params: {
  idFamily: string
  idUser?: string
  categories: Category[]
  tags: Tag[]
}): TransactionWithRelations[] {
  const categoryMap = new Map(params.categories.map(c => [c.id_category, c]))
  const tagMap = new Map(params.tags.map(t => [t.id_tag, t]))
  const transactions = loadLocalTransactions().filter(t => t.id_family === params.idFamily)

  const filtered = params.idUser
    ? transactions.filter(t => t.users.some(u => u.id_user === params.idUser))
    : transactions

  return filtered.map((t) => {
    const users = t.users.map(u => ({
      id_user: u.id_user,
      ds_user: null,
      ft_amount_user: u.ft_amount_user,
    }))
    const adjustedAmount = params.idUser
      ? users
          .filter(u => u.id_user === params.idUser)
          .reduce((sum, u) => sum + (u.ft_amount_user || 0), 0)
      : t.ft_amount

    const category = t.id_category ? categoryMap.get(t.id_category) : null
    const tag = t.id_tag ? tagMap.get(t.id_tag) : null

    return {
      ...t,
      ft_amount: adjustedAmount,
      category: category
        ? { id_category: category.id_category, ds_category: category.ds_category }
        : null,
      subcategory: null,
      tag: tag ? { id_tag: tag.id_tag, ds_tag: tag.ds_tag } : null,
      users,
    } as TransactionWithRelations
  })
}
