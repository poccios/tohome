'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import {
  getRestaurant,
  getRestaurantMenu,
  type RestaurantDetail,
  type MenuCategory,
  type Product,
  type OptionGroup,
  type OptionItem,
} from '@/lib/api';
import { useCart } from '@/lib/cart/CartContext';
import type { CartOption } from '@/lib/cartTypes';

// Modal state
interface ModalState {
  product: Product;
  selections: Record<string, string[]>; // groupId -> itemIds[]
}

function RestaurantPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { addItem } = useCart();

  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal for products with options
  const [modal, setModal] = useState<ModalState | null>(null);

  useEffect(() => {
    fetchData();
  }, [slug]);

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      const [restaurantRes, menuRes] = await Promise.all([
        getRestaurant(slug),
        getRestaurantMenu(slug),
      ]);

      setRestaurant(restaurantRes.restaurant);
      setCategories(menuRes.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  }

  function handleAddSimple(product: Product) {
    if (!restaurant) return;

    addItem(
      {
        id: restaurant.id,
        slug: restaurant.slug,
        name: restaurant.name,
      },
      {
        id: product.id,
        name: product.name,
        base_price_cents: product.base_price_cents,
      },
      [],
      1
    );

    alert(`Aggiunto al carrello: ${product.name}`);
  }

  function handleAddWithOptions(product: Product) {
    // Initialize selections
    const initialSelections: Record<string, string[]> = {};
    product.option_groups.forEach((group) => {
      initialSelections[group.id] = [];
    });

    setModal({
      product,
      selections: initialSelections,
    });
  }

  function handleModalToggleItem(groupId: string, itemId: string, group: OptionGroup) {
    if (!modal) return;

    const current = modal.selections[groupId] || [];
    const isSelected = current.includes(itemId);

    let newSelection: string[];

    if (group.max_select === 1) {
      // Radio behavior
      newSelection = isSelected ? [] : [itemId];
    } else {
      // Checkbox behavior
      if (isSelected) {
        newSelection = current.filter((id) => id !== itemId);
      } else {
        if (current.length < group.max_select) {
          newSelection = [...current, itemId];
        } else {
          return; // Max reached
        }
      }
    }

    setModal({
      ...modal,
      selections: {
        ...modal.selections,
        [groupId]: newSelection,
      },
    });
  }

  function handleModalConfirm() {
    if (!modal || !restaurant) return;

    // Validate min_select for all groups
    const errors: string[] = [];

    modal.product.option_groups.forEach((group) => {
      const selected = modal.selections[group.id] || [];
      if (selected.length < group.min_select) {
        errors.push(`${group.name}: scegli almeno ${group.min_select}`);
      }
    });

    if (errors.length > 0) {
      alert('Errori:\n' + errors.join('\n'));
      return;
    }

    // Build CartOption array
    const cartOptions: CartOption[] = [];

    modal.product.option_groups.forEach((group) => {
      const selectedIds = modal.selections[group.id] || [];
      const selectedItems = group.items.filter((item) => selectedIds.includes(item.id));

      selectedItems.forEach((item) => {
        cartOptions.push({
          group_id: group.id,
          group_name: group.name,
          item_id: item.id,
          item_name: item.name,
          price_delta_cents: item.price_cents,
        });
      });
    });

    // Add to cart
    addItem(
      {
        id: restaurant.id,
        slug: restaurant.slug,
        name: restaurant.name,
      },
      {
        id: modal.product.id,
        name: modal.product.name,
        base_price_cents: modal.product.base_price_cents,
      },
      cartOptions,
      1
    );

    alert(`Aggiunto al carrello: ${modal.product.name}`);
    setModal(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Caricamento…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <p className="text-gray-600">Errore: {error}</p>
          <button
            onClick={fetchData}
            className="bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 transition-colors"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Ristorante non trovato</p>
      </div>
    );
  }

  const isOpen = restaurant.is_open ?? false;

  return (
    <div className="flex flex-col items-center min-h-screen p-8">
      <div className="w-full max-w-4xl space-y-8">
        {/* Restaurant Header */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h1 className="text-4xl font-bold mb-4">{restaurant.name}</h1>

          {restaurant.description && (
            <p className="text-gray-600 mb-4">{restaurant.description}</p>
          )}

          {(restaurant.address || restaurant.city) && (
            <p className="text-sm text-gray-600 mb-2">
              {restaurant.address}
              {restaurant.address && restaurant.city && ', '}
              {restaurant.city}
            </p>
          )}

          {/* Status Banner */}
          <div className="mb-4">
            {isOpen ? (
              <span
                className="inline-block px-2 py-1 text-xs rounded-full font-medium"
                style={{ backgroundColor: '#dcfce7', color: '#166534' }}
              >
                Aperto ora
              </span>
            ) : (
              <span
                className="inline-block px-2 py-1 text-xs rounded-full font-medium"
                style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}
              >
                Chiuso
              </span>
            )}
          </div>

          {/* Delivery Info */}
          <div className="text-sm text-gray-600 space-y-2">
            <p>Consegna: {restaurant.eta_min}–{restaurant.eta_max} min</p>
            <p>Costo consegna: €{(restaurant.delivery_fee / 100).toFixed(2)}</p>
            <p>Ordine minimo: €{(restaurant.min_order / 100).toFixed(2)}</p>
          </div>
        </div>

        {/* Menu */}
        {categories.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <p className="text-gray-600 text-center">Menu non disponibile</p>
          </div>
        ) : (
          <div className="space-y-8">
            {categories.map((category) => (
              <div key={category.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-2xl font-semibold mb-2">{category.name}</h2>
                {category.description && (
                  <p className="text-sm text-gray-600 mb-4">{category.description}</p>
                )}

                <div className="space-y-3">
                  {category.products.map((product) => (
                    <div
                      key={product.id}
                      className="border border-gray-200 rounded-md p-4 flex flex-col"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold mb-2">{product.name}</h3>
                        {product.description && (
                          <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                        )}
                        <p className="text-sm font-medium">
                          €{(product.base_price_cents / 100).toFixed(2)}
                        </p>
                      </div>

                      <div className="mt-3">
                        {!(product.is_available ?? true) ? (
                          <button
                            disabled
                            className="bg-gray-100 text-gray-400 px-4 py-2 rounded-md"
                            style={{ cursor: 'not-allowed' }}
                          >
                            Non disponibile
                          </button>
                        ) : product.option_groups && product.option_groups.length > 0 ? (
                          <button
                            onClick={() => handleAddWithOptions(product)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                          >
                            Aggiungi
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAddSimple(product)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                          >
                            Aggiungi
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for Options */}
      {modal && (
        <div
          className="fixed inset-0 bg-black flex items-center justify-center p-8"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 50 }}
          onClick={() => setModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-md p-6 w-full max-w-2xl"
            style={{ maxHeight: '80vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-semibold mb-4">{modal.product.name}</h2>

            <div className="space-y-8">
              {modal.product.option_groups.map((group) => {
                const selected = modal.selections[group.id] || [];
                const isRadio = group.max_select === 1;

                return (
                  <div key={group.id}>
                    <h3 className="font-semibold mb-2">
                      {group.name}
                      {group.min_select > 0 && (
                        <span className="text-sm text-gray-600 font-normal ml-2">
                          (scegli almeno {group.min_select})
                        </span>
                      )}
                    </h3>

                    <div className="space-y-2">
                      {group.items.map((item) => {
                        const isSelected = selected.includes(item.id);

                        return (
                          <label
                            key={item.id}
                            className="flex items-center p-2 border border-gray-200 rounded-md"
                            style={{ cursor: (item.is_available ?? true) ? 'pointer' : 'not-allowed' }}
                          >
                            <input
                              type={isRadio ? 'radio' : 'checkbox'}
                              checked={isSelected}
                              disabled={!(item.is_available ?? true)}
                              onChange={() => handleModalToggleItem(group.id, item.id, group)}
                              className="mr-2"
                              style={{ width: '1rem', height: '1rem' }}
                            />
                            <span className="flex-1">
                              {item.name}
                              {item.price_cents > 0 && (
                                <span className="text-sm text-gray-600 ml-2">
                                  +€{(item.price_cents / 100).toFixed(2)}
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex space-y-3 flex-col">
              <button
                onClick={handleModalConfirm}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Conferma
              </button>
              <button
                onClick={() => setModal(null)}
                className="w-full bg-gray-100 text-gray-700 px-4 py-3 rounded-md hover:bg-gray-200 transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RestaurantDetailPage() {
  return (
    <AuthGuard>
      <RestaurantPage />
    </AuthGuard>
  );
}
