import { ref } from "vue";
import type { ConfirmationRequest, ConfirmationState } from "./types";

export function useConfirmation() {
  const confirmation = ref<ConfirmationState | null>(null);

  function requestConfirmation(request: ConfirmationRequest): Promise<boolean> {
    confirmation.value?.resolve(false);
    return new Promise((resolve) => {
      confirmation.value = { ...request, resolve };
    });
  }

  function settleConfirmation(confirmed: boolean): void {
    const current = confirmation.value;
    confirmation.value = null;
    current?.resolve(confirmed);
  }

  function confirmConfirmation(): void {
    settleConfirmation(true);
  }

  function cancelConfirmation(): void {
    settleConfirmation(false);
  }

  return {
    confirmation,
    requestConfirmation,
    confirmConfirmation,
    cancelConfirmation
  };
}
