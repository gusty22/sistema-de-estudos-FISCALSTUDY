import { useEffect, useRef } from 'react';

export interface UseModalA11yOptions {
  isOpen: boolean;
  onClose: () => void;
  closeOnEscape?: boolean;
  restoreFocus?: boolean;
}

/**
 * Hook para padronizar acessibilidade em modais do FiscalStudy:
 * - Captura e restaura o foco do elemento que disparou a abertura.
 * - Trata tecla Escape para encerramento sem fechar indevidamente se estiver em campos de texto.
 */
export function useModalA11y({
  isOpen,
  onClose,
  closeOnEscape = true,
  restoreFocus = true
}: UseModalA11yOptions) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (typeof document !== 'undefined') {
        previousFocusRef.current = document.activeElement as HTMLElement | null;
      }
    } else if (restoreFocus && previousFocusRef.current) {
      try {
        previousFocusRef.current.focus?.();
      } catch {
        // Fallback silencioso caso o nó tenha sido desmontado
      }
      previousFocusRef.current = null;
    }
  }, [isOpen, restoreFocus]);

  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, closeOnEscape, onClose]);

  return { previousFocusRef };
}

/**
 * Trata navegação por teclado (Enter ou Barra de Espaço) em cartões interativos (ex: alternativas).
 */
export function handleKeyActivate(event: React.KeyboardEvent, callback: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    callback();
  }
}
