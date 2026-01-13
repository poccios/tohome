/**
 * Admin Restaurant Menu Management Page
 * Manage categories and products for a specific restaurant
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AdminGuard } from '@/components/admin-guard';
import { adminHttp, AdminHttpError } from '@/lib/adminHttp';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
}

interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

interface Product {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  base_price_cents: number;
  sort_order: number;
  is_active: boolean;
  allergens: string | null;
}

type ModalMode = 'create-category' | 'edit-category' | 'create-product' | 'edit-product' | null;

function RestaurantMenuPage() {
  const params = useParams();
  const router = useRouter();
  const restaurantId = params.restaurantId as string;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form state for category
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    sort_order: 0,
    is_active: true,
  });

  // Form state for product
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    base_price_cents: 0,
    category_id: '',
    sort_order: 0,
    is_active: true,
    allergens: '',
  });

  useEffect(() => {
    loadRestaurantData();
  }, [restaurantId]);

  const loadRestaurantData = async () => {
    setLoading(true);
    setError('');

    try {
      // Load restaurant details
      const restResponse = await adminHttp.get<any>(`/restaurants/${restaurantId}`);
      const rest = restResponse.restaurant || restResponse.data || restResponse;
      setRestaurant(rest);

      // Load menu (categories and products)
      const menuResponse = await adminHttp.get<any>(`/restaurants/${restaurantId}/menu`);

      let cats: Category[] = [];
      if (Array.isArray(menuResponse)) {
        cats = menuResponse;
      } else if (menuResponse.categories) {
        cats = menuResponse.categories;
      } else if (menuResponse.data?.categories) {
        cats = menuResponse.data.categories;
      }

      // Extract products from categories
      const allProducts: Product[] = [];
      cats.forEach((cat) => {
        if (cat.products && Array.isArray(cat.products)) {
          allProducts.push(...cat.products);
        }
      });

      setCategories(cats);
      setProducts(allProducts);
    } catch (err) {
      if (err instanceof AdminHttpError) {
        setError(err.message);
      } else {
        setError('Errore nel caricamento dati');
      }
    } finally {
      setLoading(false);
    }
  };

  // Category handlers
  const openCreateCategoryModal = () => {
    setCategoryForm({
      name: '',
      description: '',
      sort_order: categories.length,
      is_active: true,
    });
    setModalMode('create-category');
  };

  const openEditCategoryModal = (category: Category) => {
    setSelectedCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      sort_order: category.sort_order,
      is_active: category.is_active,
    });
    setModalMode('edit-category');
  };

  const handleCreateCategory = async () => {
    setError('');
    try {
      await adminHttp.post(`/admin/restaurants/${restaurantId}/categories`, {
        name: categoryForm.name,
        description: categoryForm.description || null,
        sort_order: categoryForm.sort_order,
        is_active: categoryForm.is_active,
      });

      setModalMode(null);
      loadRestaurantData();
    } catch (err) {
      if (err instanceof AdminHttpError) {
        setError(err.message);
      } else {
        setError('Errore nella creazione categoria');
      }
    }
  };

  const handleUpdateCategory = async () => {
    if (!selectedCategory) return;

    setError('');
    try {
      await adminHttp.patch(`/admin/categories/${selectedCategory.id}`, {
        name: categoryForm.name,
        description: categoryForm.description || null,
        sort_order: categoryForm.sort_order,
        is_active: categoryForm.is_active,
      });

      setModalMode(null);
      setSelectedCategory(null);
      loadRestaurantData();
    } catch (err) {
      if (err instanceof AdminHttpError) {
        setError(err.message);
      } else {
        setError('Errore nell\'aggiornamento categoria');
      }
    }
  };

  // Product handlers
  const openCreateProductModal = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    const productsInCategory = products.filter((p) => p.category_id === categoryId);

    setProductForm({
      name: '',
      description: '',
      base_price_cents: 0,
      category_id: categoryId,
      sort_order: productsInCategory.length,
      is_active: true,
      allergens: '',
    });
    setModalMode('create-product');
  };

  const openEditProductModal = (product: Product) => {
    setSelectedProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      base_price_cents: product.base_price_cents,
      category_id: product.category_id,
      sort_order: product.sort_order,
      is_active: product.is_active,
      allergens: product.allergens || '',
    });
    setModalMode('edit-product');
  };

  const handleCreateProduct = async () => {
    setError('');
    try {
      await adminHttp.post(`/admin/restaurants/${restaurantId}/products`, {
        name: productForm.name,
        description: productForm.description || null,
        base_price_cents: productForm.base_price_cents,
        category_id: productForm.category_id,
        sort_order: productForm.sort_order,
        is_active: productForm.is_active,
        allergens: productForm.allergens || null,
      });

      setModalMode(null);
      loadRestaurantData();
    } catch (err) {
      if (err instanceof AdminHttpError) {
        setError(err.message);
      } else {
        setError('Errore nella creazione prodotto');
      }
    }
  };

  const handleUpdateProduct = async () => {
    if (!selectedProduct) return;

    setError('');
    try {
      await adminHttp.patch(`/admin/products/${selectedProduct.id}`, {
        name: productForm.name,
        description: productForm.description || null,
        base_price_cents: productForm.base_price_cents,
        category_id: productForm.category_id,
        sort_order: productForm.sort_order,
        is_active: productForm.is_active,
        allergens: productForm.allergens || null,
      });

      setModalMode(null);
      setSelectedProduct(null);
      loadRestaurantData();
    } catch (err) {
      if (err instanceof AdminHttpError) {
        setError(err.message);
      } else {
        setError('Errore nell\'aggiornamento prodotto');
      }
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo prodotto?')) return;

    setError('');
    try {
      await adminHttp.delete(`/admin/products/${productId}`);
      loadRestaurantData();
    } catch (err) {
      if (err instanceof AdminHttpError) {
        setError(err.message);
      } else {
        setError('Errore nell\'eliminazione prodotto');
      }
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedCategory(null);
    setSelectedProduct(null);
    setError('');
  };

  const getProductsForCategory = (categoryId: string) => {
    return products.filter((p) => p.category_id === categoryId).sort((a, b) => a.sort_order - b.sort_order);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: '#6b7280' }}>Caricamento...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', padding: '1rem 2rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <a href="/admin/menu" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '1rem', display: 'inline-block' }}>
            ← Torna ai ristoranti
          </a>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', margin: 0 }}>
            Menu: {restaurant?.name}
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.5rem 0 0 0' }}>
            Gestisci categorie e prodotti
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        {error && (
          <div style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* Categories */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Categorie</h2>
            <button
              onClick={openCreateCategoryModal}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
            >
              + Nuova Categoria
            </button>
          </div>

          {categories.length === 0 ? (
            <div style={{ padding: '2rem', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ color: '#6b7280' }}>Nessuna categoria. Creane una per iniziare!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {categories.sort((a, b) => a.sort_order - b.sort_order).map((category) => (
                <div key={category.id} style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>{category.name}</h3>
                        <span style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', borderRadius: '9999px', backgroundColor: category.is_active ? '#dcfce7' : '#fee2e2', color: category.is_active ? '#166534' : '#991b1b' }}>
                          {category.is_active ? 'Attiva' : 'Disattivata'}
                        </span>
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Sort: {category.sort_order}</span>
                      </div>
                      {category.description && <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>{category.description}</p>}
                    </div>
                    <button
                      onClick={() => openEditCategoryModal(category)}
                      style={{ padding: '0.5rem 1rem', backgroundColor: '#fff', color: '#2563eb', border: '1px solid #2563eb', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}
                    >
                      Modifica
                    </button>
                  </div>

                  {/* Products in category */}
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Prodotti</h4>
                      <button
                        onClick={() => openCreateProductModal(category.id)}
                        style={{ padding: '0.5rem 1rem', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}
                      >
                        + Aggiungi Prodotto
                      </button>
                    </div>

                    {getProductsForCategory(category.id).length === 0 ? (
                      <p style={{ color: '#9ca3af', fontSize: '0.875rem', fontStyle: 'italic' }}>Nessun prodotto in questa categoria</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {getProductsForCategory(category.id).map((product) => (
                          <div key={product.id} style={{ padding: '1rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <strong style={{ fontSize: '0.95rem' }}>{product.name}</strong>
                                <span style={{ padding: '0.125rem 0.5rem', fontSize: '0.7rem', borderRadius: '9999px', backgroundColor: product.is_active ? '#dcfce7' : '#fee2e2', color: product.is_active ? '#166534' : '#991b1b' }}>
                                  {product.is_active ? 'Attivo' : 'Disattivato'}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Sort: {product.sort_order}</span>
                              </div>
                              {product.description && <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>{product.description}</p>}
                              <p style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.9rem', margin: '0.5rem 0 0 0' }}>€{(product.base_price_cents / 100).toFixed(2)}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                onClick={() => openEditProductModal(product)}
                                style={{ padding: '0.5rem 1rem', backgroundColor: '#fff', color: '#2563eb', border: '1px solid #2563eb', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                              >
                                Modifica
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(product.id)}
                                style={{ padding: '0.5rem 1rem', backgroundColor: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                              >
                                Elimina
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalMode && (
        <div
          onClick={closeModal}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '2rem' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#fff', borderRadius: '8px', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflow: 'auto', padding: '2rem' }}
          >
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
              {modalMode === 'create-category' && 'Nuova Categoria'}
              {modalMode === 'edit-category' && 'Modifica Categoria'}
              {modalMode === 'create-product' && 'Nuovo Prodotto'}
              {modalMode === 'edit-product' && 'Modifica Prodotto'}
            </h3>

            {/* Category Form */}
            {(modalMode === 'create-category' || modalMode === 'edit-category') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Nome *</label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Descrizione</label>
                  <textarea
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    rows={3}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Ordine</label>
                  <input
                    type="number"
                    value={categoryForm.sort_order}
                    onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={categoryForm.is_active}
                    onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
                    style={{ width: '1.25rem', height: '1.25rem' }}
                  />
                  <label style={{ fontWeight: 500, fontSize: '0.875rem' }}>Attiva</label>
                </div>
              </div>
            )}

            {/* Product Form */}
            {(modalMode === 'create-product' || modalMode === 'edit-product') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Nome *</label>
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Descrizione</label>
                  <textarea
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    rows={3}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Prezzo (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={(productForm.base_price_cents / 100).toFixed(2)}
                    onChange={(e) => setProductForm({ ...productForm, base_price_cents: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>
                {modalMode === 'edit-product' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Categoria</label>
                    <select
                      value={productForm.category_id}
                      onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Ordine</label>
                  <input
                    type="number"
                    value={productForm.sort_order}
                    onChange={(e) => setProductForm({ ...productForm, sort_order: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={productForm.is_active}
                    onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                    style={{ width: '1.25rem', height: '1.25rem' }}
                  />
                  <label style={{ fontWeight: 500, fontSize: '0.875rem' }}>Attivo</label>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button
                onClick={closeModal}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  if (modalMode === 'create-category') handleCreateCategory();
                  else if (modalMode === 'edit-category') handleUpdateCategory();
                  else if (modalMode === 'create-product') handleCreateProduct();
                  else if (modalMode === 'edit-product') handleUpdateProduct();
                }}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
              >
                {modalMode?.startsWith('create') ? 'Crea' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminRestaurantMenuPage() {
  return (
    <AdminGuard>
      <RestaurantMenuPage />
    </AdminGuard>
  );
}
