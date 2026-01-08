'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getAllCategoriesByFamily,
  getSubcategoriesByCategory,
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  updateCategoriesOrder,
  type Category,
  type Subcategory,
} from '@/lib/categories'
import CategoryModal from './CategoryModal'
import SubcategoryModal from './SubcategoryModal'

interface CategoryManagerProps {
  idFamily: string
}

export default function CategoryManager({ idFamily }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState<
    Record<string, Subcategory[]>
  >({})
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  )
  const [loading, setLoading] = useState(true)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false)
  const [selectedCategoryForSubcategory, setSelectedCategoryForSubcategory] =
    useState<Category | null>(null)
  const [categoryType, setCategoryType] = useState<'Income' | 'Expense'>(
    'Expense'
  )
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null)
  const [draggedSubcategoryId, setDraggedSubcategoryId] = useState<{
    idCategory: string
    idSubcategory: string
  } | null>(null)

  useEffect(() => {
    loadCategories()
  }, [idFamily, categoryType])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const allCategories = await getAllCategoriesByFamily(supabase, idFamily)
      // Filtrar por tipo
      const filtered = allCategories.filter(
        (cat) =>
          (categoryType === 'Income' && cat.is_income) ||
          (categoryType === 'Expense' && cat.is_expense)
      )
      setCategories(filtered)

      // Cargar subcategorías para cada categoría
      const subcats: Record<string, Subcategory[]> = {}
      for (const category of filtered) {
        const subs = await getSubcategoriesByCategory(
          supabase,
          category.id_category
        )
        subcats[category.id_category] = subs
      }
      setSubcategoriesByCategory(subcats)
    } catch (err) {
      console.error('Error al cargar categorías:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryCreated = async (newCategory: Category) => {
    // Añadir la nueva categoría directamente sin recargar todo
    if (
      (categoryType === 'Income' && newCategory.is_income) ||
      (categoryType === 'Expense' && newCategory.is_expense)
    ) {
      setCategories((prev) => [...prev, newCategory])
      setSubcategoriesByCategory((prev) => ({
        ...prev,
        [newCategory.id_category]: [],
      }))
    }
  }

  const handleSubcategoryCreated = async (newSubcategory: Subcategory) => {
    // Añadir la nueva subcategoría directamente sin recargar todo
    setSubcategoriesByCategory((prev) => {
      const categoryId = newSubcategory.id_category
      if (!categoryId) return prev
      return {
        ...prev,
        [categoryId]: [...(prev[categoryId] || []), newSubcategory],
      }
    })
  }

  const handleDeleteCategory = async (idCategory: string) => {
    if (
      !confirm(
        '¿Estás seguro de que quieres eliminar esta categoría? También se eliminarán todas sus subcategorías.'
      )
    ) {
      return
    }

    try {
      await deleteCategory(supabase, idCategory)
      // Eliminar de la lista local sin recargar todo
      setCategories((prev) => prev.filter((c) => c.id_category !== idCategory))
      setSubcategoriesByCategory((prev) => {
        const newSubcats = { ...prev }
        delete newSubcats[idCategory]
        return newSubcats
      })
      setExpandedCategories((prev) => {
        const newSet = new Set(prev)
        newSet.delete(idCategory)
        return newSet
      })
    } catch (err) {
      console.error('Error al eliminar categoría:', err)
      alert('Error al eliminar la categoría')
    }
  }

  const handleDeleteSubcategory = async (idSubcategory: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta subcategoría?')) {
      return
    }

    try {
      await deleteSubcategory(supabase, idSubcategory)
      // Eliminar de la lista local sin recargar todo
      setSubcategoriesByCategory((prev) => {
        const newSubcats = { ...prev }
        for (const categoryId in newSubcats) {
          newSubcats[categoryId] = newSubcats[categoryId].filter(
            (s) => s.id_subcategory !== idSubcategory
          )
        }
        return newSubcats
      })
    } catch (err) {
      console.error('Error al eliminar subcategoría:', err)
      alert('Error al eliminar la subcategoría')
    }
  }

  // Drag and Drop para categorías
  const handleCategoryDragStart = (e: React.DragEvent, idCategory: string) => {
    setDraggedCategoryId(idCategory)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', idCategory)
  }

  const handleCategoryDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleCategoryDrop = async (
    e: React.DragEvent,
    targetCategoryId: string
  ) => {
    e.preventDefault()
    if (!draggedCategoryId || draggedCategoryId === targetCategoryId) {
      setDraggedCategoryId(null)
      return
    }

    const draggedIndex = categories.findIndex(
      (c) => c.id_category === draggedCategoryId
    )
    const targetIndex = categories.findIndex(
      (c) => c.id_category === targetCategoryId
    )

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedCategoryId(null)
      return
    }

    const newCategories = [...categories]
    const [moved] = newCategories.splice(draggedIndex, 1)
    newCategories.splice(targetIndex, 0, moved)

    // Actualizar órdenes
    const orders = newCategories.map((cat, index) => ({
      id_category: cat.id_category,
      id_order: index + 1,
    }))

    try {
      await updateCategoriesOrder(supabase, orders)
      setCategories(newCategories)
    } catch (err) {
      console.error('Error al reordenar categorías:', err)
      alert('Error al reordenar las categorías')
      await loadCategories()
    } finally {
      setDraggedCategoryId(null)
    }
  }

  // Drag and Drop para subcategorías
  const handleSubcategoryDragStart = (
    e: React.DragEvent,
    idCategory: string,
    idSubcategory: string
  ) => {
    setDraggedSubcategoryId({ idCategory, idSubcategory })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', idSubcategory)
  }

  const handleSubcategoryDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleSubcategoryDrop = (
    e: React.DragEvent,
    idCategory: string,
    targetSubcategoryId: string
  ) => {
    e.preventDefault()
    if (
      !draggedSubcategoryId ||
      draggedSubcategoryId.idCategory !== idCategory ||
      draggedSubcategoryId.idSubcategory === targetSubcategoryId
    ) {
      setDraggedSubcategoryId(null)
      return
    }

    const subcategories = subcategoriesByCategory[idCategory] || []
    const draggedIndex = subcategories.findIndex(
      (s) => s.id_subcategory === draggedSubcategoryId.idSubcategory
    )
    const targetIndex = subcategories.findIndex(
      (s) => s.id_subcategory === targetSubcategoryId
    )

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedSubcategoryId(null)
      return
    }

    const newSubcategories = [...subcategories]
    const [moved] = newSubcategories.splice(draggedIndex, 1)
    newSubcategories.splice(targetIndex, 0, moved)

    // Actualizar el estado local (por ahora solo en memoria, sin persistir en BD)
    setSubcategoriesByCategory((prev) => ({
      ...prev,
      [idCategory]: newSubcategories,
    }))

    setDraggedSubcategoryId(null)
  }

  const toggleCategory = (idCategory: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(idCategory)) {
      newExpanded.delete(idCategory)
    } else {
      newExpanded.add(idCategory)
    }
    setExpandedCategories(newExpanded)
  }

  if (loading) {
    return <p className="text-gray-600">Cargando categorías...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <h2 className="text-xl font-bold text-gray-900 text-center sm:text-left">
          Gestión de Categorías
        </h2>
        <button
          onClick={() => setShowCategoryModal(true)}
          className="rounded-2xl bg-[#90EBD6] px-4 py-2.5 text-sm font-medium text-[#0d9488] hover:bg-[#90EBD6]/90 active:bg-[#90EBD6]/80 transition-colors touch-manipulation min-h-[44px] w-full sm:w-auto shadow-sm"
        >
          + Nueva Categoría
        </button>
      </div>

      {/* Selector de tipo */}
      <div className="flex gap-2">
        <button
          onClick={() => setCategoryType('Expense')}
          className={`flex-1 rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors touch-manipulation min-h-[44px] ${
            categoryType === 'Expense'
              ? 'bg-[#f18a8a] text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Gastos
        </button>
        <button
          onClick={() => setCategoryType('Income')}
          className={`flex-1 rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors touch-manipulation min-h-[44px] ${
            categoryType === 'Income'
              ? 'bg-[#A8D5E2] text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Ingresos
        </button>
      </div>

      {categories.length === 0 ? (
        <p className="text-gray-500 text-center">
          No hay categorías de {categoryType === 'Income' ? 'ingresos' : 'gastos'}
        </p>
      ) : (
        <div className="space-y-2">
          {categories.map((category) => (
            <div
              key={category.id_category}
              draggable
              onDragStart={(e) => handleCategoryDragStart(e, category.id_category)}
              onDragOver={handleCategoryDragOver}
              onDrop={(e) => handleCategoryDrop(e, category.id_category)}
              className={`rounded-2xl border border-gray-200 bg-white overflow-hidden transition-opacity shadow-sm ${
                draggedCategoryId === category.id_category ? 'opacity-50' : ''
              }`}
            >
              <div className="p-4 sm:p-5">
                {/* Header: Nombre y controles */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      onClick={() => toggleCategory(category.id_category)}
                      className="text-gray-500 hover:text-gray-700 touch-manipulation flex-shrink-0 transition-colors"
                      aria-label="Expandir/Contraer"
                    >
                      <svg
                        className={`h-5 w-5 transition-transform ${
                          expandedCategories.has(category.id_category)
                            ? 'rotate-90'
                            : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                    <span className="font-semibold text-gray-900 truncate text-base">
                      {category.ds_category}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Icono de hamburguesa para drag */}
                    <div
                      className="cursor-move touch-manipulation flex-shrink-0 text-gray-400 hover:text-gray-600 p-1 transition-colors"
                      title="Arrastrar para reordenar"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h16M4 18h16"
                        />
                      </svg>
                    </div>

                    {/* Botón eliminar con icono pequeño */}
                    <button
                      onClick={() => handleDeleteCategory(category.id_category)}
                      className="text-red-500 hover:text-red-700 transition-colors touch-manipulation p-1.5"
                      title="Eliminar categoría"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Botón de añadir subcategoría */}
                <button
                  onClick={() => {
                    setSelectedCategoryForSubcategory(category)
                    setShowSubcategoryModal(true)
                  }}
                  className="w-full rounded-xl bg-[#C7CEEA] px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-[#C7CEEA]/90 active:bg-[#C7CEEA]/80 transition-colors touch-manipulation min-h-[44px] text-center shadow-sm"
                >
                  + Añadir Subcategoría
                </button>
              </div>

              {expandedCategories.has(category.id_category) && (
                <div className="border-t border-gray-200 bg-gray-50 p-4">
                  {subcategoriesByCategory[category.id_category]?.length ===
                  0 ? (
                    <p className="text-sm text-gray-500 text-center py-2">
                      No hay subcategorías
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {subcategoriesByCategory[category.id_category]?.map(
                        (subcategory) => (
                          <div
                            key={subcategory.id_subcategory}
                            draggable
                            onDragStart={(e) =>
                              handleSubcategoryDragStart(
                                e,
                                category.id_category,
                                subcategory.id_subcategory
                              )
                            }
                            onDragOver={handleSubcategoryDragOver}
                            onDrop={(e) =>
                              handleSubcategoryDrop(
                                e,
                                category.id_category,
                                subcategory.id_subcategory
                              )
                            }
                            className={`flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 min-h-[44px] transition-opacity shadow-sm ${
                              draggedSubcategoryId?.idSubcategory ===
                              subcategory.id_subcategory
                                ? 'opacity-50'
                                : ''
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {/* Icono de hamburguesa para drag */}
                              <div
                                className="cursor-move touch-manipulation flex-shrink-0 text-gray-400 hover:text-gray-600 p-1 transition-colors"
                                title="Arrastrar para reordenar"
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 6h16M4 12h16M4 18h16"
                                  />
                                </svg>
                              </div>

                              <span className="text-sm text-gray-900 flex-1 min-w-0 truncate font-medium">
                                {subcategory.ds_subcategory}
                              </span>
                            </div>

                            {/* Botón eliminar con icono pequeño */}
                            <button
                              onClick={() =>
                                handleDeleteSubcategory(
                                  subcategory.id_subcategory
                                )
                              }
                              className="text-red-500 hover:text-red-700 transition-colors touch-manipulation p-1.5 flex-shrink-0"
                              title="Eliminar subcategoría"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCategoryCreated={handleCategoryCreated}
        idFamily={idFamily}
        transactionType={categoryType}
      />

      {selectedCategoryForSubcategory && (
        <SubcategoryModal
          isOpen={showSubcategoryModal}
          onClose={() => {
            setShowSubcategoryModal(false)
            setSelectedCategoryForSubcategory(null)
          }}
          onSubcategoryCreated={handleSubcategoryCreated}
          idCategory={selectedCategoryForSubcategory.id_category}
          categoryName={selectedCategoryForSubcategory.ds_category}
        />
      )}
    </div>
  )
}

