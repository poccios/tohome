/**
 * Admin Edit Restaurant Page
 * Edit restaurant info, hours, and delivery rules
 * WITH ENHANCED HOURS EDITOR: validations, quick actions, preview
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AdminGuard } from '@/components/admin-guard';
import { adminHttp, AdminHttpError } from '@/lib/adminHttp';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  force_closed: boolean;
  force_closed_note: string | null;
}

interface HourSlot {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

interface DeliveryRules {
  min_order_cents: number;
  delivery_fee_cents: number;
  eta_min_minutes: number;
  eta_max_minutes: number;
}

interface Override {
  id: string;
  restaurant_id: string;
  date: string; // YYYY-MM-DD
  is_closed: boolean;
  open_time: string | null; // HH:MM
  close_time: string | null; // HH:MM
  note: string | null;
}

const DAY_NAMES = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MAX_SLOTS_PER_DAY = 3;

function EditRestaurantPage() {
  const params = useParams();
  const router = useRouter();
  const restaurantId = params.id as string;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Basic info form
  const [form, setForm] = useState({
    name: '',
    slug: '',
    address: '',
    phone: '',
    latitude: '',
    longitude: '',
    is_active: true,
    force_closed: false,
    force_closed_note: '',
  });

  // Hours (weekly editor)
  const [hours, setHours] = useState<HourSlot[]>([]);

  // Delivery rules
  const [deliveryRules, setDeliveryRules] = useState({
    min_order_cents: 0,
    delivery_fee_cents: 0,
    eta_min_minutes: 0,
    eta_max_minutes: 0,
  });

  // Overrides (daily exceptions)
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [overrideForm, setOverrideForm] = useState({
    date: '',
    is_closed: false,
    open_time: '',
    close_time: '',
    note: '',
  });

  useEffect(() => {
    loadRestaurantData();
    loadOverrides();
  }, [restaurantId]);

  const loadRestaurantData = async () => {
    setLoading(true);
    setError('');

    try {
      const restResponse = await adminHttp.get<any>(`/admin/restaurants/${restaurantId}`);
      const rest = restResponse.data || restResponse;
      setRestaurant(rest);

      setForm({
        name: rest.name || '',
        slug: rest.slug || '',
        address: rest.address || '',
        phone: rest.phone || '',
        latitude: rest.lat ? String(rest.lat) : '',
        longitude: rest.lng ? String(rest.lng) : '',
        is_active: rest.is_active ?? true,
        force_closed: rest.force_closed ?? false,
        force_closed_note: rest.force_closed_note || '',
      });

      // Hours are included in the restaurant response
      if (rest.hours && Array.isArray(rest.hours)) {
        setHours(rest.hours);
      } else {
        setHours([]);
      }

      // Delivery rules are included in the restaurant response
      if (rest.delivery_rules) {
        const rules = rest.delivery_rules;
        setDeliveryRules({
          min_order_cents: rules.min_order_cents || 0,
          delivery_fee_cents: rules.delivery_fee_cents || 0,
          eta_min_minutes: rules.eta_min || 0,
          eta_max_minutes: rules.eta_max || 0,
        });
      }
    } catch (err) {
      if (err instanceof AdminHttpError) {
        setError(err.message);
      } else {
        setError('Errore nel caricamento ristorante');
      }
    } finally {
      setLoading(false);
    }
  };

  // ============ OVERRIDE MANAGEMENT ============

  const loadOverrides = async () => {
    try {
      const today = new Date();
      const fromDate = new Date(today);
      fromDate.setDate(today.getDate() - 14); // Last 14 days
      const toDate = new Date(today);
      toDate.setDate(today.getDate() + 14); // Next 14 days

      const from = fromDate.toISOString().split('T')[0];
      const to = toDate.toISOString().split('T')[0];

      const response = await adminHttp.get<{ ok: boolean; data: Override[] }>(
        `/admin/restaurants/${restaurantId}/overrides?from=${from}&to=${to}`
      );
      setOverrides(response.data || []);
    } catch (err) {
      console.error('Error loading overrides:', err);
    }
  };

  const handleCreateOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!overrideForm.date) {
      setError('Data richiesta');
      return;
    }

    try {
      const payload: any = {
        is_closed: overrideForm.is_closed,
      };

      if (!overrideForm.is_closed && overrideForm.open_time && overrideForm.close_time) {
        payload.open_time = overrideForm.open_time;
        payload.close_time = overrideForm.close_time;
      } else {
        payload.open_time = null;
        payload.close_time = null;
      }

      if (overrideForm.note) {
        payload.note = overrideForm.note;
      } else {
        payload.note = null;
      }

      await adminHttp.put(
        `/admin/restaurants/${restaurantId}/override/${overrideForm.date}`,
        payload
      );

      setSuccessMessage('Override creato/aggiornato con successo');
      setOverrideForm({ date: '', is_closed: false, open_time: '', close_time: '', note: '' });
      loadOverrides();
    } catch (err) {
      if (err instanceof AdminHttpError) {
        setError(err.message);
      } else {
        setError('Errore nella creazione override');
      }
    }
  };

  const handleDeleteOverride = async (date: string) => {
    if (!confirm(`Eliminare override per ${date}?`)) {
      return;
    }

    setError('');
    setSuccessMessage('');

    try {
      await adminHttp.delete(`/admin/restaurants/${restaurantId}/override/${date}`);
      setSuccessMessage('Override eliminato con successo');
      loadOverrides();
    } catch (err) {
      if (err instanceof AdminHttpError) {
        setError(err.message);
      } else {
        setError('Errore nell\'eliminazione override');
      }
    }
  };

  // ============ BASIC INFO MANAGEMENT ============

  const handleUpdateBasicInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        is_active: form.is_active,
        force_closed: form.force_closed,
        force_closed_note: form.force_closed_note.trim() || null,
      };

      await adminHttp.patch(`/admin/restaurants/${restaurantId}`, payload);
      setSuccessMessage('Informazioni aggiornate con successo');
      loadRestaurantData();
    } catch (err) {
      if (err instanceof AdminHttpError) {
        setError(err.message);
      } else {
        setError('Errore nell\'aggiornamento ristorante');
      }
    }
  };

  // ============ HOURS VALIDATION & MANAGEMENT ============

  const getSlotsForDay = (dayOfWeek: number) => {
    return hours.filter(slot => slot.day_of_week === dayOfWeek);
  };

  const isDayClosed = (dayOfWeek: number) => {
    const slots = getSlotsForDay(dayOfWeek);
    return slots.length > 0 && slots.every(slot => slot.is_closed);
  };

  const validateSlot = (slot: HourSlot): string[] => {
    const errors: string[] = [];

    if (!slot.is_closed) {
      if (!slot.open_time) errors.push('Orario apertura richiesto');
      if (!slot.close_time) errors.push('Orario chiusura richiesto');

      if (slot.open_time && slot.close_time && slot.open_time >= slot.close_time) {
        errors.push('Apertura deve essere prima della chiusura');
      }
    }

    return errors;
  };

  const checkOverlap = (slot1: HourSlot, slot2: HourSlot): boolean => {
    if (slot1.is_closed || slot2.is_closed) return false;
    if (slot1.day_of_week !== slot2.day_of_week) return false;

    // Check if time ranges overlap
    return (
      (slot1.open_time < slot2.close_time && slot1.close_time > slot2.open_time)
    );
  };

  const validateHours = (): Map<number, string[]> => {
    const errorsBySlot = new Map<number, string[]>();

    hours.forEach((slot, index) => {
      const slotErrors = validateSlot(slot);

      // Check overlaps with other slots on same day
      hours.forEach((otherSlot, otherIndex) => {
        if (index !== otherIndex && checkOverlap(slot, otherSlot)) {
          slotErrors.push('Sovrapposizione con altro slot');
        }
      });

      if (slotErrors.length > 0) {
        errorsBySlot.set(index, slotErrors);
      }
    });

    return errorsBySlot;
  };

  const hoursErrors = useMemo(() => validateHours(), [hours]);
  const hasErrors = hoursErrors.size > 0;

  const addHourSlot = (dayOfWeek: number) => {
    const daySlots = getSlotsForDay(dayOfWeek);
    if (daySlots.length >= MAX_SLOTS_PER_DAY) {
      alert(`Massimo ${MAX_SLOTS_PER_DAY} slot per giorno`);
      return;
    }

    const newSlot: HourSlot = {
      day_of_week: dayOfWeek,
      open_time: '12:00',
      close_time: '23:00',
      is_closed: false,
    };
    setHours([...hours, newSlot]);
  };

  const removeHourSlot = (dayOfWeek: number, slotIndex: number) => {
    const daySlots = getSlotsForDay(dayOfWeek);
    const slotToRemove = daySlots[slotIndex];
    const indexInAll = hours.indexOf(slotToRemove);
    setHours(hours.filter((_, i) => i !== indexInAll));
  };

  const updateHourSlot = (dayOfWeek: number, slotIndex: number, field: keyof HourSlot, value: any) => {
    const daySlots = getSlotsForDay(dayOfWeek);
    const slotToUpdate = daySlots[slotIndex];
    const indexInAll = hours.indexOf(slotToUpdate);

    const updated = [...hours];
    updated[indexInAll] = { ...updated[indexInAll], [field]: value };
    setHours(updated);
  };

  const setDayClosed = (dayOfWeek: number, isClosed: boolean) => {
    if (isClosed) {
      // Remove all slots for this day and add a closed slot
      const filtered = hours.filter(slot => slot.day_of_week !== dayOfWeek);
      setHours([...filtered, {
        day_of_week: dayOfWeek,
        open_time: '00:00',
        close_time: '00:00',
        is_closed: true,
      }]);
    } else {
      // Remove closed slot and add default open slot
      const filtered = hours.filter(slot => slot.day_of_week !== dayOfWeek);
      setHours([...filtered, {
        day_of_week: dayOfWeek,
        open_time: '12:00',
        close_time: '23:00',
        is_closed: false,
      }]);
    }
  };

  // Quick actions
  const copyMondayToAll = () => {
    const mondaySlots = getSlotsForDay(1);
    if (mondaySlots.length === 0) {
      alert('Nessun orario configurato per Lunedì');
      return;
    }

    const newHours: HourSlot[] = [];
    for (let day = 0; day < 7; day++) {
      mondaySlots.forEach(slot => {
        newHours.push({
          ...slot,
          day_of_week: day,
        });
      });
    }
    setHours(newHours);
    setSuccessMessage('Orari di Lunedì copiati su tutti i giorni');
  };

  const applyPreset = () => {
    const newHours: HourSlot[] = [];
    for (let day = 0; day < 7; day++) {
      newHours.push({
        day_of_week: day,
        open_time: '19:00',
        close_time: '23:30',
        is_closed: false,
      });
    }
    setHours(newHours);
    setSuccessMessage('Preset 19:00-23:30 applicato a tutti i giorni');
  };

  const closeAll = () => {
    const newHours: HourSlot[] = [];
    for (let day = 0; day < 7; day++) {
      newHours.push({
        day_of_week: day,
        open_time: '00:00',
        close_time: '00:00',
        is_closed: true,
      });
    }
    setHours(newHours);
    setSuccessMessage('Tutti i giorni impostati come chiusi');
  };

  const handleUpdateHours = async () => {
    setError('');
    setSuccessMessage('');

    try {
      await adminHttp.put(`/admin/restaurants/${restaurantId}/hours`, { hours });
      setSuccessMessage('Orari aggiornati con successo');
    } catch (err) {
      if (err instanceof AdminHttpError) {
        setError(err.message);
      } else {
        setError('Errore nell\'aggiornamento orari');
      }
    }
  };

  const handleUpdateDeliveryRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    try {
      await adminHttp.put(`/admin/restaurants/${restaurantId}/delivery-rules`, deliveryRules);
      setSuccessMessage('Regole di consegna aggiornate con successo');
    } catch (err) {
      if (err instanceof AdminHttpError) {
        setError(err.message);
      } else {
        setError('Errore nell\'aggiornamento regole consegna');
      }
    }
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
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <a href="/admin/restaurants" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '1rem', display: 'inline-block' }}>
            ← Torna ai ristoranti
          </a>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', margin: 0 }}>
            Modifica Ristorante: {restaurant?.name}
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
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

        {/* Basic Info Section */}
        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '2rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Informazioni Base</h2>
          <form onSubmit={handleUpdateBasicInfo}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Nome *</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Slug *</label>
                <input type="text" required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Indirizzo</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Telefono</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Latitudine</label>
                  <input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Longitudine</label>
                  <input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} style={{ width: '1.25rem', height: '1.25rem' }} />
                <label style={{ fontWeight: 500, fontSize: '0.875rem' }}>Ristorante attivo</label>
              </div>

              {/* Force Closed (Kill Switch) */}
              <div style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={form.force_closed}
                    onChange={(e) => setForm({ ...form, force_closed: e.target.checked })}
                    style={{ width: '1.25rem', height: '1.25rem' }}
                  />
                  <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#dc2626' }}>
                    🚫 Forza Chiuso (Kill Switch)
                  </label>
                </div>
                {form.force_closed && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#991b1b' }}>
                      Nota (motivo chiusura)
                    </label>
                    <textarea
                      value={form.force_closed_note}
                      onChange={(e) => setForm({ ...form, force_closed_note: e.target.value })}
                      placeholder="Es: Chiuso per manutenzione straordinaria"
                      rows={2}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #fca5a5',
                        borderRadius: '6px',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                        fontSize: '0.875rem',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                )}
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#991b1b' }}>
                  ⚠️ Quando attivo, il ristorante risulterà chiuso indipendentemente da orari e override
                </p>
              </div>

              <button type="submit" style={{ padding: '0.75rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>
                Salva Informazioni
              </button>
            </div>
          </form>
        </div>

        {/* Hours Section - ENHANCED */}
        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '2rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Orari di Apertura</h2>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={copyMondayToAll}
              style={{ padding: '0.5rem 1rem', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              📋 Copia Lun → Tutti
            </button>
            <button
              type="button"
              onClick={applyPreset}
              style={{ padding: '0.5rem 1rem', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              🕐 Preset 19:00-23:30
            </button>
            <button
              type="button"
              onClick={closeAll}
              style={{ padding: '0.5rem 1rem', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              🚫 Chiudi Tutti
            </button>
          </div>

          {/* Days */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {DAY_NAMES.map((dayName, dayIndex) => {
              const daySlots = getSlotsForDay(dayIndex);
              const isClosed = isDayClosed(dayIndex);

              return (
                <div key={dayIndex} style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{dayName}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={isClosed}
                        onChange={(e) => setDayClosed(dayIndex, e.target.checked)}
                        style={{ width: '1.1rem', height: '1.1rem' }}
                      />
                      <label style={{ fontSize: '0.875rem', color: '#6b7280' }}>Chiuso</label>
                    </div>
                  </div>

                  {!isClosed && (
                    <>
                      {daySlots.map((slot, slotIndex) => {
                        const slotGlobalIndex = hours.indexOf(slot);
                        const slotErrors = hoursErrors.get(slotGlobalIndex) || [];

                        return (
                          <div key={slotIndex} style={{ marginBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input
                                type="time"
                                value={slot.open_time}
                                onChange={(e) => updateHourSlot(dayIndex, slotIndex, 'open_time', e.target.value)}
                                style={{ padding: '0.5rem', border: slotErrors.length > 0 ? '1px solid #dc2626' : '1px solid #d1d5db', borderRadius: '4px' }}
                              />
                              <span>-</span>
                              <input
                                type="time"
                                value={slot.close_time}
                                onChange={(e) => updateHourSlot(dayIndex, slotIndex, 'close_time', e.target.value)}
                                style={{ padding: '0.5rem', border: slotErrors.length > 0 ? '1px solid #dc2626' : '1px solid #d1d5db', borderRadius: '4px' }}
                              />
                              <button
                                type="button"
                                onClick={() => removeHourSlot(dayIndex, slotIndex)}
                                style={{ padding: '0.5rem 0.75rem', backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }}
                              >
                                Rimuovi
                              </button>
                            </div>
                            {slotErrors.length > 0 && (
                              <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>
                                {slotErrors.map((err, i) => (
                                  <div key={i}>• {err}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {daySlots.length < MAX_SLOTS_PER_DAY && (
                        <button
                          type="button"
                          onClick={() => addHourSlot(dayIndex)}
                          style={{ padding: '0.5rem 1rem', backgroundColor: '#e0e7ff', color: '#3730a3', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }}
                        >
                          + Aggiungi Fascia ({daySlots.length}/{MAX_SLOTS_PER_DAY})
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleUpdateHours}
            disabled={hasErrors}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem',
              backgroundColor: hasErrors ? '#9ca3af' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: hasErrors ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              width: '100%',
            }}
          >
            {hasErrors ? '❌ Correggi gli errori prima di salvare' : 'Salva Orari'}
          </button>

          {/* Preview JSON */}
          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
              📄 Preview JSON (sarà inviato al backend):
            </div>
            <pre style={{ fontSize: '0.75rem', color: '#6b7280', overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify({ hours }, null, 2)}
            </pre>
          </div>
        </div>

        {/* Override Section */}
        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Override Giornalieri</h2>

          {/* Override Form */}
          <form onSubmit={handleCreateOverride} style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                  Data
                </label>
                <input
                  type="date"
                  value={overrideForm.date}
                  onChange={(e) => setOverrideForm({ ...overrideForm, date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                  Stato
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={overrideForm.is_closed}
                    onChange={(e) => setOverrideForm({ ...overrideForm, is_closed: e.target.checked })}
                  />
                  <span style={{ fontSize: '0.875rem' }}>Chiuso</span>
                </label>
              </div>
            </div>

            {!overrideForm.is_closed && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                    Apertura (opzionale)
                  </label>
                  <input
                    type="time"
                    value={overrideForm.open_time}
                    onChange={(e) => setOverrideForm({ ...overrideForm, open_time: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                    Chiusura (opzionale)
                  </label>
                  <input
                    type="time"
                    value={overrideForm.close_time}
                    onChange={(e) => setOverrideForm({ ...overrideForm, close_time: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                Note (opzionale)
              </label>
              <input
                type="text"
                value={overrideForm.note}
                onChange={(e) => setOverrideForm({ ...overrideForm, note: e.target.value })}
                placeholder="Es: Chiuso per ferie"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                padding: '0.75rem',
                backgroundColor: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Salva Override
            </button>
          </form>

          {/* Override List */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#374151' }}>
              Override Esistenti (ultimi 14 + prossimi 14 giorni)
            </h3>
            {overrides.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Nessun override configurato</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {overrides.map((override) => (
                  <div
                    key={override.id}
                    style={{
                      padding: '1rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      backgroundColor: '#f9fafb',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                          {new Date(override.date + 'T00:00:00').toLocaleDateString('it-IT', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          {override.is_closed ? (
                            <span style={{ color: '#dc2626', fontWeight: 500 }}>🚫 Chiuso</span>
                          ) : override.open_time && override.close_time ? (
                            <span style={{ color: '#16a34a', fontWeight: 500 }}>
                              🕐 {override.open_time} - {override.close_time}
                            </span>
                          ) : (
                            <span style={{ color: '#9ca3af' }}>Orari regolari</span>
                          )}
                        </div>
                        {override.note && (
                          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            📝 {override.note}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteOverride(override.date)}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                        }}
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

        {/* Delivery Rules Section */}
        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Regole di Consegna</h2>
          <form onSubmit={handleUpdateDeliveryRules}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Ordine Minimo (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={(deliveryRules.min_order_cents / 100).toFixed(2)}
                  onChange={(e) => setDeliveryRules({ ...deliveryRules, min_order_cents: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Costo Consegna (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={(deliveryRules.delivery_fee_cents / 100).toFixed(2)}
                  onChange={(e) => setDeliveryRules({ ...deliveryRules, delivery_fee_cents: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Tempo Min (minuti)</label>
                  <input
                    type="number"
                    value={deliveryRules.eta_min_minutes}
                    onChange={(e) => setDeliveryRules({ ...deliveryRules, eta_min_minutes: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Tempo Max (minuti)</label>
                  <input
                    type="number"
                    value={deliveryRules.eta_max_minutes}
                    onChange={(e) => setDeliveryRules({ ...deliveryRules, eta_max_minutes: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <button type="submit" style={{ padding: '0.75rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>
                Salva Regole di Consegna
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AdminEditRestaurantPage() {
  return (
    <AdminGuard>
      <EditRestaurantPage />
    </AdminGuard>
  );
}
