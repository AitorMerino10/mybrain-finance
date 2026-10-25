'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getCategoriesByType,
  getSubcategoriesByCategory,
} from '@/lib/categories'
import { getFamilyMembers, type FamilyMember } from '@/lib/family'
import { updateTransactionComplete } from '@/lib/transactions'
import {
  getIncomeAllocations,
  replaceIncomeAllocations,
  type AllocationRow,
} from '@/lib/income-allocations'
import IncomeAllocationEditor, { allocationIsValid } from './IncomeAllocationEditor'
import {
  budgetTypesForUsers,
  getBudgetSubtypes,
  getBudgetTypes,
  getSubcategoryBudgetDefaults,
  type BudgetSubtype,
  type BudgetType,
  type SubcategoryBudgetDefault,
} from '@/lib/budgets'
import { convertDBFormatToMonthYear } from '@/lib/date-utils'
import { validateTransactionForm } from '@/types/transactions'
import type {
  Category,
  Subcategory,
  TransactionFormData,
  Tag,
} from '@/types/transactions'
import type { TransactionWithRelations } from '@/lib/transactions'
import CategoryModal from './CategoryModal'
import SubcategoryModal from './SubcategoryModal'
import TagModal from './TagModal'
import TagPicker from './TagPicker'

interface EditTransactionModalProps {
  transaction: TransactionWithRelations
  idFamily: string
  idUser: string
  familyMembers: FamilyMember[]
  categories: Category[]
  tags: Tag[]
  onClose: () => void
  onSave: () => void
}

export default function EditTransactionModal({
  transaction,
  idFamily,
  idUser,
  familyMembers: initialFamilyMembers,
  categories: initialCategories,
  tags: initialTags,
  onClose,
  onSave,
}: EditTransactionModalProps) {
  const transactionType = transaction.transactionType === 'Income' ? 'Income' : 'Expense'
  
  const [formData, setFormData] = useState<TransactionFormData>({
    id_type: transaction.id_type || '',
    id_category: transaction.id_category || null,
    id_subcategory: transaction.id_subcategory || null,
    ft_amount: transaction.ft_amount || 0,
    dt_date: transaction.dt_date || '',
    ds_month_declared: transaction.ds_month_declared 
      ? convertDBFormatToMonthYear(transaction.ds_month_declared)
      : '',
    id_tag: transaction.tag?.id_tag || null,
    id_budget_type: transaction.id_budget_type || null,
    id_budget_subtype: transaction.id_budget_subtype || null,
    selectedUsers: transaction.users?.map(u => u.id_user) || [],
    ds_comments: transaction.ds_comments || null,
  })

  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [tags, setTags] = useState<Tag[]>(initialTags)
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(initialFamilyMembers)
  const [budgetTypes, setBudgetTypes] = useState<BudgetType[]>([])
  const [budgetSubtypes, setBudgetSubtypes] = useState<BudgetSubtype[]>([])
  // Reparto personalizado del ingreso entre partidas (null = por defecto). `hadStoredAllocation`: ya había uno guardado
  const [incomeAllocation, setIncomeAllocation] = useState<AllocationRow[] | null>(null)
  const [hadStoredAllocation, setHadStoredAllocation] = useState(false)
  const [budgetDefaults, setBudgetDefaults] = useState<SubcategoryBudgetDefault[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingSubcategories, setLoadingSubcategories] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [amountInputValue, setAmountInputValue] = useState<string>(String(transaction.ft_amount || 0))

  // Cargar categorías y subcategorías
  useEffect(() => {
    const loadData = async () => {
      try {
        const categoriesData = await getCategoriesByType(
          supabase,
          idFamily,
          transactionType
        )
        setCategories(categoriesData)

        if (formData.id_category) {
          const subs = await getSubcategoriesByCategory(supabase, formData.id_category)
          setSubcategories(subs)
        }

        const [budgetTypesData, budgetDefaultsData] = await Promise.all([
          getBudgetTypes(supabase, idFamily),
          getSubcategoryBudgetDefaults(supabase, idFamily),
        ])

        setBudgetTypes(budgetTypesData)
        setBudgetSubtypes((await getBudgetSubtypes(supabase, idFamily, { includeArchived: true })).subtypes)
        setBudgetDefaults(budgetDefaultsData)
      } catch (err) {
        console.error('Error al cargar datos:', err)
      }
    }
    loadData()
  }, [idFamily, transaction.id_transaction, transactionType, formData.id_category])

  // Cargar subcategorías cuando cambia la categoría
  useEffect(() => {
    const loadSubcategories = async () => {
      if (transactionType !== 'Expense' || !formData.id_category) {
        setSubcategories([])
        return
      }

      try {
        setLoadingSubcategories(true)
        const subs = await getSubcategoriesByCategory(supabase, formData.id_category)
        setSubcategories(subs)
        if (formData.id_subcategory && !subs.some(s => s.id_subcategory === formData.id_subcategory)) {
          setFormData(prev => ({ ...prev, id_subcategory: null }))
        }
      } catch (err) {
        console.error('Error al cargar subcategorías:', err)
      } finally {
        setLoadingSubcategories(false)
      }
    }
    loadSubcategories()
  }, [formData.id_category, formData.id_subcategory, transactionType])

  // Reparto ya guardado del ingreso
  useEffect(() => {
    if (transactionType !== 'Income') return
    let cancelled = false
    getIncomeAllocations(supabase, transaction.id_transaction).then((rows) => {
      if (cancelled) return
      setIncomeAllocation(rows)
      setHadStoredAllocation(rows !== null)
    })
    return () => {
      cancelled = true
    }
  }, [transaction.id_transaction, transactionType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const requireUsers = familyMembers.length > 1
    const validationErrors = validateTransactionForm(formData, requireUsers)
    if (transactionType === 'Expense' && !formData.id_budget_type) {
      validationErrors.id_budget_type = 'Selecciona una partida de presupuesto'
    }
    if (transactionType === 'Income' && !allocationIsValid(incomeAllocation, formData.ft_amount)) {
      validationErrors.incomeAllocation = 'El reparto entre partidas supera el importe del ingreso'
    }
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const amountToSend = parseFloat(amountInputValue.replace(',', '.')) || 0
      
      await updateTransactionComplete(
        supabase,
        transaction.id_transaction,
        {
          id_category: formData.id_category || null,
          id_subcategory: formData.id_subcategory || null,
          id_budget_type: transactionType === 'Expense' ? formData.id_budget_type : null,
          // Solo se envía si hay (o había) subpartida: así funciona también antes de ejecutar la migración
          ...(transactionType !== 'Expense'
            ? transaction.id_budget_subtype
              ? { id_budget_subtype: null }
              : {}
            : formData.id_budget_subtype || transaction.id_budget_subtype
              ? { id_budget_subtype: formData.id_budget_subtype || null }
              : {}),
          ft_amount: amountToSend,
          dt_date: formData.dt_date,
          ds_comments: formData.ds_comments || null,
        },
        formData.ds_month_declared,
        formData.id_tag || null,
        formData.selectedUsers && formData.selectedUsers.length > 0 ? formData.selectedUsers : undefined
      )

      // Reparto del ingreso: se guarda si lo has personalizado y se borra si vuelves al reparto por defecto
      if (transactionType === 'Income' && (incomeAllocation !== null || hadStoredAllocation)) {
        try {
          await replaceIncomeAllocations(supabase, {
            idFamily,
            idTransaction: transaction.id_transaction,
            rows: incomeAllocation,
          })
        } catch (allocationError) {
          console.error('Error al guardar el reparto del ingreso:', allocationError)
          throw new Error(
            'Se han guardado los cambios, pero no el reparto entre partidas (¿falta ejecutar la migración 20261026130000?).'
          )
        }
      }

      onSave()
    } catch (err) {
      console.error('Error al actualizar transacción:', err)
      setErrors({
        general: err instanceof Error ? err.message : 'Error al actualizar la transacción',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryCreated = (newCategory: Category) => {
    setCategories((prev) => [...prev, newCategory])
    setFormData((prev) => ({ ...prev, id_category: newCategory.id_category }))
  }

  const handleSubcategoryCreated = (newSubcategory: Subcategory) => {
    setSubcategories((prev) => [...prev, newSubcategory])
    setFormData((prev) => ({
      ...prev,
      id_subcategory: newSubcategory.id_subcategory,
    }))
  }

  const handleTagCreated = (newTag: Tag) => {
    setTags((prev) => [...prev, newTag])
    setFormData((prev) => ({ ...prev, id_tag: newTag.id_tag }))
  }

  const colors = {
    income: '#10b981',
    expense: '#f87171',
    text: {
      primary: '#1f2937',
      secondary: '#6b7280',
    },
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
              Editar Transacción
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors touch-manipulation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {errors.general && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">{errors.general}</p>
              </div>
            )}

            {/* Categoría */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Categoría *
              </label>
              <div className="mt-1 flex gap-2">
                <select
                  value={formData.id_category || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      id_category: e.target.value || null,
                      id_subcategory: null,
                      id_budget_type: transactionType === 'Expense' ? null : prev.id_budget_type,
                      id_budget_subtype: transactionType === 'Expense' ? null : prev.id_budget_subtype,
                    }))
                  }
                  disabled={loading}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2.5 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 touch-manipulation"
                >
                  <option value="">Selecciona una categoría</option>
                  {categories.map((category) => (
                    <option key={category.id_category} value={category.id_category}>
                      {category.ds_category}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(true)}
                  disabled={loading}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation min-h-[44px] flex items-center justify-center"
                >
                  + Nueva
                </button>
              </div>
              {errors.id_category && (
                <p className="mt-1 text-sm text-red-600">{errors.id_category}</p>
              )}
            </div>

            {/* Subcategoría (solo Expense) */}
            {transactionType === 'Expense' && formData.id_category && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Subcategoría {loadingSubcategories && '(Cargando...)'}
                </label>
                <div className="mt-1 flex gap-2">
                  <select
                    value={formData.id_subcategory || ''}
                    onChange={(e) => {
                      const idSubcategory = e.target.value || null
                      const budgetDefault = idSubcategory
                        ? budgetDefaults.find(
                            (item) => item.id_subcategory === idSubcategory
                          )
                        : null
                      setFormData((prev) => ({
                        ...prev,
                        id_subcategory: idSubcategory,
                        id_budget_type:
                          budgetDefault?.id_budget_type || prev.id_budget_type,
                        id_budget_subtype: budgetDefault?.id_budget_type ? null : prev.id_budget_subtype,
                      }))
                    }}
                    disabled={loadingSubcategories || loading}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2.5 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 touch-manipulation"
                  >
                    <option value="">Sin subcategoría</option>
                    {subcategories.map((subcategory) => (
                      <option
                        key={subcategory.id_subcategory}
                        value={subcategory.id_subcategory}
                      >
                        {subcategory.ds_subcategory}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowSubcategoryModal(true)}
                    disabled={loadingSubcategories || loading || !formData.id_category}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation min-h-[44px] flex items-center justify-center"
                  >
                    + Nueva
                  </button>
                </div>
              </div>
            )}

            {transactionType === 'Expense' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Partida de presupuesto *
                  </label>
                  <select
                    value={formData.id_budget_type || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        id_budget_type: e.target.value || null,
                        id_budget_subtype: null,
                      }))
                    }
                    disabled={loading}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2.5 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 touch-manipulation"
                  >
                    <option value="">Selecciona partida</option>
                    {budgetTypes
                      .filter((budgetType) => budgetType.id_budget_type === formData.id_budget_type || budgetTypesForUsers([budgetType], formData.selectedUsers).length > 0)
                      .map((budgetType) => (
                      <option
                        key={budgetType.id_budget_type}
                        value={budgetType.id_budget_type}
                      >
                        {budgetType.ds_budget_type}
                      </option>
                    ))}
                  </select>
                  {errors.id_budget_type && (
                    <p className="mt-1 text-sm text-red-600">{errors.id_budget_type}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Subpartida</label>
                  <select
                    value={formData.id_budget_subtype || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, id_budget_subtype: e.target.value || null }))
                    }
                    disabled={
                      loading ||
                      !formData.id_budget_type ||
                      !budgetSubtypes.some(
                        (sub) =>
                          sub.id_budget_type === formData.id_budget_type &&
                          (!sub.is_archived || sub.id_budget_subtype === formData.id_budget_subtype)
                      )
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2.5 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 touch-manipulation"
                  >
                    <option value="">
                      {!formData.id_budget_type
                        ? 'Elige antes la partida'
                        : budgetSubtypes.some((sub) => sub.id_budget_type === formData.id_budget_type)
                          ? 'Sin subpartida'
                          : 'Esta partida no tiene subpartidas'}
                    </option>
                    {budgetSubtypes
                      .filter(
                        (sub) =>
                          sub.id_budget_type === formData.id_budget_type &&
                          (!sub.is_archived || sub.id_budget_subtype === formData.id_budget_subtype)
                      )
                      .map((sub) => (
                        <option key={sub.id_budget_subtype} value={sub.id_budget_subtype}>
                          {sub.ds_budget_subtype}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}

            {/* Importe */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Importe *
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={amountInputValue}
                onChange={(e) => {
                  const inputValue = e.target.value
                  const cleanedValue = inputValue.replace(/[^0-9.,]/g, '')
                  const dotCount = (cleanedValue.match(/\./g) || []).length
                  const commaCount = (cleanedValue.match(/,/g) || []).length
                  
                  if (dotCount > 1 || commaCount > 1 || (dotCount > 0 && commaCount > 0)) {
                    return
                  }
                  
                  setAmountInputValue(cleanedValue)
                  const normalizedValue = cleanedValue.replace(',', '.')
                  
                  if (cleanedValue === '' || normalizedValue === '.') {
                    setFormData((prev) => ({ ...prev, ft_amount: 0 }))
                  } else {
                    const numValue = parseFloat(normalizedValue)
                    if (!isNaN(numValue)) {
                      setFormData((prev) => ({ ...prev, ft_amount: numValue }))
                    }
                  }
                }}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2.5 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 touch-manipulation"
                placeholder="0.00"
              />
              {errors.ft_amount && (
                <p className="mt-1 text-sm text-red-600">{errors.ft_amount}</p>
              )}
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Fecha *
              </label>
              <input
                type="date"
                value={formData.dt_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, dt_date: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2.5 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 touch-manipulation"
                required
              />
            </div>

            {/* Mes Declarado */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Mes Declarado *
              </label>
              <input
                type="text"
                value={formData.ds_month_declared}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9-]/g, '')
                  if (value.length <= 7) {
                    setFormData((prev) => ({ ...prev, ds_month_declared: value }))
                  }
                }}
                placeholder="MM-YYYY"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2.5 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 touch-manipulation"
                required
              />
            </div>

            {/* Tag */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Tag
              </label>
              <div className="mt-1 flex gap-2">
                <TagPicker
                  tags={tags}
                  value={formData.id_tag || null}
                  onChange={(idTag) => setFormData((prev) => ({ ...prev, id_tag: idTag }))}
                  onTagUpdated={(updated) => setTags((prev) => prev.map((tag) => (tag.id_tag === updated.id_tag ? updated : tag)))}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowTagModal(true)}
                  disabled={loading}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation min-h-[44px] flex items-center justify-center"
                >
                  + Nueva
                </button>
              </div>
            </div>

            {/* Usuarios */}
            {familyMembers.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Personas Afectadas *
                </label>
                <div className="mt-1 space-y-2">
                  {familyMembers.map((member) => (
                    <label key={member.id_user} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.selectedUsers.includes(member.id_user)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData((prev) => ({
                              ...prev,
                              selectedUsers: [...prev.selectedUsers, member.id_user],
                            }))
                          } else {
                            setFormData((prev) => ({
                              ...prev,
                              selectedUsers: prev.selectedUsers.filter(
                                (id) => id !== member.id_user
                              ),
                            }))
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 touch-manipulation"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {member.ds_user || member.ds_email || 'Sin nombre'}
                      </span>
                    </label>
                  ))}
                </div>
                {errors.selectedUsers && (
                  <p className="mt-1 text-sm text-red-600">{errors.selectedUsers}</p>
                )}
              </div>
            )}

            {/* Reparto del ingreso entre partidas */}
            {transactionType === 'Income' && (
              <>
                <IncomeAllocationEditor
                  idFamily={idFamily}
                  amount={formData.ft_amount}
                  userIds={
                    familyMembers.length > 1
                      ? formData.selectedUsers
                      : [familyMembers[0]?.id_user].filter((id): id is string => Boolean(id))
                  }
                  monthDeclared={formData.ds_month_declared}
                  value={incomeAllocation}
                  onChange={setIncomeAllocation}
                  disabled={loading}
                />
                {errors.incomeAllocation && (
                  <p className="text-sm font-medium text-red-600">{errors.incomeAllocation}</p>
                )}
              </>
            )}

            {/* Comentarios */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Comentarios
              </label>
              <textarea
                value={formData.ds_comments || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    ds_comments: e.target.value || null,
                  }))
                }
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2.5 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 touch-manipulation"
                placeholder="Comentarios adicionales (opcional)"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3 justify-end pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors touch-manipulation min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 transition-colors touch-manipulation min-h-[44px]"
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modales */}
      {showCategoryModal && (
        <CategoryModal
          isOpen={showCategoryModal}
          idFamily={idFamily}
          transactionType={transactionType}
          onClose={() => setShowCategoryModal(false)}
          onCategoryCreated={handleCategoryCreated}
        />
      )}

      {showSubcategoryModal && formData.id_category && (
        <SubcategoryModal
          isOpen={showSubcategoryModal}
          idCategory={formData.id_category}
          categoryName={categories.find(c => c.id_category === formData.id_category)?.ds_category || ''}
          onClose={() => setShowSubcategoryModal(false)}
          onSubcategoryCreated={handleSubcategoryCreated}
        />
      )}

      {showTagModal && (
        <TagModal
          isOpen={showTagModal}
          idFamily={idFamily}
          onClose={() => setShowTagModal(false)}
          onTagCreated={handleTagCreated}
        />
      )}
    </>
  )
}


