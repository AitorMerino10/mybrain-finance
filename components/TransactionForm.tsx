'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getCategoriesByType,
  getSubcategoriesByCategory,
  getTransactionTypeId,
} from '@/lib/categories'
import { getTagsByFamily } from '@/lib/tags'
import { getFamilyMembers, type FamilyMember } from '@/lib/family'
import { createTransaction } from '@/lib/transactions'
import { getTodayISOString, getCurrentMonthYear } from '@/lib/date-utils'
import { validateTransactionForm } from '@/types/transactions'
import type {
  TransactionTypeName,
  Category,
  Subcategory,
  TransactionFormData,
  Tag,
} from '@/types/transactions'
import CategoryModal from './CategoryModal'
import SubcategoryModal from './SubcategoryModal'
import TagModal from './TagModal'

interface TransactionFormProps {
  transactionType: TransactionTypeName
  idFamily: string
  idUser: string
  onSuccess?: () => void
  onCancel?: () => void
}

export default function TransactionForm({
  transactionType,
  idFamily,
  idUser,
  onSuccess,
  onCancel,
}: TransactionFormProps) {
  const [formData, setFormData] = useState<TransactionFormData>({
    id_type: '',
    id_category: null,
    id_subcategory: null,
    ft_amount: 0,
    dt_date: getTodayISOString(),
    ds_month_declared: getCurrentMonthYear(),
    id_tag: null,
    selectedUsers: [],
    ds_comments: null,
  })

  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [loadingSubcategories, setLoadingSubcategories] = useState(false)
  const [loadingTags, setLoadingTags] = useState(true)
  const [loadingFamilyMembers, setLoadingFamilyMembers] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [amountInputValue, setAmountInputValue] = useState<string>('')

  // Cargar tipo de transacción, categorías, tags y miembros de la familia al montar
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoadingCategories(true)
        setLoadingTags(true)
        setLoadingFamilyMembers(true)

        // Obtener ID del tipo de transacción
        const typeId = await getTransactionTypeId(supabase, transactionType)
        if (!typeId) {
          setErrors({ general: 'No se pudo encontrar el tipo de transacción' })
          return
        }

        setFormData((prev) => ({ ...prev, id_type: typeId }))

        // Cargar categorías filtradas por tipo y familia
        const categoriesData = await getCategoriesByType(
          supabase,
          idFamily,
          transactionType
        )
        setCategories(categoriesData)

        // Cargar tags de la familia
        const tagsData = await getTagsByFamily(supabase, idFamily)
        setTags(tagsData)

        // Cargar miembros de la familia
        const membersData = await getFamilyMembers(supabase, idFamily)
        setFamilyMembers(membersData)

        // Seleccionar el usuario logueado por defecto
        if (membersData.length > 0) {
          const loggedInUser = membersData.find(m => m.id_user === idUser) || membersData[0]
          setFormData((prev) => ({
            ...prev,
            selectedUsers: [loggedInUser.id_user],
          }))
        }
      } catch (err) {
        console.error('Error al cargar datos iniciales:', err)
        setErrors({
          general: err instanceof Error ? err.message : 'Error al cargar datos',
        })
      } finally {
        setLoadingCategories(false)
        setLoadingTags(false)
        setLoadingFamilyMembers(false)
      }
    }

    loadInitialData()
  }, [transactionType, idFamily])

  // Cargar subcategorías cuando se selecciona una categoría (solo para Expense)
  useEffect(() => {
    const loadSubcategories = async () => {
      // Solo cargar subcategorías si es Expense
      if (transactionType !== 'Expense') {
        setSubcategories([])
        setFormData((prev) => ({ ...prev, id_subcategory: null }))
        return
      }

      if (!formData.id_category) {
        setSubcategories([])
        setFormData((prev) => ({ ...prev, id_subcategory: null }))
        return
      }

      try {
        setLoadingSubcategories(true)
        const subcategoriesData = await getSubcategoriesByCategory(
          supabase,
          formData.id_category
        )
        setSubcategories(subcategoriesData)
        // Resetear subcategoría seleccionada si no está en la nueva lista
        if (
          formData.id_subcategory &&
          !subcategoriesData.some(
            (s) => s.id_subcategory === formData.id_subcategory
          )
        ) {
          setFormData((prev) => ({ ...prev, id_subcategory: null }))
        }
      } catch (err) {
        console.error('Error al cargar subcategorías:', err)
        setErrors({
          subcategories: err instanceof Error ? err.message : 'Error al cargar subcategorías',
        })
      } finally {
        setLoadingSubcategories(false)
      }
    }

    loadSubcategories()
  }, [formData.id_category, transactionType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validar formulario (solo requerir usuarios si hay más de uno en la familia)
    const requireUsers = familyMembers.length > 1
    const validationErrors = validateTransactionForm(formData, requireUsers)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setLoading(true)
    setErrors({})

    try {
      // Asegurar que el valor se redondee correctamente a 2 decimales antes de enviar
      // Usar una función robusta para evitar problemas de precisión de punto flotante
      const roundToTwoDecimals = (num: number): number => {
        // Multiplicar por 100, redondear, y dividir por 100
        // Esto evita problemas de precisión de punto flotante
        return Math.round((num + Number.EPSILON) * 100) / 100
      }
      const amountToSend = roundToTwoDecimals(formData.ft_amount)
      
      // Determinar usuarios a asociar (si hay más de uno en la familia, usar los seleccionados)
      const usersToAssociate =
        familyMembers.length > 1 ? formData.selectedUsers : [familyMembers[0]?.id_user].filter(Boolean)
      
      await createTransaction(
        supabase,
        {
          id_type: formData.id_type,
          id_category: formData.id_category,
          id_subcategory: formData.id_subcategory,
          ft_amount: amountToSend,
          dt_date: formData.dt_date,
          ds_comments: formData.ds_comments || null,
          id_family: idFamily,
          id_user_creator: idUser,
        },
        formData.ds_month_declared,
        formData.id_tag || undefined,
        usersToAssociate.length > 0 ? usersToAssociate : undefined
      )

      // Resetear formulario - mantener usuario logueado seleccionado
      const loggedInUser = familyMembers.find(m => m.id_user === idUser) || familyMembers[0]
      const initialSelectedUsers = loggedInUser ? [loggedInUser.id_user] : []
      
      setFormData({
        id_type: formData.id_type, // Mantener el tipo
        id_category: null,
        id_subcategory: null,
        ft_amount: 0,
        dt_date: getTodayISOString(),
        ds_month_declared: getCurrentMonthYear(),
        id_tag: null,
        selectedUsers: initialSelectedUsers,
        ds_comments: null,
      })
      setAmountInputValue('')
      setSubcategories([])
      setErrors({})

      onSuccess?.()
    } catch (err) {
      console.error('Error al crear transacción:', err)
      setErrors({
        general: err instanceof Error ? err.message : 'Error al crear la transacción',
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

  const selectedCategory = categories.find(
    (c) => c.id_category === formData.id_category
  )

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {errors.general && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4">
            <p className="text-sm font-semibold text-red-800">{errors.general}</p>
          </div>
        )}

        {/* Personas afectadas primero - solo si hay más de uno */}
        {familyMembers.length > 1 && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Personas afectadas * {loadingFamilyMembers && <span className="text-gray-400 font-normal">(Cargando...)</span>}
            </label>
            <div className="space-y-2">
              {familyMembers.map((member) => {
                const isSelected = formData.selectedUsers.includes(member.id_user)
                return (
                  <button
                    key={member.id_user}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setFormData((prev) => ({
                          ...prev,
                          selectedUsers: prev.selectedUsers.filter(
                            (id) => id !== member.id_user
                          ),
                        }))
                      } else {
                        setFormData((prev) => ({
                          ...prev,
                          selectedUsers: [...prev.selectedUsers, member.id_user],
                        }))
                      }
                    }}
                    disabled={loadingFamilyMembers || loading}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200 text-left ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500'
                        : 'border-gray-300 bg-white'
                    }`}>
                      {isSelected && (
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="font-medium">{member.ds_user || member.ds_email}</span>
                    </div>
                  </button>
                )
              })}
            </div>
            {errors.selectedUsers && (
              <p className="mt-1 text-sm text-red-600 font-medium">{errors.selectedUsers}</p>
            )}
            {formData.selectedUsers.length === 0 && (
              <p className="text-xs text-gray-500">
                Debe seleccionar al menos una persona
              </p>
            )}
          </div>
        )}

        {/* Campo de importe destacado */}
        <div className="space-y-2">
          <label
            htmlFor="amount"
            className="block text-sm font-semibold text-gray-700"
          >
            Importe *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-gray-500 text-xl font-semibold">€</span>
            </div>
            <input
              type="text"
              id="amount"
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
                  setFormData((prev) => ({
                    ...prev,
                    ft_amount: 0,
                  }))
                  return
                }
                
                const numValue = parseFloat(normalizedValue)
                if (!isNaN(numValue) && numValue >= 0) {
                  setFormData((prev) => ({
                    ...prev,
                    ft_amount: numValue,
                  }))
                }
              }}
              onBlur={(e) => {
                const inputValue = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.')
                
                if (inputValue === '' || inputValue === '.') {
                  setFormData((prev) => ({
                    ...prev,
                    ft_amount: 0,
                  }))
                  setAmountInputValue('')
                  return
                }
                
                const numValue = parseFloat(inputValue)
                if (!isNaN(numValue) && numValue >= 0) {
                  const roundedValue = Math.round((numValue + Number.EPSILON) * 100) / 100
                  setFormData((prev) => ({
                    ...prev,
                    ft_amount: roundedValue,
                  }))
                  setAmountInputValue(roundedValue.toString())
                }
              }}
              disabled={loading}
              className="block w-full pl-12 pr-4 py-4 text-2xl font-bold border-2 border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all duration-200 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="0.00"
              required
            />
          </div>
          {errors.ft_amount && (
            <p className="mt-1 text-sm text-red-600 font-medium">{errors.ft_amount}</p>
          )}
        </div>

        {/* Categoría con icono */}
        <div className="space-y-2">
          <label
            htmlFor="category"
            className="block text-sm font-semibold text-gray-700"
          >
            Categoría *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
              <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <select
              id="category"
              value={formData.id_category || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  id_category: e.target.value || null,
                  id_subcategory: null,
                }))
              }
              disabled={loadingCategories || loading}
              className="block w-full pl-10 sm:pl-12 pr-20 sm:pr-24 py-3 sm:py-3.5 text-sm sm:text-base border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm hover:border-gray-300 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 appearance-none"
            >
              <option value="">Categoría</option>
              {categories.map((category) => (
                <option key={category.id_category} value={category.id_category}>
                  {category.ds_category}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                disabled={loadingCategories || loading}
                className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 active:bg-indigo-200 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-200"
              >
                + Nueva
              </button>
            </div>
          </div>
          {errors.id_category && (
            <p className="mt-1 text-sm text-red-600 font-medium">{errors.id_category}</p>
          )}
        </div>

        {/* Mostrar subcategoría solo para Expense */}
        {transactionType === 'Expense' && formData.id_category && (
          <div className="space-y-2">
            <label
              htmlFor="subcategory"
              className="block text-sm font-semibold text-gray-700"
            >
              Subcategoría {loadingSubcategories && <span className="text-gray-400 font-normal">(Cargando...)</span>}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <select
                id="subcategory"
                value={formData.id_subcategory || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    id_subcategory: e.target.value || null,
                  }))
                }
                disabled={loadingSubcategories || loading}
                className="block w-full pl-10 sm:pl-12 pr-20 sm:pr-24 py-3 sm:py-3.5 text-sm sm:text-base border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm hover:border-gray-300 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 appearance-none"
              >
                <option value="">Subcategoría</option>
                {subcategories.map((subcategory) => (
                  <option
                    key={subcategory.id_subcategory}
                    value={subcategory.id_subcategory}
                  >
                    {subcategory.ds_subcategory}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                <button
                  type="button"
                  onClick={() => setShowSubcategoryModal(true)}
                  disabled={loadingSubcategories || loading || !formData.id_category}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 active:bg-indigo-200 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-200"
                >
                  + Nueva
                </button>
              </div>
            </div>
            {errors.id_subcategory && (
              <p className="mt-1 text-sm text-red-600 font-medium">{errors.id_subcategory}</p>
            )}
          </div>
        )}

        {/* Grid para fecha y mes declarado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label
              htmlFor="date"
              className="block text-sm font-semibold text-gray-700"
            >
              Fecha *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <input
                type="date"
                id="date"
                value={formData.dt_date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, dt_date: e.target.value }))
                }
                disabled={loading}
                className="block w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm hover:border-gray-300 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                required
              />
            </div>
            {errors.dt_date && (
              <p className="mt-1 text-sm text-red-600 font-medium">{errors.dt_date}</p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="monthDeclared"
              className="block text-sm font-semibold text-gray-700"
            >
              Mes Declarado *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <input
                type="text"
                id="monthDeclared"
                value={formData.ds_month_declared}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === '' || /^\d{0,2}-?\d{0,4}$/.test(value.replace(/-/g, ''))) {
                    let formatted = value.replace(/-/g, '')
                    if (formatted.length > 2) {
                      formatted = formatted.slice(0, 2) + '-' + formatted.slice(2, 6)
                    }
                    setFormData((prev) => ({ ...prev, ds_month_declared: formatted }))
                  }
                }}
                disabled={loading}
                className="block w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm hover:border-gray-300 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="01-2024"
                maxLength={7}
                required
              />
            </div>
            <p className="text-xs text-gray-500">
              Formato: MM-YYYY
            </p>
            {errors.ds_month_declared && (
              <p className="mt-1 text-sm text-red-600 font-medium">{errors.ds_month_declared}</p>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="tag"
            className="block text-sm font-medium text-gray-700"
          >
            Tag {loadingTags && '(Cargando...)'}
          </label>
          <div className="mt-1 flex gap-2">
            <select
              id="tag"
              value={formData.id_tag || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  id_tag: e.target.value || null,
                }))
              }
              disabled={loadingTags || loading}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2.5 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 touch-manipulation"
            >
              <option value="">Sin tag</option>
              {tags.map((tag) => (
                <option key={tag.id_tag} value={tag.id_tag}>
                  {tag.ds_tag}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowTagModal(true)}
              disabled={loadingTags || loading}
              className="rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation min-h-[44px] flex items-center justify-center"
            >
              + Nueva
            </button>
          </div>
          {errors.id_tag && (
            <p className="mt-1 text-sm text-red-600">{errors.id_tag}</p>
          )}
        </div>


        {/* Comentarios */}
        <div className="space-y-2">
          <label
            htmlFor="comments"
            className="block text-sm font-semibold text-gray-700"
          >
            Comentarios
          </label>
          <div className="relative">
            <div className="absolute top-3 left-4 pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <textarea
              id="comments"
              value={formData.ds_comments || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  ds_comments: e.target.value || null,
                }))
              }
              disabled={loading}
              rows={3}
              className="block w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm hover:border-gray-300 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 resize-none"
              placeholder="Notas adicionales sobre esta transacción..."
            />
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t border-gray-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-6 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-200"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={loading || loadingCategories}
            className="flex-1 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {loading ? 'Guardando...' : 'Guardar Transacción'}
          </button>
        </div>
      </form>

      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCategoryCreated={handleCategoryCreated}
        idFamily={idFamily}
        transactionType={transactionType}
      />

      <SubcategoryModal
        isOpen={showSubcategoryModal}
        onClose={() => setShowSubcategoryModal(false)}
        onSubcategoryCreated={handleSubcategoryCreated}
        idCategory={formData.id_category!}
        categoryName={selectedCategory?.ds_category || 'Categoría'}
      />

      <TagModal
        isOpen={showTagModal}
        onClose={() => setShowTagModal(false)}
        onTagCreated={handleTagCreated}
        idFamily={idFamily}
      />
    </>
  )
}

