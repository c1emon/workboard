import type { ObjectDirective } from "vue";

type Options = { close: () => void; busy?: boolean };
type DialogState = { options: Options; restore: HTMLElement | null; blocked: Array<{ el: HTMLElement; inert: boolean }>; keydown: (event: KeyboardEvent) => void };
const states = new WeakMap<HTMLElement, DialogState>();
const stack: HTMLElement[] = [];

export const vModalFocus: ObjectDirective<HTMLElement, Options> = {
  mounted(el, binding) {
    const state: DialogState = { options: binding.value, restore: document.activeElement as HTMLElement, blocked: [], keydown: () => {} };
    let branch: HTMLElement = el;
    // Inert siblings along the ancestry also handles dialogs rendered inside the admin shell.
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      for (const sibling of parent.children) if (sibling instanceof HTMLElement && sibling !== branch) {
        state.blocked.push({ el: sibling, inert: sibling.inert });
        sibling.inert = true;
      }
      if (parent === document.body) break;
      branch = parent;
    }
    const focusables = () => [...el.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')];
    state.keydown = (event) => {
      if (stack.at(-1) !== el) return;
      if (event.key === 'Escape') {
        event.preventDefault();event.stopPropagation();if (!state.options.busy) state.options.close();return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusables(), first = elements[0], last = elements.at(-1);
      if (!first) { event.preventDefault();el.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === el)) { event.preventDefault();last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault();first.focus(); }
    };
    el.addEventListener('keydown', state.keydown);
    el.setAttribute('role', 'dialog');el.setAttribute('aria-modal', 'true');el.tabIndex = -1;
    states.set(el, state);stack.push(el);
    queueMicrotask(() => { if (stack.at(-1) === el) (el.querySelector<HTMLElement>('[data-initial-focus]') ?? focusables().find(item => ['INPUT','SELECT','TEXTAREA'].includes(item.tagName)) ?? focusables()[0] ?? el).focus(); });
  },
  updated(el, binding) { const state = states.get(el); if (state) state.options = binding.value; },
  beforeUnmount(el) {
    const state = states.get(el); if (!state) return;
    el.removeEventListener('keydown', state.keydown);
    const index = stack.indexOf(el);if (index >= 0) stack.splice(index, 1);
    state.blocked.forEach(({ el: sibling, inert }) => { sibling.inert = inert; });
    if (state.restore?.isConnected) state.restore.focus();
    states.delete(el);
  }
};
