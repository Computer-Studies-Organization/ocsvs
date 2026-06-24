import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/lib/toast";
import type { UseMutationResult } from "@tanstack/react-query";
import { extractErrorMessage } from "./mutation-feedback-utils";

interface MutationFeedbackOptions {
  successMessage: string;
  errorMessage?: string;
  onSuccess?: () => void;
  autoCloseMs?: number;
}

export function useMutationWithFeedback<TData, TVariables>(
  mutation: UseMutationResult<TData, Error, TVariables>,
  options: MutationFeedbackOptions,
) {
  const { showToast } = useToast();
  const { mutateAsync } = mutation;
  const { successMessage, errorMessage, autoCloseMs, onSuccess } = options;

  const [isPending, setIsPending] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const mutateWithFeedback = useCallback(
    async (variables: TVariables) => {
      setIsPending(true);
      let success = false;
      try {
        await mutateAsync(variables);
        showToast({ message: successMessage, type: "success" });
        success = true;
      } catch (error: unknown) {
        const fallback = errorMessage ?? "An error occurred";
        showToast({ message: extractErrorMessage(error, fallback), type: "error" });
      } finally {
        setIsPending(false);
      }

      // Call onSuccess outside try/catch so its errors aren't caught as mutation errors
      if (success && onSuccess) {
        if (autoCloseMs) {
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(onSuccess, autoCloseMs);
        } else {
          onSuccess();
        }
      }
    },
    [mutateAsync, successMessage, errorMessage, autoCloseMs, onSuccess, showToast],
  );

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return { mutateWithFeedback, isPending };
}
