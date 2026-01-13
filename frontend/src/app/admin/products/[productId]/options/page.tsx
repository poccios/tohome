/**
 * Admin Product Options Page
 * Manage option groups and items for a specific product
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AdminGuard } from '@/components/admin-guard';
import { adminHttp, AdminHttpError } from '@/lib/adminHttp';

interface Product {
  id: string;
  name: string;
  restaurant_id: string;
  category_id: string;
}

interface OptionItem {
  id?: string;
  name: string;
  price_delta_cents: number;
  is_active: boolean;
  sort_order: number;
}

interface OptionGroup {
  id?: string;
  name: string;
  min_select: number;
  max_select: number;
  sort_order: number;
  items: OptionItem[];
}

type ModalMode = 'create-group' | 'edit-group' | 'create-item' | 'edit-item' | null;

function ProductOptionsPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.productId as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

  // Form state for option group
  const [groupForm, setGroupForm] = useState({
    name: '',
    min_select: 0,
    max_select: 1,
    sort_order: 0,
  });

  // Form state for option item
  const [itemForm, setItemForm] = useState({
    name: '',
    price_delta_cents: 0,
    is_active: true,
    sort_order: 0,
  });

  useEffect(() => {
    loadProductData();
  }, [productId]);

  const loadProductData = async () => {
    setLoading(true);
    setError('');

    try {
      // Load product with options
      const response = await adminHttp.get<any>(`/admin/products/${productId}`);
      const prod = response.product || response.data || response;
      setProduct(prod);

      // Load existing options
      let groups: OptionGroup[] = [];
      if (prod.option_groups && Array.isArray(prod.option_groups)) {
        groups = prod.option_groups;
      } else if (prod.options?.groups) {
        groups = prod.options.groups;
      }

      setOptionGroups(groups);
    } catch (err) {
      if (err instanceof AdminHttpError) {
        setError(err.message);
      } else {
        setError('Errore nel caricamento prodotto');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOptions = async () => {
    setError('');
    setSuccessMessage('');
    setSaving(true);

    try {
      // PUT replaces all options
      await adminHttp.put(`/admin/products/${productId}/options`, {
        option_groups: optionGroups,
      });

      setSuccessMessage('Opzioni salvate con successo');
      loadProductData();
    } catch (err) {
      if (err instanceof AdminHttpError) {
        setError(err.message);
      } else {
        setError('Errore nel salvataggio opzioni');
      }
    } finally {
      setSaving(false);
    }
  };

  // Group handlers
  const openCreateGroupModal = () => {
    setGroupForm({
      name: '',
      min_select: 0,
      max_select: 1,
      sort_order: optionGroups.length,
    });
    setModalMode('create-group');
  };

  const openEditGroupModal = (index: number) => {
    const group = optionGroups[index];
    setSelectedGroupIndex(index);
    setGroupForm({
      name: group.name,
      min_select: group.min_select,
      max_select: group.max_select,
      sort_order: group.sort_order,
    });
    setModalMode('edit-group');
  };

  const handleCreateGroup = () => {
    const newGroup: OptionGroup = {
      name: groupForm.name,
      min_select: groupForm.min_select,
      max_select: groupForm.max_select,
      sort_order: groupForm.sort_order,
      items: [],
    };

    setOptionGroups([...optionGroups, newGroup]);
    setModalMode(null);
  };

  const handleUpdateGroup = () => {
    if (selectedGroupIndex === null) return;

    const updated = [...optionGroups];
    updated[selectedGroupIndex] = {
      ...updated[selectedGroupIndex],
      name: groupForm.name,
      min_select: groupForm.min_select,
      max_select: groupForm.max_select,
      sort_order: groupForm.sort_order,
    };

    setOptionGroups(updated);
    setModalMode(null);
    setSelectedGroupIndex(null);
  };

  const handleDeleteGroup = (index: number) => {
    if (!confirm('Sei sicuro di voler eliminare questo gruppo di opzioni?')) return;
    setOptionGroups(optionGroups.filter((_, i) => i !== index));
  };

  // Item handlers
  const openCreateItemModal = (groupIndex: number) => {
    const group = optionGroups[groupIndex];
    setSelectedGroupIndex(groupIndex);
    setItemForm({
      name: '',
      price_delta_cents: 0,
      is_active: true,
      sort_order: group.items.length,
    });
    setModalMode('create-item');
  };

  const openEditItemModal = (groupIndex: number, itemIndex: number) => {
    const item = optionGroups[groupIndex].items[itemIndex];
    setSelectedGroupIndex(groupIndex);
    setSelectedItemIndex(itemIndex);
    setItemForm({
      name: item.name,
      price_delta_cents: item.price_delta_cents,
      is_active: item.is_active,
      sort_order: item.sort_order,
    });
    setModalMode('edit-item');
  };

  const handleCreateItem = () => {
    if (selectedGroupIndex === null) return;

    const newItem: OptionItem = {
      name: itemForm.name,
      price_delta_cents: itemForm.price_delta_cents,
      is_active: itemForm.is_active,
      sort_order: itemForm.sort_order,
    };

    const updated = [...optionGroups];
    updated[selectedGroupIndex].items.push(newItem);
    setOptionGroups(updated);
    setModalMode(null);
    setSelectedGroupIndex(null);
  };

  const handleUpdateItem = () => {
    if (selectedGroupIndex === null || selectedItemIndex === null) return;

    const updated = [...optionGroups];
    updated[selectedGroupIndex].items[selectedItemIndex] = {
      ...updated[selectedGroupIndex].items[selectedItemIndex],
      name: itemForm.name,
      price_delta_cents: itemForm.price_delta_cents,
      is_active: itemForm.is_active,
      sort_order: itemForm.sort_order,
    };

    setOptionGroups(updated);
    setModalMode(null);
    setSelectedGroupIndex(null);
    setSelectedItemIndex(null);
  };

  const handleDeleteItem = (groupIndex: number, itemIndex: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa opzione?')) return;

    const updated = [...optionGroups];
    updated[groupIndex].items = updated[groupIndex].items.filter((_, i) => i !== itemIndex);
    setOptionGroups(updated);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedGroupIndex(null);
    setSelectedItemIndex(null);
    setError('');
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
          <a
            href={product ? `/admin/menu/${product.restaurant_id}` : '/admin/menu'}
            style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '1rem', display: 'inline-block' }}
          >
            ← Torna al menu
          </a>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', margin: 0 }}>
            Opzioni Prodotto: {product?.name}
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.5rem 0 0 0' }}>
            Gestisci gruppi di opzioni e relative scelte
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

        {successMessage && (
          <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', marginBottom: '1rem' }}>
            {successMessage}
          </div>
        )}

        {/* Actions Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <button
            onClick={openCreateGroupModal}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
          >
            + Nuovo Gruppo Opzioni
          </button>

          <button
            onClick={handleSaveOptions}
            disabled={saving}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: '#16a34a',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? 'Salvataggio...' : '💾 Salva Tutte le Opzioni'}
          </button>
        </div>

        {/* Option Groups */}
        {optionGroups.length === 0 ? (
          <div style={{ padding: '3rem', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
              Nessun gruppo di opzioni. Creane uno per iniziare!
            </p>
            <button
              onClick={openCreateGroupModal}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
            >
              + Nuovo Gruppo Opzioni
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {optionGroups.sort((a, b) => a.sort_order - b.sort_order).map((group, groupIndex) => (
              <div key={groupIndex} style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem' }}>
                {/* Group Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{group.name}</h3>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      <span>Min: {group.min_select}</span>
                      <span>Max: {group.max_select}</span>
                      <span>Sort: {group.sort_order}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => openEditGroupModal(groupIndex)}
                      style={{ padding: '0.5rem 1rem', backgroundColor: '#fff', color: '#2563eb', border: '1px solid #2563eb', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}
                    >
                      Modifica
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(groupIndex)}
                      style={{ padding: '0.5rem 1rem', backgroundColor: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}
                    >
                      Elimina
                    </button>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Opzioni</h4>
                    <button
                      onClick={() => openCreateItemModal(groupIndex)}
                      style={{ padding: '0.5rem 1rem', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}
                    >
                      + Aggiungi Opzione
                    </button>
                  </div>

                  {group.items.length === 0 ? (
                    <p style={{ color: '#9ca3af', fontSize: '0.875rem', fontStyle: 'italic', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                      Nessuna opzione in questo gruppo
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {group.items.sort((a, b) => a.sort_order - b.sort_order).map((item, itemIndex) => (
                        <div
                          key={itemIndex}
                          style={{
                            padding: '1rem',
                            backgroundColor: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                              <strong style={{ fontSize: '0.95rem' }}>{item.name}</strong>
                              <span
                                style={{
                                  padding: '0.125rem 0.5rem',
                                  fontSize: '0.7rem',
                                  borderRadius: '9999px',
                                  backgroundColor: item.is_active ? '#dcfce7' : '#fee2e2',
                                  color: item.is_active ? '#166534' : '#991b1b',
                                }}
                              >
                                {item.is_active ? 'Attiva' : 'Disattivata'}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Sort: {item.sort_order}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
                              <span style={{ color: item.price_delta_cents > 0 ? '#16a34a' : item.price_delta_cents < 0 ? '#dc2626' : '#6b7280', fontWeight: 500 }}>
                                {item.price_delta_cents > 0 && '+'}{(item.price_delta_cents / 100).toFixed(2)}€
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => openEditItemModal(groupIndex, itemIndex)}
                              style={{ padding: '0.5rem 1rem', backgroundColor: '#fff', color: '#2563eb', border: '1px solid #2563eb', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              Modifica
                            </button>
                            <button
                              onClick={() => handleDeleteItem(groupIndex, itemIndex)}
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

        {/* Info Box */}
        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px' }}>
          <p style={{ color: '#1e40af', fontSize: '0.875rem', margin: 0 }}>
            💡 <strong>Nota:</strong> Le modifiche non vengono salvate automaticamente. Clicca su "Salva Tutte le Opzioni" per applicare i cambiamenti.
          </p>
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
              {modalMode === 'create-group' && 'Nuovo Gruppo Opzioni'}
              {modalMode === 'edit-group' && 'Modifica Gruppo Opzioni'}
              {modalMode === 'create-item' && 'Nuova Opzione'}
              {modalMode === 'edit-item' && 'Modifica Opzione'}
            </h3>

            {/* Group Form */}
            {(modalMode === 'create-group' || modalMode === 'edit-group') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Nome Gruppo *</label>
                  <input
                    type="text"
                    value={groupForm.name}
                    onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                    placeholder="es: Dimensione, Ingredienti Extra"
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Min Select</label>
                    <input
                      type="number"
                      min="0"
                      value={groupForm.min_select}
                      onChange={(e) => setGroupForm({ ...groupForm, min_select: parseInt(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                    />
                    <small style={{ color: '#6b7280', fontSize: '0.75rem' }}>Scelte minime richieste</small>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Max Select</label>
                    <input
                      type="number"
                      min="0"
                      value={groupForm.max_select}
                      onChange={(e) => setGroupForm({ ...groupForm, max_select: parseInt(e.target.value) || 1 })}
                      style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                    />
                    <small style={{ color: '#6b7280', fontSize: '0.75rem' }}>Scelte massime consentite</small>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Ordine</label>
                  <input
                    type="number"
                    value={groupForm.sort_order}
                    onChange={(e) => setGroupForm({ ...groupForm, sort_order: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            )}

            {/* Item Form */}
            {(modalMode === 'create-item' || modalMode === 'edit-item') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Nome Opzione *</label>
                  <input
                    type="text"
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    placeholder="es: Piccola, Grande, Mozzarella Extra"
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Variazione Prezzo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={(itemForm.price_delta_cents / 100).toFixed(2)}
                    onChange={(e) => setItemForm({ ...itemForm, price_delta_cents: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                    placeholder="0.00 (es: 2.50 per +2.50€)"
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                  <small style={{ color: '#6b7280', fontSize: '0.75rem' }}>Usa valori negativi per sconti (es: -1.00)</small>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Ordine</label>
                  <input
                    type="number"
                    value={itemForm.sort_order}
                    onChange={(e) => setItemForm({ ...itemForm, sort_order: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={itemForm.is_active}
                    onChange={(e) => setItemForm({ ...itemForm, is_active: e.target.checked })}
                    style={{ width: '1.25rem', height: '1.25rem' }}
                  />
                  <label style={{ fontWeight: 500, fontSize: '0.875rem' }}>Opzione attiva</label>
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
                  if (modalMode === 'create-group') handleCreateGroup();
                  else if (modalMode === 'edit-group') handleUpdateGroup();
                  else if (modalMode === 'create-item') handleCreateItem();
                  else if (modalMode === 'edit-item') handleUpdateItem();
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

export default function AdminProductOptionsPage() {
  return (
    <AdminGuard>
      <ProductOptionsPage />
    </AdminGuard>
  );
}
