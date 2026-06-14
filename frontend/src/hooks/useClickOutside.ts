import { useEffect, RefObject } from 'react';

/**
 * useClickOutside — Custom hook theo dõi click bên ngoài một phần tử.
 *
 * Trích xuất logic useEffect + mousedown listener đang bị copy-paste
 * ở RegisterFace, EmployeeDirectory, và ManagerDashboard.
 *
 * @param ref     - Ref tới phần tử DOM cần theo dõi
 * @param handler - Hàm callback gọi khi click bên ngoài phần tử
 *
 * @note handler nên được bọc bằng useCallback để tránh effect
 *       chạy lại không cần thiết trên mỗi lần render.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  handler: () => void
): void {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}
