// Web test setup
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import React from 'react';

// Mock console methods to reduce noise
global.console = {
  ...console,
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Mock fetch
global.fetch = vi.fn();

// Custom render with providers
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialPath?: string;
}

const customRender = (ui: React.ReactElement, options: CustomRenderOptions = {}) => {
  const { initialPath = '/', ...renderOptions } = options;
  
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter initialEntries={[initialPath]}>
      {children}
    </BrowserRouter>
  );

  return render(ui, { wrapper, ...renderOptions });
};

export * from '@testing-library/react';
export { customRender as render };

// Test utilities
export const testUtils = {
  // Mock auth context
  mockAuth: (user = { id: 'test-user', email: 'test@test.com', nombre: 'Test User' }) => {
    vi.stubGlobal('useAuth', () => ({
      user,
      login: vi.fn(),
      logout: vi.fn(),
      isLoading: false,
    }));
  },

  // Wait for async operations
  waitFor: (fn: () => Promise<void> | void) => {
    return new Promise(resolve => setTimeout(() => resolve(fn()), 0));
  },
};

// Custom matchers
expect.extend({
  toBeInTheDocument(received: HTMLElement | null) {
    const pass = received !== null && document.body.contains(received);
    return {
      pass,
      message: () => pass
        ? 'expected element not to be in the document'
        : 'expected element to be in the document',
    };
  },

  toHaveTextContent(received: HTMLElement | null, expected: string | RegExp) {
    if (!received) {
      return {
        pass: false,
        message: () => 'expected element to exist',
      };
    }
    const text = received.textContent || '';
    const pass = typeof expected === 'string' 
      ? text.includes(expected) 
      : expected.test(text);
    return {
      pass,
      message: () => pass
        ? `expected element not to have text content matching ${expected}`
        : `expected element to have text content matching ${expected}, got "${text}"`,
    };
  },
});

declare global {
  namespace Vi {
    interface JestAssertion<T = any> {
      toBeInTheDocument(): T;
      toHaveTextContent(expected: string | RegExp): T;
    }
  }
}