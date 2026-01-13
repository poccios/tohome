import { DateTime } from 'luxon';

export interface RestaurantHours {
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  open_time: string; // HH:MM:SS format (e.g., "09:00:00")
  close_time: string; // HH:MM:SS format (e.g., "22:00:00")
  is_closed: boolean;
}

export interface RestaurantOverride {
  date: string; // YYYY-MM-DD
  is_closed: boolean;
  open_time: string | null; // HH:MM format
  close_time: string | null; // HH:MM format
}

/**
 * Determines if a restaurant is currently open based on its hours
 * Uses Europe/Rome timezone
 * Handles slots that cross midnight (e.g., 19:00-02:00)
 * Skips slots where is_closed = true
 * Prioritizes daily overrides if provided for the current date
 *
 * @param hours Array of restaurant hours
 * @param override Optional override for today's date
 * @returns true if restaurant is currently open, false otherwise
 */
export function isRestaurantOpenNow(
  hours: RestaurantHours[],
  override?: RestaurantOverride | null
): boolean {
  if (!hours || hours.length === 0) {
    return false;
  }

  // Get current time in Europe/Rome timezone
  const now = DateTime.now().setZone('Europe/Rome');
  const currentDayOfWeek = now.weekday % 7; // Convert luxon's 1-7 (Mon-Sun) to 0-6 (Sun-Sat)
  const currentTime = now.toFormat('HH:mm:ss');
  const todayDate = now.toFormat('yyyy-MM-dd');

  // Check if there's an override for today
  if (override && override.date === todayDate) {
    // If override says closed, restaurant is closed
    if (override.is_closed) {
      return false;
    }

    // If override has custom hours, check against those
    if (override.open_time && override.close_time) {
      const openTime = `${override.open_time}:00`; // Convert HH:MM to HH:MM:SS
      const closeTime = `${override.close_time}:00`;
      return isTimeInSlot(currentTime, openTime, closeTime);
    }

    // If override is not closed but has no times, fall through to regular hours
  }

  // Check today's hours
  const todayHours = hours.filter(
    (h) => h.day_of_week === currentDayOfWeek && !h.is_closed
  );

  for (const slot of todayHours) {
    if (isTimeInSlot(currentTime, slot.open_time, slot.close_time)) {
      return true;
    }
  }

  // Check if we're in a slot from yesterday that crosses midnight
  const yesterdayDayOfWeek = (currentDayOfWeek + 6) % 7; // -1 with wrap
  const yesterdayHours = hours.filter(
    (h) => h.day_of_week === yesterdayDayOfWeek && !h.is_closed
  );

  for (const slot of yesterdayHours) {
    // If close_time < open_time, the slot crosses midnight
    if (slot.close_time < slot.open_time) {
      // Check if current time is before the close time (in the "next day" part)
      if (currentTime < slot.close_time) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Helper function to check if a time is within a slot
 * Handles slots that cross midnight
 *
 * @param time Current time (HH:mm:ss)
 * @param openTime Slot open time (HH:mm:ss)
 * @param closeTime Slot close time (HH:mm:ss)
 * @returns true if time is within the slot
 */
function isTimeInSlot(time: string, openTime: string, closeTime: string): boolean {
  if (closeTime > openTime) {
    // Normal slot (doesn't cross midnight)
    return time >= openTime && time < closeTime;
  } else {
    // Slot crosses midnight (e.g., 19:00-02:00)
    return time >= openTime || time < closeTime;
  }
}
